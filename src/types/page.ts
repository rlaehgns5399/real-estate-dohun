/** 페이지 렌더링에 필요한 모든 데이터 (data/latest.json 스키마) */
export interface PageData {
  /** 데이터 생성 시각 (ISO) */
  generatedAt: string;
  apartments: ApartmentPage[];
}

export interface ApartmentPage {
  name: string;
  address: string;
  naverUrl: string;
  /** 면적별 데이터. 첫 번째가 기본으로 열리는 탭이다. */
  areas: AreaPage[];
}

/** 한 전용면적의 모든 지표 — 매매를 중심에 두고 전월세를 곁들인다 */
export interface AreaPage {
  /** 전용면적 (㎡) */
  area: number;
  summary: Summary;
  chart: ChartSeries;
  /** 매매 매물 */
  listings: PageListing[];
  rent: RentSection;
  timeline: TimelineEvent[];
  transactions: PageTransaction[];
}

export interface Summary {
  /** 현재 활성 매매 매물 중 최저 호가 (만원) */
  lowestAsk: number | null;
  /** 활성 매매 매물 호가 중앙값 (만원) */
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
  /** 그 날 올라와 있던 매매 매물 호가의 최저 / 최고 */
  askLow: Array<{ t: number; y: number }>;
  askHigh: Array<{ t: number; y: number }>;
}

export interface PageListing {
  articleId: string;
  /** 만원 단위로 파싱한 호가 (정렬용). 월세는 보증금. */
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
  /** 확인일이 오늘이거나 어제인 매물 */
  isNew: boolean;
}

/** 전월세 매물 한 건 */
export interface RentListing extends PageListing {
  /** 월 임대료 (만원). 전세는 0. */
  monthlyRent: number;
  /** 보증금을 월세로 환산해 더한 값 (만원/월). 월세 매물끼리 비교하려고 둔다. */
  monthlyCost: number;
}

/**
 * 전월세 현황.
 *
 * 전세가율은 같은 시점의 호가끼리(전세 호가 ÷ 매매 호가) 비교하는 것을 기본으로 둔다.
 * 호가와 실거래가를 섞으면 "희망가 ÷ 체결가"가 되어 값이 부풀거나 꺼진다.
 */
export interface RentSection {
  jeonse: RentListing[];
  monthly: RentListing[];
  /** 전세 기준값 (만원). 네이버 전세 매물 중앙값, 없으면 KB 전세 일반거래가. */
  jeonseMedian: number | null;
  /** jeonseMedian이 어디서 왔는지 — 화면에 근거를 밝히려고 둔다 */
  jeonseSource: "listing" | "kb" | null;
  jeonseLow: number | null;
  jeonseHigh: number | null;
  /** 전세가율 (%). 전세 호가면 매매 호가로, KB 전세면 KB 매매로 나눈다. */
  ratioVsAsk: number | null;
  /** 전세가율 (%) — 전세 기준값 ÷ 최근 실거래가 */
  ratioVsDeal: number | null;
  /** ratioVsAsk의 분모 (만원). 매매 호가 중앙값 또는 KB 매매 일반거래가. */
  askBasis: number | null;
  /** 최근 실거래가 (만원). ratioVsDeal의 분모. */
  dealBasis: number | null;
  /** 갭 (만원) — 매매 기준가 − 전세 호가 중앙값. 전세를 끼고 살 때 필요한 현금. */
  gap: number | null;
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
  /** 네이버 매물 고유번호. 같은 값의 매물이 여러 건이라 목록 키로 쓴다. */
  articleId: string;
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
