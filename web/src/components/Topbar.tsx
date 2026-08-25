import type { ApartmentPage } from "@shared/types/page";
import { formatEok } from "@shared/utils/format";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signedPct, tone } from "@/format";
import type { ThemeChoice } from "@/hooks/useTheme";

interface Props {
  apt: ApartmentPage;
  choice: ThemeChoice;
  onCycleTheme: () => void;
}

/** 스크롤해도 남는 상단바 — 이름과 핵심 숫자만 */
export function Topbar({ apt, choice, onCycleTheme }: Props) {
  const { lastDeal, vsPurchasePct } = apt.summary;

  return (
    <div className="topbar">
      <div className="wrap topbar-inner">
        <span className="topbar-name">
          {apt.name} {apt.targetArea}㎡
        </span>
        <span className="topbar-right">
          <span className="topbar-price">
            {lastDeal ? formatEok(lastDeal.price) : "—"}
            {vsPurchasePct !== null && (
              <em className={tone(vsPurchasePct)}>{signedPct(vsPurchasePct)}</em>
            )}
          </span>
          <ThemeToggle choice={choice} onCycle={onCycleTheme} />
        </span>
      </div>
    </div>
  );
}
