import "dotenv/config";
import { collectKbPrices } from "@/collectors/kb";
import { collectTransactions } from "@/collectors/molit";
import { APARTMENT_ITEMS } from "@/constants/items";
import { updateListingsSnapshot } from "@/services/snapshot";
import { sendNotification } from "@/services/telegram";

async function main() {
  console.log("=== 부동산 알림 시작 ===", new Date().toISOString());

  if (APARTMENT_ITEMS.length === 0) {
    console.error("관심 아파트가 등록되지 않았습니다. src/constants/items.ts를 확인하세요.");
    process.exit(1);
  }

  console.log(`관심 아파트 ${APARTMENT_ITEMS.length}개 등록됨`);

  // 1. 실거래가 수집 (국토교통부)
  let allTransactions: Awaited<ReturnType<typeof collectTransactions>> = [];
  try {
    allTransactions = await collectTransactions();
  } catch (err) {
    console.error("[molit] 실거래가 수집 실패:", err);
  }

  // 2. KB 시세 수집
  let kbPrices: Awaited<ReturnType<typeof collectKbPrices>> = [];
  try {
    kbPrices = await collectKbPrices(APARTMENT_ITEMS);
  } catch (err) {
    console.error("[kb] 시세 수집 실패:", err);
  }

  // 3. 각 아파트별 매물 스냅샷 + 알림
  for (const apt of APARTMENT_ITEMS) {
    const aptTransactions = allTransactions.filter((t) => t.apartmentName === apt.name);
    const kbPrice = kbPrices.find((k) => k.complexNo === apt.kbComplexId) ?? null;

    let diff: import("@/types").ListingDiff = {
      newListings: [],
      removedListings: [],
      totalActive: 0,
    };

    try {
      diff = await updateListingsSnapshot(apt);
    } catch (err) {
      console.error(`[${apt.name}] 네이버 매물 수집 실패:`, err);
    }

    try {
      await sendNotification(apt.name, aptTransactions, diff, kbPrice);
    } catch (err) {
      console.error(`[${apt.name}] 알림 발송 실패:`, err);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("=== 부동산 알림 완료 ===", new Date().toISOString());
}

main().catch((err) => {
  console.error("치명적 오류:", err);
  process.exit(1);
});
