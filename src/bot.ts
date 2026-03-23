import "dotenv/config";
import { createInterface } from "node:readline";
import { Telegraf } from "telegraf";
import { collectKbPrices } from "@/collectors/kb";
import { collectTransactions } from "@/collectors/molit";
import { env } from "@/config/env";
import { APARTMENT_ITEMS } from "@/constants/items";
import { updateListingsSnapshot } from "@/services/snapshot";
import { sendNotification } from "@/services/telegram";

const bot = new Telegraf(env.telegram.botToken);

async function runReport() {
  let allTransactions: Awaited<ReturnType<typeof collectTransactions>> = [];
  try {
    allTransactions = await collectTransactions();
  } catch (err) {
    console.error("[molit] 실거래가 수집 실패:", err);
  }

  let kbPrices: Awaited<ReturnType<typeof collectKbPrices>> = [];
  try {
    kbPrices = await collectKbPrices(APARTMENT_ITEMS);
  } catch (err) {
    console.error("[kb] 시세 수집 실패:", err);
  }

  for (const apt of APARTMENT_ITEMS) {
    const aptTransactions = allTransactions.filter((t) => t.apartmentName === apt.name);
    const kbPrice = kbPrices.find((k) => k.complexNo === apt.kbComplexId) ?? null;

    let diff: import("@/types").ListingDiff = {
      newListings: [],
      removedListings: [],
      priceChangedListings: [],
      totalActive: 0,
    };

    try {
      diff = await updateListingsSnapshot(apt);
    } catch (err) {
      console.error(`[${apt.name}] 네이버 매물 수집 실패:`, err);
    }

    await sendNotification(apt.name, apt.targetArea, aptTransactions, diff, kbPrice);
  }
}

const ALLOWED_CHAT_ID = Number(env.telegram.chatId);

// 허용된 채팅방에서만 명령어 처리
bot.use((ctx, next) => {
  if (ctx.chat?.id !== ALLOWED_CHAT_ID) return;
  return next();
});

bot.command("report", async (ctx) => {
  await ctx.reply("🔍 매물 조사 시작합니다...");
  try {
    await runReport();
  } catch (err) {
    await ctx.reply("❌ 매물 조사 실패");
    console.error(err);
  }
});

bot.command("start", (ctx) => {
  ctx.reply("🏠 부동산 봇입니다.\n/report — 매물 조사 실행");
});

bot.on("message", (ctx) => {
  if (!("new_chat_members" in ctx.message)) return;
  for (const member of ctx.message.new_chat_members) {
    if (member.is_bot) continue;
    const name = member.first_name;
    ctx.reply(
      `환영합니다 ${name}님! 🏠\n\n` +
        "이 채널은 부동산 매물 알림 채널입니다.\n\n" +
        "📋 명령어:\n" +
        "/report — 매물 조사 실행\n\n" +
        "매일 9시, 12시, 15시, 18시에 자동 알림이 옵니다.",
    );
  }
});

const mode = process.argv[2];

if (mode === "listen") {
  // 텔레그램 리스너 모드: pnpm bot listen
  bot.launch();
  console.log("[bot] 텔레그램 리스너 시작. /report 명령어로 조사 실행.");
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
} else {
  // CLI 모드: pnpm bot
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log("[bot] 메시지를 입력하세요. Ctrl+C로 종료.");

  rl.on("line", async (text) => {
    if (!text.trim()) return;
    await bot.telegram.sendMessage(env.telegram.chatId, text);
    console.log(`[bot] 전송 완료: ${text}`);
  });

  rl.on("close", () => process.exit(0));
}
