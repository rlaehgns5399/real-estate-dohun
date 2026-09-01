import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const webRoot = import.meta.dirname;
const repoRoot = resolve(webRoot, "..");

/** 배포 경로. GitHub Pages는 https://<user>.github.io/<repo>/ 로 서빙한다. */
const BASE = "/real-estate-dohun/";

/**
 * 프리렌더용 SSR 번들.
 *
 * 클라이언트 번들과 목적이 다르다. 이건 빌드 중에 Node에서 딱 한 번 실행돼 HTML 문자열을
 * 만들고 버려진다. 그래서 tailwind 플러그인도 넣지 않는다 — CSS는 클라이언트 빌드가
 * 이미 뽑아 dist에 넣어뒀고, 여기서 또 만들면 같은 파일을 덮어써 버린다.
 */
export default defineConfig({
  root: webRoot,
  base: BASE,
  plugins: [react()],
  build: {
    ssr: resolve(webRoot, "src/entry-server.tsx"),
    outDir: resolve(repoRoot, "dist-ssr"),
    emptyOutDir: true,
    // 빌드 로그를 조용히 — 실제 산출물은 dist 쪽이다
    reportCompressedSize: false,
  },
  resolve: {
    alias: {
      "@": resolve(webRoot, "src"),
      "@data": resolve(repoRoot, "data"),
      "@shared": resolve(repoRoot, "src"),
    },
  },
});
