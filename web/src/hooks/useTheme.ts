import { useCallback, useEffect, useRef, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme";
const CYCLE: ThemeChoice[] = ["system", "light", "dark"];

function readStored(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

/**
 * data-theme 속성과 저장소를 즉시 갱신한다.
 *
 * effect가 아니라 이벤트 핸들러에서 동기적으로 부르는 게 중요하다.
 * React는 자식 effect를 부모보다 먼저 실행하므로, 부모(App)의 effect에서 속성을
 * 바꾸면 자식(ChartCard)이 그 전에 CSS 토큰을 읽어 이전 테마 색으로 차트를 그린다.
 * 다크→라이트에서 격자가 검게, 라이트→다크에서 희게 보이던 원인이다.
 */
function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);

  try {
    if (choice === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // 저장 불가한 환경 — 이번 페이지에서만 적용된다
  }
}

/**
 * 시스템 → 라이트 → 다크를 순환하는 테마 스위치.
 *
 * 선택은 localStorage에 남고, index.html의 인라인 스크립트가 첫 페인트 전에
 * 같은 키를 읽어 적용한다. 두 곳이 어긋나면 새로고침할 때 색이 번쩍이므로
 * 키 이름을 바꿀 때는 반드시 양쪽을 함께 고쳐야 한다.
 */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readStored);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  const choiceRef = useRef(choice);
  choiceRef.current = choice;

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const cycle = useCallback(() => {
    const next = CYCLE[(CYCLE.indexOf(choiceRef.current) + 1) % CYCLE.length];
    // 리렌더 전에 DOM을 먼저 바꾼다. 자식 effect가 새 팔레트를 읽도록.
    applyTheme(next);
    setChoice(next);
  }, []);

  const resolved: ResolvedTheme = choice === "system" ? (systemDark ? "dark" : "light") : choice;

  return { choice, resolved, cycle };
}
