import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { renderHtml } from "@/render/html";
import { DATA_FILE, PAGE_FILE } from "@/render/paths";
import type { PageData } from "@/types/page";

/** data/latest.json → docs/index.html */
async function main() {
  const data = JSON.parse(await readFile(DATA_FILE, "utf-8")) as PageData;
  const html = renderHtml(data);
  await mkdir(dirname(PAGE_FILE), { recursive: true });
  await writeFile(PAGE_FILE, html);
  console.log(`[render] ${PAGE_FILE} 생성 — ${(html.length / 1024).toFixed(1)}KB`);
}

main();
