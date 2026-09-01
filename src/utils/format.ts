/** 만원 단위 가격 → "9.5억" */
export function formatEok(priceInMan: number): string {
  const eok = priceInMan / 10000;
  return `${parseFloat(eok.toFixed(2))}억`;
}

/**
 * 만원 단위 가격 → "1,000만" / "1억" / "1억 5,000"
 *
 * 보증금처럼 억이 안 되는 값도 자주 나오는 자리에 쓴다.
 * formatEok는 1,000만원을 "0.1억"으로 적어 읽기 어렵다.
 */
export function formatMan(priceInMan: number): string {
  if (priceInMan < 10000) return `${priceInMan.toLocaleString("ko-KR")}만`;
  const eok = Math.floor(priceInMan / 10000);
  const rest = priceInMan % 10000;
  return rest === 0 ? `${eok}억` : `${eok}억 ${rest.toLocaleString("ko-KR")}`;
}

/** 만원 단위 차액 → "▲ 0.3억" / "▼ 0.3억" / "" */
export function formatDelta(diffInMan: number): string {
  if (diffInMan > 0) return `▲ ${formatEok(diffInMan)}`;
  if (diffInMan < 0) return `▼ ${formatEok(Math.abs(diffInMan))}`;
  return "";
}

/** 확인일자 "20260323" → "2026.03.23" */
export function formatYmd(ymd: string): string {
  if (ymd?.length !== 8) return ymd ?? "";
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`;
}

/** ISO 날짜 "2026-03-23" → "03.23" */
export function formatMonthDay(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return m && d ? `${m}.${d}` : isoDate;
}

/**
 * 네이버 층 정보 → "5층/14층", "고층/14층"
 * 네이버는 저/중/고 같은 문자열도 내려주므로 숫자 여부와 무관하게 "층"을 붙인다.
 */
export function formatFloor(floorInfo: string): string {
  const parts = (floorInfo ?? "").split("/");
  if (parts.length === 2) return `${parts[0]}층/${parts[1]}층`;
  return floorInfo ?? "";
}

/**
 * 네이버 가격 한 토막 → 만원 단위 숫자
 * "9억 5,000" → 95000, "10억" → 100000, "9,500" → 9500
 */
function parseAmount(text: string): number {
  if (!text) return 0;
  let total = 0;
  const eokMatch = text.match(/(\d+)억/);
  if (eokMatch) total += parseInt(eokMatch[1], 10) * 10000;
  const manMatch = text.replace(/,/g, "").match(/억\s*(\d+)|^(\d+)$/);
  if (manMatch) total += parseInt(manMatch[1] ?? manMatch[2], 10);
  return total;
}

/**
 * 네이버 가격 문자열 → 만원 단위 숫자 (월세는 보증금)
 *
 * 월세는 "1,000/80"처럼 보증금과 월세액이 슬래시로 붙어 오므로 앞 토막만 본다.
 * 매매·전세는 슬래시가 없어 그대로 통과한다.
 */
export function parsePriceText(text: string): number {
  return parseAmount((text ?? "").split("/")[0]);
}

/** 월세 문자열 "1,000/80" → 월세액 80 (만원). 슬래시가 없으면 0. */
export function parseMonthlyRent(text: string): number {
  const parts = (text ?? "").split("/");
  return parts.length < 2 ? 0 : parseAmount(parts[1].trim());
}

/** 한국 시간 기준 "2026.08.25 14:30" */
export function formatKstDateTime(date: Date): string {
  return date.toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).replace(/-/g, ".").slice(0, 16);
}
