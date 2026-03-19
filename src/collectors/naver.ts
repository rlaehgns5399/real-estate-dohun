import axios from "axios";
import type { Listing } from "@/types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://new.land.naver.com/",
};

interface NaverArticle {
  articleNo: string;
  articleName: string;
  tradeTypeName: string;
  dealOrWarrantPrc: string;
  area2: number;
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

/** 특정 단지의 현재 매물 목록 조회 */
export async function fetchListings(complexNo: string): Promise<Listing[]> {
  const listings: Listing[] = [];
  let page = 1;

  while (true) {
    const { data } = await axios.get(
      `https://new.land.naver.com/api/articles/complex/${complexNo}`,
      {
        headers: HEADERS,
        params: {
          realEstateType: "APT",
          tradeType: "", // 전체 (매매+전세+월세)
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
          complexNo,
          buildingNos: "",
          areaNos: "",
          type: "list",
          order: "rank",
        },
      },
    );

    const articles: NaverArticle[] = data?.articleList ?? [];
    if (articles.length === 0) break;

    listings.push(...articles.map((a) => parseArticle(a, complexNo)));
    page++;

    // 요청 간 딜레이 (차단 방지)
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`[naver] 단지 ${complexNo}: 매물 ${listings.length}건 수집`);
  return listings;
}
