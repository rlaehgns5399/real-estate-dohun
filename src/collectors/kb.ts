import axios from "axios";
import { supabase } from "@/db/client";
import type { ApartmentItem, KbPrice } from "@/types";
import { AREA_TOLERANCE } from "@/utils/constants";
import { delay } from "@/utils/delay";
import { formatMan } from "@/utils/format";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://kbland.kr/",
};

interface KbAreaData {
  공급면적: string;
  전용면적: string;
  /** 주택형 식별자. 과거 시세 조회(WholQuotList)에 필요하다. */
  면적일련번호: number;
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

/**
 * KB부동산 시세 조회 — 관심 면적에 걸리는 주택형을 모두 합쳐서 돌려준다.
 *
 * null은 "KB가 이 면적 시세를 제공하지 않는다"는 뜻이고, 그건 정상이다. 조회 자체가
 * 실패하면 던진다. 예전에는 둘을 모두 null로 뭉개서, KB가 응답 형식을 바꿔도 매일
 * 조용히 "시세 없음"으로 넘어가고 아무도 모르는 상태가 될 수 있었다.
 */
export async function fetchKbPrice(
  apt: ApartmentItem,
  targetArea: number,
): Promise<KbPrice | null> {
  if (!apt.kbComplexId) return null;

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

  // 면적별로 항상 한 줄 남긴다. 병합될 때만 찍으면 병합이 없는 면적은
  // 조사에서 빠진 것처럼 보인다.
  const merged = mergeAreas(matches);
  const detail = matches
    .map((m) => `${m.전용면적}㎡(${m.주택형타입내용}·${m.세대수}세대)`)
    .join(" + ");
  const typeInfo = matches.length > 1 ? `주택형 ${matches.length}개 병합: ${detail}` : detail;
  console.log(
    `[kb] ${apt.name} ${targetArea}㎡: 매매 ${formatMan(merged.dealPriceGeneral)} · ` +
      `전세 ${formatMan(merged.jeonseGeneral)} — ${typeInfo}`,
  );

  return {
    complexNo: apt.kbComplexId,
    area: targetArea,
    baseDate: new Date().toISOString().slice(0, 10),
    ...merged,
  };
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
          throw new Error(
            "[kb] kb_prices에 area / jeonse_price_general 칼럼이 없습니다. " +
              "src/db/migrations/001-kb-prices-per-area.sql을 Supabase SQL Editor에서 실행하세요.",
          );
        }
        throw new Error(`[kb] ${apt.name} ${target.area}㎡ 저장 실패: ${error.message}`);
      }

      results.push(price);
      await delay(300);
    }
  }

  console.log(`[kb] 시세 ${results.length}건 수집 완료`);
  return results;
}

/* ── 과거 시세 ─────────────────────────────────────────────────────────────── */

/**
 * KB가 월 단위로 보관하는 과거 시세.
 *
 * mpriByType은 "지금" 값만 준다. 그래서 우리가 수집을 시작한 날부터만 곡선이 생기고,
 * 관심 면적을 나중에 추가하면 그 면적만 그래프가 짧게 잘린다. KB는 같은 값을 월별로
 * 들고 있으므로 한 번 받아 두면 관측 이전 구간이 메워진다.
 *
 * 신축은 KB가 시세를 매기기 시작한 달부터만 나온다 — 그 이전은 KB에도 없다.
 */
interface KbMonthlyQuote {
  기준년월: string;
  매매일반거래가: number;
  매매하한가: number;
  매매상한가: number;
  전세일반거래가: number;
}

/** 시세가 존재하는 연도 목록 */
async function fetchQuoteYears(complexNo: string, areaSeq: number): Promise<string[]> {
  const { data } = await axios.get("https://api.kbland.kr/land-price/price/QuotBaseYear", {
    headers: HEADERS,
    params: { 단지기본일련번호: complexNo, 면적일련번호: areaSeq },
  });
  return ((data?.dataBody?.data ?? []) as Array<{ 기준년: string }>).map((y) => y.기준년);
}

/** 한 주택형의 월별 시세 전체 */
async function fetchMonthlyQuotes(complexNo: string, areaSeq: number): Promise<KbMonthlyQuote[]> {
  const years = await fetchQuoteYears(complexNo, areaSeq);
  const out: KbMonthlyQuote[] = [];

  for (const year of years) {
    const { data } = await axios.get("https://api.kbland.kr/land-price/price/WholQuotList", {
      headers: HEADERS,
      params: { 단지기본일련번호: complexNo, 면적일련번호: areaSeq, 기준년: year },
    });

    const groups = (data?.dataBody?.data?.시세 ?? []) as Array<{ items?: KbMonthlyQuote[] }>;
    for (const g of groups) out.push(...(g.items ?? []));
    await delay(300);
  }

  return out;
}

/**
 * 관심 면적 하나의 과거 시세를 월별로 돌려준다.
 *
 * 주택형이 여러 개면(59㎡ = 59.94 A + 59.78 B) 같은 달끼리 합친다. 합치는 방식은
 * 현재 시세와 똑같이 세대수 가중평균이라, 과거와 현재가 같은 기준으로 이어진다.
 */
export async function fetchKbHistory(apt: ApartmentItem, targetArea: number): Promise<KbPrice[]> {
  if (!apt.kbComplexId) return [];

  const { data } = await axios.get("https://api.kbland.kr/land-complex/complex/mpriByType", {
    headers: HEADERS,
    params: { 단지기본일련번호: apt.kbComplexId },
  });

  const types = ((data?.dataBody?.data ?? []) as KbAreaData[]).filter(
    (item) =>
      Math.abs(Number.parseFloat(item.전용면적) - targetArea) <= AREA_TOLERANCE &&
      item.시세제공여부 === "1",
  );

  if (types.length === 0) {
    console.warn(`[kb] ${apt.name}: 전용 ${targetArea}㎡ 시세 없음`);
    return [];
  }

  // 달 → 그 달의 주택형별 값. 합칠 때 세대수가 필요하므로 주택형 정보를 함께 들고 간다.
  const byMonth = new Map<string, KbAreaData[]>();
  for (const type of types) {
    const quotes = await fetchMonthlyQuotes(apt.kbComplexId, type.면적일련번호);
    for (const q of quotes) {
      const bucket = byMonth.get(q.기준년월) ?? [];
      bucket.push({ ...type, ...q });
      byMonth.set(q.기준년월, bucket);
    }
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, rows]) => ({
      complexNo: apt.kbComplexId as string,
      area: targetArea,
      // 월별 값이라 그 달의 1일로 둔다. 일별 관측과 같은 축에 놓여야 한 곡선이 된다.
      baseDate: `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`,
      ...mergeAreas(rows),
    }));
}
