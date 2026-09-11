import type { AreaPage } from "@shared/types/page";
import { formatEok } from "@shared/utils/format";
import {
  BarController,
  BarElement,
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  ScatterController,
  Tooltip,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import { useEffect, useMemo, useRef, useState } from "react";
import { readChartTokens } from "@/chartTokens";
import { Card, SectionTitle } from "@/components/Card";
import type { ResolvedTheme } from "@/hooks/useTheme";

// 필요한 것만 등록한다. chart.js/auto를 쓰면 안 쓰는 컨트롤러까지 번들에 들어간다.
Chart.register(
  LineController,
  ScatterController,
  BarController,
  BarElement,
  LineElement,
  PointElement,
  LinearScale,
  Filler,
  Tooltip,
  zoomPlugin,
);

const DAY_MS = 24 * 60 * 60 * 1000;
/** 데이터 양 끝에 두는 x축 여백 */
const X_PAD = 3 * DAY_MS;
/** 확대 하한 — 이보다 좁게는 못 들어간다 */
const MIN_RANGE = 14 * DAY_MS;

/**
 * 허가 눈금이 차지할 세로 비율의 역수.
 *
 * y2 최댓값을 실제 최대 건수의 이만큼으로 잡아, 가장 많은 날도 아래 1/5 안에 머문다.
 * 가격 영역에 아예 들어오지 않으면서 건수의 많고 적음은 높이로 그대로 읽힌다.
 * 이 값을 3 이하로 낮추면 눈금이 실거래 점 사이를 뚫고 올라와 차트가 어수선해진다.
 */
const PERMIT_HEADROOM = 5;

/**
 * 눈금 폭(px). x축이 몇 달이든 몇 년이든 실처럼 얇아지지 않게 고정한다.
 *
 * 얇고 각지게 둔다. 테두리를 두르거나 모서리를 굴리면 폭이 좁아 윤곽선만 도드라져
 * 통통한 상자처럼 보인다.
 */
const PERMIT_BAR_PX = 2.5;

/** 범례 칩 하나가 켜고 끄는 데이터셋 라벨들. 밴드는 상/하한 두 개가 한 쌍이다. */
interface Series {
  key: string;
  label: string;
  labels: string[];
  swatch: "dot" | "line" | "band" | "dash" | "bar" | "rails";
  color: string;
  present: (area: AreaPage) => boolean;
}

const SERIES: Series[] = [
  {
    key: "deal",
    label: "실거래",
    labels: ["실거래"],
    swatch: "dot",
    color: "var(--color-deal)",
    present: (a) => a.chart.transactions.length > 0,
  },
  {
    key: "ask",
    label: "호가 최저~최고",
    labels: ["호가 최고", "호가 최저"],
    swatch: "band",
    color: "var(--color-ask)",
    present: (a) => a.chart.askLow.length > 0,
  },
  {
    key: "kbGeneral",
    label: "KB 일반가",
    labels: ["KB 일반가"],
    swatch: "line",
    color: "var(--color-kb)",
    present: (a) => a.chart.kbGeneral.length > 0,
  },
  {
    key: "kbBand",
    label: "KB 하위~상위",
    labels: ["KB 상위평균", "KB 하위평균"],
    swatch: "rails",
    color: "var(--color-kb)",
    present: (a) => a.chart.kbLower.length > 0,
  },
  {
    key: "mine",
    label: "매입가",
    labels: ["매입가"],
    swatch: "dash",
    color: "var(--color-mine)",
    present: (a) => a.summary.purchasePrice !== null,
  },
  {
    key: "permit",
    label: "토지거래허가",
    labels: ["토지거래허가"],
    swatch: "bar",
    color: "var(--color-permit)",
    present: (a) => (a.chart.permits?.length ?? 0) > 0,
  },
];

/** 범례 칩의 색 표식 — 점 / 실선 / 밴드 / 점선 */
function Swatch({ series }: { series: Series }) {
  if (series.swatch === "dot") {
    return (
      <i
        className="inline-block size-2 shrink-0 rounded-full"
        style={{ background: series.color }}
      />
    );
  }
  if (series.swatch === "dash") {
    return (
      <i
        className="inline-block h-[2.5px] w-3.5 shrink-0 rounded-sm"
        style={{
          color: series.color,
          background: "repeating-linear-gradient(90deg, currentColor 0 4px, transparent 4px 7px)",
        }}
      />
    );
  }
  // 경계선 한 쌍 — 위아래 얇은 선 사이가 비어 있는 밴드를 뜻한다
  if (series.swatch === "rails") {
    return (
      <i
        className="inline-flex h-2 w-3.5 shrink-0 flex-col justify-between"
        style={{ color: series.color }}
      >
        <i className="block h-px w-full rounded-sm bg-current" />
        <i className="block h-px w-full rounded-sm bg-current" />
      </i>
    );
  }
  if (series.swatch === "bar") {
    return (
      <i
        className="inline-block h-2.5 w-[3px] shrink-0 rounded-[1px]"
        style={{ background: series.color }}
      />
    );
  }
  return (
    <i
      className="inline-block h-[2.5px] w-3.5 shrink-0 rounded-sm"
      style={{ background: series.color, opacity: series.swatch === "band" ? 0.5 : 1 }}
    />
  );
}

const monthDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCMonth() + 1}.${d.getUTCDate()}`;
};

const fullDate = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`;
};

const xy = (points: Array<{ t: number; y: number; floor?: number }>) =>
  points.map((p) => ({ x: p.t, y: p.y, floor: p.floor }));

/**
 * 관측이 하루뿐인 계열을 축 전체를 가로지르는 평평한 선으로 편다.
 *
 * 선은 점이 둘 이상이어야 그려지고 밴드는 면이 생기지 않는다. 면적을 새로 추가한
 * 첫날이 정확히 그 상태라 점 하나만 덩그러니 남는다. 매입가 기준선과 같은 방식으로
 * 양 끝까지 늘려 두면 지금 시세가 실거래 분포의 어디쯤인지 바로 읽힌다.
 *
 * 과거에도 그 값이었다는 뜻은 아니다 — 관측이 쌓이면 이틀째부터 실제 곡선으로 바뀐다.
 */
function stretch(points: Array<{ t: number; y: number }>, bounds: { min: number; max: number }) {
  if (points.length !== 1) return xy(points);
  const { y } = points[0];
  return [
    { x: bounds.min, y },
    { x: bounds.max, y },
  ];
}

interface Props {
  area: AreaPage;
  theme: ResolvedTheme;
}

export function ChartCard({ area, theme }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [zoomed, setZoomed] = useState(false);

  const visibleSeries = useMemo(() => SERIES.filter((s) => s.present(area)), [area]);

  const bounds = useMemo(() => {
    const times = [
      ...area.chart.transactions,
      ...area.chart.kbGeneral,
      ...area.chart.kbLower,
      ...area.chart.kbUpper,
      ...area.chart.askLow,
      ...area.chart.askHigh,
      ...(area.chart.permits ?? []),
    ].map((p) => p.t);

    if (times.length === 0) return null;
    return { min: Math.min(...times) - X_PAD, max: Math.max(...times) + X_PAD };
  }, [area]);

  // theme은 effect 본문에서 직접 읽지 않지만 반드시 의존성에 있어야 한다.
  // 팔레트는 CSS 커스텀 프로퍼티로 바뀌는데, 린터는 그 DOM 경로를 볼 수 없어
  // "불필요한 의존성"으로 판단한다. 빼면 테마를 바꿔도 차트 색이 그대로 남는다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 위 설명 참고
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bounds) return;

    // theme이 바뀐 뒤에 읽어야 새 팔레트가 잡힌다. 그래서 effect 안에서 읽는다.
    const tokens = readChartTokens();

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const purchase = area.summary.purchasePrice;
    const permits = area.chart.permits ?? [];
    const maxPermit = permits.length > 0 ? Math.max(...permits.map((p) => p.y)) : 0;

    const datasets: Array<Record<string, unknown>> = [
      // 밴드가 둘인데 둘 다 채우면 겹친 구간이 어느 쪽도 아닌 색이 된다.
      // 면은 호가 하나만 쓰고, KB는 위·아래 경계선으로 둘러 표시한다.
      // 실제로 관측된 값(호가)에 면을, 기관 추정치(KB)에 선을 주는 편이 의미와도 맞다.
      {
        type: "line",
        label: "KB 상위평균",
        data: stretch(area.chart.kbUpper, bounds),
        borderColor: tokens.kb,
        borderWidth: 1,
        fill: false,
        pointRadius: 0,
        pointHitRadius: 0,
        cubicInterpolationMode: "monotone",
        order: 6,
      },
      {
        type: "line",
        label: "KB 하위평균",
        data: stretch(area.chart.kbLower, bounds),
        borderColor: tokens.kb,
        borderWidth: 1,
        fill: false,
        pointRadius: 0,
        pointHitRadius: 0,
        cubicInterpolationMode: "monotone",
        order: 6,
      },
      {
        type: "line",
        label: "호가 최고",
        data: stretch(area.chart.askHigh, bounds),
        borderColor: "transparent",
        backgroundColor: tokens.bandAsk,
        fill: "+1",
        pointRadius: 0,
        pointHitRadius: 0,
        cubicInterpolationMode: "monotone",
        order: 5,
      },
      {
        type: "line",
        label: "호가 최저",
        data: stretch(area.chart.askLow, bounds),
        borderColor: "transparent",
        pointRadius: 0,
        pointHitRadius: 0,
        cubicInterpolationMode: "monotone",
        order: 5,
      },
      {
        type: "line",
        label: "KB 일반가",
        data: stretch(area.chart.kbGeneral, bounds),
        borderColor: tokens.kb,
        borderWidth: 1.5,
        pointRadius: 0,
        cubicInterpolationMode: "monotone",
        order: 4,
      },
    ];

    // 매입가 기준선 — 축 전체를 가로지르는 평평한 점선.
    // y 스케일 계산에 포함되므로 기준선이 화면 밖으로 잘리지 않는다.
    if (purchase) {
      datasets.push({
        type: "line",
        label: "매입가",
        data: [
          { x: bounds.min, y: purchase },
          { x: bounds.max, y: purchase },
        ],
        borderColor: tokens.mine,
        borderWidth: 1.5,
        borderDash: [2, 3],
        pointRadius: 0,
        pointHitRadius: 0,
        order: 2,
      });
    }

    // 허가 건수는 가격과 단위가 달라 오른쪽 축(y2)에 따로 그린다.
    // order를 가장 크게 줘서 가격 계열 뒤에 깔리게 한다.
    if (permits.length > 0) {
      datasets.push({
        type: "bar",
        label: "토지거래허가",
        yAxisID: "y2",
        data: xy(permits),
        backgroundColor: tokens.permit,
        borderWidth: 0,
        borderRadius: 0,
        barThickness: PERMIT_BAR_PX,
        maxBarThickness: PERMIT_BAR_PX,
        order: 9,
      });
    }

    datasets.push({
      type: "scatter",
      label: "실거래",
      data: xy(area.chart.transactions),
      backgroundColor: tokens.deal,
      borderColor: tokens.card,
      borderWidth: 1,
      pointRadius: 3.2,
      pointHoverRadius: 5.5,
      pointHoverBorderWidth: 2,
      order: 1,
    });

    const chart = new Chart(canvas, {
      // biome-ignore lint/suspicious/noExplicitAny: 혼합 차트 데이터셋은 Chart.js 타입으로 표현이 어렵다
      data: { datasets: datasets as any },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // 면적 탭을 바꿀 때마다 다시 그려지므로 길면 조작이 굼떠 보인다.
        animation: reduceMotion ? false : { duration: 400, easing: "easeOutQuart" },
        interaction: { mode: "nearest", intersect: false },
        layout: { padding: { top: 4, right: 4 } },
        scales: {
          x: {
            type: "linear",
            // 막대 데이터셋이 있으면 Chart.js가 양끝에 막대 반 칸씩 여백을 넣는다.
            // 범주형 축에서는 맞지만 여기서는 x가 실제 시각이라 데이터가 축 끝에
            // 닿아야 한다. 끄지 않으면 첫 관측과 마지막 관측 바깥이 비어 보인다.
            offset: false,
            min: bounds.min,
            max: bounds.max,
            border: { color: tokens.border },
            grid: { color: tokens.grid, drawTicks: false },
            ticks: {
              color: tokens.muted,
              font: { size: 11 },
              maxTicksLimit: 7,
              padding: 8,
              callback: (value) => monthDay(Number(value)),
            },
          },
          y: {
            // 최고/최저점이 축에 딱 붙지 않도록 위아래 여백을 준다.
            grace: "14%",
            border: { display: false },
            grid: { color: tokens.grid, drawTicks: false },
            ticks: {
              color: tokens.muted,
              font: { size: 11 },
              padding: 10,
              maxTicksLimit: 6,
              callback: (value) => `${(Number(value) / 10000).toFixed(1)}억`,
            },
          },
          // 건수 축. 실제 최대 건수의 PERMIT_HEADROOM배를 천장으로 둬서 눈금이
          // 하단 레일에만 머문다. 눈금값은 정수로만 찍는다 — 0.5건은 없는 값이다.
          y2: {
            display: permits.length > 0,
            position: "right",
            beginAtZero: true,
            max: Math.max(PERMIT_HEADROOM, maxPermit * PERMIT_HEADROOM),
            border: { display: false },
            grid: { drawOnChartArea: false, drawTicks: false },
            ticks: {
              color: tokens.muted,
              font: { size: 11 },
              padding: 8,
              precision: 0,
              stepSize: Math.max(1, maxPermit),
              callback: (value) => (Number(value) > maxPermit ? "" : `${value}건`),
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tokens.card,
            titleColor: tokens.text,
            bodyColor: tokens.text,
            borderColor: tokens.border,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 9,
            boxPadding: 4,
            titleFont: { size: 12, weight: 600 },
            bodyFont: { size: 12 },
            callbacks: {
              title: (items) => fullDate(Number(items[0].parsed.x)),
              label: (ctx) => {
                // 허가 계열만 단위가 건수다. 가격 포맷을 그대로 쓰면 "3건"이 "0.0억"이 된다.
                if (ctx.dataset.yAxisID === "y2") {
                  return `${ctx.dataset.label} ${ctx.parsed.y}건`;
                }
                const base = `${ctx.dataset.label} ${formatEok(Number(ctx.parsed.y))}`;
                const floor = (ctx.raw as { floor?: number })?.floor;
                return floor ? `${base} (${floor}층)` : base;
              },
            },
          },
          // 가로로 밀어서 이동, 핀치/휠로 확대. 세로 스크롤은 페이지에 넘긴다.
          zoom: {
            pan: {
              enabled: true,
              mode: "x",
              onPanComplete: ({ chart: c }) => setZoomed(c.isZoomedOrPanned()),
            },
            zoom: {
              wheel: { enabled: true, speed: 0.08 },
              pinch: { enabled: true },
              mode: "x",
              onZoomComplete: ({ chart: c }) => setZoomed(c.isZoomedOrPanned()),
            },
            limits: { x: { min: bounds.min, max: bounds.max, minRange: MIN_RANGE } },
          },
        },
      },
    });

    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, [area, theme, bounds]);

  // 범례로 끈 계열을 반영한다. 차트를 새로 만들지 않고 표시 여부만 바꾼다.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const hiddenLabels = new Set(SERIES.filter((s) => hidden.has(s.key)).flatMap((s) => s.labels));
    chart.data.datasets.forEach((dataset, i) => {
      chart.setDatasetVisibility(i, !hiddenLabels.has(String(dataset.label)));
    });
    chart.update("none");
  }, [hidden]);

  const toggle = (key: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const reset = () => {
    chartRef.current?.resetZoom();
    setZoomed(false);
  };

  return (
    <section className="mb-6">
      <SectionTitle>시세 추이</SectionTitle>
      <Card large className="px-4 pb-[0.9375rem] pt-[1.125rem]">
        <div className="flex items-start justify-between gap-3">
          <div className="mb-3.5 flex flex-wrap gap-1.5">
            {visibleSeries.map((series) => (
              <button
                key={series.key}
                type="button"
                aria-pressed={!hidden.has(series.key)}
                onClick={() => toggle(series.key)}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-[0.5625rem] py-1 text-[0.6875rem] tracking-[0.015em] transition-[transform,opacity,border-color,background-color] duration-150 ease-out-strong hover:border-faint active:scale-[0.96] aria-[pressed=false]:bg-transparent aria-[pressed=false]:text-muted aria-[pressed=false]:opacity-45 motion-reduce:transition-colors motion-reduce:active:scale-100"
              >
                <Swatch series={series} />
                {series.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            hidden={!zoomed}
            onClick={reset}
            className="shrink-0 cursor-pointer whitespace-nowrap rounded-chip border border-border bg-card px-2 py-1 text-[0.6875rem] font-medium tracking-[0.015em] text-muted transition-[transform,color] duration-150 ease-out-strong hover:text-text active:scale-[0.96] motion-reduce:transition-colors motion-reduce:active:scale-100"
          >
            초기화
          </button>
        </div>
        <div className="relative h-[306px] sm:h-[348px]">
          <canvas ref={canvasRef} className="chart-canvas" />
        </div>
      </Card>
    </section>
  );
}
