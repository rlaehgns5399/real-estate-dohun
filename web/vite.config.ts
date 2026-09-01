import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const webRoot = import.meta.dirname;
const repoRoot = resolve(webRoot, "..");

/** 배포 경로. GitHub Pages는 https://<user>.github.io/<repo>/ 로 서빙한다. */
const BASE = "/real-estate-dohun/";

export default defineConfig({
  root: webRoot,
  // GitHub Pages는 /<repo>/ 하위에 올라간다.
  // 상대 경로가 아니라 절대 경로를 쓰는 이유: 면적별 페이지가 /59/ 같은 하위 경로에
  // 생기는데, "./assets/..."는 거기서 /59/assets/...로 풀려 404가 난다.
  base: BASE,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(repoRoot, "dist"),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": resolve(webRoot, "src"),
      // 수집 파이프라인이 만든 스냅샷을 빌드 시점에 그대로 번들에 넣는다.
      "@data": resolve(repoRoot, "data"),
      // Node/브라우저가 함께 쓰는 타입·포맷 유틸
      "@shared": resolve(repoRoot, "src"),
    },
  },
  server: { fs: { allow: [repoRoot] } },
});
