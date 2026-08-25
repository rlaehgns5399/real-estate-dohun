import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { DATA_FILE } from "@/render/paths";
import { buildPageData } from "@/services/page-data";

/** Supabase에 쌓인 데이터로 data/latest.json을 갱신한다 (수집은 하지 않음) */
async function main() {
  const data = await buildPageData();
  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`[data] ${DATA_FILE} 갱신 — 아파트 ${data.apartments.length}개`);
}

main();
