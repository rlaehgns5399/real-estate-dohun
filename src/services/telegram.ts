import { Telegraf } from "telegraf";
import { env } from "@/config/env";
import type { KbPrice, Listing, ListingDiff, Transaction } from "@/types";

const bot = new Telegraf(env.telegram.botToken);

function formatPrice(priceInMan: number): string {
  if (priceInMan >= 10000) {
    const eok = Math.floor(priceInMan / 10000);
    const remainder = priceInMan % 10000;
    return remainder > 0 ? `${eok}억 ${remainder.toLocaleString()}만` : `${eok}억`;
  }
  return `${priceInMan.toLocaleString()}만`;
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

  let line = `  • ${l.price} | ${l.area}㎡ | ${dong}${floor} | ${date}`;

  if (prevPrice && prevPrice !== l.price) {
    line += ` ${formatDelta(prevPrice, l.price)}`;
  }

  return line;
}

function buildMessage(
  apartmentName: string,
  transactions: Transaction[],
  diff: ListingDiff,
  kbPrice: KbPrice | null,
): string {
  const lines: string[] = [];
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  lines.push(`🏠 *${apartmentName}* 부동산 알림`);
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
      lines.push(`  • ${formatPrice(t.price)} | ${t.area}㎡ | ${t.floor}층 | ${t.dealDate}`);
    }
    lines.push("");
  } else {
    lines.push("💰 *최근 실거래가*: 최근 3개월 내 거래 없음");
    lines.push("");
  }

  // 매물 현황
  lines.push(`📋 *매물 현황* (총 ${diff.totalActive}건)`);

  if (diff.newListings.length > 0) {
    lines.push(`\n🆕 *신규 매물* (${diff.newListings.length}건)`);
    for (const l of diff.newListings.slice(0, 10)) {
      lines.push(formatListing(l));
    }
    if (diff.newListings.length > 10) {
      lines.push(`  ... 외 ${diff.newListings.length - 10}건`);
    }
  }

  if (diff.priceChangedListings.length > 0) {
    lines.push(`\n💸 *가격 변동* (${diff.priceChangedListings.length}건)`);
    for (const { listing, prevPrice } of diff.priceChangedListings.slice(0, 10)) {
      lines.push(formatListing(listing, prevPrice));
    }
  }

  if (diff.removedListings.length > 0) {
    lines.push(`\n❌ *사라진 매물* (${diff.removedListings.length}건)`);
    for (const l of diff.removedListings.slice(0, 10)) {
      lines.push(`  • ${l.price}`);
    }
    if (diff.removedListings.length > 10) {
      lines.push(`  ... 외 ${diff.removedListings.length - 10}건`);
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
  transactions: Transaction[],
  diff: ListingDiff,
  kbPrice: KbPrice | null,
): Promise<void> {
  const message = buildMessage(apartmentName, transactions, diff, kbPrice);

  await bot.telegram.sendMessage(env.telegram.chatId, message, {
    parse_mode: "Markdown",
  });

  console.log(`[telegram] ${apartmentName} 알림 발송 완료`);
}
