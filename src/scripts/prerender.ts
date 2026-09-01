import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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
  const { render, areas } = (await import(pathToFileURL(SSR_ENTRY).href)) as {
    render: (area: number | null) => string;
    areas: () => number[];
  };

  const template = await readFile(HTML, "utf-8");
  if (!template.includes(PLACEHOLDER)) {
    throw new Error(
      `[prerender] dist/index.html에서 ${PLACEHOLDER}를 찾지 못했습니다. ` +
        "이미 채워졌거나 템플릿이 바뀌었습니다.",
    );
  }

  const all = areas();
  const [primary] = all;

  /*
   * 면적마다 파일을 하나씩 만든다.
   *
   * 기본 면적은 루트(index.html), 나머지는 /59/index.html처럼 하위 경로에 둔다.
   * 정적 호스팅도 하위 경로에 파일이 있으면 그대로 서빙하므로 SPA 폴백이 필요 없다.
   * 이래야 /59/로 바로 들어와도 서버가 처음부터 59를 그린 HTML을 준다 — 쿼리(?area=59)
   * 방식에서는 프리렌더된 마크업이 항상 기본 면적이라 49가 잠깐 보였다가 넘어갔다.
   */
  const written: string[] = [];
  for (const area of all) {
    const isPrimary = area === primary;
    const markup = render(isPrimary ? null : area);
    const html = template.replace(PLACEHOLDER, `<div id="root">${markup}</div>`);

    const out = isPrimary ? HTML : resolve(ROOT, `dist/${area}/index.html`);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, html);

    written.push(
      `${isPrimary ? "index.html" : `${area}/index.html`} ${(Buffer.byteLength(html) / 1024).toFixed(1)}KB`,
    );
  }

  // SSR 번들은 여기서만 쓰고 버린다. 배포 산출물(dist)에 섞이면 안 된다.
  await rm(resolve(ROOT, "dist-ssr"), { recursive: true, force: true });

  console.log(`[prerender] ${written.join(" · ")}`);
}

main().catch((err) => {
  console.error("[prerender] 실패:", err);
  process.exit(1);
});
