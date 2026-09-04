import { fetchListings } from "@/collectors/naver";
import { supabase } from "@/db/client";
import type { ApartmentItem, Listing, ListingDiff } from "@/types";
import { AREA_TOLERANCE } from "@/utils/constants";
import { parsePriceText } from "@/utils/format";

interface DbListingRow {
  id: number;
  article_id: string;
  is_active: boolean;
  trade_type: string;
  price: string;
  area: number;
  floor: string;
  building_name: string;
  direction: string;
  description: string;
  realtor_name: string;
  confirm_date: string;
}

function dbRowToListing(row: DbListingRow, complexNo: string): Listing {
  return {
    articleId: row.article_id,
    complexNo,
    articleName: row.description ?? "",
    tradeType: row.trade_type ?? "",
    price: row.price,
    area: Number(row.area) || 0,
    supplyArea: 0,
    floor: row.floor ?? "",
    buildingName: row.building_name ?? "",
    direction: row.direction ?? "",
    description: row.description ?? "",
    confirmDate: row.confirm_date ?? "",
    realtorName: row.realtor_name ?? "",
    priceChangeState: "SAME",
  };
}

/**
 * 이 단지에서 한 번이라도 본 매물 전부. 비활성 매물까지 가져온다.
 *
 * 활성 매물만 보면, 수집이 한 번 비어 통째로 꺼졌던 매물이 다음 실행에서 전부
 * "신규"로 잡히고 first_seen_at이 리셋된다. 이미 아는 article_id인지가 기준이어야 한다.
 */
async function getKnownListings(naverComplexId: string): Promise<DbListingRow[]> {
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("naver_complex_id", naverComplexId);

  return (data ?? []) as DbListingRow[];
}

/**
 * 처음 보는 매물을 넣는다.
 *
 * first_seen_at은 일부러 보내지 않는다. 스키마 기본값(NOW())이 새 행을 채우고,
 * 충돌한 행은 값을 유지한다. 여기서 매번 실어 보내면 같은 매물이 다시 들어올 때마다
 * 처음 본 시각이 오늘로 밀려 daysOnMarket과 신규 카운트가 같이 무너진다.
 */
async function upsertNewListings(naverComplexId: string, listings: Listing[]): Promise<void> {
  for (const l of listings) {
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
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "naver_complex_id,article_id" },
    );
  }
}

async function detectPriceChanges(
  currentListings: Listing[],
  existingRows: DbListingRow[],
): Promise<Array<{ listing: Listing; prevPrice: string }>> {
  const changed: Array<{ listing: Listing; prevPrice: string }> = [];

  for (const l of currentListings) {
    const row = existingRows.find((r) => r.article_id === l.articleId);
    if (row && row.price !== l.price) {
      changed.push({ listing: l, prevPrice: row.price });
      await supabase
        .from("listings")
        .update({ price: l.price, last_seen_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  }

  return changed;
}

async function updateActiveTimestamps(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase.from("listings").update({ last_seen_at: new Date().toISOString() }).in("id", ids);
}

/** 내려간 줄 알았던 매물이 다시 보일 때 되살린다. first_seen_at은 그대로 둔다. */
async function reactivateListings(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase
    .from("listings")
    .update({ is_active: true, last_seen_at: new Date().toISOString() })
    .in("id", ids);
}

async function deactivateListings(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase
    .from("listings")
    .update({ is_active: false, last_seen_at: new Date().toISOString() })
    .in("id", ids);
}

/**
 * 이 시점의 실제 매매 호가 범위를 면적별로 기록한다.
 *
 * listings는 가격이 바뀌면 행을 덮어쓰므로 과거 호가를 되살릴 수 없다.
 * 매 실행마다 관측한 값을 그대로 남겨야 차트가 추론 없이 과거를 그릴 수 있다.
 *
 * ask_snapshots에는 거래 유형 칼럼이 없어 매매만 남긴다. 전월세 매물은 listings에
 * 그대로 쌓이므로 현재 시점의 전세가율은 거기서 계산한다.
 */
async function recordAskSnapshot(apt: ApartmentItem, listings: Listing[]): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  for (const target of apt.areas) {
    const prices = listings
      .filter((l) => l.tradeType === "매매" && Math.abs(l.area - target.area) <= AREA_TOLERANCE)
      .map((l) => parsePriceText(l.price))
      .filter((p) => p > 0)
      .sort((a, b) => a - b);

    if (prices.length === 0) continue;

    const { error } = await supabase.from("ask_snapshots").upsert(
      {
        naver_complex_id: apt.naverComplexId,
        area: target.area,
        snapshot_date: today,
        low: prices[0],
        median: prices[Math.floor(prices.length / 2)],
        high: prices[prices.length - 1],
        listing_count: prices.length,
      },
      { onConflict: "naver_complex_id,area,snapshot_date" },
    );

    if (error) {
      console.error(
        `[snapshot] ${target.area}㎡ 호가 범위 기록 실패 (ask_snapshots 테이블 확인): ${error.message}`,
      );
    }
  }
}

/**
 * 매물 스냅샷을 저장하고 이전 대비 변동사항을 반환.
 *
 * 쓰기는 전부 아래쪽에 몰아둔다. 수집 결과가 미덥지 않으면 DB를 건드리기 전에 던져서,
 * 실패한 실행이 남긴 흔적이 없게 한다.
 */
export async function updateListingsSnapshot(apt: ApartmentItem): Promise<ListingDiff> {
  const { naverComplexId } = apt;

  const currentListings = await fetchListings(apt);
  const currentArticleIds = new Set(currentListings.map((l) => l.articleId));

  const knownRows = await getKnownListings(naverComplexId);
  const activeRows = knownRows.filter((r) => r.is_active);

  // 활성 매물이 있었는데 이번에 한 건도 못 봤다면 수집이 막힌 것이다. 관심 면적의 매물이
  // 하루아침에 전멸하는 일은 없다. 여기서 진행하면 활성 매물이 통째로 꺼지고 이력이 날아간다.
  if (currentListings.length === 0 && activeRows.length > 0) {
    throw new Error(
      `[snapshot] 단지 ${naverComplexId}: 활성 매물 ${activeRows.length}건이 있는데 수집 결과가 0건입니다. ` +
        "매물이 내려간 게 아니라 수집이 막힌 것으로 보고 DB를 건드리지 않습니다.",
    );
  }

  // 신규 판정은 비활성 매물까지 포함해서 본다. 되살아난 매물은 신규가 아니다.
  const knownArticleIds = new Set(knownRows.map((r) => r.article_id));
  const newListings = currentListings.filter((l) => !knownArticleIds.has(l.articleId));
  const revivedRows = knownRows.filter((r) => !r.is_active && currentArticleIds.has(r.article_id));
  const removedRows = activeRows.filter((r) => !currentArticleIds.has(r.article_id));

  await upsertNewListings(naverComplexId, newListings);
  await reactivateListings(revivedRows.map((r) => r.id));
  const priceChangedListings = await detectPriceChanges(currentListings, knownRows);

  const stillActiveIds = activeRows
    .filter((r) => currentArticleIds.has(r.article_id))
    .map((r) => r.id);
  await updateActiveTimestamps(stillActiveIds);
  await deactivateListings(removedRows.map((r) => r.id));

  await recordAskSnapshot(apt, currentListings);

  const removedListings = removedRows.map((r) => dbRowToListing(r, naverComplexId));

  console.log(
    `[snapshot] 단지 ${naverComplexId}: 신규 ${newListings.length}건, 재등장 ${revivedRows.length}건, 삭제 ${removedListings.length}건, 활성 ${currentListings.length}건`,
  );

  return {
    allListings: currentListings,
    newListings,
    removedListings,
    priceChangedListings,
    totalActive: currentListings.length,
  };
}
