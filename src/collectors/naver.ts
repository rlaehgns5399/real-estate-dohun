import axios from "axios";
import type { ApartmentItem, Listing } from "@/types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://new.land.naver.com/",
};

/** 네이버 tradeType 코드 매핑 */
const TRADE_TYPE_CODE: Record<string, string> = {
  매매: "A1",
  전세: "B1",
  월세: "B2",
};

/** 면적 오차 허용 범위 (㎡) */
const AREA_TOLERANCE = 1;

interface NaverArticle {
  articleNo: string;
  articleName: string;
  tradeTypeName: string;
  dealOrWarrantPrc: string;
  area2: number; // 전용면적
  floorInfo: string;
  articleFeatureDesc?: string;
  articleConfirmYmd: string;
  realtorName: string;
}

function parseArticle(article: NaverArticle, complexNo: string): Listing {
  return {
    articleId: article.articleNo,
    complexNo,
    articleName: article.articleName,
    tradeType: article.tradeTypeName,
    price: article.dealOrWarrantPrc,
    area: article.area2,
    floor: article.floorInfo,
    description: article.articleFeatureDesc ?? "",
    confirmDate: article.articleConfirmYmd,
    realtorName: article.realtorName,
  };
}

/** 특정 단지의 현재 매물 목록 조회 (거래유형 + 면적 필터) */
export async function fetchListings(apt: ApartmentItem): Promise<Listing[]> {
  const listings: Listing[] = [];
  let page = 1;
  let retryCount = 0;
  const MAX_RETRIES = 3;
  const tradeTypeCode = TRADE_TYPE_CODE[apt.tradeType] ?? "";

  while (true) {
    let data: { articleList?: NaverArticle[] };
    try {
      const res = await axios.get(
        `https://new.land.naver.com/api/articles/complex/${apt.naverComplexId}`,
        {
          headers: HEADERS,
          params: {
            realEstateType: "APT",
            tradeType: tradeTypeCode,
            tag: ":::::",
            rentPriceMin: 0,
            rentPriceMax: 900000000,
            priceMin: 0,
            priceMax: 900000000,
            areaMin: 0,
            areaMax: 900000000,
            oldBuildYears: "",
            recentlyBuildYears: "",
            minHouseHoldCount: "",
            maxHouseHoldCount: "",
            showArticle: false,
            sameAddressGroup: true,
            minMaintenanceCost: "",
            maxMaintenanceCost: "",
            priceType: "RETAIL",
            directions: "",
            page,
            complexNo: apt.naverComplexId,
            buildingNos: "",
            areaNos: "",
            type: "list",
            order: "rank",
          },
        },
      );
      data = res.data;
    } catch (err) {
      const isRetryable =
        axios.isAxiosError(err) &&
        (err.response?.status === 429 || err.code === "ECONNRESET");

      if (isRetryable) {
        retryCount++;
        if (retryCount > MAX_RETRIES) {
          console.warn(`[naver] ${MAX_RETRIES}회 재시도 초과, 중단`);
          break;
        }
        const reason = axios.isAxiosError(err) && err.response?.status === 429
          ? "429 rate limit"
          : "ECONNRESET";
        console.warn(`[naver] ${reason} — 10초 대기 후 재시도 (${retryCount}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, 10000));
        continue;
      }
      throw err;
    }

    const articles: NaverArticle[] = data?.articleList ?? [];
    if (articles.length === 0) break;

    listings.push(...articles.map((a) => parseArticle(a, apt.naverComplexId)));
    page++;

    // 요청 간 딜레이 (차단 방지)
    await new Promise((r) => setTimeout(r, 2000));
  }

  // 전용면적 필터 (API에서 면적 필터가 정확하지 않을 수 있으므로 후처리)
  const filtered = listings.filter(
    (l) => Math.abs(l.area - apt.targetArea) <= AREA_TOLERANCE,
  );

  console.log(
    `[naver] 단지 ${apt.naverComplexId}: 전체 ${listings.length}건 중 ${apt.targetArea}㎡ ${apt.tradeType} ${filtered.length}건`,
  );
  return filtered;
}
