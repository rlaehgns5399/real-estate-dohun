// 클라이언트와 똑같은 스냅샷을 쓴다. 이 페이지는 런타임에 아무것도 부르지 않으므로
// 빌드 시점에 그린 HTML이 방문자가 볼 화면과 정확히 같다.
import data from "@data/latest.json";
import type { PageData } from "@shared/types/page";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { App } from "@/App";

/** 빌드 시점에 App을 HTML 문자열로 그린다. styles.css는 클라이언트 빌드가 이미 뽑아둔다. */
export function render(): string {
  return renderToString(
    <StrictMode>
      <App data={data as PageData} />
    </StrictMode>,
  );
}
