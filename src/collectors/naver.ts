/// <reference lib="dom" />
// page.evaluate 콜백은 브라우저 컨텍스트에서 실행되므로 DOM 타입이 필요하다.
// 나머지 Node 코드가 실수로 브라우저 API를 쓰는 걸 막기 위해 이 파일에만 열어둔다.

import type { BrowserContext } from "playwright";
import { launchNaverBrowser } from "@/collectors/naver-browser";
import type { ApartmentItem, Listing } from "@/types";
import { AREA_TOLERANCE } from "@/utils/constants";

/**
 * 신 네이버부동산(네이버페이 부동산, fin.land.naver.com)에서 매물을 모은다.
 *
 * 구 네이버부동산(new.land.naver.com)은 2026-11 기준으로도 같은 매물을 주지만 신 사이트로
 * 옮겨 가는 중이라 언제 닫힐지 모른다. 매물 번호(articleNumber)는 구 사이트의 articleNo와
 * 같은 체계이고, 같은 집을 여러 중개사가 올린 묶음의 대표 매물도 구 사이트의
 * sameAddressGroup=true 결과와 일치했다(30/30). 그래서 소스를 바꿔도 DB의 기존 매물이
 * 그대로 이어진다.
 */
const ORIGIN = "https://fin.land.naver.com";
const LIST_PATH = "/front-api/v1/complex/article/list";

/** 한 번에 받을 묶음 수. 사이트가 쓰는 값 그대로다. */
const PAGE_SIZE = 30;

/** 페이지네이션 폭주 방지. 한 단지 매물이 30 × 20 = 600묶음을 넘을 일은 없다. */
const MAX_PAGES = 20;

/** 거래 유형 코드 → 구 사이트가 쓰던 이름. DB와 페이지가 이 이름으로 나눈다. */
const TRADE_TYPE_NAMES: Record<string, string> = {
  A1: "매매",
  B1: "전세",
  B2: "월세",
  B3: "단기임대",
};

/** 방향 코드 → 구 사이트 표기. 첫 글자가 동/서, 둘째 글자가 남/북 축이다. */
const DIRECTION_NAMES: Record<string, string> = {
  SS: "남향",
  NN: "북향",
  EE: "동향",
  WW: "서향",
  ES: "남동향",
  WS: "남서향",
  EN: "북동향",
  WN: "북서향",
};

interface FinArticle {
  articleNumber: string;
  articleName?: string;
  dongName?: string;
  /** A1 매매 / B1 전세 / B2 월세 / B3 단기임대 */
  tradeType: string;
  spaceInfo: { supplySpace: number; exclusiveSpace: number };
  verificationInfo?: { articleConfirmDate?: string };
  brokerInfo?: { brokerageName?: string };
  articleDetail?: {
    direction?: string;
    articleFeatureDescription?: string;
    /** "7/14", "고/13" — 구 사이트와 같은 형식 */
    floorInfo?: string;
  };
  /** 전부 원 단위 */
  priceInfo: {
    dealPrice: number;
    warrantyPrice: number;
    rentPrice: number;
    priceChangeStatus?: number;
  };
}

/** 같은 집 묶음. 대표 매물 하나와, 여러 중개사가 올렸으면 그 목록이 온다. */
interface FinArticleGroup {
  representativeArticleInfo: FinArticle;
}

interface FinListPage {
  status: number;
  isSuccess: boolean;
  detailCode?: string;
  list: FinArticleGroup[];
  totalCount: number;
  hasNextPage: boolean;
}

/**
 * 원 단위 금액을 구 사이트 표기로 적는다: "10억", "9억 8,000", "5,000".
 *
 * DB에 쌓인 가격이 이 형식이고, 가격 변동은 문자열 비교로 잡는다. 형식이 한 글자라도
 * 달라지면 소스를 바꾼 첫 실행에 모든 매물이 "가격 변동"으로 잡힌다.
 */
function formatWon(won: number): string {
  const man = Math.round(won / 10000);
  if (man < 10000) return man.toLocaleString("en-US");
  const eok = Math.floor(man / 10000);
  const rest = man % 10000;
  return rest === 0 ? `${eok}억` : `${eok}억 ${rest.toLocaleString("en-US")}`;
}

/** 거래 유형에 맞는 가격 문자열. 월세는 구 사이트처럼 "보증금/월세"로 합친다. */
function priceText(article: FinArticle): string {
  const { dealPrice, warrantyPrice, rentPrice } = article.priceInfo;
  if (article.tradeType === "A1") return formatWon(dealPrice);
  if (rentPrice > 0) return `${formatWon(warrantyPrice)}/${formatWon(rentPrice)}`;
  return formatWon(warrantyPrice);
}

function priceChangeState(status: number | undefined): string {
  if (!status) return "SAME";
  return status > 0 ? "UP" : "DOWN";
}

function parseArticle(article: FinArticle, complexNo: string): Listing {
  const detail = article.articleDetail ?? {};
  return {
    articleId: article.articleNumber,
    complexNo,
    articleName: article.articleName ?? "",
    tradeType: TRADE_TYPE_NAMES[article.tradeType] ?? article.tradeType,
    price: priceText(article),
    // 구 사이트는 면적을 정수로 잘라 줬고(49.69 → 49) DB 행도 그렇게 쌓였다. 맞춰 둔다.
    area: Math.floor(article.spaceInfo.exclusiveSpace),
    supplyArea: Math.floor(article.spaceInfo.supplySpace),
    floor: detail.floorInfo ?? "",
    // "1403" → "1403동". 이미 "동"으로 끝나는 이름(예: "상가동")엔 붙이지 않는다.
    buildingName: !article.dongName
      ? ""
      : article.dongName.endsWith("동")
        ? article.dongName
        : `${article.dongName}동`,
    direction: detail.direction ? (DIRECTION_NAMES[detail.direction] ?? detail.direction) : "",
    description: detail.articleFeatureDescription ?? "",
    // "2026-11-06" → "20261106" (구 사이트 형식)
    confirmDate: (article.verificationInfo?.articleConfirmDate ?? "").replaceAll("-", ""),
    realtorName: article.brokerInfo?.brokerageName ?? "",
    priceChangeState: priceChangeState(article.priceInfo.priceChangeStatus),
  };
}

/**
 * 단지 매물을 끝까지 받아 온다. 브라우저 안에서 실행된다.
 *
 * 스크롤로 다음 페이지를 부르게 하지 않고 사이트가 쓰는 API를 직접 부른다. 스크롤은
 * 목록 컨테이너 셀렉터에 묶여 있어 화면 개편 한 번에 조용히 첫 페이지만 받게 된다.
 * 같은 출처에서 부르므로 쿠키는 사이트가 쓰는 그대로 실린다.
 *
 * 사이트 자신의 요청에는 x-attest 헤더가 붙지만 2026-11 기준 없어도 응답한다.
 * 이 호출이 갑자기 실패하면 그 헤더를 요구하기 시작했는지부터 본다.
 */
async function fetchAllPagesInPage(args: {
  complexNumber: number;
  path: string;
  size: number;
  maxPages: number;
}): Promise<FinListPage[]> {
  const pages: FinListPage[] = [];
  let lastInfo: unknown[] = [];
  let seed: string | undefined;

  for (let i = 0; i < args.maxPages; i++) {
    const res = await fetch(args.path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        size: args.size,
        complexNumber: args.complexNumber,
        tradeTypes: [],
        pyeongTypes: [],
        dongNumbers: [],
        userChannelType: "PC",
        articleSortType: "RANKING_DESC",
        lastInfo,
        // 랭킹 정렬은 seed로 순서를 고정한다. 첫 응답의 seed를 이어 써야 페이지 사이에 중복·누락이 없다.
        ...(seed ? { seed } : {}),
      }),
    });
    const json = await res.json().catch(() => null);
    const result = json?.result;
    pages.push({
      status: res.status,
      isSuccess: json?.isSuccess === true,
      detailCode: json?.detailCode,
      list: result?.list ?? [],
      totalCount: result?.totalCount ?? -1,
      hasNextPage: result?.hasNextPage === true,
    });
    if (!res.ok || json?.isSuccess !== true || result?.hasNextPage !== true) break;
    lastInfo = result.lastInfo;
    seed = result.seed;
  }
  return pages;
}

/**
 * Playwright로 신 네이버부동산 단지 페이지를 열고, 그 안에서 매물 API를 끝까지 부른다.
 *
 * 거래 유형 필터를 걸지 않는다. 매매·전세·월세를 한 번에 받아서 코드에서 나누면
 * 브라우저를 유형마다 새로 띄우지 않아도 되고, 자동화 탐지에 노출되는 횟수도 줄어든다.
 * 반환값은 관심 면적으로만 걸러진 전 거래 유형 매물이다.
 */
export async function fetchListings(apt: ApartmentItem): Promise<Listing[]> {
  let pages: FinListPage[] = [];

  let context: BrowserContext | null = null;
  try {
    context = await launchNaverBrowser();
    // 영속 프로필은 빈 탭 하나를 띄운 채로 열린다. 새 탭을 또 만들지 않고 그걸 쓴다.
    const page = context.pages()[0] ?? (await context.newPage());

    // webdriver 플래그 제거 (자동화 감지 우회)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    // 사이트가 스스로 매물 목록을 불러야 페이지가 제대로 열린 것이다. 이걸 못 보면
    // 차단·구조 변경이고, 그 상태에서 API를 직접 불러 봐야 믿을 수 없다.
    const firstList = page.waitForResponse(
      (r) => r.url().includes(LIST_PATH) && r.status() === 200,
      { timeout: 45000 },
    );
    // goto가 먼저 던지면 firstList는 아무도 기다리지 않은 채 context.close()로 reject된다.
    // 핸들러가 없으면 unhandledRejection으로 프로세스가 죽고 원래 에러가 가려진다.
    firstList.catch(() => {});
    await page.goto(`${ORIGIN}/complexes/${apt.naverComplexId}?tab=article`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await firstList.catch((err) => {
      throw new Error(
        `[naver] 단지 ${apt.naverComplexId}: 사이트가 매물 목록을 불러오지 않았습니다. ` +
          "차단됐거나 페이지 구조가 바뀌었을 수 있습니다.",
        { cause: err },
      );
    });

    pages = await page.evaluate(fetchAllPagesInPage, {
      complexNumber: Number(apt.naverComplexId),
      path: LIST_PATH,
      size: PAGE_SIZE,
      maxPages: MAX_PAGES,
    });
  } catch (err) {
    // 여기서 삼키면 빈 배열이 "매물 전부 내려감"으로 둔갑해 DB의 활성 매물이 통째로 꺼진다.
    throw new Error(`[naver] 단지 ${apt.naverComplexId} 수집 실패`, { cause: err });
  } finally {
    if (context) await context.close();
  }

  const last = pages.at(-1);
  if (!last || last.status !== 200 || !last.isSuccess) {
    throw new Error(
      `[naver] 단지 ${apt.naverComplexId}: 매물 API 응답 실패 ` +
        `(HTTP ${last?.status ?? "없음"}, ${last?.detailCode ?? "응답 없음"}).`,
    );
  }

  /**
   * 부분 수집이 0건보다 위험하다. 39건 중 30건만 받으면 나머지 9건이 조용히 "내려감"으로
   * 처리되는데, 건수만 봐서는 정상과 구분되지 않는다. 마지막 페이지(hasNextPage=false)에
   * 닿았는지와, 받은 묶음 수가 서버가 알려준 totalCount와 같은지를 둘 다 본다.
   */
  const groups = pages.flatMap((p) => p.list);
  if (last.hasNextPage) {
    throw new Error(
      `[naver] 단지 ${apt.naverComplexId}: 매물 목록을 끝까지 못 읽었습니다 ` +
        `(${MAX_PAGES}페이지 ${groups.length}건까지 받고도 다음 페이지가 남음).`,
    );
  }
  if (groups.length !== last.totalCount) {
    throw new Error(
      `[naver] 단지 ${apt.naverComplexId}: 받은 매물 ${groups.length}건이 ` +
        `전체 ${last.totalCount}건과 다릅니다. 페이지네이션이 바뀌었을 수 있습니다.`,
    );
  }

  const listings = groups.map((g) => parseArticle(g.representativeArticleInfo, apt.naverComplexId));

  // 페이지 경계에서 같은 묶음이 다시 실려 올 수 있다.
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
    `[naver] 단지 ${apt.naverComplexId}: ${pages.length}페이지 전체 ${unique.length}건 중 관심 면적 ${filtered.length}건 (${breakdown})`,
  );
  return filtered;
}
