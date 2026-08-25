import { CHART_SCRIPT } from "@/render/chart-script";
import { STYLES } from "@/render/styles";
import { THEME_KEY, THEME_STORAGE } from "@/render/theme";
import type {
  ApartmentPage,
  PageData,
  PageListing,
  PageTransaction,
  TimelineEvent,
  TimelineItem,
} from "@/types/page";
import { formatEok, formatKstDateTime, formatMonthDay, formatYmd } from "@/utils/format";

const CHART_JS_CDN = "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js";
/** 터치 핀치 제스처 인식에 필요 (zoom 플러그인이 Hammer를 요구한다) */
const HAMMER_CDN = "https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js";
const CHART_ZOOM_CDN =
  "https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.2.0/dist/chartjs-plugin-zoom.min.js";

/** 매물이 오래 안 나가면 호가가 높다는 신호 — 이 일수부터 배지를 붙인다 */
const STALE_DAYS = 21;

/** 매물 목록을 한 번에 보여줄 개수 — 나머지는 "더 보기"로 펼친다 */
const PAGE_SIZE = 20;

/** 실거래 월 그룹 중 처음부터 펼쳐둘 개월 수 */
const OPEN_MONTHS = 2;

/**
 * 테마 스위치. 시스템 → 라이트 → 다크를 순환하며 선택은 브라우저에 영구 저장된다.
 * 아이콘 전환은 CSS가 data-theme을 보고 처리한다.
 */
const THEME_TOGGLE = `<button type="button" class="theme-toggle" id="theme-toggle"
        aria-label="테마 전환" title="테마 전환 (시스템 → 라이트 → 다크)">
        <svg class="i-system" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>
        <svg class="i-light" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
        </svg>
        <svg class="i-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
        </svg>
      </button>`;

/** 첫 페인트 전에 저장된 테마를 적용해 잘못된 색이 번쩍이는 걸 막는다 */
const THEME_BOOT =
  `(function(){try{var t=${THEME_STORAGE}.getItem("${THEME_KEY}");` +
  `if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

function esc(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** JSON을 <script> 안에 안전하게 심는다 */
function jsonScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** 부호를 명시한 억 단위 표기 — "+0.4억" / "−0.4억" */
function signedEok(value: number): string {
  return `${value >= 0 ? "+" : "−"}${formatEok(Math.abs(value))}`;
}

function signedPct(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

function toneClass(value: number): string {
  return value >= 0 ? "pos" : "neg";
}

/** 스크롤해도 남는 상단바 — 이름과 핵심 숫자만 */
function renderTopbar(apt: ApartmentPage): string {
  const s = apt.summary;
  const price = s.lastDeal ? formatEok(s.lastDeal.price) : "—";
  const delta =
    s.vsPurchasePct !== null
      ? `<em class="${toneClass(s.vsPurchasePct)}">${esc(signedPct(s.vsPurchasePct))}</em>`
      : "";

  return `<div class="topbar">
    <div class="wrap topbar-inner">
      <span class="topbar-name">${esc(apt.name)} ${apt.targetArea}㎡</span>
      <span class="topbar-right">
        <span class="topbar-price">${esc(price)}${delta}</span>
        ${THEME_TOGGLE}
      </span>
    </div>
  </div>`;
}

/**
 * 히어로 — 지금 얼마고, 내 매입가 대비 얼마인가.
 * 매입가를 설정하지 않았으면 최근 실거래가만 크게 보여준다.
 */
function renderHero(apt: ApartmentPage): string {
  const s = apt.summary;
  const value = s.lastDeal ? formatEok(s.lastDeal.price) : "—";
  const basis = s.lastDeal ? `${formatMonthDay(s.lastDeal.dealDate)} 계약` : "실거래 없음";

  const delta =
    s.purchasePrice !== null && s.vsPurchase !== null && s.vsPurchasePct !== null
      ? `매입가 ${esc(formatEok(s.purchasePrice))} 대비
         <b class="${toneClass(s.vsPurchase)}">${esc(signedEok(s.vsPurchase))}
         (${esc(signedPct(s.vsPurchasePct))})</b> · ${esc(basis)}`
      : esc(basis);

  return `<header class="hero">
      <h1 class="reveal reveal-1">${esc(apt.name)}</h1>
      <p class="hero-sub reveal reveal-1">
        ${apt.targetArea}㎡ ${esc(apt.tradeType)} · ${esc(apt.address)} ·
        <a href="${esc(apt.naverUrl)}" target="_blank" rel="noopener">네이버 부동산</a>
      </p>
      <div class="hero-stat reveal reveal-2">
        <div class="hero-label">최근 실거래가</div>
        <div class="hero-value">${esc(value)}</div>
        <div class="hero-delta">${delta}</div>
      </div>
    </header>`;
}

function statCard(label: string, value: string, note: string, tone = ""): string {
  return `<div class="card stat ${tone}">
        <div class="label">${esc(label)}</div>
        <div class="value">${esc(value)}</div>
        <div class="note">${esc(note)}</div>
      </div>`;
}

function renderStats(apt: ApartmentPage): string {
  const s = apt.summary;

  const kbNote =
    s.kbLower !== null && s.kbUpper !== null
      ? `${formatEok(s.kbLower)} ~ ${formatEok(s.kbUpper)}`
      : "시세 없음";

  const gapValue = s.askDealGap === null ? "—" : signedEok(s.askDealGap);
  const gapNote =
    s.askDealGap === null
      ? "비교 불가"
      : s.askDealGap >= 0
        ? "호가가 실거래보다 높음"
        : "호가가 실거래보다 낮음";

  const listingNote = [
    s.newCount > 0 ? `신규 ${s.newCount}` : "",
    s.removedCount > 0 ? `내려감 ${s.removedCount}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return `<section class="stats reveal reveal-3">
      ${statCard(
        "최저 호가",
        s.lowestAsk !== null ? formatEok(s.lowestAsk) : "—",
        s.medianAsk !== null ? `중앙값 ${formatEok(s.medianAsk)}` : "매물 없음",
        "ask",
      )}
      ${statCard("KB 일반가", s.kbGeneral !== null ? formatEok(s.kbGeneral) : "—", kbNote, "kb")}
      ${statCard("호가 − 실거래", gapValue, gapNote)}
      ${statCard("현재 매물", `${s.activeCount}건`, listingNote || "최근 7일 변동 없음")}
    </section>`;
}

/**
 * 범례 항목. data-series는 이 항목이 켜고 끌 데이터셋 라벨 목록이다.
 * 밴드는 상/하한 두 데이터셋으로 이뤄져 있어 한 항목이 둘을 함께 토글한다.
 */
function legendItem(series: string, swatch: string, label: string): string {
  return `<button type="button" class="legend-item" data-series="${esc(series)}" aria-pressed="true">
            <i class="${swatch}"></i>${esc(label)}
          </button>`;
}

function renderChart(apt: ApartmentPage, index: number): string {
  // 데이터가 없는 계열은 범례에서도 뺀다 — 켤 게 없는 칩을 보여줄 이유가 없다.
  const items: string[] = [];

  if (apt.chart.transactions.length > 0) {
    items.push(legendItem("실거래", 'swatch dot" style="background:var(--deal)', "실거래"));
  }
  if (apt.chart.askLow.length > 0) {
    items.push(
      legendItem(
        "호가 최고,호가 최저",
        'swatch" style="background:var(--ask);opacity:.5',
        "호가 최저~최고",
      ),
    );
  }
  if (apt.chart.kbGeneral.length > 0) {
    items.push(legendItem("KB 일반가", 'swatch" style="background:var(--kb)', "KB 일반가"));
  }
  if (apt.chart.kbLower.length > 0) {
    items.push(
      legendItem(
        "KB 상위평균,KB 하위평균",
        'swatch" style="background:var(--kb);opacity:.5',
        "KB 하위~상위",
      ),
    );
  }
  if (apt.summary.purchasePrice !== null) {
    items.push(legendItem("매입가", 'swatch dash" style="color:var(--mine)', "매입가"));
  }

  return `<section>
      <h2>시세 추이</h2>
      <div class="card chart-card">
        <div class="chart-head">
          <div class="legend">${items.join("\n          ")}</div>
          <button type="button" class="chart-reset" data-reset="${index}" hidden>초기화</button>
        </div>
        <div class="chart-box"><canvas data-index="${index}"></canvas></div>
      </div>
    </section>`;
}

function renderListing(l: PageListing): string {
  const badges: string[] = [];
  if (l.isNew) badges.push('<span class="badge new">신규</span>');
  if (l.daysOnMarket >= STALE_DAYS) {
    badges.push(`<span class="badge stale">${l.daysOnMarket}일째</span>`);
  }

  const where = [l.buildingName, l.floor, l.direction].filter(Boolean).join(" · ");

  return `<div class="listing" data-price="${l.price}" data-days="${l.daysOnMarket}">
          <div class="price">${esc(formatEok(l.price))}</div>
          <div class="body">
            <div class="where">${esc(where)}${
              badges.length > 0 ? `<span class="badges">${badges.join("")}</span>` : ""
            }</div>
            <div class="desc" title="${esc(l.description)}">${esc(l.description) || "—"}</div>
            <div class="meta">확인 ${esc(formatYmd(l.confirmDate))} · ${esc(l.realtorName)}</div>
          </div>
        </div>`;
}

function renderListings(apt: ApartmentPage, index: number): string {
  const listId = `listings-${index}`;
  const body =
    apt.listings.length > 0
      ? apt.listings.map(renderListing).join("\n")
      : '<div class="empty">현재 등록된 매물이 없습니다.</div>';

  // 페이지네이션 대신 점진적 노출을 쓴다. 정렬을 바꿔도 페이지 상태가 꼬이지 않고
  // 스크롤 흐름이 끊기지 않는다.
  const more =
    apt.listings.length > PAGE_SIZE
      ? `<button type="button" class="more" data-more="${listId}"></button>`
      : "";

  return `<section>
      <div class="list-head">
        <h2>현재 매물 <span class="h2-note">${apt.summary.activeCount}건</span></h2>
        <div class="sorts" data-sorts="${listId}">
          <button type="button" data-sort="price" aria-pressed="true">가격순</button>
          <button type="button" data-sort="recent" aria-pressed="false">최신순</button>
          <button type="button" data-sort="oldest" aria-pressed="false">오래된순</button>
        </div>
      </div>
      <div class="card" id="${listId}" data-limit="${PAGE_SIZE}">${body}</div>
      ${more}
    </section>`;
}

const TIMELINE_MARK: Record<TimelineEvent["type"], string> = {
  new: "🆕",
  removed: "❌",
  deal: "💰",
};

const CHEVRON = `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 18l6-6-6-6"/></svg>`;

function renderTimelineItems(items: TimelineItem[]): string {
  return items
    .map(
      (item) => `<div class="tl-line">
            <span class="p">${esc(formatEok(item.price))}</span>
            <span class="w">${esc(item.where) || "—"}</span>
            <span class="n">${esc(item.note)}</span>
          </div>`,
    )
    .join("\n");
}

function renderTimelineEvent(event: TimelineEvent): string {
  const head = `<span class="date">${esc(formatMonthDay(event.date))}</span>
        <span class="mark">${TIMELINE_MARK[event.type]}</span>
        <span class="what">${esc(event.label)}<span class="detail">${esc(event.detail)}</span></span>`;

  // 실거래는 라벨에 가격과 층이 이미 다 들어 있어 펼칠 게 없다.
  if (event.type === "deal" || event.items.length === 0) {
    return `<div class="tl-row ${event.type}">${head}</div>`;
  }

  return `<details class="tl-group">
        <summary class="tl-row ${event.type}">${head}${CHEVRON}</summary>
        <div class="tl-detail">${renderTimelineItems(event.items)}</div>
      </details>`;
}

function renderTimeline(apt: ApartmentPage): string {
  if (apt.timeline.length === 0) {
    return `<section>
      <h2>최근 변동</h2>
      <div class="card"><div class="empty">최근 14일간 변동이 없습니다.</div></div>
    </section>`;
  }

  return `<section>
      <h2>최근 변동 <span class="h2-note">14일 · 눌러서 상세 보기</span></h2>
      <div class="card tl">${apt.timeline.map(renderTimelineEvent).join("\n")}</div>
    </section>`;
}

/** 실거래를 월 단위로 묶는다 — 건수가 늘어도 훑어보기 쉽고, 월별 흐름이 드러난다. */
function groupByMonth(transactions: PageTransaction[]): Array<{
  month: string;
  rows: PageTransaction[];
}> {
  const groups = new Map<string, PageTransaction[]>();
  for (const t of transactions) {
    const month = t.dealDate.slice(0, 7);
    const bucket = groups.get(month) ?? [];
    bucket.push(t);
    groups.set(month, bucket);
  }
  return [...groups.entries()]
    .map(([month, rows]) => ({ month, rows }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

function renderMonthGroup(
  group: { month: string; rows: PageTransaction[] },
  purchase: number | null,
  open: boolean,
): string {
  const prices = group.rows.map((t) => t.price).sort((a, b) => a - b);
  const avg = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);
  const low = prices[0];
  const high = prices[prices.length - 1];
  const range = low === high ? formatEok(low) : `${formatEok(low)} ~ ${formatEok(high)}`;

  const rows = group.rows
    .map((t) => {
      const vs = purchase !== null ? t.price - purchase : null;
      const vsCell =
        vs === null ? "" : `<td class="num ${toneClass(vs)}">${esc(signedEok(vs))}</td>`;

      return `<tr>
              <td>${esc(t.dealDate.slice(8).replace(/^0/, ""))}일</td>
              <td class="num">${esc(formatEok(t.price))}</td>
              <td class="num">${t.floor}층</td>
              ${vsCell}
            </tr>`;
    })
    .join("\n");

  const vsHead = purchase !== null ? '<th class="num">매입가 대비</th>' : "";
  const [year, month] = group.month.split("-");

  return `<details class="mo-group"${open ? " open" : ""}>
        <summary class="mo-row">
          <span class="mo">${esc(year)}.${esc(month)}</span>
          <span class="mo-meta">${group.rows.length}건 · 평균 ${esc(formatEok(avg))} · ${esc(range)}</span>
          ${CHEVRON}
        </summary>
        <div class="table-scroll">
          <table>
            <thead>
              <tr><th>계약일</th><th class="num">거래가</th><th class="num">층</th>${vsHead}</tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </details>`;
}

function renderTransactions(apt: ApartmentPage): string {
  if (apt.transactions.length === 0) {
    return `<section>
      <h2>실거래 내역</h2>
      <div class="card"><div class="empty">실거래 기록이 없습니다.</div></div>
    </section>`;
  }

  const groups = groupByMonth(apt.transactions);
  const body = groups
    .map((group, i) => renderMonthGroup(group, apt.summary.purchasePrice, i < OPEN_MONTHS))
    .join("\n");

  return `<section>
      <h2>실거래 내역 <span class="h2-note">${apt.transactions.length}건 · ${groups.length}개월</span></h2>
      <div class="card">${body}</div>
    </section>`;
}

function renderApartment(apt: ApartmentPage, index: number): string {
  return `<article>
      ${renderHero(apt)}
      ${renderStats(apt)}
      ${renderChart(apt, index)}
      ${renderListings(apt, index)}
      ${renderTimeline(apt)}
      ${renderTransactions(apt)}
    </article>`;
}

/** PageData → 단일 HTML 문서 */
export function renderHtml(data: PageData): string {
  const generated = formatKstDateTime(new Date(data.generatedAt));
  const first = data.apartments[0];
  const title = first ? `${first.name} ${first.targetArea}㎡` : "부동산 모니터";

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(title)} · 부동산 모니터</title>
<style>${STYLES}</style>
<script>${THEME_BOOT}</script>
</head>
<body>
${first ? renderTopbar(first) : ""}
<main class="wrap">
${data.apartments.map(renderApartment).join("\n")}
<footer>${esc(generated)} 기준 · 국토교통부 · KB부동산 · 네이버 부동산</footer>
</main>
<script>window.__PAGE_DATA__ = ${jsonScript(data)};</script>
<script src="${CHART_JS_CDN}"></script>
<script src="${HAMMER_CDN}"></script>
<script src="${CHART_ZOOM_CDN}"></script>
<script>${CHART_SCRIPT}</script>
</body>
</html>
`;
}
