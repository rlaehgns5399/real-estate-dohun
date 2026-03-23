import { fetchListings } from "@/collectors/naver";
import { supabase } from "@/db/client";
import type { ApartmentItem, ListingDiff } from "@/types";

/** 매물 스냅샷을 저장하고 이전 대비 변동사항을 반환 */
export async function updateListingsSnapshot(apt: ApartmentItem): Promise<ListingDiff> {
  const naverComplexId = apt.naverComplexId;

  // 1. 현재 매물 수집 (거래유형 + 면적 필터 적용됨)
  const currentListings = await fetchListings(apt);
  const currentArticleIds = new Set(currentListings.map((l) => l.articleId));

  // 2. DB에서 기존 활성 매물 조회
  const { data: existingRows } = await supabase
    .from("listings")
    .select("*")
    .eq("naver_complex_id", naverComplexId)
    .eq("is_active", true);

  const existing = existingRows ?? [];
  const existingArticleIds = new Set(existing.map((r) => r.article_id as string));

  // 3. 새 매물 찾기 (현재에 있지만 DB에 없는 것)
  const newListings = currentListings.filter((l) => !existingArticleIds.has(l.articleId));

  // 4. 사라진 매물 찾기 (DB에 있지만 현재에 없는 것)
  const removedRows = existing.filter((r) => !currentArticleIds.has(r.article_id as string));

  // 5. 새 매물 DB 삽입 (가격 변동 감지를 위해 이전 가격도 확인)
  for (const l of newListings) {
    await supabase.from("listings").upsert(
      {
        naver_complex_id: naverComplexId,
        article_id: l.articleId,
        trade_type: l.tradeType,
        price: l.price,
        area: l.area,
        floor: l.floor,
        building_name: l.buildingName,
        direction: l.direction,
        description: l.description,
        realtor_name: l.realtorName,
        confirm_date: l.confirmDate,
        is_active: true,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "naver_complex_id,article_id" },
    );
  }

  // 5-1. 기존 매물 가격 변동 감지
  const priceChangedListings: Array<{ listing: typeof currentListings[0]; prevPrice: string }> = [];
  for (const l of currentListings) {
    const existingRow = existing.find((r) => r.article_id === l.articleId);
    if (existingRow && existingRow.price !== l.price) {
      priceChangedListings.push({ listing: l, prevPrice: existingRow.price as string });
      // DB 가격 업데이트
      await supabase
        .from("listings")
        .update({ price: l.price, last_seen_at: new Date().toISOString() })
        .eq("id", existingRow.id);
    }
  }

  // 6. 여전히 존재하는 매물의 last_seen_at 업데이트
  const stillActiveIds = existing
    .filter((r) => currentArticleIds.has(r.article_id as string))
    .map((r) => r.id as number);

  if (stillActiveIds.length > 0) {
    await supabase
      .from("listings")
      .update({ last_seen_at: new Date().toISOString() })
      .in("id", stillActiveIds);
  }

  // 7. 사라진 매물 비활성화
  const removedIds = removedRows.map((r) => r.id as number);
  if (removedIds.length > 0) {
    await supabase
      .from("listings")
      .update({ is_active: false, last_seen_at: new Date().toISOString() })
      .in("id", removedIds);
  }

  const removedListings = removedRows.map((r) => ({
    articleId: r.article_id as string,
    complexNo: naverComplexId,
    articleName: (r.description as string) ?? "",
    tradeType: (r.trade_type as string) ?? "",
    price: r.price as string,
    area: Number(r.area) || 0,
    supplyArea: 0,
    floor: (r.floor as string) ?? "",
    buildingName: (r.building_name as string) ?? "",
    direction: (r.direction as string) ?? "",
    description: (r.description as string) ?? "",
    confirmDate: (r.confirm_date as string) ?? "",
    realtorName: (r.realtor_name as string) ?? "",
    priceChangeState: "SAME",
  }));

  console.log(
    `[snapshot] 단지 ${naverComplexId}: 신규 ${newListings.length}건, 삭제 ${removedListings.length}건, 활성 ${currentListings.length}건`,
  );

  return {
    newListings,
    removedListings,
    priceChangedListings,
    totalActive: currentListings.length,
  };
}
