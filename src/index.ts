import "dotenv/config";
import { buildPageData } from "@/services/page-data";
import { publishData } from "@/services/publish";
import { runCollection } from "@/services/report";

/**
 * 수집 → data/latest.json 갱신 → 커밋·푸시.
 * 푸시가 GitHub Actions를 깨워 GitHub Pages를 다시 배포한다.
 *
 * 커밋·푸시를 떼어내고 싶으면 publishData 대신 writeDataFile만 호출하면 된다.
 */
async function main() {
  await runCollection();

  const data = await buildPageData();
  await publishData(data);
}

main().catch((err) => {
  console.error("치명적 오류:", err);
  process.exit(1);
});
