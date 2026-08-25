import type { ApartmentPage } from "@shared/types/page";
import { formatEok } from "@shared/utils/format";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signedPct, toneClass } from "@/format";
import type { ThemeChoice } from "@/hooks/useTheme";

interface Props {
  apt: ApartmentPage;
  choice: ThemeChoice;
  onCycleTheme: () => void;
}

/**
 * 스크롤해도 남는 상단바.
 *
 * 반투명 머티리얼 위로 콘텐츠가 흘러가고, 아래 경계는 선이 아니라
 * 그라데이션 마스크(.topbar-fade)로 흐린다.
 */
export function Topbar({ apt, choice, onCycleTheme }: Props) {
  const { lastDeal, vsPurchasePct } = apt.summary;

  return (
    <div className="topbar-glass topbar-fade sticky top-0 z-20 bg-scrim backdrop-blur-[24px] backdrop-saturate-[1.8]">
      <div className="mx-auto flex max-w-[780px] items-center justify-between gap-4 px-[1.125rem] py-3">
        <span className="truncate text-[0.8125rem] font-semibold tracking-[-0.005em] text-muted">
          {apt.name} {apt.targetArea}㎡
        </span>
        <span className="flex shrink-0 items-center gap-2.5">
          <span className="whitespace-nowrap text-[0.8125rem] font-semibold tracking-[-0.01em] tabular-nums">
            {lastDeal ? formatEok(lastDeal.price) : "—"}
            {vsPurchasePct !== null && (
              <em className={`ml-1.5 not-italic ${toneClass(vsPurchasePct)}`}>
                {signedPct(vsPurchasePct)}
              </em>
            )}
          </span>
          <ThemeToggle choice={choice} onCycle={onCycleTheme} />
        </span>
      </div>
    </div>
  );
}
