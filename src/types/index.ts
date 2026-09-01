/** 한 단지에서 지켜볼 전용면적 하나 */
export interface AreaTarget {
  /** 관심 전용면적 (㎡). 국토부·네이버 응답과 ±AREA_TOLERANCE 범위에서 매칭한다. */
  area: number;
  /** 내 매입가 (만원). 설정하면 차트에 기준선과 평가손익이 표시된다. */
  purchasePrice?: number;
}

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
  /** 지켜볼 전용면적들. 첫 번째가 페이지의 기본 탭이 된다. */
  areas: AreaTarget[];
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

/** 거래 유형 */
export type TradeType = "매매" | "전세" | "월세";

/** 네이버 부동산 매물 */
export interface Listing {
  articleId: string;
  complexNo: string;
  articleName: string;
  tradeType: string; // 매매, 전세, 월세
  /**
   * 네이버 표기 그대로의 가격.
   * 매매·전세는 "9억 5,000", 월세는 "1,000/80" (보증금/월세) 형태다.
   */
  price: string;
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

/** KB 시세 (면적별) */
export interface KbPrice {
  complexNo: string;
  /** 이 시세가 속한 관심 전용면적 (㎡) */
  area: number;
  dealPriceGeneral: number; // 매매 일반거래가 (만원)
  dealPriceLower: number; // 매매 하위 평균가 (만원)
  dealPriceUpper: number; // 매매 상위 평균가 (만원)
  /** 전세 일반거래가 (만원). 네이버 전세 매물이 없어도 전세가율을 낼 수 있다. */
  jeonseGeneral: number;
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
