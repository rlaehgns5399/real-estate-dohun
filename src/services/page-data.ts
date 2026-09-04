import { APARTMENT_ITEMS } from "@/constants/items";
import { supabase } from "@/db/client";
import type { ApartmentItem, AreaTarget } from "@/types";
import type {
  ApartmentPage,
  AreaPage,
  ChartSeries,
  PageData,
  PageListing,
  PageTransaction,
  RentListing,
  RentSection,
  Summary,
  TimelineEvent,
  TimelineItem,
} from "@/types/page";
import { AREA_TOLERANCE } from "@/utils/constants";
import { formatEok, formatFloor, parseMonthlyRent, parsePriceText } from "@/utils/format";

/** 요약 카드의 "신규 / 내려감"에 포함할 최근 기간 */
const RECENT_DAYS = 7;

/**
 * "신규" 배지를 붙일 기준 (일). 확인일이 오늘이거나 어제면 신규로 본다.
 *
 * first_seen_at(우리가 처음 관측한 시각)은 쓰지 않는다. 수집이 한 번이라도 비면
 * 활성 매물이 통째로 내려간 것으로 처리됐다가 다음 실행에서 전부 신규로 다시
 * 들어오면서 리셋되기 때문이다. 매물이 스스로 들고 있는 확인일을 쓰면 우리
 * 수집 이력과 무관하게 항상 같은 값이 나온다.
 */
const NEW_CONFIRM_DAYS = 1;

/** 타임라인에 표시할 기간 */
const TIMELINE_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 보증금을 월세로 환산할 때 쓰는 연이율.
 *
 * 월세 매물끼리 "보증금 1억/월 50"과 "보증금 3천/월 90"을 비교하려면 하나의 축이 필요하다.
 * 시장에서 통용되는 전월세전환율(연 5~6%)의 하단을 쓴다. 정답이 있는 값은 아니므로
 * 정렬과 대략적인 비교에만 쓰고, 개별 매물은 항상 원래 표기를 함께 보여준다.
 */
const DEPOSIT_TO_RENT_RATE = 0.05;

interface ListingRow {
  article_id: string;
  naver_complex_id: string;
  trade_type: string;
  price: string;
  area: number;
  floor: string;
  building_name: string;
  direction: string;
  description: string;
  realtor_name: string;
  confirm_date: string;
  is_active: boolean;
  first_seen_at: string;
  last_seen_at: string;
}

interface TransactionRow {
  apartment_name: string;
  deal_date: string;
  price: number;
  area: number;
  floor: number;
  road_address: string;
}

interface KbRow {
  apartment_name: string;
  /** 마이그레이션 전에 쌓인 행에는 없다 (undefined) */
  area?: number | null;
  deal_price_general: number | null;
  deal_price_lower: number | null;
  deal_price_upper: number | null;
  jeonse_price_general?: number | null;
  base_date: string;
  fetched_at: string;
}

function daysBetween(from: string, to: number): number {
  return Math.max(0, Math.floor((to - new Date(from).getTime()) / DAY_MS));
}

/**
 * 네이버 확인일("20260904")이 며칠 전인지. 형식이 어긋나면 null.
 *
 * 확인일은 한국 날짜라 오늘도 한국 날짜로 잡아야 한다. 빌드는 UTC에서 돌기 때문에
 * 그냥 비교하면 한국 시간 오전 9시 전까지 하루씩 밀린다.
 */
function daysSinceConfirm(confirmDate: string, now: number): number | null {
  const ymd = /^(\d{4})(\d{2})(\d{2})$/.exec(confirmDate ?? "");
  if (!ymd) return null;

  const today = new Date(now).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const confirmed = Date.parse(`${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00Z`);

  return Math.round((Date.parse(`${today}T00:00:00Z`) - confirmed) / DAY_MS);
}

function toListing(row: ListingRow, now: number): PageListing {
  return {
    articleId: row.article_id,
    price: parsePriceText(row.price),
    priceText: row.price,
    floor: formatFloor(row.floor),
    buildingName: row.building_name ?? "",
    direction: row.direction ?? "",
    description: row.description ?? "",
    realtorName: row.realtor_name ?? "",
    confirmDate: row.confirm_date ?? "",
    firstSeenAt: row.first_seen_at,
    daysOnMarket: daysBetween(row.first_seen_at, now),
    isNew:
      (daysSinceConfirm(row.confirm_date, now) ?? Number.POSITIVE_INFINITY) <= NEW_CONFIRM_DAYS,
  };
}

function toRentListing(row: ListingRow, now: number): RentListing {
  const base = toListing(row, now);
  const monthlyRent = parseMonthlyRent(row.price);

  return {
    ...base,
    monthlyRent,
    monthlyCost: Math.round(monthlyRent + (base.price * DEPOSIT_TO_RENT_RATE) / 12),
  };
}

function toTransaction(row: TransactionRow): PageTransaction {
  return {
    dealDate: row.deal_date,
    price: row.price,
    area: Number(row.area),
    floor: row.floor,
  };
}

/** 오름차순 정렬된 값들의 중앙값. 비어 있으면 null. */
function median(sorted: number[]): number | null {
  return sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : null;
}

interface AskSnapshotRow {
  snapshot_date: string;
  low: number;
  high: number;
}

/** ask_snapshots에 기록된 매매 호가 범위 — 관측 당시 값 그대로라 정확하다 */
async function fetchRecordedAsk(
  apt: ApartmentItem,
  area: number,
): Promise<{ low: Array<{ t: number; y: number }>; high: Array<{ t: number; y: number }> }> {
  const { data, error } = await supabase
    .from("ask_snapshots")
    .select("snapshot_date, low, high")
    .eq("naver_complex_id", apt.naverComplexId)
    .gte("area", area - AREA_TOLERANCE)
    .lte("area", area + AREA_TOLERANCE)
    .order("snapshot_date", { ascending: true });

  if (error) {
    console.warn(
      `[page-data] ask_snapshots 조회 실패 — 매물 기록으로만 그립니다: ${error.message}`,
    );
    return { low: [], high: [] };
  }

  const rows = (data ?? []) as AskSnapshotRow[];
  const at = (date: string) => new Date(`${date}T00:00:00Z`).getTime();

  return {
    low: rows.map((r) => ({ t: at(r.snapshot_date), y: r.low })),
    high: rows.map((r) => ({ t: at(r.snapshot_date), y: r.high })),
  };
}

/**
 * ask_snapshots 기록이 시작되기 전 구간을 listings로 채운다.
 *
 * 여기 쓰이는 가격은 전부 네이버에서 실제로 관측한 값이고, 매물이 올라와 있던 기간도
 * 관측된 값이다. 다만 가격이 중간에 바뀐 매물은 그 이전 시점에 다른 값이었을 수 있어,
 * 기록이 있는 날짜는 항상 기록 쪽을 쓴다.
 */
function buildAskFromListings(rows: ListingRow[]): {
  low: Array<{ t: number; y: number }>;
  high: Array<{ t: number; y: number }>;
} {
  const snapshotDays = [...new Set(rows.map((r) => r.last_seen_at.slice(0, 10)))].sort();

  const low: Array<{ t: number; y: number }> = [];
  const high: Array<{ t: number; y: number }> = [];

  for (const day of snapshotDays) {
    const start = new Date(`${day}T00:00:00Z`).getTime();
    const end = start + DAY_MS;

    const prices = rows
      .filter((r) => {
        const first = new Date(r.first_seen_at).getTime();
        const last = new Date(r.last_seen_at).getTime();
        return first < end && last >= start;
      })
      .map((r) => parsePriceText(r.price))
      .filter((p) => p > 0)
      .sort((a, b) => a - b);

    if (prices.length === 0) continue;

    low.push({ t: start, y: prices[0] });
    high.push({ t: start, y: prices[prices.length - 1] });
  }

  return { low, high };
}

/** 기록된 스냅샷을 우선 쓰고, 그 이전 구간만 매물 기록으로 채운다 */
async function fetchAskSeries(
  apt: ApartmentItem,
  area: number,
  saleRows: ListingRow[],
): Promise<{ low: Array<{ t: number; y: number }>; high: Array<{ t: number; y: number }> }> {
  const recorded = await fetchRecordedAsk(apt, area);
  const cutoff = recorded.low[0]?.t ?? Number.POSITIVE_INFINITY;
  const derived = buildAskFromListings(saleRows);

  return {
    low: [...derived.low.filter((p) => p.t < cutoff), ...recorded.low],
    high: [...derived.high.filter((p) => p.t < cutoff), ...recorded.high],
  };
}

/**
 * 같은 값이 이어지는 구간을 구간 중앙의 점 하나로 합친다.
 *
 * KB 시세나 최저 호가는 같은 값이 수십 일 이어지다 하루 만에 점프하는 계단 데이터다.
 * 포인트가 조밀한 상태로 곡선 보간을 걸면 점프 구간이 거의 수직선이 되어 여전히 각져 보인다.
 * 구간을 대표점 하나로 줄이면 점 사이가 멀어져 보간이 자연스러운 곡선을 그린다.
 * 선이 차트 양 끝까지 닿도록 첫 점과 마지막 점의 시점은 원래대로 유지한다.
 */
function condense(points: Array<{ t: number; y: number }>): Array<{ t: number; y: number }> {
  if (points.length <= 2) return points;

  const runs: Array<{ start: number; end: number; y: number }> = [];
  for (const point of points) {
    const last = runs.at(-1);
    if (last && last.y === point.y) last.end = point.t;
    else runs.push({ start: point.t, end: point.t, y: point.y });
  }

  const condensed = runs.map((run) => ({ t: (run.start + run.end) / 2, y: run.y }));

  const first = points[0];
  const last = points.at(-1) as { t: number; y: number };
  if (condensed[0].t > first.t) condensed.unshift({ t: first.t, y: condensed[0].y });
  if ((condensed.at(-1) as { t: number }).t < last.t) condensed.push({ t: last.t, y: last.y });

  return condensed;
}

/**
 * 이 면적에 해당하는 KB 행만 남긴다.
 *
 * area 칼럼이 생기기 전에 쌓인 행에는 면적이 없다. 그 시절엔 면적 하나만 수집했으므로
 * 첫 번째 관심 면적의 이력으로 본다. 마이그레이션이 끝나면 전부 area를 갖게 되어
 * 이 분기는 자연히 죽는다.
 */
function selectKbRowsForArea(rows: KbRow[], area: number, isPrimaryArea: boolean): KbRow[] {
  return rows.filter((r) => {
    if (r.area === undefined || r.area === null) return isPrimaryArea;
    return Math.abs(Number(r.area) - area) <= AREA_TOLERANCE;
  });
}

/** base_date별로 가장 최근에 수집한 KB 시세만 남긴다 (하루에 여러 번 수집되므로) */
function dedupeKbByDate(rows: KbRow[]): KbRow[] {
  const byDate = new Map<string, KbRow>();
  for (const row of rows) {
    const prev = byDate.get(row.base_date);
    if (!prev || row.fetched_at > prev.fetched_at) byDate.set(row.base_date, row);
  }
  return [...byDate.values()].sort((a, b) => a.base_date.localeCompare(b.base_date));
}

function buildSummary(
  target: AreaTarget,
  active: PageListing[],
  transactions: PageTransaction[],
  kbLatest: KbRow | undefined,
  newCount: number,
  removedCount: number,
): Summary {
  const prices = active
    .map((l) => l.price)
    .filter((p) => p > 0)
    .sort((a, b) => a - b);
  const lowestAsk = prices[0] ?? null;
  const medianAsk = median(prices);
  const lastDeal = transactions[0] ?? null;

  // 평가손익 기준은 가장 객관적인 최근 실거래가로 잡는다 (호가는 희망가라 부풀려진다).
  const purchasePrice = target.purchasePrice ?? null;
  const vsPurchase = purchasePrice !== null && lastDeal ? lastDeal.price - purchasePrice : null;

  return {
    lowestAsk,
    medianAsk,
    lastDeal,
    kbGeneral: kbLatest?.deal_price_general ?? null,
    kbLower: kbLatest?.deal_price_lower ?? null,
    kbUpper: kbLatest?.deal_price_upper ?? null,
    activeCount: active.length,
    newCount,
    removedCount,
    askDealGap: lowestAsk !== null && lastDeal ? lowestAsk - lastDeal.price : null,
    purchasePrice,
    vsPurchase,
    vsPurchasePct: vsPurchase !== null && purchasePrice ? (vsPurchase / purchasePrice) * 100 : null,
  };
}

/**
 * 전월세 현황과 전세가율.
 *
 * 전세가율의 분모는 매매 호가 중앙값을 기본으로 쓴다. 전세 호가와 매매 호가는 같은 날
 * 같은 성격(희망가)으로 관측한 값이라 그대로 비교할 수 있다. 실거래가를 분모로 쓰면
 * 시점도 성격도 다른 값을 나누게 되므로, 참고용으로 따로 계산해 함께 보여준다.
 */
function buildRentSection(
  jeonseRows: ListingRow[],
  monthlyRows: ListingRow[],
  saleMedian: number | null,
  lastDealPrice: number | null,
  kbLatest: KbRow | undefined,
  now: number,
): RentSection {
  const jeonse = jeonseRows.map((r) => toRentListing(r, now)).sort((a, b) => a.price - b.price);
  const monthly = monthlyRows
    .map((r) => toRentListing(r, now))
    .sort((a, b) => a.monthlyCost - b.monthlyCost);

  const deposits = jeonse.map((l) => l.price).filter((p) => p > 0);
  const listedMedian = median(deposits);

  // 네이버 전세 매물이 0건인 면적이 흔하다. 그럴 때는 KB 전세 시세로 대신 낸다.
  const kbJeonse = kbLatest?.jeonse_price_general ?? null;
  const jeonseMedian = listedMedian ?? kbJeonse;
  const jeonseSource: RentSection["jeonseSource"] =
    listedMedian !== null ? "listing" : kbJeonse !== null ? "kb" : null;

  const ratio = (basis: number | null) =>
    jeonseMedian !== null && basis ? (jeonseMedian / basis) * 100 : null;

  // KB 전세를 쓸 때는 분모도 KB 매매로 맞춘다 — 같은 기관의 같은 기준끼리 나눠야 한다.
  const kbGeneral = kbLatest?.deal_price_general ?? null;
  const askBasis = jeonseSource === "kb" ? kbGeneral : saleMedian;

  // 갭은 실제로 사야 하는 값인 매매 호가를 우선 쓰고, 매물이 없을 때만 실거래로 떨어진다.
  const gapBasis = saleMedian ?? lastDealPrice;

  return {
    jeonse,
    monthly,
    jeonseMedian,
    jeonseSource,
    jeonseLow: deposits[0] ?? null,
    jeonseHigh: deposits.at(-1) ?? null,
    ratioVsAsk: ratio(askBasis),
    ratioVsDeal: ratio(lastDealPrice),
    askBasis,
    dealBasis: lastDealPrice,
    gap: jeonseMedian !== null && gapBasis ? gapBasis - jeonseMedian : null,
  };
}

/**
 * 최근 변동 타임라인.
 *
 * 네이버는 동일 매물이 재등록되며 article_id가 자주 바뀌어 하루 수십 건이 생겼다 사라진다.
 * 개별 나열하면 읽을 수 없으므로 (날짜, 유형)으로 묶고 가격 범위만 보여준다.
 * 실거래는 드물고 중요하므로 묶지 않는다.
 */
function buildTimeline(
  rows: ListingRow[],
  transactions: PageTransaction[],
  now: number,
): TimelineEvent[] {
  const cutoff = now - TIMELINE_DAYS * DAY_MS;
  const buckets = new Map<
    string,
    { date: string; type: "new" | "removed"; items: TimelineItem[] }
  >();

  const push = (date: string, type: "new" | "removed", row: ListingRow) => {
    const key = `${date}|${type}`;
    const bucket = buckets.get(key) ?? { date, type, items: [] };
    bucket.items.push({
      articleId: row.article_id,
      price: parsePriceText(row.price),
      where: [row.building_name, formatFloor(row.floor)].filter(Boolean).join(" · "),
      note: [row.direction, row.realtor_name].filter(Boolean).join(" · "),
    });
    buckets.set(key, bucket);
  };

  for (const row of rows) {
    if (new Date(row.first_seen_at).getTime() >= cutoff) {
      push(row.first_seen_at.slice(0, 10), "new", row);
    }
    if (!row.is_active && new Date(row.last_seen_at).getTime() >= cutoff) {
      push(row.last_seen_at.slice(0, 10), "removed", row);
    }
  }

  const events: TimelineEvent[] = [...buckets.values()].map((bucket) => {
    const items = [...bucket.items].sort((a, b) => a.price - b.price);
    const prices = items.map((i) => i.price).filter((p) => p > 0);
    const low = prices[0];
    const high = prices.at(-1);
    const range =
      prices.length === 0
        ? ""
        : low === high
          ? formatEok(low)
          : `${formatEok(low)} ~ ${formatEok(high as number)}`;

    return {
      date: bucket.date,
      type: bucket.type,
      label: bucket.type === "new" ? "신규 매물" : "매물 내려감",
      detail: `${items.length}건 · ${range}`,
      items,
    };
  });

  for (const t of transactions) {
    if (new Date(t.dealDate).getTime() >= cutoff) {
      events.push({
        date: t.dealDate,
        type: "deal",
        label: `${formatEok(t.price)} 실거래 체결`,
        detail: `${t.floor}층`,
        items: [
          {
            articleId: `deal-${t.dealDate}-${t.price}-${t.floor}`,
            price: t.price,
            where: `${t.floor}층`,
            note: `전용 ${t.area}㎡`,
          },
        ],
      });
    }
  }

  return events.sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type));
}

/** 단지 전체에서 받아온 행을 면적 하나 분량으로 좁혀 페이지 데이터를 만든다 */
function buildAreaPage(
  target: AreaTarget,
  allListingRows: ListingRow[],
  allTxRows: TransactionRow[],
  kbRows: KbRow[],
  ask: { low: Array<{ t: number; y: number }>; high: Array<{ t: number; y: number }> },
  now: number,
): AreaPage {
  const listingRows = allListingRows.filter(
    (r) => Math.abs(Number(r.area) - target.area) <= AREA_TOLERANCE,
  );
  const saleRows = listingRows.filter((r) => r.trade_type === "매매");
  const txRows = allTxRows.filter((r) => Math.abs(Number(r.area) - target.area) <= AREA_TOLERANCE);

  // 같은 날 여러 건이 체결되면 날짜만으로는 어느 게 대표가 될지 정해지지 않는다.
  // 높은 가격을 앞에 둬서 "그 날의 최고가"가 대표값이 되게 한다.
  const transactions = txRows
    .map(toTransaction)
    .sort((a, b) => b.dealDate.localeCompare(a.dealDate) || b.price - a.price);

  const activeSaleRows = saleRows.filter((r) => r.is_active);
  const active = activeSaleRows.map((r) => toListing(r, now)).sort((a, b) => a.price - b.price);

  const cutoff = now - RECENT_DAYS * DAY_MS;
  const newCount = activeSaleRows.filter(
    (r) => new Date(r.first_seen_at).getTime() >= cutoff,
  ).length;
  const removedCount = saleRows.filter(
    (r) => !r.is_active && new Date(r.last_seen_at).getTime() >= cutoff,
  ).length;

  const kbPoint = (pick: (r: KbRow) => number | null) =>
    condense(
      kbRows
        .filter((r) => pick(r) !== null)
        .map((r) => ({ t: new Date(`${r.base_date}T00:00:00Z`).getTime(), y: pick(r) as number })),
    );

  const chart: ChartSeries = {
    transactions: transactions.map((t) => ({
      t: new Date(`${t.dealDate}T00:00:00Z`).getTime(),
      y: t.price,
      floor: t.floor,
    })),
    kbGeneral: kbPoint((r) => r.deal_price_general),
    kbLower: kbPoint((r) => r.deal_price_lower),
    kbUpper: kbPoint((r) => r.deal_price_upper),
    askLow: condense(ask.low),
    askHigh: condense(ask.high),
  };

  const summary = buildSummary(target, active, transactions, kbRows.at(-1), newCount, removedCount);

  const activeOf = (tradeType: string) =>
    listingRows.filter((r) => r.is_active && r.trade_type === tradeType);

  return {
    area: target.area,
    summary,
    chart,
    listings: active,
    rent: buildRentSection(
      activeOf("전세"),
      activeOf("월세"),
      summary.medianAsk,
      summary.lastDeal?.price ?? null,
      kbRows.at(-1),
      now,
    ),
    // 타임라인은 매매 매물 흐름만 본다 — 전월세까지 섞으면 무엇이 움직였는지 흐려진다.
    timeline: buildTimeline(saleRows, transactions, now),
    transactions,
  };
}

async function buildApartmentPage(apt: ApartmentItem, now: number): Promise<ApartmentPage> {
  const [listingRes, txRes, kbRes] = await Promise.all([
    supabase.from("listings").select("*").eq("naver_complex_id", apt.naverComplexId),
    supabase
      .from("transactions")
      .select("*")
      .eq("apartment_name", apt.name)
      .order("deal_date", { ascending: false }),
    supabase
      .from("kb_prices")
      .select("*")
      .eq("apartment_name", apt.name)
      .order("fetched_at", { ascending: false }),
  ]);

  const allListingRows = (listingRes.data ?? []) as ListingRow[];
  const allTxRows = (txRes.data ?? []) as TransactionRow[];
  const allKbRows = (kbRes.data ?? []) as KbRow[];

  const areas = await Promise.all(
    apt.areas.map(async (target, index) => {
      const saleRows = allListingRows.filter(
        (r) => r.trade_type === "매매" && Math.abs(Number(r.area) - target.area) <= AREA_TOLERANCE,
      );
      const ask = await fetchAskSeries(apt, target.area, saleRows);
      const kbRows = dedupeKbByDate(selectKbRowsForArea(allKbRows, target.area, index === 0));
      return buildAreaPage(target, allListingRows, allTxRows, kbRows, ask, now);
    }),
  );

  return {
    name: apt.name,
    address: apt.address,
    naverUrl: `https://new.land.naver.com/complexes/${apt.naverComplexId}`,
    areas,
  };
}

/** Supabase에 쌓인 데이터로 페이지 렌더링용 payload를 만든다 */
export async function buildPageData(): Promise<PageData> {
  const now = Date.now();
  const apartments = await Promise.all(APARTMENT_ITEMS.map((apt) => buildApartmentPage(apt, now)));

  return { generatedAt: new Date(now).toISOString(), apartments };
}
