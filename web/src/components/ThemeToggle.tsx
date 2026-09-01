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

const CHOICES: ThemeChoice[] = ["system", "light", "dark"];

interface Props {
  choice: ThemeChoice;
  onCycle: () => void;
}

/**
 * 시스템 → 라이트 → 다크를 순환하는 스위치.
 *
 * 아이콘을 React 상태로 고르지 않는다. HTML을 빌드 시점에 미리 렌더하므로 그때는 방문자의
 * 선택을 알 수 없고, 그래서 useTheme의 첫 상태는 항상 "system"이다. 상태로 고르면 저장된
 * 값이 반영되는 순간(측정상 약 430ms) 아이콘이 한 번 바뀌어 깜빡인다.
 *
 * 대신 셋을 다 그려 두고 CSS가 data-theme으로 하나만 보여준다. 그 속성은 index.html의
 * 인라인 스크립트가 첫 페인트 전에 걸어주므로, JS가 아직 도착하지 않았어도 처음부터
 * 올바른 아이콘이 보인다.
 */
export function ThemeToggle({ choice, onCycle }: Props) {
  return (
    <button
      type="button"
      onClick={onCycle}
      aria-label={`테마: ${LABELS[choice]} (눌러서 전환)`}
      title={`테마: ${LABELS[choice]}`}
      className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-muted transition-[transform,color,border-color] duration-150 ease-out-strong hover:border-faint hover:text-text active:scale-95 motion-reduce:transition-colors motion-reduce:active:scale-100"
    >
      {CHOICES.map((name) => (
        <svg
          key={name}
          className={`theme-icon theme-icon-${name} size-[15px]`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {ICONS[name]}
        </svg>
      ))}
    </button>
  );
}
