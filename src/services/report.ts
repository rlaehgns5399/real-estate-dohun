import { collectKbPrices } from "@/collectors/kb";
import { collectTransactions } from "@/collectors/molit";
import { APARTMENT_ITEMS } from "@/constants/items";
import { updateListingsSnapshot } from "@/services/snapshot";
import type { ApartmentItem, AreaTarget, KbPrice, ListingDiff, Transaction } from "@/types";
import { AREA_TOLERANCE } from "@/utils/constants";

const EMPTY_DIFF: ListingDiff = {
  allListings: [],
  newListings: [],
  removedListings: [],
  priceChangedListings: [],
  totalActive: 0,
};

/** 아파트 한 곳 · 면적 하나의 수집 결과 */
export interface CollectedArea {
  apt: ApartmentItem;
  target: AreaTarget;
  transactions: Transaction[];
  /** 이 면적의 매매 매물 변동 */
  diff: ListingDiff;
  kbPrice: KbPrice | null;
}

/** 단지 전체 수집 결과를 면적 하나 분량으로 좁힌다 */
function narrowToArea(diff: ListingDiff, area: number): ListingDiff {
  const inArea = (l: { area: number; tradeType: string }) =>
    l.tradeType === "매매" && Math.abs(l.area - area) <= AREA_TOLERANCE;

  const allListings = diff.allListings.filter(inArea);

  return {
    allListings,
    newListings: diff.newListings.filter(inArea),
    removedListings: diff.removedListings.filter(inArea),
    priceChangedListings: diff.priceChangedListings.filter((c) => inArea(c.listing)),
    totalActive: allListings.length,
  };
}

/**
 * 외부 소스에서 수집해 Supabase에 저장하고 결과를 반환한다.
 *
 * 한 소스가 실패해도 나머지는 계속 진행한다 — 네이버 스크래핑이 막혀도
 * 실거래가/KB 시세는 갱신되는 편이 낫다.
 */
export async function runCollection(): Promise<CollectedArea[]> {
  console.log("=== 수집 시작 ===", new Date().toISOString());

  if (APARTMENT_ITEMS.length === 0) {
    console.error("관심 아파트가 등록되지 않았습니다. src/constants/items.ts를 확인하세요.");
    return [];
  }

  let allTransactions: Transaction[] = [];
  try {
    allTransactions = await collectTransactions();
  } catch (err) {
    console.error("[molit] 실거래가 수집 실패:", err);
  }

  let kbPrices: KbPrice[] = [];
  try {
    kbPrices = await collectKbPrices(APARTMENT_ITEMS);
  } catch (err) {
    console.error("[kb] 시세 수집 실패:", err);
  }

  const results: CollectedArea[] = [];

  for (const apt of APARTMENT_ITEMS) {
    let diff = EMPTY_DIFF;
    try {
      diff = await updateListingsSnapshot(apt);
    } catch (err) {
      console.error(`[${apt.name}] 네이버 매물 수집 실패:`, err);
    }

    for (const target of apt.areas) {
      results.push({
        apt,
        target,
        transactions: allTransactions.filter(
          (t) => t.apartmentName === apt.name && Math.abs(t.area - target.area) <= AREA_TOLERANCE,
        ),
        diff: narrowToArea(diff, target.area),
        kbPrice:
          kbPrices.find((k) => k.complexNo === apt.kbComplexId && k.area === target.area) ?? null,
      });
    }
  }

  console.log("=== 수집 완료 ===", new Date().toISOString());
  return results;
}
