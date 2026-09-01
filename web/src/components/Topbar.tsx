import type { ApartmentPage, AreaPage } from "@shared/types/page";
import { formatEok, formatKstDateTime } from "@shared/utils/format";
import { AreaMenu } from "@/components/AreaMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signedPct, toneClass } from "@/format";
import type { ThemeChoice } from "@/hooks/useTheme";

interface Props {
  apt: ApartmentPage;
  /** 현재 보고 있는 면적 */
  area: AreaPage;
  /** data/latest.json이 만들어진 시각 (ISO) */
  generatedAt: string;
  choice: ThemeChoice;
  onCycleTheme: () => void;
  onSelectArea: (area: number) => void;
}

/**
 * 스크롤해도 남는 상단바.
 *
 * 반투명 머티리얼 위로 콘텐츠가 흘러가고, 아래 경계는 선이 아니라
 * 그라데이션 마스크(.topbar-fade)로 흐린다.
 */
export function Topbar({ apt, area, generatedAt, choice, onCycleTheme, onSelectArea }: Props) {
  const { lastDeal, vsPurchasePct } = area.summary;

  // "2026.08.26 10:32" → 연도와 나머지로 쪼갠다
  const stamp = formatKstDateTime(new Date(generatedAt));
  const [year, ...rest] = stamp.split(".");
  const monthDayTime = rest.join(".");

  return (
    <div className="topbar-glass topbar-fade sticky top-0 z-20 bg-scrim backdrop-blur-[24px] backdrop-saturate-[1.8]">
      <div className="mx-auto flex max-w-[780px] items-center justify-between gap-4 px-[1.125rem] py-3">
        {/* 이름은 좁아지면 잘리고, 시각은 항상 보이게 둔다 */}
        <span className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] tracking-[-0.005em]">
          <AreaMenu
            name={apt.name}
            areas={apt.areas}
            selected={area.area}
            onSelect={onSelectArea}
          />
          {/* 좁은 화면에서는 연도를 뺀다. 단지명이 잘리는 것보다 낫다. */}
          <span className="shrink-0 tabular-nums text-faint">
            (<span className="hidden sm:inline">{year}.</span>
            {monthDayTime})
          </span>
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
