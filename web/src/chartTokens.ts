/** 차트가 CSS에서 읽어오는 색 토큰 */
export interface ChartTokens {
  deal: string;
  ask: string;
  kb: string;
  mine: string;
  border: string;
  grid: string;
  bandAsk: string;
  bandKb: string;
  muted: string;
  card: string;
  text: string;
}

const TOKEN_NAMES: Record<keyof ChartTokens, string> = {
  deal: "--deal",
  ask: "--ask",
  kb: "--kb",
  mine: "--mine",
  border: "--border",
  grid: "--grid",
  bandAsk: "--band-ask",
  bandKb: "--band-kb",
  muted: "--muted",
  card: "--card",
  text: "--text",
};

/**
 * 차트 색을 CSS 커스텀 프로퍼티에서 읽어온다.
 *
 * Chart.js는 캔버스에 직접 그리므로 CSS를 상속받지 못한다. 그래서 색을 값으로 넘겨야 하고,
 * 테마가 바뀌면 다시 읽어 차트를 새로 그려야 한다. 색을 여기서 하드코딩하지 않는 이유이기도
 * 하다 — 팔레트는 styles.css 한 곳에만 산다.
 */
export function readChartTokens(): ChartTokens {
  const style = getComputedStyle(document.documentElement);
  const tokens = {} as ChartTokens;
  for (const [key, name] of Object.entries(TOKEN_NAMES)) {
    tokens[key as keyof ChartTokens] = style.getPropertyValue(name).trim();
  }
  return tokens;
}
