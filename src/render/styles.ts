/**
 * 페이지 전역 스타일.
 *
 * 설계 기준 (emilkowalski/skills — emil-design-eng, apple-design):
 * - 트래킹은 크기별로 다르게: 큰 글자는 음수, 본문은 0, 작은 라벨은 살짝 양수
 * - 리딩은 크기와 반비례
 * - 커스텀 이징 곡선 사용, UI 전환은 300ms 이하, ease-in 금지
 * - transform/opacity만 애니메이션
 * - 반투명 머티리얼 + 스크롤 엣지 그라데이션 (하드 디바이더 대신)
 * - hover는 포인터 기기에서만, reduced-motion/transparency/contrast 대응
 */
const DARK_TOKENS = `
  --bg: #0a0a0c;
  --card: #16171a;
  --border: #2a2b31;
  --text: #f2f2f5;
  --muted: #98989f;
  --faint: #6b6b73;

  --deal: #30d158;
  --ask: #ff9f0a;
  --kb: #7d7aff;
  --mine: #ff6482;
  --pos: #30d158;
  --neg: #ff6482;

  --band-ask: rgba(255, 159, 10, .09);
  --band-kb: rgba(125, 122, 255, .07);
  --grid: #23242a;

  --scrim: rgba(10, 10, 12, .72);
  --shadow-sm: none;
  --shadow-md: none;
`;

export const STYLES = `
:root {
  color-scheme: light dark;

  --bg: #fbfbfd;
  --card: #ffffff;
  --border: #e7e7ec;
  --text: #1d1d1f;
  --muted: #6e6e73;
  --faint: #a1a1a6;

  --deal: #007a55;
  --ask: #b26a00;
  --kb: #4c46c9;
  --mine: #c9184a;
  --pos: #007a55;
  --neg: #c9184a;

  /* 차트 전용 — 투명도가 배경에 따라 달라야 해서 테마별로 완성된 색을 정의한다 */
  --band-ask: rgba(178, 106, 0, .14);
  --band-kb: rgba(76, 70, 201, .11);
  --grid: #e6e6ec;

  --scrim: rgba(251, 251, 253, .72);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, .04), 0 1px 1px rgba(0, 0, 0, .03);
  --shadow-md: 0 1px 2px rgba(0, 0, 0, .04), 0 8px 24px rgba(0, 0, 0, .05);

  --ease-out: cubic-bezier(.23, 1, .32, 1);
  --ease-in-out: cubic-bezier(.77, 0, .175, 1);

  --r-sm: 9px;
  --r-md: 14px;
  --r-lg: 18px;
}

/*
 * 테마는 기본적으로 시스템 설정을 따르고, 사용자가 스위치로 고른 경우
 * data-theme 속성이 양방향으로 이를 덮는다.
 */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${DARK_TOKENS}
  }
}
:root[data-theme="dark"] {
${DARK_TOKENS}
}
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; }

* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }

body {
  margin: 0;
  padding: 0 0 5rem;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Apple SD Gothic Neo",
    "Pretendard", "Noto Sans KR", system-ui, sans-serif;
  /* 본문: 트래킹 0, 넉넉한 리딩 */
  font-size: 0.9375rem;
  line-height: 1.55;
  letter-spacing: 0;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.wrap { max-width: 780px; margin: 0 auto; padding: 0 1.125rem; }

/* ── 반투명 상단바: 콘텐츠가 아래로 흐르고, 경계는 그라데이션으로 ── */
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--scrim);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
}
.topbar::after {
  content: "";
  position: absolute;
  inset: 100% 0 auto 0;
  height: 16px;
  background: linear-gradient(var(--bg), transparent);
  pointer-events: none;
}
.topbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: .75rem;
  padding-bottom: .75rem;
}
.topbar-name {
  font-size: .8125rem;
  font-weight: 600;
  letter-spacing: -.005em;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.topbar-price {
  font-size: .8125rem;
  font-weight: 600;
  letter-spacing: -.01em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.topbar-price em { font-style: normal; margin-left: .375rem; }

.topbar-right { display: flex; align-items: center; gap: .625rem; flex: none; }
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  color: var(--muted);
  cursor: pointer;
  transition: transform 140ms var(--ease-out), color 140ms var(--ease-out),
    border-color 140ms var(--ease-out);
}
.theme-toggle:active { transform: scale(.92); }
@media (hover: hover) and (pointer: fine) {
  .theme-toggle:hover { color: var(--text); border-color: var(--faint); }
}
.theme-toggle svg { width: 15px; height: 15px; display: none; }
/* 현재 모드에 해당하는 아이콘만 CSS로 보여준다 (JS 아이콘 교체 불필요) */
.theme-toggle .i-system { display: block; }
:root[data-theme="light"] .theme-toggle .i-system,
:root[data-theme="dark"] .theme-toggle .i-system { display: none; }
:root[data-theme="light"] .theme-toggle .i-light { display: block; }
:root[data-theme="dark"] .theme-toggle .i-dark { display: block; }

@media (prefers-reduced-transparency: reduce) {
  .topbar { background: var(--bg); backdrop-filter: none; -webkit-backdrop-filter: none; }
}
@media (prefers-contrast: more) {
  .topbar { background: var(--bg); border-bottom: 1px solid var(--text); }
  .card { border-color: var(--muted); }
}

/* ── 히어로 ── */
.hero { padding: 2.25rem 0 1.75rem; }
.hero h1 {
  margin: 0;
  /* 큰 글자: 음수 트래킹, 타이트한 리딩 */
  font-size: clamp(1.5rem, 6vw, 1.875rem);
  font-weight: 700;
  line-height: 1.12;
  letter-spacing: -.028em;
}
.hero-sub {
  margin: .375rem 0 0;
  font-size: .8125rem;
  line-height: 1.5;
  letter-spacing: .003em;
  color: var(--muted);
}
.hero-sub a {
  color: var(--muted);
  text-decoration: none;
  border-bottom: 1px solid var(--border);
  transition: color 160ms var(--ease-out), border-color 160ms var(--ease-out);
}
@media (hover: hover) and (pointer: fine) {
  .hero-sub a:hover { color: var(--text); border-color: var(--faint); }
}

.hero-stat { margin-top: 1.75rem; }
.hero-label {
  font-size: .75rem;
  font-weight: 600;
  letter-spacing: .045em;
  text-transform: uppercase;
  color: var(--muted);
}
.hero-value {
  /* 디스플레이: 가장 강한 음수 트래킹 + 리딩 1.0 */
  margin-top: .3125rem;
  font-size: clamp(2.75rem, 13vw, 3.75rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -.045em;
  font-variant-numeric: tabular-nums;
}
.hero-delta {
  margin-top: .5rem;
  font-size: .875rem;
  line-height: 1.5;
  letter-spacing: 0;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.hero-delta b { font-weight: 600; }
.pos { color: var(--pos); }
.neg { color: var(--neg); }

/* ── 섹션 ── */
section { margin-bottom: 1.5rem; }
h2 {
  font-size: .75rem;
  font-weight: 600;
  letter-spacing: .075em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0 0 .6875rem;
}
h2 .h2-note {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
  color: var(--faint);
}

.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-sm);
}

/* ── 보조 지표 ── */
.stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: .625rem; }
@media (min-width: 620px) { .stats { grid-template-columns: repeat(4, 1fr); } }
.stat { padding: .875rem .9375rem 1rem; }
.stat .label {
  font-size: .6875rem;
  font-weight: 500;
  letter-spacing: .02em;
  color: var(--muted);
}
.stat .value {
  margin: .1875rem 0 .125rem;
  font-size: 1.375rem;
  font-weight: 650;
  line-height: 1.15;
  letter-spacing: -.022em;
  font-variant-numeric: tabular-nums;
}
.stat .note {
  font-size: .6875rem;
  line-height: 1.45;
  letter-spacing: .012em;
  color: var(--faint);
}
.stat.ask .value { color: var(--ask); }
.stat.kb .value { color: var(--kb); }

/* ── 차트 ── */
.chart-card { padding: 1.125rem 1rem .9375rem; border-radius: var(--r-lg); box-shadow: var(--shadow-md); }
.chart-head { display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem; }
.chart-reset {
  flex: none;
  font: inherit;
  font-size: .6875rem;
  font-weight: 500;
  letter-spacing: .015em;
  padding: .25rem .5rem;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--muted);
  border-radius: var(--r-sm);
  cursor: pointer;
  white-space: nowrap;
  transition: transform 140ms var(--ease-out), color 140ms var(--ease-out);
}
.chart-reset:active { transform: scale(.96); }
@media (hover: hover) and (pointer: fine) { .chart-reset:hover { color: var(--text); } }

.chart-box { position: relative; height: 306px; }
/*
 * 가로 제스처(팬·핀치)는 차트가, 세로 스크롤은 브라우저가 가져간다.
 * zoom 플러그인이 캔버스에 인라인으로 touch-action: none을 박아서
 * 그대로 두면 차트 위에서 시작한 세로 스크롤이 먹통이 된다. !important로 되돌린다.
 */
.chart-box canvas { touch-action: pan-y !important; }
@media (min-width: 620px) { .chart-box { height: 348px; } }
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: .375rem;
  margin-bottom: .875rem;
  font-size: .6875rem;
  letter-spacing: .015em;
  color: var(--muted);
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: .375rem;
  white-space: nowrap;
  font: inherit;
  font-size: .6875rem;
  letter-spacing: .015em;
  color: var(--text);
  padding: .25rem .5625rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--card);
  cursor: pointer;
  transition: transform 140ms var(--ease-out), opacity 160ms var(--ease-out),
    border-color 140ms var(--ease-out), background-color 140ms var(--ease-out);
}
.legend-item:active { transform: scale(.94); }
@media (hover: hover) and (pointer: fine) {
  .legend-item:hover { border-color: var(--faint); }
}
/* 꺼진 칩은 흐리게 — 목록에서 사라지지 않아야 다시 켤 수 있다 */
.legend-item[aria-pressed="false"] {
  opacity: .45;
  background: none;
  color: var(--muted);
}
.swatch { width: 14px; height: 2.5px; border-radius: 2px; display: inline-block; flex: none; }
.swatch.dot { width: 8px; height: 8px; border-radius: 50%; }
.swatch.dash { background: repeating-linear-gradient(90deg, currentColor 0 4px, transparent 4px 7px); }

/* ── 매물 ── */
.list-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: .5rem;
  margin-bottom: .6875rem;
}
.list-head h2 { margin: 0; }
.sorts { display: flex; gap: .25rem; flex: none; }
.sorts button {
  font: inherit;
  font-size: .6875rem;
  font-weight: 500;
  letter-spacing: .015em;
  padding: .3125rem .5625rem;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--muted);
  border-radius: var(--r-sm);
  cursor: pointer;
  white-space: nowrap;
  /* 누르는 순간 반응 — transform만, ease-out, 140ms */
  transition: transform 140ms var(--ease-out), color 140ms var(--ease-out),
    border-color 140ms var(--ease-out);
}
.sorts button:active { transform: scale(.96); }
.sorts button[aria-pressed="true"] { color: var(--text); border-color: var(--faint); font-weight: 600; }
@media (hover: hover) and (pointer: fine) {
  .sorts button:hover { color: var(--text); }
}

.listing {
  display: flex;
  gap: .875rem;
  padding: .875rem .9375rem;
  border-bottom: 1px solid var(--border);
}
.listing:last-child { border-bottom: 0; }
.listing .price {
  flex: 0 0 4.25rem;
  font-size: 1.0625rem;
  font-weight: 650;
  line-height: 1.35;
  letter-spacing: -.022em;
  font-variant-numeric: tabular-nums;
  color: var(--ask);
}
.listing .body { min-width: 0; flex: 1; }
.listing .where { font-size: .875rem; font-weight: 500; letter-spacing: -.005em; }
.listing .desc {
  margin-top: .1875rem;
  font-size: .8125rem;
  line-height: 1.45;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.listing .meta {
  margin-top: .25rem;
  font-size: .6875rem;
  letter-spacing: .015em;
  color: var(--faint);
}
.badges { display: inline-flex; gap: .3125rem; margin-left: .375rem; vertical-align: middle; }
.badge {
  font-size: .625rem;
  font-weight: 600;
  letter-spacing: .02em;
  padding: .0625rem .375rem;
  border-radius: 6px;
  border: 1px solid transparent;
  white-space: nowrap;
}
.badge.new { color: var(--deal); border-color: color-mix(in srgb, var(--deal) 45%, transparent); }
.badge.stale { color: var(--faint); border-color: var(--border); }

/* ── 더 보기 ── */
.more {
  display: block;
  width: 100%;
  margin-top: .5rem;
  font: inherit;
  font-size: .75rem;
  font-weight: 500;
  letter-spacing: .015em;
  padding: .625rem;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--card);
  color: var(--muted);
  cursor: pointer;
  transition: transform 140ms var(--ease-out), color 140ms var(--ease-out);
}
.more:active { transform: scale(.99); }
@media (hover: hover) and (pointer: fine) { .more:hover { color: var(--text); } }

/* ── 펼침 공통 (타임라인 / 실거래 월 그룹) ── */
summary { list-style: none; cursor: pointer; user-select: none; }
summary::-webkit-details-marker { display: none; }
.chev {
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
  margin-left: auto;
  color: var(--faint);
  transition: transform 180ms var(--ease-out);
}
details[open] > summary .chev { transform: rotate(90deg); }
@media (prefers-reduced-motion: reduce) { .chev { transition: none; } }

/* ── 타임라인 ── */
.tl { padding: .375rem 0; }
.tl-row { display: flex; gap: .75rem; padding: .4375rem .9375rem; align-items: center; }
@media (hover: hover) and (pointer: fine) {
  .tl-group > summary:hover { background: color-mix(in srgb, var(--text) 4%, transparent); }
}
.tl-detail { padding: .125rem .9375rem .5rem 4.75rem; }
.tl-line {
  display: flex;
  gap: .625rem;
  align-items: baseline;
  padding: .1875rem 0;
  font-size: .75rem;
  letter-spacing: .01em;
}
.tl-line .p {
  flex: 0 0 3.25rem;
  font-weight: 600;
  color: var(--ask);
  font-variant-numeric: tabular-nums;
}
.tl-line .w { color: var(--text); white-space: nowrap; }
.tl-line .n {
  color: var(--faint);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tl-row .date {
  flex: 0 0 3rem;
  font-size: .6875rem;
  letter-spacing: .02em;
  color: var(--faint);
  font-variant-numeric: tabular-nums;
}
.tl-row .mark { flex: 0 0 1rem; text-align: center; font-size: .75rem; }
.tl-row .what { font-size: .8125rem; letter-spacing: -.003em; }
.tl-row .what .detail { color: var(--muted); margin-left: .375rem; font-variant-numeric: tabular-nums; }
.tl-row.deal .what { color: var(--deal); font-weight: 600; }

/* ── 실거래 표 ── */
.mo-group { border-bottom: 1px solid var(--border); }
.mo-group:last-child { border-bottom: 0; }
.mo-row { display: flex; align-items: center; gap: .75rem; padding: .6875rem .9375rem; }
@media (hover: hover) and (pointer: fine) {
  .mo-row:hover { background: color-mix(in srgb, var(--text) 4%, transparent); }
}
.mo {
  font-size: .8125rem;
  font-weight: 650;
  letter-spacing: -.01em;
  font-variant-numeric: tabular-nums;
}
.mo-meta {
  font-size: .75rem;
  letter-spacing: .012em;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.mo-group .table-scroll { padding-bottom: .375rem; }
.mo-group th { border-bottom: 1px solid var(--border); }
.mo-group td { border-bottom: 0; padding-top: .3125rem; padding-bottom: .3125rem; }

.table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
table { width: 100%; border-collapse: collapse; font-size: .8125rem; }
th, td { padding: .5rem .9375rem; text-align: left; white-space: nowrap; }
th {
  font-size: .6875rem;
  font-weight: 600;
  letter-spacing: .03em;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
}
td { border-bottom: 1px solid var(--border); font-variant-numeric: tabular-nums; }
tr:last-child td { border-bottom: 0; }
th.num, td.num { text-align: right; }
td.mark-mine { color: var(--pos); font-weight: 600; }

.empty { padding: 1.75rem .9375rem; color: var(--faint); font-size: .8125rem; text-align: center; }
footer {
  padding-top: 1.25rem;
  text-align: center;
  font-size: .6875rem;
  letter-spacing: .015em;
  color: var(--faint);
}

/*
 * 진입 애니메이션은 첫 화면(히어로 + 지표)에만.
 * 스크롤해야 보이는 아래쪽은 애니메이션해도 보이지 않으므로 하지 않는다.
 * scale(0)에서 시작하지 않고, transform/opacity만 쓴다.
 */
.reveal {
  opacity: 0;
  transform: translateY(10px);
  animation: reveal 420ms var(--ease-out) forwards;
}
.reveal-1 { animation-delay: 0ms; }
.reveal-2 { animation-delay: 60ms; }
.reveal-3 { animation-delay: 120ms; }

@keyframes reveal {
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .reveal { transform: none; animation: fade 260ms ease forwards; }
  @keyframes fade { to { opacity: 1; } }
  .sorts button, .chart-reset, .theme-toggle, .more, .legend-item {
    transition: color 140ms ease, opacity 140ms ease;
  }
  .sorts button:active, .chart-reset:active, .theme-toggle:active,
  .more:active, .legend-item:active { transform: none; }
}
`;
