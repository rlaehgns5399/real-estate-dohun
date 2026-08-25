import { collectKbPrices } from "@/collectors/kb";
import { collectTransactions } from "@/collectors/molit";
import { APARTMENT_ITEMS } from "@/constants/items";
import { updateListingsSnapshot } from "@/services/snapshot";
import type { ApartmentItem, KbPrice, ListingDiff, Transaction } from "@/types";

const EMPTY_DIFF: ListingDiff = {
  allListings: [],
  newListings: [],
  removedListings: [],
  priceChangedListings: [],
  totalActive: 0,
};

/** 아파트 한 곳의 수집 결과 */
export interface CollectedApartment {
  apt: ApartmentItem;
  transactions: Transaction[];
  diff: ListingDiff;
  kbPrice: KbPrice | null;
}

/**
 * 외부 소스에서 수집해 Supabase에 저장하고 결과를 반환한다.
 *
 * 한 소스가 실패해도 나머지는 계속 진행한다 — 네이버 스크래핑이 막혀도
 * 실거래가/KB 시세는 갱신되는 편이 낫다.
 */
export async function runCollection(): Promise<CollectedApartment[]> {
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

  const results: CollectedApartment[] = [];

  for (const apt of APARTMENT_ITEMS) {
    let diff = EMPTY_DIFF;
    try {
      diff = await updateListingsSnapshot(apt);
    } catch (err) {
      console.error(`[${apt.name}] 네이버 매물 수집 실패:`, err);
    }

    results.push({
      apt,
      transactions: allTransactions.filter((t) => t.apartmentName === apt.name),
      diff,
      kbPrice: kbPrices.find((k) => k.complexNo === apt.kbComplexId) ?? null,
    });
  }

  console.log("=== 수집 완료 ===", new Date().toISOString());
  return results;
}
