import "dotenv/config";
import { fetchKbHistory } from "@/collectors/kb";
import { APARTMENT_ITEMS } from "@/constants/items";
import { supabase } from "@/db/client";
import type { KbPrice } from "@/types";

/**
 * KB 과거 시세를 채운다 (`pnpm backfill:kb`).
 *
 * 매 실행 수집(runCollection)은 KB가 주는 "지금" 값만 넣는다. 그래서 곡선이 우리가
 * 수집을 시작한 날부터만 생기고, 관심 면적을 나중에 추가하면 그 면적만 짧게 잘린다.
 * KB는 같은 값을 월별로 들고 있으므로 한 번 받아 두면 관측 이전 구간이 메워진다.
 *
 * 결과가 거의 바뀌지 않으므로 수집 파이프라인과 분리했다. 면적을 새로 추가했을 때
 * 한 번 돌려 주면 된다.
 */

/** 이미 들어 있는 (면적, 기준일) 조합 — 같은 날짜를 두 번 넣지 않는다 */
async function existingKeys(apartmentName: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("kb_prices")
    .select("area, base_date")
    .eq("apartment_name", apartmentName);

  if (error) throw new Error(`[kb] 기존 시세 조회 실패: ${error.message}`);

  return new Set(
    ((data ?? []) as Array<{ area: number; base_date: string }>).map(
      (r) => `${Number(r.area)}|${r.base_date}`,
    ),
  );
}

async function save(apartmentName: string, prices: KbPrice[]): Promise<void> {
  if (prices.length === 0) return;

  const { error } = await supabase.from("kb_prices").insert(
    prices.map((p) => ({
      apartment_name: apartmentName,
      area: p.area,
      deal_price_general: p.dealPriceGeneral,
      deal_price_lower: p.dealPriceLower,
      deal_price_upper: p.dealPriceUpper,
      jeonse_price_general: p.jeonseGeneral,
      base_date: p.baseDate,
    })),
  );

  if (error) throw new Error(`[kb] 과거 시세 저장 실패: ${error.message}`);
}

async function main() {
  const targets = APARTMENT_ITEMS.filter((a) => a.kbComplexId);
  if (targets.length === 0) {
    console.log("[kb] kbComplexId가 설정된 단지가 없습니다.");
    return;
  }

  for (const apt of targets) {
    const seen = await existingKeys(apt.name);

    for (const target of apt.areas) {
      const history = await fetchKbHistory(apt, target.area);
      const fresh = history.filter((p) => !seen.has(`${p.area}|${p.baseDate}`));
      await save(apt.name, fresh);

      const span =
        history.length > 0 ? `${history[0].baseDate} ~ ${history.at(-1)?.baseDate}` : "없음";
      console.log(
        `[KB 시세 백필] ${apt.name} ${target.area}㎡ ${span}: ` +
          `${history.length}개월 중 ${fresh.length}개 신규 저장`,
      );
    }
  }
}

main().catch((err) => {
  console.error("치명적 오류:", err);
  process.exit(1);
});
