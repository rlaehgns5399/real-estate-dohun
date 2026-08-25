import { formatEok } from "@shared/utils/format";

/** 부호를 명시한 억 단위 표기 — "+0.4억" / "−0.4억" */
export function signedEok(value: number): string {
  return `${value >= 0 ? "+" : "−"}${formatEok(Math.abs(value))}`;
}

export function signedPct(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

/** 상승/하락 색 */
export function toneClass(value: number): string {
  return value >= 0 ? "text-pos" : "text-neg";
}
