import type { ApartmentPage, PageListing } from "@shared/types/page";
import { formatEok, formatYmd } from "@shared/utils/format";
import { type ReactNode, useMemo, useState } from "react";
import { Card, Empty, SectionTitle, TitleNote } from "@/components/Card";

/** 매물이 오래 안 나가면 호가가 높다는 신호 — 이 일수부터 배지를 붙인다 */
const STALE_DAYS = 21;
/** 한 번에 보여줄 개수. 나머지는 "더 보기"로 펼친다 */
const PAGE_SIZE = 20;

type SortKey = "price" | "recent" | "oldest";

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "price", label: "가격순" },
  { key: "recent", label: "최신순" },
  { key: "oldest", label: "오래된순" },
];

function compare(key: SortKey) {
  return (a: PageListing, b: PageListing) => {
    if (key === "price") return a.price - b.price;
    if (key === "recent") return a.daysOnMarket - b.daysOnMarket;
    return b.daysOnMarket - a.daysOnMarket;
  };
}

function Badge({ children, tone }: { children: ReactNode; tone: "new" | "stale" }) {
  const color = tone === "new" ? "border-deal/45 text-deal" : "border-border text-faint";
  return (
    <span
      className={`whitespace-nowrap rounded-md border px-1.5 py-px text-[0.625rem] font-semibold tracking-[0.02em] ${color}`}
    >
      {children}
    </span>
  );
}

function Listing({ listing }: { listing: PageListing }) {
  const where = [listing.buildingName, listing.floor, listing.direction]
    .filter(Boolean)
    .join(" · ");
  const stale = listing.daysOnMarket >= STALE_DAYS;

  return (
    <div className="flex gap-3.5 border-b border-border px-[0.9375rem] py-3.5 last:border-b-0">
      <div className="w-17 shrink-0 text-[1.0625rem] font-[650] leading-[1.35] tracking-[-0.022em] tabular-nums text-ask">
        {formatEok(listing.price)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium tracking-[-0.005em]">
          {where}
          {(listing.isNew || stale) && (
            <span className="ml-1.5 inline-flex gap-[0.3125rem] align-middle">
              {listing.isNew && <Badge tone="new">신규</Badge>}
              {stale && <Badge tone="stale">{listing.daysOnMarket}일째</Badge>}
            </span>
          )}
        </div>
        <div
          className="mt-[0.1875rem] truncate text-[0.8125rem] leading-[1.45] text-muted"
          title={listing.description}
        >
          {listing.description || "—"}
        </div>
        <div className="mt-1 text-[0.6875rem] tracking-[0.015em] text-faint">
          확인 {formatYmd(listing.confirmDate)} · {listing.realtorName}
        </div>
      </div>
    </div>
  );
}

/**
 * 페이지네이션 대신 점진적 노출을 쓴다.
 * 정렬을 바꿔도 페이지 상태가 꼬이지 않고 스크롤 흐름이 끊기지 않는다.
 */
export function ListingList({ apt }: { apt: ApartmentPage }) {
  const [sort, setSort] = useState<SortKey>("price");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const sorted = useMemo(() => [...apt.listings].sort(compare(sort)), [apt.listings, sort]);
  const remaining = sorted.length - limit;

  return (
    <section className="mb-6">
      <div className="mb-[0.6875rem] flex flex-wrap items-baseline justify-between gap-2">
        <SectionTitle>
          현재 매물 <TitleNote>{apt.summary.activeCount}건</TitleNote>
        </SectionTitle>
        <div className="flex shrink-0 gap-1">
          {SORTS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={sort === key}
              onClick={() => setSort(key)}
              className="cursor-pointer whitespace-nowrap rounded-chip border border-border bg-card px-[0.5625rem] py-[0.3125rem] text-[0.6875rem] font-medium tracking-[0.015em] text-muted transition-[transform,color,border-color] duration-150 ease-out-strong hover:text-text active:scale-[0.96] aria-pressed:border-faint aria-pressed:font-semibold aria-pressed:text-text motion-reduce:transition-colors motion-reduce:active:scale-100"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        {sorted.length === 0 ? (
          <Empty>현재 등록된 매물이 없습니다.</Empty>
        ) : (
          sorted.slice(0, limit).map((l) => <Listing key={l.articleId} listing={l} />)
        )}
      </Card>

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + PAGE_SIZE)}
          className="mt-2 block w-full cursor-pointer rounded-card border border-border bg-card p-2.5 text-xs font-medium tracking-[0.015em] text-muted transition-[transform,color] duration-150 ease-out-strong hover:text-text active:scale-[0.99] motion-reduce:transition-colors motion-reduce:active:scale-100"
        >
          {remaining}건 더 보기
        </button>
      )}
    </section>
  );
}
