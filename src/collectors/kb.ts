import axios from "axios";
import { supabase } from "@/db/client";
import type { ApartmentItem, KbPrice } from "@/types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://kbland.kr/",
};

interface KbComplexPrice {
  dealPrcMin?: number;
  dealPrcMax?: number;
  leasePrcMin?: number;
  leasePrcMax?: number;
  baseDate?: string;
}

/** KB부동산 시세 조회 (비공식 API) */
export async function fetchKbPrice(complexNo: string): Promise<KbPrice | null> {
  try {
    const { data } = await axios.get(`https://data-api.kbland.kr/bfmstat/complex/price`, {
      headers: HEADERS,
      params: {
        complexNo,
        type: "deal",
      },
    });

    const info: KbComplexPrice | undefined = data?.data;
    if (!info) return null;

    return {
      complexNo,
      dealPriceLower: info.dealPrcMin ?? 0,
      dealPriceUpper: info.dealPrcMax ?? 0,
      leasePriceLower: info.leasePrcMin ?? 0,
      leasePriceUpper: info.leasePrcMax ?? 0,
      baseDate: info.baseDate ?? new Date().toISOString().slice(0, 10),
    };
  } catch (err) {
    console.warn(`[kb] 시세 조회 실패 (complexNo: ${complexNo}):`, err);
    return null;
  }
}

/** KB 시세를 DB에 저장 */
export async function collectKbPrices(apartments: ApartmentItem[]): Promise<KbPrice[]> {
  const results: KbPrice[] = [];

  for (const apt of apartments) {
    if (!apt.kbComplexId) continue;
    const price = await fetchKbPrice(apt.kbComplexId);
    if (!price) continue;

    await supabase.from("kb_prices").insert({
      apartment_name: apt.name,
      deal_price_lower: price.dealPriceLower,
      deal_price_upper: price.dealPriceUpper,
      lease_price_lower: price.leasePriceLower,
      lease_price_upper: price.leasePriceUpper,
      base_date: price.baseDate,
    });

    results.push(price);
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`[kb] 시세 ${results.length}건 수집 완료`);
  return results;
}
