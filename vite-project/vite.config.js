import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
