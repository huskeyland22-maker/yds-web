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
    "import.meta.env.VITE_APP_VERSION_LABEL": JSON.stringify(APP_VERSION_LABEL),
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
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      filename: "sw.js",
      manifest: false,
      devOptions: {
        enabled: false,
      },
      workbox: {
        /** 배포마다 변경 → 이전 precache·runtime 캐시 일괄 무효화 */
        cacheId: `yds-pwa-${BUILD_ID}`,
        globPatterns: ["**/*.{js,css,svg,ico,png,woff2,webp}"],
        globIgnores: [
          "**/index.html",
          "**/build-version.json",
          "**/manifest.webmanifest",
          "**/manifest.json",
          "**/client-env-manifest.json",
          "**/panic-data.json",
          "**/value-chain-data.js",
          "**/stats.html",
          "**/report.html",
        ],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "yds-html-pages",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 },
            },
          },
          {
            urlPattern: ({ request, url }) =>
              url.origin === self.location.origin &&
              (request.destination === "script" || request.destination === "style"),
            handler: "NetworkFirst",
            options: {
              cacheName: "yds-js-css",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 },
            },
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
