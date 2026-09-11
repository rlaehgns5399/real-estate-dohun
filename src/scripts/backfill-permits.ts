import "dotenv/config";
import { APARTMENT_ITEMS } from "@/constants/items";
import { collectPermits } from "@/services/land-permit";

/**
 * 토지거래허가 과거 이력을 채운다 (`pnpm backfill:permits [시작일]`).
 *
 * 매 실행 수집(runCollection)은 최근 62일만 본다. 원본 조회의 62일 제한은 "한 번에 볼
 * 수 있는 폭"이지 "보관 기간"이 아니라서, 창을 쪼개면 과거도 읽힌다. 이 스크립트가
 * 그 일을 한다. 오래 걸리고 결과가 거의 바뀌지 않으므로 수집 파이프라인과 분리했다.
 *
 * 기본 시작일은 2025-10-20 — 서울 전역이 토지거래허가구역으로 지정된 날이다
 * (국토교통부 공고 제2025-1219호). 그 이전에도 자료는 남아 있지만 강동구가 허가구역이
 * 아니었던 기간이라 건수가 미미하다. 더 거슬러 올라가려면 인자로 날짜를 넘기면 된다.
 */
const DEFAULT_FROM = "2025-10-20";

async function main() {
  const fromArg = process.argv[2] ?? DEFAULT_FROM;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromArg)) {
    throw new Error(`시작일 형식이 잘못됐습니다: ${fromArg} (예: 2025-10-20)`);
  }

  const from = new Date(`${fromArg}T00:00:00Z`);
  const to = new Date();
  const targets = APARTMENT_ITEMS.filter((a) => a.permitParcel);

  if (targets.length === 0) {
    console.log("[permit] permitParcel이 설정된 단지가 없습니다. src/constants/items.ts 확인.");
    return;
  }

  console.log(`=== 토지거래허가 백필 ${fromArg} ~ 오늘 (단지 ${targets.length}개) ===`);
  for (const apt of targets) {
    await collectPermits(apt, from, to, true);
  }
  console.log("=== 백필 완료 ===");
}

main().catch((err) => {
  console.error("치명적 오류:", err);
  process.exit(1);
});
