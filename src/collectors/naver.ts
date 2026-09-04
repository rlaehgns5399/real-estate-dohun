/// <reference lib="dom" />
// page.evaluate 콜백은 브라우저 컨텍스트에서 실행되므로 DOM 타입이 필요하다.
// 나머지 Node 코드가 실수로 브라우저 API를 쓰는 걸 막기 위해 이 파일에만 열어둔다.

import { type Browser, chromium } from "playwright";
import type { ApartmentItem, Listing } from "@/types";
import { AREA_TOLERANCE } from "@/utils/constants";

interface NaverArticle {
  articleNo: string;
  articleName: string;
  tradeTypeName: string;
  /** 매매가 / 전세보증금 / 월세보증금 */
  dealOrWarrantPrc: string;
  /** 월세액 (월세 매물만). "80" 형태 */
  rentPrc?: string;
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

/**
 * 네이버가 쓰는 표기로 가격 문자열을 만든다.
 *
 * 월세는 보증금과 월세액이 따로 오므로 "1,000/80"으로 합친다.
 * 이미 슬래시가 들어 있으면 네이버가 합쳐 보낸 것이므로 그대로 둔다.
 */
function priceText(article: NaverArticle): string {
  const deposit = String(article.dealOrWarrantPrc ?? "").trim();
  const rent = String(article.rentPrc ?? "").trim();
  if (!rent || deposit.includes("/")) return deposit;
  return `${deposit}/${rent}`;
}

function parseArticle(article: NaverArticle, complexNo: string): Listing {
  return {
    articleId: article.articleNo,
    complexNo,
    articleName: article.articleName,
    tradeType: article.tradeTypeName,
    price: priceText(article),
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

/**
 * Playwright로 네이버 부동산 페이지를 열고 API 응답을 가로채서 매물 수집.
 *
 * 거래 유형 필터(b=)를 걸지 않는다. 매매·전세·월세를 한 번에 받아서 코드에서 나누면
 * 브라우저를 유형마다 새로 띄우지 않아도 되고, 자동화 탐지에 노출되는 횟수도 줄어든다.
 * 반환값은 관심 면적으로만 걸러진 전 거래 유형 매물이다.
 */
export async function fetchListings(apt: ApartmentItem): Promise<Listing[]> {
  const listings: Listing[] = [];

  /**
   * 매물 API 응답을 한 번이라도 받았는지.
   *
   * "수집이 막혀서 0건"과 "단지에 매물이 정말 0건"을 가르는 유일한 신호다. 매물이
   * 없어도 이 응답 자체는 오므로, 한 번도 못 받았다면 페이지를 제대로 열지 못한 것이다.
   * 이걸 구분하지 않고 빈 배열을 돌려주면 호출부가 "매물이 전부 내려갔다"로 읽는다.
   */
  let gotArticleResponse = false;

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      headless: false,
      args: [
        "--disable-blink-features=AutomationControlled",
        ...(process.env.CI ? [] : ["--window-position=-9999,-9999"]),
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
        // 본문 파싱 실패와 무관하게, 응답이 왔다는 사실 자체가 페이지가 열렸다는 증거다.
        gotArticleResponse = true;
        try {
          const json = await response.json();
          const articles: NaverArticle[] = json?.articleList ?? [];
          listings.push(...articles.map((a) => parseArticle(a, apt.naverComplexId)));
        } catch {
          // JSON 파싱 실패 무시
        }
      }
    });

    // 네이버 부동산 단지 페이지 직접 방문 (거래 유형 필터 없음)
    const url = `https://new.land.naver.com/complexes/${apt.naverComplexId}?ms=37.5,127.0,17&a=APT:PRE&e=RETAIL&ad=true`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // API 응답이 올 때까지 대기
    await page.waitForTimeout(10000);

    // 매물 목록 스크롤 컨테이너에서 반복 스크롤로 전체 로드
    let prevCount = 0;
    for (let i = 0; i < 30; i++) {
      try {
        // 더보기 버튼 클릭 시도
        const moreButton = page.locator("a.more_btn, button.more_btn").first();
        if (await moreButton.isVisible({ timeout: 500 }).catch(() => false)) {
          await moreButton.click();
          await page.waitForTimeout(2000);
          continue;
        }

        // 매물 목록 컨테이너 스크롤
        await page.evaluate(() => {
          const el = document.querySelector(".item_list--article");
          if (el) el.scrollTop = el.scrollHeight;
        });
        await page.waitForTimeout(2000);
      } catch {
        break;
      }

      // 매물 수 변화 없으면 종료
      if (listings.length === prevCount) break;
      prevCount = listings.length;
    }
    console.log(`[naver] 스크롤 완료: 총 ${listings.length}건 수집`);
  } catch (err) {
    // 여기서 삼키면 빈 배열이 "매물 전부 내려감"으로 둔갑해 DB의 활성 매물이 통째로 꺼진다.
    throw new Error(`[naver] 단지 ${apt.naverComplexId} 수집 실패`, { cause: err });
  } finally {
    if (browser) await browser.close();
  }

  if (!gotArticleResponse) {
    throw new Error(
      `[naver] 단지 ${apt.naverComplexId}: 매물 API 응답을 한 번도 받지 못했습니다. ` +
        "차단됐거나 페이지 구조가 바뀌었을 수 있습니다.",
    );
  }

  // 같은 매물이 여러 API 응답에 중복으로 실려 온다.
  const unique = [...new Map(listings.map((l) => [l.articleId, l])).values()];

  // 관심 면적만 남긴다 — 안 보는 면적까지 DB에 쌓을 이유가 없다.
  const filtered = unique.filter((l) =>
    apt.areas.some((a) => Math.abs(l.area - a.area) <= AREA_TOLERANCE),
  );

  const byType = new Map<string, number>();
  for (const l of filtered) byType.set(l.tradeType, (byType.get(l.tradeType) ?? 0) + 1);
  const breakdown =
    [...byType.entries()].map(([type, n]) => `${type} ${n}`).join(", ") || "해당 없음";

  console.log(
    `[naver] 단지 ${apt.naverComplexId}: 전체 ${unique.length}건 중 관심 면적 ${filtered.length}건 (${breakdown})`,
  );
  return filtered;
}
