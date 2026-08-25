/** 페이지 렌더링에 필요한 모든 데이터 (data/latest.json 스키마) */
export interface PageData {
  /** 데이터 생성 시각 (ISO) */
  generatedAt: string;
  apartments: ApartmentPage[];
}

export interface ApartmentPage {
  name: string;
  address: string;
  targetArea: number;
  tradeType: string;
  naverUrl: string;
  summary: Summary;
  chart: ChartSeries;
  listings: PageListing[];
  timeline: TimelineEvent[];
  transactions: PageTransaction[];
}

export interface Summary {
  /** 현재 활성 매물 중 최저 호가 (만원) */
  lowestAsk: number | null;
  /** 활성 매물 호가 중앙값 (만원) */
  medianAsk: number | null;
  /** 가장 최근 실거래 */
  lastDeal: PageTransaction | null;
  kbGeneral: number | null;
  kbLower: number | null;
  kbUpper: number | null;
  activeCount: number;
  /** 최근 N일 신규 매물 수 */
  newCount: number;
  /** 최근 N일 내려간 매물 수 */
  removedCount: number;
  /** 최저 호가 − 최근 실거래가 (만원). 양수면 호가가 더 높다. */
  askDealGap: number | null;
  /** 내 매입가 (만원) */
  purchasePrice: number | null;
  /** 최근 실거래가 − 매입가 (만원) */
  vsPurchase: number | null;
  /** 매입가 대비 등락률 (%) */
  vsPurchasePct: number | null;
}

/** 차트용 시계열. t는 epoch millis. */
export interface ChartSeries {
  transactions: Array<{ t: number; y: number; floor: number }>;
  kbGeneral: Array<{ t: number; y: number }>;
  kbLower: Array<{ t: number; y: number }>;
  kbUpper: Array<{ t: number; y: number }>;
  /** 그 날 올라와 있던 매물 호가의 최저 / 최고 */
  askLow: Array<{ t: number; y: number }>;
  askHigh: Array<{ t: number; y: number }>;
}

export interface PageListing {
  articleId: string;
  /** 만원 단위로 파싱한 호가 (정렬용) */
  price: number;
  priceText: string;
  floor: string;
  buildingName: string;
  direction: string;
  description: string;
  realtorName: string;
  confirmDate: string;
  firstSeenAt: string;
  /** 매물이 올라와 있는 일수 */
  daysOnMarket: number;
  isNew: boolean;
}

export interface TimelineEvent {
  /** YYYY-MM-DD */
  date: string;
  type: "new" | "removed" | "deal";
  label: string;
  detail: string;
  /** 펼쳤을 때 보여줄 개별 항목 */
  items: TimelineItem[];
}

export interface TimelineItem {
  /** 만원 단위 */
  price: number;
  /** "1403동 · 저층/14층" */
  where: string;
  /** 확인일이나 방향 등 부가 정보 */
  note: string;
}

export interface PageTransaction {
  dealDate: string;
  price: number;
  area: number;
  floor: number;
}
