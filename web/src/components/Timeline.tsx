import type { ApartmentPage, TimelineEvent, TimelineItem } from "@shared/types/page";
import { formatEok, formatMonthDay } from "@shared/utils/format";
import { Chevron } from "@/components/Chevron";

const MARK: Record<TimelineEvent["type"], string> = {
  new: "🆕",
  removed: "❌",
  deal: "💰",
};

function Head({ event }: { event: TimelineEvent }) {
  return (
    <>
      <span className="date">{formatMonthDay(event.date)}</span>
      <span className="mark">{MARK[event.type]}</span>
      <span className="what">
        {event.label}
        <span className="detail">{event.detail}</span>
      </span>
    </>
  );
}

function Line({ item }: { item: TimelineItem }) {
  return (
    <div className="tl-line">
      <span className="p">{formatEok(item.price)}</span>
      <span className="w">{item.where || "—"}</span>
      <span className="n">{item.note}</span>
    </div>
  );
}

function Event({ event }: { event: TimelineEvent }) {
  // 실거래는 라벨에 가격과 층이 이미 다 들어 있어 펼칠 게 없다.
  if (event.type === "deal" || event.items.length === 0) {
    return (
      <div className={`tl-row ${event.type}`}>
        <Head event={event} />
      </div>
    );
  }

  return (
    <details className="tl-group">
      <summary className={`tl-row ${event.type}`}>
        <Head event={event} />
        <Chevron />
      </summary>
      <div className="tl-detail">
        {event.items.map((item) => (
          <Line key={`${item.price}-${item.where}-${item.note}`} item={item} />
        ))}
      </div>
    </details>
  );
}

export function Timeline({ apt }: { apt: ApartmentPage }) {
  if (apt.timeline.length === 0) {
    return (
      <section>
        <h2>최근 변동</h2>
        <div className="card">
          <div className="empty">최근 14일간 변동이 없습니다.</div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2>
        최근 변동 <span className="h2-note">14일</span>
      </h2>
      <div className="card tl">
        {apt.timeline.map((event) => (
          <Event key={`${event.date}-${event.type}`} event={event} />
        ))}
      </div>
    </section>
  );
}
