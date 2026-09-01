import type { AreaPage, RentListing } from "@shared/types/page";
import { formatEok, formatMan, formatYmd } from "@shared/utils/format";
import { useState } from "react";
import { Card, Empty, SectionTitle, TitleNote } from "@/components/Card";

type Tab = "jeonse" | "monthly";

/** 월세는 "1,000만 / 80만", 전세는 보증금만 */
function priceLabel(listing: RentListing): string {
  return listing.monthlyRent > 0
    ? `${formatMan(listing.price)} / ${formatMan(listing.monthlyRent)}`
    : formatMan(listing.price);
}

function RentRow({ listing }: { listing: RentListing }) {
  const where = [listing.buildingName, listing.floor, listing.direction]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex gap-3.5 border-b border-border px-[0.9375rem] py-3.5 last:border-b-0">
      <div className="w-27 shrink-0">
        <div className="text-[0.9375rem] font-[650] leading-[1.35] tracking-[-0.018em] tabular-nums text-ask">
          {priceLabel(listing)}
        </div>
        {listing.monthlyRent > 0 && (
          <div className="mt-px text-[0.625rem] tracking-[0.01em] tabular-nums text-faint">
            환산 월 {formatMan(listing.monthlyCost)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium tracking-[-0.005em]">
          {where || "—"}
          {listing.isNew && (
            <span className="ml-1.5 whitespace-nowrap rounded-md border border-deal/45 px-1.5 py-px align-middle text-[0.625rem] font-semibold tracking-[0.02em] text-deal">
              신규
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
 * 전세가율 요약.
 *
 * 어떤 값을 무엇으로 나눴는지 항상 함께 적는다. 전세가율은 분모를 호가로 잡느냐
 * 실거래가로 잡느냐에 따라 몇 %p씩 달라져서, 숫자만 있으면 해석할 수 없다.
 */
function RatioBlock({ area }: { area: AreaPage }) {
  const { rent } = area;
  const headline = rent.ratioVsAsk ?? rent.ratioVsDeal;

  if (headline === null) {
    return (
      <div className="border-b border-border px-[0.9375rem] py-5 text-[0.8125rem] text-faint">
        전세 매물이 없어 전세가율을 계산할 수 없습니다.
      </div>
    );
  }

  const usingAsk = rent.ratioVsAsk !== null;
  const basis = usingAsk ? rent.askBasis : rent.dealBasis;

  // 전세 매물이 없어 KB 시세로 낸 값이면 반드시 밝힌다 — 호가 기준과 성격이 다르다.
  const fromKb = rent.jeonseSource === "kb";
  const numerator = fromKb ? "KB 전세 시세" : "전세 호가 중앙값";
  const denominator = fromKb ? "KB 매매 일반가" : usingAsk ? "매매 호가 중앙값" : "최근 실거래가";

  return (
    <div className="border-b border-border px-[0.9375rem] pb-4 pt-3.5">
      <div className="text-[0.6875rem] font-medium tracking-[0.02em] text-muted">전세가율</div>
      <div className="my-[0.1875rem] text-[1.75rem] font-[650] leading-[1.1] tracking-[-0.025em] tabular-nums text-kb">
        {headline.toFixed(1)}%
      </div>
      <div className="text-[0.6875rem] leading-[1.55] tracking-[0.012em] tabular-nums text-faint">
        {numerator} {formatEok(rent.jeonseMedian as number)} ÷ {denominator}{" "}
        {formatEok(basis as number)}
        {usingAsk && rent.ratioVsDeal !== null && (
          <> · 실거래 기준 {rent.ratioVsDeal.toFixed(1)}%</>
        )}
        {rent.gap !== null && <> · 갭 {formatEok(rent.gap)}</>}
      </div>
    </div>
  );
}

/** 전월세 현황 — 전세가율과 전세·월세 매물 목록 */
export function RentCard({ area }: { area: AreaPage }) {
  const { jeonse, monthly } = area.rent;
  // 매물이 있는 쪽을 먼저 연다. 전세가 비면 월세부터 보는 게 자연스럽다.
  const [tab, setTab] = useState<Tab>(
    jeonse.length === 0 && monthly.length > 0 ? "monthly" : "jeonse",
  );

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: "jeonse", label: "전세", count: jeonse.length },
    { key: "monthly", label: "월세", count: monthly.length },
  ];
  const rows = tab === "jeonse" ? jeonse : monthly;
  const empty = jeonse.length === 0 && monthly.length === 0;

  return (
    <section className="mb-6">
      <div className="mb-[0.6875rem] flex flex-wrap items-baseline justify-between gap-2">
        <SectionTitle>
          전월세{" "}
          <TitleNote>
            전세 {jeonse.length}건 · 월세 {monthly.length}건
          </TitleNote>
        </SectionTitle>
        {/* 양쪽 다 비었으면 고를 게 없다 — 0만 적힌 칩은 내지 않는다. */}
        {!empty && (
          <div className="flex shrink-0 gap-1">
            {tabs.map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
                className="cursor-pointer whitespace-nowrap rounded-chip border border-border bg-card px-[0.5625rem] py-[0.3125rem] text-[0.6875rem] font-medium tracking-[0.015em] tabular-nums text-muted transition-[transform,color,border-color] duration-150 ease-out-strong hover:text-text active:scale-[0.96] aria-pressed:border-faint aria-pressed:font-semibold aria-pressed:text-text motion-reduce:transition-colors motion-reduce:active:scale-100"
              >
                {label} {count}
              </button>
            ))}
          </div>
        )}
      </div>

      <Card>
        {empty ? (
          <>
            {/* 매물이 없어도 KB 전세 시세가 있으면 전세가율은 낼 수 있다 */}
            <RatioBlock area={area} />
            <Empty>등록된 전월세 매물이 없습니다.</Empty>
          </>
        ) : (
          <>
            <RatioBlock area={area} />
            {rows.length === 0 ? (
              <Empty>등록된 {tab === "jeonse" ? "전세" : "월세"} 매물이 없습니다.</Empty>
            ) : (
              rows.map((l) => <RentRow key={l.articleId} listing={l} />)
            )}
          </>
        )}
      </Card>
    </section>
  );
}
