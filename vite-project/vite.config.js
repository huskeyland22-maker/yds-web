import fs from "node:fs"
import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"

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

function resolveAppVersionLabel() {
  try {
    const metaPath = path.resolve(process.cwd(), "public", "build-version.json")
    if (fs.existsSync(metaPath)) {
      const parsed = JSON.parse(fs.readFileSync(metaPath, "utf8"))
      if (parsed && typeof parsed.version === "string" && parsed.version.trim()) {
        return parsed.version.trim()
      }
    }
  } catch {
    // ignore
  }
  return "dev"
}

const APP_VERSION_LABEL = resolveAppVersionLabel()

function resolveReleaseChannel(mode) {
  const fromEnv = String(process.env.VITE_APP_RELEASE_CHANNEL ?? "").trim().toLowerCase()
  if (fromEnv === "rc" || fromEnv === "release-candidate") return "rc"
  if (fromEnv === "dev") return "dev"
  return mode === "development" ? "dev" : "prod"
}

const APP_RELEASE_CHANNEL = resolveReleaseChannel(process.env.NODE_ENV)

function htmlBuildIdPlugin() {
  return {
    name: "html-build-id",
    transformIndexHtml() {
      return [
        { tag: "meta", attrs: { name: "app-build-id", content: BUILD_ID }, injectTo: "head" },
        {
          tag: "meta",
          attrs: { name: "app-release-channel", content: APP_RELEASE_CHANNEL },
          injectTo: "head",
        },
      ]
    },
  }
}

// https://vite.dev/config/
// Network-first shell: index.html always from network; hashed /assets/* never precached (404 after deploy).
export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_BUILD_ID": JSON.stringify(BUILD_ID),
    "import.meta.env.VITE_APP_VERSION_LABEL": JSON.stringify(APP_VERSION_LABEL),
    "import.meta.env.VITE_APP_RELEASE_CHANNEL": JSON.stringify(APP_RELEASE_CHANNEL),
  },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash][extname]`,
      },
    },
  },
  plugins: [
    react(),
    htmlBuildIdPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      filename: "sw.js",
      manifest: false,
      devOptions: {
        enabled: false,
      },
      workbox: {
        /** 배포마다 변경 → 이전 Workbox precache·runtime 그룹 무효화 */
        cacheId: `yds-pwa-${BUILD_ID}`,
        /** 해시 JS/CSS는 precache 금지 — 삭제된 chunk 404·화이트 스크린 방지 */
        globPatterns: [
          "favicon.svg",
          "icon.svg",
          "icon-maskable.svg",
          "icons.svg",
          "icon-192.png",
          "icon-512.png",
        ],
        globIgnores: [
          "**/assets/**",
          "**/index.html",
          "**/build-version.json",
          "**/manifest.webmanifest",
          "**/manifest.json",
          "**/client-env-manifest.json",
          "**/panic-data.json",
          "**/value-chain-data.js",
          "**/stats.html",
          "**/report.html",
          "**/sw.js",
          "**/workbox-*.js",
        ],
        // navigateFallback 제거: index.html은 precache 제외 → non-precached-url 경고·불필요한 SW navigate 지연
        // SPA 라우팅은 BrowserRouter + navigate 요청은 아래 NetworkOnly로 처리
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && url.pathname.startsWith("/assets/"),
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ url }) =>
              /\/api\/panic/i.test(url.pathname) ||
              /\/panic-data/i.test(url.pathname) ||
              /panic-data\.json$/i.test(url.pathname),
            handler: "NetworkOnly",
          },
          {
            urlPattern: /\/build-version\.json(\?.*)?$/i,
            handler: "NetworkOnly",
          },
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
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
      "/api/portfolio-quote": {
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
      "/api/portfolio-quote": {
        target: "https://yds-web-kappa.vercel.app",
        changeOrigin: true,
      },
    },
  },
})
