import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// https://vite.dev/config/
export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_BUILD_ID": JSON.stringify(String(Date.now())),
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  plugins: [
    react(),
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
    },
  },
})
