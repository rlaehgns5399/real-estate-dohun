import type { ApartmentPage } from "@shared/types/page";
import { formatEok } from "@shared/utils/format";
import { Card } from "@/components/Card";
import { signedEok } from "@/format";

function Stat({
  label,
  value,
  note,
  valueClass = "",
}: {
  label: string;
  value: string;
  note: string;
  valueClass?: string;
}) {
  return (
    <Card className="px-[0.9375rem] pb-4 pt-3.5">
      <div className="text-[0.6875rem] font-medium tracking-[0.02em] text-muted">{label}</div>
      <div
        className={`my-[0.1875rem] text-[1.375rem] font-[650] leading-[1.15] tracking-[-0.022em] tabular-nums ${valueClass}`}
      >
        {value}
      </div>
      <div className="text-[0.6875rem] leading-[1.45] tracking-[0.012em] text-faint">{note}</div>
    </Card>
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
    <section className="reveal reveal-3 mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <Stat
        label="최저 호가"
        value={s.lowestAsk !== null ? formatEok(s.lowestAsk) : "—"}
        note={s.medianAsk !== null ? `중앙값 ${formatEok(s.medianAsk)}` : "매물 없음"}
        valueClass="text-ask"
      />
      <Stat
        label="KB 일반가"
        value={s.kbGeneral !== null ? formatEok(s.kbGeneral) : "—"}
        note={kbNote}
        valueClass="text-kb"
      />
      <Stat
        label="호가 − 실거래"
        value={s.askDealGap === null ? "—" : signedEok(s.askDealGap)}
        note={gapNote}
      />
      <Stat label="현재 매물" value={`${s.activeCount}건`} note={listingNote} />
    </section>
  );
}
