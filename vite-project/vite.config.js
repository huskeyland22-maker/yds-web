import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifestFilename: "manifest.json",
      includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "패닉지수 대시보드",
        short_name: "패닉지수",
        description: "시장 공포 탐욕 분석 앱",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
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
    },
  },
  preview: {
    proxy: {
      "/panic-data": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
})
