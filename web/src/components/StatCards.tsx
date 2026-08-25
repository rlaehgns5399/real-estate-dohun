import type { ApartmentPage } from "@shared/types/page";
import { formatEok } from "@shared/utils/format";
import { signedEok } from "@/format";

function StatCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: string;
}) {
  return (
    <div className={`card stat ${tone ?? ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="note">{note}</div>
    </div>
  );
}

export function StatCards({ apt }: { apt: ApartmentPage }) {
  const s = apt.summary;

  const kbNote =
    s.kbLower !== null && s.kbUpper !== null
      ? `${formatEok(s.kbLower)} ~ ${formatEok(s.kbUpper)}`
      : "시세 없음";

  const gapNote =
    s.askDealGap === null
      ? "비교 불가"
      : s.askDealGap >= 0
        ? "호가가 실거래보다 높음"
        : "호가가 실거래보다 낮음";

  const listingNote =
    [s.newCount > 0 && `신규 ${s.newCount}`, s.removedCount > 0 && `내려감 ${s.removedCount}`]
      .filter(Boolean)
      .join(" · ") || "최근 7일 변동 없음";

  return (
    <section className="stats reveal reveal-3">
      <StatCard
        label="최저 호가"
        value={s.lowestAsk !== null ? formatEok(s.lowestAsk) : "—"}
        note={s.medianAsk !== null ? `중앙값 ${formatEok(s.medianAsk)}` : "매물 없음"}
        tone="ask"
      />
      <StatCard
        label="KB 일반가"
        value={s.kbGeneral !== null ? formatEok(s.kbGeneral) : "—"}
        note={kbNote}
        tone="kb"
      />
      <StatCard
        label="호가 − 실거래"
        value={s.askDealGap === null ? "—" : signedEok(s.askDealGap)}
        note={gapNote}
      />
      <StatCard label="현재 매물" value={`${s.activeCount}건`} note={listingNote} />
    </section>
  );
}
