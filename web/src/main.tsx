import type { PageData } from "@shared/types/page";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { App } from "@/App";
import "@/styles.css";

// 수집 파이프라인이 만든 스냅샷을 빌드 시점에 번들에 그대로 넣는다.
// 브라우저가 Supabase나 네트워크를 부르지 않으므로 로딩 상태도, 키도 필요 없다.
import data from "@data/latest.json";

const root = document.getElementById("root");
if (!root) throw new Error("#root를 찾을 수 없습니다.");

// 빌드 시점에 그려 넣은 마크업에 이어 붙는다(createRoot처럼 새로 그리지 않는다).
// 덕분에 JS가 도착하기 전에도 화면이 완성되어 있고, JS는 인터랙션만 살린다.
hydrateRoot(
  root,
  <StrictMode>
    <App data={data as PageData} />
  </StrictMode>,
);
