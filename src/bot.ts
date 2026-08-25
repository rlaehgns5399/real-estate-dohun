import "dotenv/config";
import { createInterface } from "node:readline";
import { Telegraf } from "telegraf";
import { env } from "@/config/env";
import { runTelegramReport } from "@/services/notify";

const bot = new Telegraf(env.telegram.botToken);
const ALLOWED_CHAT_ID = Number(env.telegram.chatId);

bot.use((ctx, next) => {
  if (ctx.chat?.id !== ALLOWED_CHAT_ID) return;
  return next();
});

bot.command("report", async (ctx) => {
  await ctx.reply("🔍 매물 조사 시작합니다...");
  try {
    await runTelegramReport();
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
        "/report — 매물 조사 실행",
    );
  }
});

const mode = process.argv[2];

if (mode === "listen") {
  bot.launch();
  console.log("[bot] 텔레그램 리스너 시작. /report 명령어로 조사 실행.");
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log("[bot] 메시지를 입력하세요. Ctrl+C로 종료.");

  rl.on("line", async (text) => {
    if (!text.trim()) return;
    await bot.telegram.sendMessage(env.telegram.chatId, text);
    console.log(`[bot] 전송 완료: ${text}`);
  });

  rl.on("close", () => process.exit(0));
}
