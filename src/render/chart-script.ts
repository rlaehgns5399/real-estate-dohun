/**
 * 브라우저에서 실행될 차트 스크립트. Chart.js가 로드된 뒤 실행된다.
 *
 * 설계 기준:
 * - y축은 grace로 위아래 여백을 둬서 최고/최저점이 축에 붙지 않게 한다
 * - 진입 애니메이션은 600ms easeOutQuart, reduced-motion이면 끈다
 * - 색은 CSS 토큰에서 읽어 라이트/다크가 자동으로 맞는다
 */
import { THEME_KEY, THEME_STORAGE } from "@/render/theme";

export const CHART_SCRIPT = `
(function () {
  var DATA = window.__PAGE_DATA__;
  if (!DATA || typeof Chart === "undefined") return;

  var charts = [];
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function token(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function eok(v) {
    return (Math.round(v / 100) / 100) + "억";
  }

  function monthDay(ms) {
    var d = new Date(ms);
    return (d.getUTCMonth() + 1) + "." + d.getUTCDate();
  }

  function fullDate(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + "." + String(d.getUTCMonth() + 1).padStart(2, "0") + "." +
      String(d.getUTCDate()).padStart(2, "0");
  }

  function xy(points) {
    return points.map(function (p) { return { x: p.t, y: p.y, floor: p.floor }; });
  }

  // zoom 플러그인은 UMD가 자동 등록하지 않는 빌드도 있어 방어적으로 등록한다.
  if (window.ChartZoom && Chart.registry.plugins.get("zoom") === undefined) {
    Chart.register(window.ChartZoom);
  }

  /** 확대/이동 상태일 때만 초기화 버튼을 보여준다 */
  function syncResetButton(chart, canvas) {
    var btn = document.querySelector('[data-reset="' + canvas.dataset.index + '"]');
    if (!btn) return;
    btn.hidden = !(chart.isZoomedOrPanned && chart.isZoomedOrPanned());
  }

  /** 범례 버튼의 on/off 상태를 차트에 반영한다 */
  function applyLegendState(canvas, chart) {
    var card = canvas.closest(".chart-card");
    if (!card) return;

    card.querySelectorAll(".legend-item").forEach(function (item) {
      var visible = item.getAttribute("aria-pressed") !== "false";
      var labels = item.dataset.series.split(",");
      chart.data.datasets.forEach(function (dataset, i) {
        if (labels.indexOf(dataset.label) !== -1) chart.setDatasetVisibility(i, visible);
      });
    });
    chart.update("none");
  }

  function build(canvas) {
    var apt = DATA.apartments[Number(canvas.dataset.index)];
    if (!apt) return;

    var c = {
      deal: token("--deal"),
      ask: token("--ask"),
      kb: token("--kb"),
      mine: token("--mine"),
      border: token("--border"),
      grid: token("--grid"),
      bandAsk: token("--band-ask"),
      bandKb: token("--band-kb"),
      muted: token("--muted"),
      card: token("--card"),
      text: token("--text"),
    };

    // Chart.js 자동 스케일은 데이터가 없는 구간까지 축을 넓히므로 x는 실제 범위로 고정한다.
    var times = [].concat(
      apt.chart.transactions, apt.chart.kbGeneral, apt.chart.kbLower,
      apt.chart.kbUpper, apt.chart.askLow, apt.chart.askHigh
    ).map(function (p) { return p.t; });
    var pad = 3 * 24 * 60 * 60 * 1000;
    var xMin = times.length ? Math.min.apply(null, times) - pad : undefined;
    var xMax = times.length ? Math.max.apply(null, times) + pad : undefined;

    var datasets = [
      {
        type: "line", label: "KB 상위평균", data: xy(apt.chart.kbUpper),
        borderColor: "transparent",
        backgroundColor: c.bandKb,
        fill: "+1", pointRadius: 0, pointHitRadius: 0,
        cubicInterpolationMode: "monotone", order: 6,
      },
      {
        type: "line", label: "KB 하위평균", data: xy(apt.chart.kbLower),
        borderColor: "transparent", pointRadius: 0, pointHitRadius: 0,
        cubicInterpolationMode: "monotone", order: 6,
      },
      {
        type: "line", label: "KB 일반가", data: xy(apt.chart.kbGeneral),
        borderColor: c.kb, borderWidth: 1.5, pointRadius: 0,
        cubicInterpolationMode: "monotone", order: 4,
      },
      {
        type: "line", label: "호가 최고", data: xy(apt.chart.askHigh),
        borderColor: "transparent",
        backgroundColor: c.bandAsk,
        fill: "+1", pointRadius: 0, pointHitRadius: 0,
        cubicInterpolationMode: "monotone", order: 5,
      },
      {
        type: "line", label: "호가 최저", data: xy(apt.chart.askLow),
        borderColor: "transparent", pointRadius: 0, pointHitRadius: 0,
        cubicInterpolationMode: "monotone", order: 5,
      },
    ];

    // 매입가 기준선 — 축 전체를 가로지르는 평평한 점선.
    // 이 데이터셋이 y 스케일 계산에 포함되므로 기준선이 잘리지 않는다.
    var purchase = apt.summary.purchasePrice;
    if (purchase && xMin !== undefined) {
      datasets.push({
        type: "line",
        label: "매입가",
        data: [{ x: xMin, y: purchase }, { x: xMax, y: purchase }],
        borderColor: c.mine, borderWidth: 1.5, borderDash: [2, 3],
        pointRadius: 0, pointHitRadius: 0, order: 2,
      });
    }

    datasets.push({
      type: "scatter", label: "실거래", data: xy(apt.chart.transactions),
      backgroundColor: c.deal, borderColor: c.card, borderWidth: 1.5,
      pointRadius: 3.2, pointHoverRadius: 5.5, pointHoverBorderWidth: 2,
      borderWidth: 1, order: 1,
    });

    var chart = new Chart(canvas.getContext("2d"), {
      data: { datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reduceMotion ? false : { duration: 600, easing: "easeOutQuart" },
        interaction: { mode: "nearest", intersect: false },
        layout: { padding: { top: 4, right: 4 } },
        scales: {
          x: {
            type: "linear",
            min: xMin,
            max: xMax,
            border: { color: c.border },
            grid: { color: c.grid, drawTicks: false },
            ticks: {
              color: c.muted, font: { size: 11 }, maxTicksLimit: 7,
              padding: 8, callback: function (v) { return monthDay(v); },
            },
          },
          y: {
            // 최고/최저점이 축에 딱 붙지 않도록 위아래 여백을 준다.
            grace: "14%",
            border: { display: false },
            grid: { color: c.grid, drawTicks: false },
            ticks: {
              color: c.muted, font: { size: 11 }, padding: 10, maxTicksLimit: 6,
              callback: function (v) { return (v / 10000).toFixed(1) + "억"; },
            },
          },
        },
        plugins: {
          legend: { display: false },
          // 가로로 밀어서 이동, 핀치/휠로 확대. 세로 스크롤은 페이지에 넘긴다.
          zoom: {
            pan: {
              enabled: true,
              mode: "x",
              onPanComplete: function (ctx) { syncResetButton(ctx.chart, canvas); },
            },
            zoom: {
              wheel: { enabled: true, speed: 0.08 },
              pinch: { enabled: true },
              mode: "x",
              onZoomComplete: function (ctx) { syncResetButton(ctx.chart, canvas); },
            },
            // 데이터가 있는 구간 밖으로는 나가지 않게 하고, 최소 2주까지만 확대한다.
            limits: {
              x: { min: xMin, max: xMax, minRange: 14 * 24 * 60 * 60 * 1000 },
            },
          },
          tooltip: {
            backgroundColor: c.card,
            titleColor: c.text,
            bodyColor: c.text,
            borderColor: c.border,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 9,
            displayColors: true,
            boxPadding: 4,
            titleFont: { size: 12, weight: "600" },
            bodyFont: { size: 12 },
            callbacks: {
              title: function (items) { return fullDate(items[0].parsed.x); },
              label: function (ctx) {
                var base = ctx.dataset.label + " " + eok(ctx.parsed.y);
                var floor = ctx.raw && ctx.raw.floor;
                return floor ? base + " (" + floor + "층)" : base;
              },
            },
          },
        },
      },
    });

    // 테마가 바뀌면 차트를 새로 만들므로, 꺼둔 계열을 다시 반영해준다.
    applyLegendState(canvas, chart);

    charts.push(chart);

    var reset = document.querySelector('[data-reset="' + canvas.dataset.index + '"]');
    if (reset) {
      reset.onclick = function () {
        chart.resetZoom();
        syncResetButton(chart, canvas);
      };
    }
  }

  document.querySelectorAll("canvas[data-index]").forEach(build);

  // 차트 색은 CSS 토큰에서 읽으므로 테마가 바뀌면 다시 그려야 한다.
  function rebuildAll() {
    charts.splice(0).forEach(function (chart) { chart.destroy(); });
    document.querySelectorAll("canvas[data-index]").forEach(build);
  }

  var themeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  if (themeQuery.addEventListener) themeQuery.addEventListener("change", rebuildAll);

  // 테마 스위치: 시스템 → 라이트 → 다크 순환
  var toggle = document.getElementById("theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var root = document.documentElement;
      var current = root.getAttribute("data-theme");
      var next = current === null ? "light" : current === "light" ? "dark" : null;

      if (next) root.setAttribute("data-theme", next);
      else root.removeAttribute("data-theme");

      try {
        if (next) ${THEME_STORAGE}.setItem("${THEME_KEY}", next);
        else ${THEME_STORAGE}.removeItem("${THEME_KEY}");
      } catch (e) { /* 저장 불가한 환경 — 이번 페이지에서만 적용된다 */ }

      rebuildAll();
    });
  }

  // 범례 클릭으로 계열 켜고 끄기
  document.querySelectorAll(".legend-item").forEach(function (item) {
    item.addEventListener("click", function () {
      var card = item.closest(".chart-card");
      var canvas = card && card.querySelector("canvas[data-index]");
      var chart = canvas && Chart.getChart(canvas);
      if (!chart) return;

      item.setAttribute("aria-pressed", String(item.getAttribute("aria-pressed") === "false"));
      applyLegendState(canvas, chart);
    });
  });

  // 매물 목록: 20건까지만 보여주고 나머지는 "더 보기"로 펼친다
  var PAGE_SIZE = 20;

  function applyLimit(list) {
    var limit = Number(list.dataset.limit) || 0;
    var rows = Array.prototype.slice.call(list.children);
    rows.forEach(function (row, i) { row.hidden = limit > 0 && i >= limit; });

    var btn = document.querySelector('[data-more="' + list.id + '"]');
    if (!btn) return;

    var remaining = rows.length - limit;
    if (limit <= 0 || remaining <= 0) {
      btn.hidden = true;
    } else {
      btn.hidden = false;
      btn.textContent = remaining + "건 더 보기";
    }
  }

  document.querySelectorAll("[data-limit]").forEach(applyLimit);

  document.querySelectorAll("[data-more]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var list = document.getElementById(btn.dataset.more);
      if (!list) return;
      list.dataset.limit = String((Number(list.dataset.limit) || 0) + PAGE_SIZE);
      applyLimit(list);
    });
  });

  // 매물 정렬 토글
  document.querySelectorAll("[data-sorts]").forEach(function (group) {
    var list = document.getElementById(group.dataset.sorts);
    if (!list) return;

    group.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-sort]");
      if (!btn) return;

      group.querySelectorAll("button").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });

      var key = btn.dataset.sort;
      var rows = Array.prototype.slice.call(list.children);
      rows.sort(function (a, b) {
        if (key === "price") return Number(a.dataset.price) - Number(b.dataset.price);
        if (key === "recent") return Number(a.dataset.days) - Number(b.dataset.days);
        return Number(b.dataset.days) - Number(a.dataset.days);
      });
      rows.forEach(function (row) { list.appendChild(row); });
      // 정렬이 바뀌면 새 순서 기준으로 앞에서부터 다시 잘라 보여준다.
      applyLimit(list);
    });
  });
})();
`;
