import { fetchListings } from "@/collectors/naver";
import { supabase } from "@/db/client";
import type { ApartmentItem, Listing, ListingDiff } from "@/types";

interface DbListingRow {
  id: number;
  article_id: string;
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

async function getActiveListings(naverComplexId: string): Promise<DbListingRow[]> {
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("naver_complex_id", naverComplexId)
    .eq("is_active", true);

  return (data ?? []) as DbListingRow[];
}

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
        first_seen_at: new Date().toISOString(),
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
  await supabase
    .from("listings")
    .update({ last_seen_at: new Date().toISOString() })
    .in("id", ids);
}

async function deactivateListings(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase
    .from("listings")
    .update({ is_active: false, last_seen_at: new Date().toISOString() })
    .in("id", ids);
}

/** 매물 스냅샷을 저장하고 이전 대비 변동사항을 반환 */
export async function updateListingsSnapshot(apt: ApartmentItem): Promise<ListingDiff> {
  const { naverComplexId } = apt;

  const currentListings = await fetchListings(apt);
  const currentArticleIds = new Set(currentListings.map((l) => l.articleId));

  const existingRows = await getActiveListings(naverComplexId);
  const existingArticleIds = new Set(existingRows.map((r) => r.article_id));

  const newListings = currentListings.filter((l) => !existingArticleIds.has(l.articleId));
  const removedRows = existingRows.filter((r) => !currentArticleIds.has(r.article_id));

  await upsertNewListings(naverComplexId, newListings);
  const priceChangedListings = await detectPriceChanges(currentListings, existingRows);

  const stillActiveIds = existingRows
    .filter((r) => currentArticleIds.has(r.article_id))
    .map((r) => r.id);
  await updateActiveTimestamps(stillActiveIds);
  await deactivateListings(removedRows.map((r) => r.id));

  const removedListings = removedRows.map((r) => dbRowToListing(r, naverComplexId));

  console.log(
    `[snapshot] 단지 ${naverComplexId}: 신규 ${newListings.length}건, 삭제 ${removedListings.length}건, 활성 ${currentListings.length}건`,
  );

  return { newListings, removedListings, priceChangedListings, totalActive: currentListings.length };
}
