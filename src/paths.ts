import { resolve } from "node:path";

/** 커밋 대상 데이터 파일 — 이 파일 변경이 GitHub Actions 배포를 트리거한다 */
export const DATA_FILE = resolve(process.cwd(), "data/latest.json");
