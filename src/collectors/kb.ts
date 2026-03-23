import axios from "axios";
import { supabase } from "@/db/client";
import type { ApartmentItem, KbPrice } from "@/types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://kbland.kr/",
};

interface KbAreaData {
  공급면적: string;
  전용면적: string;
  매매하한가: number;
  매매상한가: number;
  매매일반거래가: number;
}

/** KB부동산 매매 시세 조회 — 면적별 필터 */
export async function fetchKbPrice(apt: ApartmentItem): Promise<KbPrice | null> {
  if (!apt.kbComplexId) return null;

  try {
    const { data } = await axios.get(
      "https://api.kbland.kr/land-complex/complex/mpriByType",
      {
        headers: HEADERS,
        params: {
          단지기본일련번호: apt.kbComplexId,
        },
      },
    );

    const items: KbAreaData[] = data?.dataBody?.data ?? [];

    // targetArea(전용면적) 기준으로 매칭
    const match = items.find(
      (item) => Math.abs(parseFloat(item.전용면적) - apt.targetArea) <= 1,
    );

    if (!match) {
      console.warn(`[kb] ${apt.name}: 전용 ${apt.targetArea}㎡ 시세 없음`);
      return null;
    }

    return {
      complexNo: apt.kbComplexId,
      dealPriceLower: match.매매하한가,
      dealPriceUpper: match.매매상한가,
      baseDate: new Date().toISOString().slice(0, 10),
    };
  } catch (err) {
    console.warn(`[kb] 시세 조회 실패 (${apt.name}):`, err);
    return null;
  }
}

/** KB 시세를 DB에 저장 */
export async function collectKbPrices(apartments: ApartmentItem[]): Promise<KbPrice[]> {
  const results: KbPrice[] = [];

  for (const apt of apartments) {
    if (!apt.kbComplexId) continue;
    const price = await fetchKbPrice(apt);
    if (!price) continue;

    await supabase.from("kb_prices").insert({
      apartment_name: apt.name,
      deal_price_lower: price.dealPriceLower,
      deal_price_upper: price.dealPriceUpper,
      base_date: price.baseDate,
    });

    results.push(price);
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`[kb] 시세 ${results.length}건 수집 완료`);
  return results;
}
