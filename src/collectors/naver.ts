import { type Browser, chromium } from "playwright";
import type { ApartmentItem, Listing } from "@/types";

/** 네이버 tradeType 코드 매핑 */
const TRADE_TYPE_CODE: Record<string, string> = {
  매매: "A1",
  전세: "B1",
  월세: "B2",
};

/** 면적 오차 허용 범위 (㎡) */
const AREA_TOLERANCE = 1;

interface NaverArticle {
  articleNo: string;
  articleName: string;
  tradeTypeName: string;
  dealOrWarrantPrc: string;
  area1: number; // 공급면적
  area2: number; // 전용면적
  floorInfo: string;
  buildingName?: string;
  direction?: string;
  articleFeatureDesc?: string;
  articleConfirmYmd: string;
  realtorName: string;
  priceChangeState?: string; // SAME, UP, DOWN
}

function parseArticle(article: NaverArticle, complexNo: string): Listing {
  return {
    articleId: article.articleNo,
    complexNo,
    articleName: article.articleName,
    tradeType: article.tradeTypeName,
    price: article.dealOrWarrantPrc,
    area: article.area2,
    supplyArea: article.area1,
    floor: article.floorInfo,
    buildingName: article.buildingName ?? "",
    direction: article.direction ?? "",
    description: article.articleFeatureDesc ?? "",
    confirmDate: article.articleConfirmYmd,
    realtorName: article.realtorName,
    priceChangeState: article.priceChangeState ?? "SAME",
  };
}

/** Playwright로 네이버 부동산 페이지를 열고 API 응답을 가로채서 매물 수집 */
export async function fetchListings(apt: ApartmentItem): Promise<Listing[]> {
  const tradeTypeCode = TRADE_TYPE_CODE[apt.tradeType] ?? "";
  const listings: Listing[] = [];

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      headless: false,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--window-position=-9999,-9999",
      ],
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    // webdriver 플래그 제거 (자동화 감지 우회)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    // API 응답 가로채기
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("/api/articles/complex/") && response.status() === 200) {
        try {
          const json = await response.json();
          const articles: NaverArticle[] = json?.articleList ?? [];
          listings.push(...articles.map((a) => parseArticle(a, apt.naverComplexId)));
        } catch {
          // JSON 파싱 실패 무시
        }
      }
    });

    // 네이버 부동산 단지 페이지 직접 방문 (매매 필터 적용)
    const url = `https://new.land.naver.com/complexes/${apt.naverComplexId}?ms=37.5,127.0,17&a=APT:PRE&b=${tradeTypeCode}&e=RETAIL`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    // 매물 목록이 로드될 때까지 대기
    await page.waitForTimeout(3000);

    // 추가 페이지가 있으면 스크롤로 로드
    for (let i = 0; i < 5; i++) {
      const moreButton = page.locator("a.more_btn, button.more_btn").first();
      if (await moreButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await moreButton.click();
        await page.waitForTimeout(2000);
      } else {
        break;
      }
    }
  } catch (err) {
    console.error("[naver] Playwright 수집 실패:", err);
  } finally {
    if (browser) await browser.close();
  }

  // 전용면적 필터
  const filtered = listings.filter(
    (l) => Math.abs(l.area - apt.targetArea) <= AREA_TOLERANCE,
  );

  console.log(
    `[naver] 단지 ${apt.naverComplexId}: 전체 ${listings.length}건 중 ${apt.targetArea}㎡ ${apt.tradeType} ${filtered.length}건`,
  );
  return filtered;
}
