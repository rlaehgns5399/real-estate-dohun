import { collectKbPrices } from "@/collectors/kb";
import { collectTransactions } from "@/collectors/molit";
import { APARTMENT_ITEMS } from "@/constants/items";
import { updateListingsSnapshot } from "@/services/snapshot";
import { sendNotification } from "@/services/telegram";
import type { ListingDiff } from "@/types";
import { delay } from "@/utils/delay";

const EMPTY_DIFF: ListingDiff = {
  allListings: [],
  newListings: [],
  removedListings: [],
  priceChangedListings: [],
  totalActive: 0,
};

/** 전체 수집 + 알림 실행 */
export async function runReport(): Promise<void> {
  console.log("=== 부동산 알림 시작 ===", new Date().toISOString());

  if (APARTMENT_ITEMS.length === 0) {
    console.error("관심 아파트가 등록되지 않았습니다. src/constants/items.ts를 확인하세요.");
    return;
  }

  console.log(`관심 아파트 ${APARTMENT_ITEMS.length}개 등록됨`);

  let allTransactions: Awaited<ReturnType<typeof collectTransactions>> = [];
  try {
    allTransactions = await collectTransactions();
  } catch (err) {
    console.error("[molit] 실거래가 수집 실패:", err);
  }

  let kbPrices: Awaited<ReturnType<typeof collectKbPrices>> = [];
  try {
    kbPrices = await collectKbPrices(APARTMENT_ITEMS);
  } catch (err) {
    console.error("[kb] 시세 수집 실패:", err);
  }

  for (const apt of APARTMENT_ITEMS) {
    const aptTransactions = allTransactions.filter((t) => t.apartmentName === apt.name);
    const kbPrice = kbPrices.find((k) => k.complexNo === apt.kbComplexId) ?? null;

    let diff = EMPTY_DIFF;
    try {
      diff = await updateListingsSnapshot(apt);
    } catch (err) {
      console.error(`[${apt.name}] 네이버 매물 수집 실패:`, err);
    }

    try {
      await sendNotification(apt.name, apt.targetArea, aptTransactions, diff, kbPrice);
    } catch (err) {
      console.error(`[${apt.name}] 알림 발송 실패:`, err);
    }

    await delay(1000);
  }

  console.log("=== 부동산 알림 완료 ===", new Date().toISOString());
}
