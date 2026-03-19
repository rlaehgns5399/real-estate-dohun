import { fetchListings } from "@/collectors/naver";
import { supabase } from "@/db/client";
import type { ListingDiff } from "@/types";

/** 매물 스냅샷을 저장하고 이전 대비 변동사항을 반환 */
export async function updateListingsSnapshot(naverComplexId: string): Promise<ListingDiff> {
  // 1. 현재 매물 수집
  const currentListings = await fetchListings(naverComplexId);
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

  // 5. 새 매물 DB 삽입
  for (const l of newListings) {
    await supabase.from("listings").upsert(
      {
        naver_complex_id: naverComplexId,
        article_id: l.articleId,
        trade_type: l.tradeType,
        price: l.price,
        area: l.area,
        floor: l.floor,
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
    articleName: (r.description as string) ?? "",
    price: r.price as string,
    lastSeenAt: r.last_seen_at as string,
  }));

  console.log(
    `[snapshot] 단지 ${naverComplexId}: 신규 ${newListings.length}건, 삭제 ${removedListings.length}건, 활성 ${currentListings.length}건`,
  );

  return {
    newListings,
    removedListings,
    totalActive: currentListings.length,
  };
}
