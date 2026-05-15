import fs from "node:fs"
import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

function resolveBuildId() {
  // 우선순위:
  // 1) generate-build-meta.mjs 가 미리 기록한 public/build-version.json
  // 2) 환경변수 VITE_APP_BUILD_ID
  // 3) 현재 시각 (개발 모드 fallback)
  try {
    const metaPath = path.resolve(process.cwd(), "public", "build-version.json")
    if (fs.existsSync(metaPath)) {
      const raw = fs.readFileSync(metaPath, "utf8")
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.buildId === "string" && parsed.buildId) {
        return parsed.buildId
      }
    }
  } catch {
    // ignore and fall through
  }
  if (typeof process.env.VITE_APP_BUILD_ID === "string" && process.env.VITE_APP_BUILD_ID) {
    return process.env.VITE_APP_BUILD_ID
  }
  return String(Date.now())
}

const BUILD_ID = resolveBuildId()

function htmlBuildIdPlugin() {
  return {
    name: "html-build-id",
    transformIndexHtml() {
      return [
        { tag: "meta", attrs: { name: "app-build-id", content: BUILD_ID }, injectTo: "head" },
        { tag: "meta", attrs: { name: "app-build-channel", content: "stable" }, injectTo: "head" },
      ]
    },
  }
}

// https://vite.dev/config/
// Network-first app: only hashed /assets/* are long-cache immutable; never add Workbox precache for JSON/API.
export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_BUILD_ID": JSON.stringify(BUILD_ID),
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-${BUILD_ID}.js`,
        chunkFileNames: `assets/[name]-[hash]-${BUILD_ID}.js`,
        assetFileNames: `assets/[name]-[hash]-${BUILD_ID}[extname]`,
      },
    },
  },
  plugins: [
    react(),
    htmlBuildIdPlugin(),
  ],
  server: {
    open: true,
    proxy: {
      "/panic-data": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
      "/api/stock-indicators": {
        target: "https://yds-web-kappa.vercel.app",
        changeOrigin: true,
      },
      "/api/stock": {
        target: "https://yds-web-kappa.vercel.app",
        changeOrigin: true,
      },
      "/api/market-data": {
        target: "https://yds-web-kappa.vercel.app",
        changeOrigin: true,
      },
      "/api/macro-briefing-ai": {
        target: "https://yds-web-kappa.vercel.app",
        changeOrigin: true,
      },
      "/api/panic": {
        target: "https://yds-web-kappa.vercel.app",
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      "/panic-data": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
      "/api/stock-indicators": {
        target: "https://yds-web-kappa.vercel.app",
        changeOrigin: true,
      },
      "/api/stock": {
        target: "https://yds-web-kappa.vercel.app",
        changeOrigin: true,
      },
      "/api/market-data": {
        target: "https://yds-web-kappa.vercel.app",
        changeOrigin: true,
      },
      "/api/macro-briefing-ai": {
        target: "https://yds-web-kappa.vercel.app",
        changeOrigin: true,
      },
      "/api/panic": {
        target: "https://yds-web-kappa.vercel.app",
        changeOrigin: true,
      },
    },
  },
})
