import type { ApartmentPage, PageListing } from "@shared/types/page";
import { formatEok, formatYmd } from "@shared/utils/format";
import { useMemo, useState } from "react";

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

function Listing({ listing }: { listing: PageListing }) {
  const where = [listing.buildingName, listing.floor, listing.direction]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="listing">
      <div className="price">{formatEok(listing.price)}</div>
      <div className="body">
        <div className="where">
          {where}
          {(listing.isNew || listing.daysOnMarket >= STALE_DAYS) && (
            <span className="badges">
              {listing.isNew && <span className="badge new">신규</span>}
              {listing.daysOnMarket >= STALE_DAYS && (
                <span className="badge stale">{listing.daysOnMarket}일째</span>
              )}
            </span>
          )}
        </div>
        <div className="desc" title={listing.description}>
          {listing.description || "—"}
        </div>
        <div className="meta">
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
    <section>
      <div className="list-head">
        <h2>
          현재 매물 <span className="h2-note">{apt.summary.activeCount}건</span>
        </h2>
        <div className="sorts">
          {SORTS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={sort === key}
              onClick={() => setSort(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {sorted.length === 0 ? (
          <div className="empty">현재 등록된 매물이 없습니다.</div>
        ) : (
          sorted.slice(0, limit).map((l) => <Listing key={l.articleId} listing={l} />)
        )}
      </div>

      {remaining > 0 && (
        <button type="button" className="more" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
          {remaining}건 더 보기
        </button>
      )}
    </section>
  );
}
