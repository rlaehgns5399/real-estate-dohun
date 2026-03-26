import { Telegraf } from "telegraf";
import { env } from "@/config/env";
import type { KbPrice, Listing, ListingDiff, Transaction } from "@/types";

const bot = new Telegraf(env.telegram.botToken);

function formatPrice(priceInMan: number): string {
  const eok = priceInMan / 10000;
  const formatted = parseFloat(eok.toFixed(2));
  return `${formatted}억`;
}

/** 확인일자 포맷 "20260323" → "2026.03.23" */
function formatDate(ymd: string): string {
  if (ymd.length !== 8) return ymd;
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`;
}

/** 층 정보 "5/14" → "5층/14층" */
function formatFloor(floorInfo: string): string {
  const parts = floorInfo.split("/");
  if (parts.length === 2) return `${parts[0]}층/${parts[1]}층`;
  return floorInfo;
}

/** 네이버 가격 문자열 → 만원 단위 숫자 ("9억 5,000" → 95000) */
function parsePriceText(text: string): number {
  let total = 0;
  const eokMatch = text.match(/(\d+)억/);
  if (eokMatch) total += parseInt(eokMatch[1], 10) * 10000;
  const manMatch = text.replace(/,/g, "").match(/억\s*(\d+)|^(\d+)$/);
  if (manMatch) total += parseInt(manMatch[1] ?? manMatch[2], 10);
  return total;
}

/** 가격 변동 delta 표시 */
function formatDelta(prevPrice: string, currentPrice: string): string {
  const prev = parsePriceText(prevPrice);
  const curr = parsePriceText(currentPrice);
  const diff = curr - prev;
  if (diff > 0) return `(▲ ${formatPrice(diff)})`;
  if (diff < 0) return `(▼ ${formatPrice(Math.abs(diff))})`;
  return "";
}

/** 매물 한 줄 포맷: 가격 | 면적 | 동 층/총층 | 날짜 */
function formatListing(l: Listing, prevPrice?: string): string {
  const dong = l.buildingName ? `${l.buildingName} ` : "";
  const floor = formatFloor(l.floor);
  const date = formatDate(l.confirmDate);

  const price = formatPrice(parsePriceText(l.price));
  let line = `  • ${price} | ${dong}${floor} | ${date}`;

  if (prevPrice && prevPrice !== l.price) {
    line += ` ${formatDelta(prevPrice, l.price)}`;
  }

  return line;
}

function buildMessage(
  apartmentName: string,
  targetArea: number,
  transactions: Transaction[],
  diff: ListingDiff,
  kbPrice: KbPrice | null,
): string {
  const lines: string[] = [];
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  lines.push(`🏠 *${apartmentName} ${targetArea}㎡* 부동산 알림`);
  lines.push(`📅 ${now}`);
  lines.push("");

  // KB 시세 (매매) — 일반가, 하위, 상위
  if (kbPrice && kbPrice.dealPriceUpper > 0) {
    lines.push("📊 *KB 매매 시세*");
    lines.push(`  일반가: ${formatPrice(kbPrice.dealPriceGeneral)}`);
    lines.push(`  하위:   ${formatPrice(kbPrice.dealPriceLower)}`);
    lines.push(`  상위:   ${formatPrice(kbPrice.dealPriceUpper)}`);
    lines.push("");
  }

  // 최근 실거래가 (최근 3개월)
  if (transactions.length > 0) {
    lines.push(`💰 *최근 실거래가* (${transactions.length}건)`);
    for (const t of transactions) {
      const dong = t.dong ? `${t.dong} ` : "";
      lines.push(`  • ${formatPrice(t.price)} | ${dong}${t.floor}층 | ${t.dealDate}`);
    }
    lines.push("");
  } else {
    lines.push("💰 *최근 실거래가*: 최근 3개월 내 거래 없음");
    lines.push("");
  }

  // 전체 매물 리스트
  if (diff.allListings.length > 0) {
    const sorted = [...diff.allListings].sort((a, b) => b.confirmDate.localeCompare(a.confirmDate));
    lines.push(`📋 *전체 매물* (${sorted.length}건)`);
    for (const l of sorted) {
      lines.push(formatListing(l));
    }
    lines.push("");
  } else {
    lines.push("📋 *전체 매물*: 없음");
    lines.push("");
  }

  // 매물 변동
  if (diff.newListings.length > 0) {
    const sorted = [...diff.newListings].sort((a, b) => b.confirmDate.localeCompare(a.confirmDate));
    lines.push(`\n🆕 *신규 매물* (${sorted.length}건)`);
    for (const l of sorted) {
      lines.push(formatListing(l));
    }
  }

  if (diff.priceChangedListings.length > 0) {
    lines.push(`\n💸 *가격 변동* (${diff.priceChangedListings.length}건)`);
    for (const { listing, prevPrice } of diff.priceChangedListings) {
      lines.push(formatListing(listing, prevPrice));
    }
  }

  if (diff.removedListings.length > 0) {
    lines.push(`\n❌ *사라진 매물* (${diff.removedListings.length}건)`);
    for (const l of diff.removedListings) {
      lines.push(formatListing(l));
    }
  }

  if (
    diff.newListings.length === 0 &&
    diff.removedListings.length === 0 &&
    diff.priceChangedListings.length === 0
  ) {
    lines.push("  변동 없음");
  }

  return lines.join("\n");
}

export async function sendNotification(
  apartmentName: string,
  targetArea: number,
  transactions: Transaction[],
  diff: ListingDiff,
  kbPrice: KbPrice | null,
): Promise<void> {
  const message = buildMessage(apartmentName, targetArea, transactions, diff, kbPrice);

  await bot.telegram.sendMessage(env.telegram.chatId, message, {
    parse_mode: "Markdown",
  });

  console.log(`[telegram] ${apartmentName} 알림 발송 완료`);
}
