import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * 빌드된 SSR 번들을 실행해 dist/index.html의 빈 #root를 실제 마크업으로 채운다.
 *
 * 이 페이지는 런타임에 아무것도 부르지 않는다 — data/latest.json이 빌드 시점에 번들로
 * 들어가므로, 지금 그린 HTML이 방문자가 볼 화면과 같다. 그런데도 지금까지는 브라우저가
 * JS를 전부 받아 실행할 때까지 흰 화면이었다. GitHub Pages로 가는 회선이 좁을수록
 * (실측 약 315KB/s) 그 대기가 그대로 드러난다.
 *
 * 미리 그려 넣으면 1KB짜리 HTML만 도착해도 화면이 완성되고, JS는 뒤에서 붙어
 * 인터랙션만 살린다.
 */

const ROOT = process.cwd();
const HTML = resolve(ROOT, "dist/index.html");
const SSR_ENTRY = resolve(ROOT, "dist-ssr/entry-server.js");
const PLACEHOLDER = '<div id="root"></div>';

async function main() {
  const { render } = (await import(pathToFileURL(SSR_ENTRY).href)) as { render: () => string };
  const markup = render();

  const html = await readFile(HTML, "utf-8");
  if (!html.includes(PLACEHOLDER)) {
    throw new Error(
      `[prerender] dist/index.html에서 ${PLACEHOLDER}를 찾지 못했습니다. ` +
        "이미 채워졌거나 템플릿이 바뀌었습니다.",
    );
  }

  await writeFile(HTML, html.replace(PLACEHOLDER, `<div id="root">${markup}</div>`));

  // SSR 번들은 여기서만 쓰고 버린다. 배포 산출물(dist)에 섞이면 안 된다.
  await rm(resolve(ROOT, "dist-ssr"), { recursive: true, force: true });

  const before = Buffer.byteLength(html);
  const after = before + Buffer.byteLength(markup);
  console.log(
    `[prerender] dist/index.html에 마크업 주입 — ${(before / 1024).toFixed(1)}KB → ${(after / 1024).toFixed(1)}KB`,
  );
}

main().catch((err) => {
  console.error("[prerender] 실패:", err);
  process.exit(1);
});
