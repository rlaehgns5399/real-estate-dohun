import { useCallback, useEffect, useState } from "react";

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

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (choice === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);

    try {
      if (choice === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // 저장 불가한 환경 — 이번 페이지에서만 적용된다
    }
  }, [choice]);

  const cycle = useCallback(() => {
    setChoice((current) => CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]);
  }, []);

  const resolved: ResolvedTheme = choice === "system" ? (systemDark ? "dark" : "light") : choice;

  return { choice, resolved, cycle };
}
