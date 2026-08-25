import type { ThemeChoice } from "@/hooks/useTheme";

const ICONS: Record<ThemeChoice, React.ReactNode> = {
  system: (
    <>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  dark: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
};

const LABELS: Record<ThemeChoice, string> = {
  system: "기기 설정",
  light: "라이트",
  dark: "다크",
};

interface Props {
  choice: ThemeChoice;
  onCycle: () => void;
}

/** 시스템 → 라이트 → 다크를 순환하는 스위치 */
export function ThemeToggle({ choice, onCycle }: Props) {
  return (
    <button
      type="button"
      onClick={onCycle}
      aria-label={`테마: ${LABELS[choice]} (눌러서 전환)`}
      title={`테마: ${LABELS[choice]}`}
      className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-muted transition-[transform,color,border-color] duration-150 ease-out-strong hover:border-faint hover:text-text active:scale-90 motion-reduce:transition-colors motion-reduce:active:scale-100"
    >
      <svg
        className="size-[15px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {ICONS[choice]}
      </svg>
    </button>
  );
}
