import { APARTMENT_ITEMS } from "@/constants/items";
import { supabase } from "@/db/client";
import type { ApartmentItem } from "@/types";
import type {
  ApartmentPage,
  ChartSeries,
  PageData,
  PageListing,
  PageTransaction,
  Summary,
  TimelineEvent,
  TimelineItem,
} from "@/types/page";
import { AREA_TOLERANCE } from "@/utils/constants";
import { formatEok, formatFloor, parsePriceText } from "@/utils/format";

/** "신규" 배지와 요약 카운트에 포함할 최근 기간 */
const RECENT_DAYS = 7;

/** 타임라인에 표시할 기간 */
const TIMELINE_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

interface ListingRow {
  article_id: string;
  naver_complex_id: string;
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
  deal_price_general: number | null;
  deal_price_lower: number | null;
  deal_price_upper: number | null;
  base_date: string;
  fetched_at: string;
}

function daysBetween(from: string, to: number): number {
  return Math.max(0, Math.floor((to - new Date(from).getTime()) / DAY_MS));
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
    isNew: now - new Date(row.first_seen_at).getTime() <= RECENT_DAYS * DAY_MS,
  };
}

function toTransaction(row: TransactionRow): PageTransaction {
  return {
    dealDate: row.deal_date,
    price: row.price,
    area: Number(row.area),
    floor: row.floor,
    dong: "",
  };
}

interface AskSnapshotRow {
  snapshot_date: string;
  low: number;
  high: number;
}

/** ask_snapshots에 기록된 호가 범위 — 관측 당시 값 그대로라 정확하다 */
async function fetchRecordedAsk(
  apt: ApartmentItem,
): Promise<{ low: Array<{ t: number; y: number }>; high: Array<{ t: number; y: number }> }> {
  const { data, error } = await supabase
    .from("ask_snapshots")
    .select("snapshot_date, low, high")
    .eq("naver_complex_id", apt.naverComplexId)
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
  rows: ListingRow[],
): Promise<{ low: Array<{ t: number; y: number }>; high: Array<{ t: number; y: number }> }> {
  const recorded = await fetchRecordedAsk(apt);
  const cutoff = recorded.low[0]?.t ?? Number.POSITIVE_INFINITY;
  const derived = buildAskFromListings(rows);

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
  apt: ApartmentItem,
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
  const medianAsk = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : null;
  const lastDeal = transactions[0] ?? null;

  // 평가손익 기준은 가장 객관적인 최근 실거래가로 잡는다 (호가는 희망가라 부풀려진다).
  const purchasePrice = apt.purchasePrice ?? null;
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
      count: items.length,
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
        count: 1,
        label: `${formatEok(t.price)} 실거래 체결`,
        detail: `${t.floor}층`,
        items: [{ price: t.price, where: `${t.floor}층`, note: `전용 ${t.area}㎡` }],
      });
    }
  }

  return events.sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type));
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

  const listingRows = ((listingRes.data ?? []) as ListingRow[]).filter(
    (r) => Math.abs(Number(r.area) - apt.targetArea) <= AREA_TOLERANCE,
  );
  const txRows = ((txRes.data ?? []) as TransactionRow[]).filter(
    (r) => Math.abs(Number(r.area) - apt.targetArea) <= AREA_TOLERANCE,
  );
  const kbRows = dedupeKbByDate((kbRes.data ?? []) as KbRow[]);

  const transactions = txRows.map(toTransaction);
  const activeRows = listingRows.filter((r) => r.is_active);
  const active = activeRows.map((r) => toListing(r, now)).sort((a, b) => a.price - b.price);

  const cutoff = now - RECENT_DAYS * DAY_MS;
  const newCount = activeRows.filter((r) => new Date(r.first_seen_at).getTime() >= cutoff).length;
  const removedCount = listingRows.filter(
    (r) => !r.is_active && new Date(r.last_seen_at).getTime() >= cutoff,
  ).length;

  const kbPoint = (pick: (r: KbRow) => number | null) =>
    condense(
      kbRows
        .filter((r) => pick(r) !== null)
        .map((r) => ({ t: new Date(`${r.base_date}T00:00:00Z`).getTime(), y: pick(r) as number })),
    );

  const ask = await fetchAskSeries(apt, listingRows);

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

  return {
    name: apt.name,
    address: apt.address,
    targetArea: apt.targetArea,
    tradeType: apt.tradeType,
    naverUrl: `https://new.land.naver.com/complexes/${apt.naverComplexId}`,
    summary: buildSummary(apt, active, transactions, kbRows.at(-1), newCount, removedCount),
    chart,
    listings: active,
    timeline: buildTimeline(listingRows, transactions, now),
    transactions,
  };
}

/** Supabase에 쌓인 데이터로 페이지 렌더링용 payload를 만든다 */
export async function buildPageData(): Promise<PageData> {
  const now = Date.now();
  const apartments = await Promise.all(APARTMENT_ITEMS.map((apt) => buildApartmentPage(apt, now)));

  return { generatedAt: new Date(now).toISOString(), apartments };
}
