import { runCollection } from "@/services/report";
import { sendNotification } from "@/services/telegram";
import { delay } from "@/utils/delay";

/**
 * 수집 후 아파트별로 텔레그램 알림을 보낸다.
 *
 * 사내망에서는 보안 게이트웨이가 api.telegram.org를 차단해 503이 난다. 개인망에서 실행할 것.
 */
export async function runTelegramReport(): Promise<void> {
  const collected = await runCollection();

  for (const { apt, transactions, diff, kbPrice } of collected) {
    try {
      await sendNotification(apt.name, apt.targetArea, transactions, diff, kbPrice);
    } catch (err) {
      console.error(`[${apt.name}] 알림 발송 실패:`, err);
    }
    await delay(1000);
  }
}
