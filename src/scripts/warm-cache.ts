import "dotenv/config";

/**
 * 배포된 페이지를 미리 한 번 긁어 CDN 엣지 캐시를 채운다.
 *
 * GitHub Pages는 Fastly 뒤에 있고, 캐시가 없으면 Fastly가 origin까지 갔다 온다(약 200ms).
 * 빌드 결과는 파일명에 해시가 박히므로 배포할 때마다 모든 에셋이 새 주소가 되고, 엣지
 * 입장에선 한 번도 본 적 없는 파일이라 전부 MISS다. 그 캐시를 채우는 값은 첫 방문자가
 * 치르는데, 배포 직후 첫 방문자는 대개 배포한 사람 자신이다.
 *
 * 중요: 반드시 "볼 사람과 같은 지역"에서 실행해야 한다. Fastly는 애니캐스트라 요청이
 * 가장 가까운 PoP로 가고, 캐시도 그 PoP에만 생긴다. GitHub Actions 러너(미국)에서 돌리면
 * 미국 PoP만 데워져 한국에서 보는 사람에겐 아무 소용이 없다. 그래서 CI가 아니라 로컬에서
 * 돌리는 스크립트로 둔다.
 */

const SITE = process.env.SITE_URL ?? "https://rlaehgns5399.github.io/real-estate-dohun/";

interface Result {
  url: string;
  status: number;
  cache: string;
  ms: number;
  bytes: number;
}

async function fetchOnce(url: string): Promise<Result> {
  const started = performance.now();
  const res = await fetch(url, { cache: "no-store" });
  const bytes = (await res.arrayBuffer()).byteLength;

  return {
    url: url.replace(SITE, "") || "(index.html)",
    status: res.status,
    cache: res.headers.get("x-cache") ?? "?",
    ms: Math.round(performance.now() - started),
    bytes,
  };
}

/** index.html에서 실제로 불러오는 에셋 주소를 뽑는다 — 해시가 붙어 매 배포마다 달라진다 */
function assetUrls(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)) {
    found.add(new URL(m[1], SITE).toString());
  }
  return [...found];
}

async function main() {
  console.log(`[warm] ${SITE}`);

  const index = await fetchOnce(SITE);
  const html = await (await fetch(SITE, { cache: "no-store" })).text();
  const assets = assetUrls(html);

  // index.html이 참조하는 것만으로는 부족하다. 지연 로딩되는 청크는 JS 안에 주소가 있다.
  const scripts = assets.filter((u) => u.endsWith(".js"));
  const lazy = new Set<string>();
  for (const url of scripts) {
    const code = await (await fetch(url, { cache: "no-store" })).text();
    for (const m of code.matchAll(/["']\.\/(assets\/[A-Za-z0-9._-]+\.js)["']/g)) {
      lazy.add(new URL(m[1], SITE).toString());
    }
  }

  const targets = [...new Set([...assets, ...lazy])];
  const results = [index, ...(await Promise.all(targets.map(fetchOnce)))];

  console.log(
    `\n${"파일".padEnd(38)}${"상태".padStart(5)}${"크기".padStart(9)}${"시간".padStart(8)}  캐시`,
  );
  for (const r of results) {
    console.log(
      `${r.url.slice(0, 38).padEnd(38)}${String(r.status).padStart(5)}` +
        `${`${Math.round(r.bytes / 1024)}KB`.padStart(9)}${`${r.ms}ms`.padStart(8)}  ${r.cache}`,
    );
  }

  const missed = results.filter((r) => r.cache.toUpperCase().includes("MISS")).length;
  console.log(
    `\n[warm] ${results.length}개 예열 완료 — 이번에 MISS였던 것 ${missed}개. ` +
      "다음 방문부터 이 지역에서는 HIT로 나갑니다.",
  );
}

main().catch((err) => {
  console.error("[warm] 실패:", err);
  process.exit(1);
});
