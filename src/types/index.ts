/** 관심 아파트 */
export interface ApartmentItem {
  /** 국토교통부 API에 나오는 아파트명 (정확히 일치해야 함) */
  name: string;
  /** 네이버 부동산 complexNo (URL에서 확인) */
  naverComplexId: string;
  /** KB부동산 단지코드 (없으면 null → KB 시세 조회 건너뜀) */
  kbComplexId: string | null;
  /** 주소 */
  address: string;
  /** 법정동코드 앞 5자리 */
  regionCode: string;
  /** 관심 전용면적 (㎡) — 이 면적만 필터링 */
  targetArea: number;
  /** 거래 유형 필터 */
  tradeType: "매매" | "전세" | "월세";
}

/** 국토교통부 실거래가 */
export interface Transaction {
  apartmentName: string;
  price: number; // 만원 단위
  area: number; // 전용면적 (㎡)
  floor: number;
  dong: string; // 아파트 동
  dealDate: string; // YYYY-MM-DD
  buildYear: number;
  roadAddress: string;
  regionCode: string;
}

/** 네이버 부동산 매물 */
export interface Listing {
  articleId: string;
  complexNo: string;
  articleName: string;
  tradeType: string; // 매매, 전세, 월세
  price: string; // "9억", "8억 5,000" 등
  area: number; // 전용면적 (㎡)
  supplyArea: number; // 공급면적 (㎡)
  floor: string; // "5/14" (해당층/총층)
  buildingName: string; // "1403동"
  direction: string; // "남향"
  description: string;
  confirmDate: string; // "20260323"
  realtorName: string;
  priceChangeState: string; // "SAME" | "UP" | "DOWN"
}

/** KB 시세 (매매) */
export interface KbPrice {
  complexNo: string;
  dealPriceGeneral: number; // 일반거래가 (만원)
  dealPriceLower: number; // 하위 평균가 (만원)
  dealPriceUpper: number; // 상위 평균가 (만원)
  baseDate: string;
}

/** 매물 변동 결과 */
export interface ListingDiff {
  allListings: Listing[];
  newListings: Listing[];
  removedListings: Listing[];
  priceChangedListings: Array<{
    listing: Listing;
    prevPrice: string;
  }>;
  totalActive: number;
}
