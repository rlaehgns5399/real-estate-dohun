import type { AreaPage, TimelineEvent, TimelineItem } from "@shared/types/page";
import { formatEok, formatMonthDay } from "@shared/utils/format";
import { Card, Empty, SectionTitle, TitleNote } from "@/components/Card";
import { Chevron } from "@/components/Chevron";

const MARK: Record<TimelineEvent["type"], string> = {
  new: "🆕",
  removed: "❌",
  deal: "💰",
};

const ROW = "flex items-center gap-3 px-[0.9375rem] py-[0.4375rem]";

function Head({ event }: { event: TimelineEvent }) {
  return (
    <>
      <span className="w-12 shrink-0 text-[0.6875rem] tracking-[0.02em] tabular-nums text-faint">
        {formatMonthDay(event.date)}
      </span>
      <span className="w-4 shrink-0 text-center text-xs">{MARK[event.type]}</span>
      <span
        className={`text-[0.8125rem] tracking-[-0.003em] ${
          event.type === "deal" ? "font-semibold text-deal" : ""
        }`}
      >
        {event.label}
        <span className="ml-1.5 tabular-nums text-muted">{event.detail}</span>
      </span>
    </>
  );
}

function Line({ item }: { item: TimelineItem }) {
  return (
    <div className="flex items-baseline gap-2.5 py-[0.1875rem] text-xs tracking-[0.01em]">
      <span className="w-13 shrink-0 font-semibold tabular-nums text-ask">
        {formatEok(item.price)}
      </span>
      <span className="whitespace-nowrap">{item.where || "—"}</span>
      <span className="min-w-0 truncate text-faint">{item.note}</span>
    </div>
  );
}

function Event({ event }: { event: TimelineEvent }) {
  // 실거래는 라벨에 가격과 층이 이미 다 들어 있어 펼칠 게 없다.
  if (event.type === "deal" || event.items.length === 0) {
    return (
      <div className={ROW}>
        <Head event={event} />
      </div>
    );
  }

  return (
    <details className="group">
      <summary className={`${ROW} hover:bg-text/4`}>
        <Head event={event} />
        <Chevron />
      </summary>
      <div className="pb-2 pl-19 pr-[0.9375rem] pt-0.5">
        {/*
          같은 날 같은 동·층·중개사로 값까지 똑같은 매물이 실제로 여러 건 올라온다.
          그래서 키는 표시값이 아니라 네이버 매물 번호로 만든다.
        */}
        {event.items.map((item) => (
          <Line key={item.articleId} item={item} />
        ))}
      </div>
    </details>
  );
}

export function Timeline({ area }: { area: AreaPage }) {
  if (area.timeline.length === 0) {
    return (
      <section className="mb-6">
        <SectionTitle>최근 변동</SectionTitle>
        <Card>
          <Empty>최근 14일간 변동이 없습니다.</Empty>
        </Card>
      </section>
    );
  }

  return (
    <section className="mb-6">
      <SectionTitle>
        최근 변동 <TitleNote>14일</TitleNote>
      </SectionTitle>
      <Card className="py-1.5">
        {area.timeline.map((event) => (
          <Event key={`${event.date}-${event.type}`} event={event} />
        ))}
      </Card>
    </section>
  );
}
