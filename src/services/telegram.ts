import { Telegraf } from "telegraf";
import { env } from "@/config/env";
import type { KbPrice, Listing, ListingDiff, Transaction } from "@/types";
import { formatDelta, formatEok, formatFloor, formatYmd, parsePriceText } from "@/utils/format";

const bot = new Telegraf(env.telegram.botToken);

/** 매물 한 줄 포맷: 가격 | 동 층/총층 | 확인일 (가격 변동 시 delta 추가) */
function formatListing(l: Listing, prevPrice?: string): string {
  const dong = l.buildingName ? `${l.buildingName} ` : "";
  const price = formatEok(parsePriceText(l.price));
  let line = `  • ${price} | ${dong}${formatFloor(l.floor)} | ${formatYmd(l.confirmDate)}`;

  if (prevPrice && prevPrice !== l.price) {
    const delta = formatDelta(parsePriceText(l.price) - parsePriceText(prevPrice));
    if (delta) line += ` (${delta})`;
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
    lines.push(`  일반가: ${formatEok(kbPrice.dealPriceGeneral)}`);
    lines.push(`  하위:   ${formatEok(kbPrice.dealPriceLower)}`);
    lines.push(`  상위:   ${formatEok(kbPrice.dealPriceUpper)}`);
    lines.push("");
  }

  // 최근 실거래가 (최근 3개월)
  if (transactions.length > 0) {
    lines.push(`💰 *최근 실거래가* (${transactions.length}건)`);
    for (const t of transactions) {
      const dong = t.dong ? `${t.dong} ` : "";
      lines.push(`  • ${formatEok(t.price)} | ${dong}${t.floor}층 | ${t.dealDate}`);
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
  console.log(`[telegram] ${apartmentName} 메시지 내용:\n${message}\n`);
}
