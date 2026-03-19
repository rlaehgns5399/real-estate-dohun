import axios from "axios";
import { env } from "@/config/env";
import { APARTMENT_ITEMS } from "@/constants/items";
import { supabase } from "@/db/client";
import type { Transaction } from "@/types";

const BASE_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";

interface MolitApiItem {
  aptNm: string;
  dealAmount: string;
  excluUseAr: string;
  floor: string;
  dealYear: string;
  dealMonth: string;
  dealDay: string;
  buildYear: string;
  roadNm: string;
  roadNmBonbun: string;
}

function parseItem(item: MolitApiItem, regionCode: string): Transaction {
  const price = parseInt(item.dealAmount.replace(/,/g, "").trim(), 10);
  const month = item.dealMonth.trim().padStart(2, "0");
  const day = item.dealDay.trim().padStart(2, "0");

  return {
    apartmentName: item.aptNm.trim(),
    price,
    area: parseFloat(item.excluUseAr),
    floor: parseInt(item.floor, 10),
    dealDate: `${item.dealYear}-${month}-${day}`,
    buildYear: parseInt(item.buildYear, 10),
    roadAddress: `${item.roadNm} ${item.roadNmBonbun}`.trim(),
    regionCode,
  };
}

/** 특정 지역의 해당 월 아파트 실거래가를 조회 */
export async function fetchTransactions(
  regionCode: string,
  dealYearMonth: string, // YYYYMM
): Promise<Transaction[]> {
  const { data } = await axios.get(BASE_URL, {
    params: {
      serviceKey: env.molit.apiKey,
      LAWD_CD: regionCode,
      DEAL_YMD: dealYearMonth,
      pageNo: 1,
      numOfRows: 1000,
      type: "json",
    },
  });

  const items = data?.response?.body?.items?.item;
  if (!items) return [];

  const list = Array.isArray(items) ? items : [items];
  return list.map((item: MolitApiItem) => parseItem(item, regionCode));
}

/** 관심 아파트의 실거래가만 필터링하여 DB에 저장 */
export async function collectTransactions(): Promise<Transaction[]> {
  const now = new Date();
  const dealYm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 관심 아파트들의 regionCode 목록 (중복 제거)
  const regionCodes = [...new Set(APARTMENT_ITEMS.map((a) => a.regionCode))];
  const aptNames = new Set(APARTMENT_ITEMS.map((a) => a.name));

  const newTransactions: Transaction[] = [];

  for (const regionCode of regionCodes) {
    const all = await fetchTransactions(regionCode, dealYm);
    const filtered = all.filter((t) => aptNames.has(t.apartmentName));

    for (const t of filtered) {
      const { error } = await supabase.from("transactions").upsert(
        {
          apartment_name: t.apartmentName,
          region_code: t.regionCode,
          deal_date: t.dealDate,
          price: t.price,
          area: t.area,
          floor: t.floor,
          build_year: t.buildYear,
          road_address: t.roadAddress,
        },
        { onConflict: "apartment_name,deal_date,price,area,floor" },
      );

      if (!error) newTransactions.push(t);
    }

    console.log(
      `[molit] ${regionCode} ${dealYm}: 전체 ${all.length}건 중 관심 아파트 ${filtered.length}건`,
    );
  }

  return newTransactions;
}
