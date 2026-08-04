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
  aptDong: string;
}

function parseItem(item: MolitApiItem, regionCode: string): Transaction {
  const price = parseInt(String(item.dealAmount).replace(/,/g, "").trim(), 10);
  const month = String(item.dealMonth).trim().padStart(2, "0");
  const day = String(item.dealDay).trim().padStart(2, "0");

  return {
    apartmentName: String(item.aptNm).trim(),
    price,
    area: parseFloat(String(item.excluUseAr)),
    floor: parseInt(String(item.floor), 10),
    dong: String(item.aptDong ?? "").trim(),
    dealDate: `${item.dealYear}-${month}-${day}`,
    buildYear: parseInt(String(item.buildYear), 10),
    roadAddress: `${String(item.roadNm ?? "")} ${String(item.roadNmBonbun ?? "")}`.trim(),
    regionCode,
  };
}

interface MolitBody {
  totalCount?: number;
  items?: { item?: MolitApiItem | MolitApiItem[] } | string;
}

interface MolitEnvelope {
  header?: { resultCode?: string; resultMsg?: string };
  body?: MolitBody;
  /** 일부 data.go.kr 서비스는 response로 한 번 더 감싼다 (이 API는 아님). */
  response?: { header?: { resultCode?: string; resultMsg?: string }; body?: MolitBody };
}

/** data.go.kr 게이트웨이 수준 오류(인증/연계 실패)를 감지해 메시지로 반환 */
function findGatewayError(data: unknown): string | null {
  // 게이트웨이 오류는 XML(문자열) 또는 OpenAPI_ServiceResponse JSON으로 내려온다.
  if (typeof data === "string") {
    const errMsg = data.match(/<errMsg>([^<]*)<\/errMsg>/)?.[1];
    const reason = data.match(/<returnReasonCode>([^<]*)<\/returnReasonCode>/)?.[1];
    if (errMsg) return `${errMsg}${reason ? ` (코드 ${reason})` : ""}`;
    return null;
  }

  const header = (data as { OpenAPI_ServiceResponse?: { cmmMsgHeader?: Record<string, string> } })
    ?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (header?.errMsg) {
    return `${header.errMsg}${header.returnReasonCode ? ` (코드 ${header.returnReasonCode})` : ""}`;
  }

  // 정상 응답은 { header, body } 형태이며 일부 서비스는 { response: { header, body } }로 감싼다.
  const d = data as MolitEnvelope;
  const result = d?.header ?? d?.response?.header;
  if (result?.resultCode && result.resultCode !== "00" && result.resultCode !== "000") {
    return `${result.resultMsg ?? "알 수 없는 오류"} (코드 ${result.resultCode})`;
  }

  return null;
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

  const gatewayError = findGatewayError(data);
  if (gatewayError) {
    throw new Error(`[molit] ${regionCode} ${dealYearMonth} API 오류: ${gatewayError}`);
  }

  // JSON을 요청했는데 XML(문자열)이 오면 파싱이 조용히 실패하므로 명시적으로 알린다.
  if (typeof data === "string") {
    throw new Error(
      `[molit] ${regionCode} ${dealYearMonth}: JSON을 요청했으나 XML 응답을 받았습니다. ` +
        "API가 type=json을 지원하지 않는 것으로 보이며 XML 파서가 필요합니다.",
    );
  }

  // 이 API는 { header, body }로 바로 내려온다. response 래퍼는 없다.
  const envelope = data as MolitEnvelope;
  const body = envelope?.body ?? envelope?.response?.body;
  if (!body) {
    throw new Error(
      `[molit] ${regionCode} ${dealYearMonth}: 예상치 못한 응답 형식 — ${JSON.stringify(data).slice(0, 300)}`,
    );
  }

  // 거래가 없는 달에는 items가 빈 문자열("")로 내려오기도 한다.
  const container = body.items;
  if (!container || typeof container === "string") return [];

  const items = container.item;
  if (!items) return []; // 해당 월에 거래가 없는 정상 케이스

  const list = Array.isArray(items) ? items : [items];
  return list.map((item: MolitApiItem) => parseItem(item, regionCode));
}

import { AREA_TOLERANCE } from "@/utils/constants";

/** 최근 N개월치 YYYYMM 목록 생성 */
function getRecentMonths(count: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

/** 관심 아파트의 실거래가만 필터링하여 DB에 저장 (최근 3개월) */
export async function collectTransactions(): Promise<Transaction[]> {
  const months = getRecentMonths(3);

  // 관심 아파트들의 regionCode 목록 (중복 제거)
  const regionCodes = [...new Set(APARTMENT_ITEMS.map((a) => a.regionCode))];

  const allTransactions: Transaction[] = [];

  for (const regionCode of regionCodes) {
    for (const dealYm of months) {
      const all = await fetchTransactions(regionCode, dealYm);

      // 관심 아파트별로 이름 + 전용면적 필터
      const filtered = all.filter((t) =>
        APARTMENT_ITEMS.some(
          (a) =>
            a.name === t.apartmentName &&
            a.regionCode === regionCode &&
            Math.abs(t.area - a.targetArea) <= AREA_TOLERANCE,
        ),
      );

      for (const t of filtered) {
        await supabase.from("transactions").upsert(
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

        allTransactions.push(t);
      }

      console.log(
        `[molit] ${regionCode} ${dealYm}: 전체 ${all.length}건 중 관심 아파트 ${filtered.length}건`,
      );
    }
  }

  // 날짜순 정렬 (최신 먼저)
  allTransactions.sort((a, b) => b.dealDate.localeCompare(a.dealDate));
  return allTransactions;
}
