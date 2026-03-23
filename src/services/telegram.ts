import { Telegraf } from "telegraf";
import { env } from "@/config/env";
import type { KbPrice, ListingDiff, Transaction } from "@/types";

const bot = new Telegraf(env.telegram.botToken);

function formatPrice(priceInMan: number): string {
  if (priceInMan >= 10000) {
    const eok = Math.floor(priceInMan / 10000);
    const remainder = priceInMan % 10000;
    return remainder > 0 ? `${eok}억 ${remainder.toLocaleString()}만` : `${eok}억`;
  }
  return `${priceInMan.toLocaleString()}만`;
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
      lines.push(`  • ${formatPrice(t.price)} / ${t.area}㎡ / ${t.floor}층 (${t.dealDate})`);
    }
    lines.push("");
  } else {
    lines.push("💰 *최근 실거래가*: 최근 3개월 내 거래 없음");
    lines.push("");
  }

  // 매물 변동
  lines.push(`📋 *매물 현황* (총 ${diff.totalActive}건 활성)`);

  if (diff.newListings.length > 0) {
    lines.push(`\n🆕 *신규 매물* (${diff.newListings.length}건)`);
    for (const l of diff.newListings.slice(0, 10)) {
      lines.push(`  • ${l.price} / ${l.area}㎡ / ${l.floor}`);
      if (l.description) {
        lines.push(`    ${l.description.slice(0, 50)}`);
      }
    }
    if (diff.newListings.length > 10) {
      lines.push(`  ... 외 ${diff.newListings.length - 10}건`);
    }
  }

  if (diff.removedListings.length > 0) {
    lines.push(`\n❌ *사라진 매물* (${diff.removedListings.length}건)`);
    for (const l of diff.removedListings.slice(0, 10)) {
      lines.push(`  • ${l.price} (${l.articleId})`);
    }
    if (diff.removedListings.length > 10) {
      lines.push(`  ... 외 ${diff.removedListings.length - 10}건`);
    }
  }

  if (diff.newListings.length === 0 && diff.removedListings.length === 0) {
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
