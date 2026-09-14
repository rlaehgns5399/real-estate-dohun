import { launchNaverBrowser, NAVER_PROFILE_DIR } from "@/collectors/naver-browser";

/**
 * 수집용 Chrome 프로필을 화면에 띄워 네이버에 로그인해 둔다 (`pnpm naver:login`).
 *
 * 수집과 똑같은 설정으로 연다. 설정이 다르면(예: 평소 Chrome으로 같은 폴더를 열면)
 * 쿠키 암호화 방식이 달라 로그인이 수집 때 풀려 버린다.
 *
 * 로그인은 선택이다. 안 해도 수집은 된다 — 프로필이 남는 것만으로 네이버는 같은
 * 브라우저로 본다. 구글 계정 동기화는 안 된다: Playwright가 자동화 Chrome에
 * --disable-sync를 붙이고, 구글도 자동화 브라우저의 로그인을 막는다.
 */
async function main() {
  const context = await launchNaverBrowser({ visible: true });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto("https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fnew.land.naver.com");

  console.log(`[naver:login] 프로필: ${NAVER_PROFILE_DIR}`);
  console.log("[naver:login] 열린 창에서 네이버에 로그인한 뒤 창을 닫으면 저장됩니다.");

  await new Promise<void>((resolve) => context.on("close", () => resolve()));
  console.log("[naver:login] 저장했습니다. 이제 pnpm start가 이 프로필로 수집합니다.");
}

main().catch((err) => {
  console.error("치명적 오류:", err);
  process.exit(1);
});
