import { resolve } from "node:path";

/** 커밋 대상 데이터 파일 — 이 파일 변경이 GitHub Actions 배포를 트리거한다 */
export const DATA_FILE = resolve(process.cwd(), "data/latest.json");

/** GitHub Pages로 배포되는 산출물 (CI에서 생성, 커밋하지 않음) */
export const PAGE_FILE = resolve(process.cwd(), "docs/index.html");
