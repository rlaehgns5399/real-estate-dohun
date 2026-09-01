// 클라이언트와 똑같은 스냅샷을 쓴다. 이 페이지는 런타임에 아무것도 부르지 않으므로
// 빌드 시점에 그린 HTML이 방문자가 볼 화면과 정확히 같다.
import data from "@data/latest.json";
import type { PageData } from "@shared/types/page";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { App } from "@/App";

/**
 * 빌드 시점에 App을 HTML 문자열로 그린다. styles.css는 클라이언트 빌드가 이미 뽑아둔다.
 *
 * area는 그 페이지가 놓일 경로에서 나온 값이다(루트면 null). 클라이언트도 같은
 * areaFromPath로 구하므로 첫 렌더가 정확히 일치한다.
 */
export function render(area: number | null): string {
  return renderToString(
    <StrictMode>
      <App data={data as PageData} initialArea={area} />
    </StrictMode>,
  );
}

/** 프리렌더할 면적 목록 — data/latest.json이 진실이다 */
export function areas(): number[] {
  return (data as PageData).apartments[0]?.areas.map((a) => a.area) ?? [];
}
