import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const webRoot = import.meta.dirname;
const repoRoot = resolve(webRoot, "..");

export default defineConfig({
  root: webRoot,
  // GitHub Pages는 /<repo>/ 하위에 올라가므로 상대 경로로 뽑는다.
  base: "./",
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
