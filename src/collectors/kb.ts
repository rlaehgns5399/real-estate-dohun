import axios from "axios";
import { supabase } from "@/db/client";
import type { ApartmentItem, KbPrice } from "@/types";
import { AREA_TOLERANCE } from "@/utils/constants";
import { delay } from "@/utils/delay";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://kbland.kr/",
};

interface KbAreaData {
  공급면적: string;
  전용면적: string;
  주택형타입내용: string;
  세대수: number;
  시세제공여부: string;
  매매하한가: number;
  매매상한가: number;
  매매일반거래가: number;
  전세일반거래가: number;
}

/**
 * 같은 관심 면적에 걸리는 KB 레코드들을 하나로 합친다.
 *
 * KB는 주택형 타입별로 행을 나눈다. 예컨대 59㎡는 59.94(A·198세대)와 59.78(B·7세대)로
 * 두 행이 오는데, 네이버는 두 타입을 모두 "59"로 뭉쳐 주기 때문에 매물을 어느 쪽에
 * 배정할 방법이 없다. 그래서 화면도 59㎡ 하나로 보고, KB도 여기서 합친다.
 *
 * 밴드는 양쪽을 다 덮도록 하한의 최소 / 상한의 최대를 쓰고, 대표값인 일반거래가는
 * 세대수로 가중평균한다. 한쪽을 골라 버리면 KB가 타입별 시세를 갈랐을 때 조용히
 * 틀린 값이 들어온다.
 */
function mergeAreas(matches: KbAreaData[]): Omit<KbPrice, "complexNo" | "area" | "baseDate"> {
  const households = matches.reduce((sum, m) => sum + (m.세대수 || 0), 0);

  const weighted = (pick: (m: KbAreaData) => number) => {
    if (households > 0) {
      return Math.round(
        matches.reduce((sum, m) => sum + pick(m) * (m.세대수 || 0), 0) / households,
      );
    }
    return Math.round(matches.reduce((sum, m) => sum + pick(m), 0) / matches.length);
  };

  return {
    dealPriceGeneral: weighted((m) => m.매매일반거래가),
    dealPriceLower: Math.min(...matches.map((m) => m.매매하한가)),
    dealPriceUpper: Math.max(...matches.map((m) => m.매매상한가)),
    jeonseGeneral: weighted((m) => m.전세일반거래가),
  };
}

/** KB부동산 시세 조회 — 관심 면적에 걸리는 주택형을 모두 합쳐서 돌려준다 */
export async function fetchKbPrice(
  apt: ApartmentItem,
  targetArea: number,
): Promise<KbPrice | null> {
  if (!apt.kbComplexId) return null;

  try {
    const { data } = await axios.get("https://api.kbland.kr/land-complex/complex/mpriByType", {
      headers: HEADERS,
      params: {
        단지기본일련번호: apt.kbComplexId,
      },
    });

    const items: KbAreaData[] = data?.dataBody?.data ?? [];

    // 시세를 제공하지 않는 주택형은 0으로 내려와 평균을 끌어내린다.
    const matches = items.filter(
      (item) =>
        Math.abs(parseFloat(item.전용면적) - targetArea) <= AREA_TOLERANCE &&
        item.시세제공여부 === "1" &&
        item.매매일반거래가 > 0,
    );

    if (matches.length === 0) {
      console.warn(`[kb] ${apt.name}: 전용 ${targetArea}㎡ 시세 없음`);
      return null;
    }

    if (matches.length > 1) {
      const detail = matches
        .map((m) => `${m.전용면적}㎡(${m.주택형타입내용}·${m.세대수}세대)`)
        .join(" + ");
      console.log(`[kb] ${apt.name} ${targetArea}㎡: 주택형 ${matches.length}개 병합 — ${detail}`);
    }

    return {
      complexNo: apt.kbComplexId,
      area: targetArea,
      baseDate: new Date().toISOString().slice(0, 10),
      ...mergeAreas(matches),
    };
  } catch (err) {
    console.warn(`[kb] 시세 조회 실패 (${apt.name} ${targetArea}㎡):`, err);
    return null;
  }
}

/** 마이그레이션 전이라 area / jeonse_price_general 칼럼이 없을 때의 안내 */
function isMissingColumn(message: string): boolean {
  return /column .* does not exist|Could not find the .* column/i.test(message);
}

/** KB 시세를 면적별로 DB에 저장 */
export async function collectKbPrices(apartments: ApartmentItem[]): Promise<KbPrice[]> {
  const results: KbPrice[] = [];

  for (const apt of apartments) {
    if (!apt.kbComplexId) continue;

    for (const target of apt.areas) {
      const price = await fetchKbPrice(apt, target.area);
      if (!price) continue;

      const { error } = await supabase.from("kb_prices").insert({
        apartment_name: apt.name,
        area: price.area,
        deal_price_general: price.dealPriceGeneral,
        deal_price_lower: price.dealPriceLower,
        deal_price_upper: price.dealPriceUpper,
        jeonse_price_general: price.jeonseGeneral,
        base_date: price.baseDate,
      });

      if (error) {
        if (isMissingColumn(error.message)) {
          console.error(
            "[kb] kb_prices에 area / jeonse_price_general 칼럼이 없습니다. " +
              "src/db/migrations/001-kb-prices-per-area.sql을 Supabase SQL Editor에서 실행하세요. " +
              "그 전까지 KB 시세는 저장되지 않습니다.",
          );
          return results;
        }
        console.error(`[kb] ${apt.name} ${target.area}㎡ 저장 실패: ${error.message}`);
        continue;
      }

      results.push(price);
      await delay(300);
    }
  }

  console.log(`[kb] 시세 ${results.length}건 수집 완료`);
  return results;
}
