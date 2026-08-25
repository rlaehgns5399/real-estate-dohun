import "dotenv/config";
import { runTelegramReport } from "@/services/notify";

/** 수집 후 텔레그램으로 알림 발송 (`pnpm telegram`) */
runTelegramReport().catch((err) => {
  console.error("치명적 오류:", err);
  process.exit(1);
});
