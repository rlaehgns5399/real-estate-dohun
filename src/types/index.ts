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
}

/** 국토교통부 실거래가 */
export interface Transaction {
  apartmentName: string;
  price: number; // 만원 단위
  area: number; // 전용면적 (㎡)
  floor: number;
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
  price: string; // "12억 5,000" 등
  area: number; // 전용면적
  floor: string;
  description: string;
  confirmDate: string;
  realtorName: string;
}

/** KB 시세 */
export interface KbPrice {
  complexNo: string;
  dealPriceLower: number; // 만원
  dealPriceUpper: number; // 만원
  leasePriceLower: number;
  leasePriceUpper: number;
  baseDate: string;
}

/** 매물 변동 결과 */
export interface ListingDiff {
  newListings: Listing[];
  removedListings: Array<{
    articleId: string;
    articleName: string;
    price: string;
    lastSeenAt: string;
  }>;
  totalActive: number;
}
