import { homedir } from "node:os";
import { join } from "node:path";
import { type BrowserContext, chromium } from "playwright";

/**
 * 네이버 수집에 쓰는 브라우저 프로필 위치.
 *
 * 평소 쓰는 Chrome 프로필(~/Library/Application Support/Google/Chrome)은 못 쓴다.
 * Chrome 136부터 기본 프로필에는 자동화 연결(--remote-debugging-pipe)이 막혔다 —
 * 원격 디버깅으로 저장된 쿠키·비밀번호를 빼 가는 공격을 막으려는 조치다. 게다가
 * 평소 Chrome이 켜져 있으면 같은 프로필을 두 프로세스가 잡을 수도 없다.
 *
 * 그래서 수집 전용 프로필을 따로 두고 진짜 Chrome으로 연다. 쿠키가 실행 사이에
 * 남으므로 네이버는 매번 처음 보는 브라우저가 아니라 같은 브라우저로 본다.
 * 저장소 밖에 둬서 로그인 쿠키가 커밋될 일이 없게 했다.
 */
export const NAVER_PROFILE_DIR =
  process.env.NAVER_BROWSER_PROFILE ?? join(homedir(), ".real-estate-dohun", "chrome-profile");

/**
 * 수집용 Chrome을 연다.
 *
 * - 번들 Chromium이 아니라 설치된 Chrome(channel: "chrome")을 쓴다. UA와 지문이 평소
 *   브라우저와 같아진다. CI에는 Chrome이 없으니 번들 Chromium으로 돌아간다.
 * - visible이 아니면 창을 화면 밖에 둔다. headless는 네이버가 막는다.
 */
export async function launchNaverBrowser({ visible = false } = {}): Promise<BrowserContext> {
  try {
    return await chromium.launchPersistentContext(NAVER_PROFILE_DIR, {
      channel: process.env.CI ? undefined : "chrome",
      headless: false,
      viewport: visible ? null : { width: 1280, height: 720 },
      args: [
        "--disable-blink-features=AutomationControlled",
        ...(visible || process.env.CI ? [] : ["--window-position=-9999,-9999"]),
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // 같은 프로필을 이미 누가 쓰고 있으면 Chrome이 프로필 손상을 막으려고 스스로 멈춘다.
    if (message.includes("ProcessSingleton")) {
      throw new Error(
        `[naver] 수집용 Chrome 프로필이 이미 열려 있습니다 (${NAVER_PROFILE_DIR}). ` +
          "pnpm naver:login 창이나 다른 pnpm start가 떠 있는지 확인하세요.",
        { cause: err },
      );
    }
    if (message.includes("Chromium distribution 'chrome' is not found")) {
      throw new Error("[naver] Google Chrome이 설치돼 있지 않습니다.", { cause: err });
    }
    throw err;
  }
}
