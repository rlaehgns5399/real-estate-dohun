import { collectKbPrices } from "@/collectors/kb";
import { collectTransactions } from "@/collectors/molit";
import { APARTMENT_ITEMS } from "@/constants/items";
import { updateListingsSnapshot } from "@/services/snapshot";
import type { ApartmentItem, AreaTarget, KbPrice, ListingDiff, Transaction } from "@/types";
import { AREA_TOLERANCE } from "@/utils/constants";

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
 * 한 소스라도 실패하면 던져서 실행 전체를 멈춘다. 페이지 상단에 갱신 시각이 찍히기
 * 때문에, 일부만 성공한 채로 발행하면 "방금 갱신"이라고 써 놓고 실거래가는 어제 것을
 * 보여주게 된다. 직전 데이터를 그대로 두는 편이 정직하다.
 *
 * 실패와 "정상적인 빈 결과"는 다르다. 거래가 없는 달, KB가 시세를 안 주는 면적,
 * 매물이 없는 단지는 전부 정상이고 각 수집기가 빈 값으로 돌려준다. 여기서 멈추는 건
 * 수집기가 던진 경우, 즉 조회 자체가 실패한 경우뿐이다.
 */
export async function runCollection(): Promise<CollectedArea[]> {
  console.log("=== 수집 시작 ===", new Date().toISOString());

  if (APARTMENT_ITEMS.length === 0) {
    console.error("관심 아파트가 등록되지 않았습니다. src/constants/items.ts를 확인하세요.");
    return [];
  }

  const allTransactions = await collectTransactions();
  const kbPrices = await collectKbPrices(APARTMENT_ITEMS);

  const results: CollectedArea[] = [];

  for (const apt of APARTMENT_ITEMS) {
    const diff = await updateListingsSnapshot(apt);

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
