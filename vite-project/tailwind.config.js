/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"IBM Plex Sans"',
          '"Noto Sans KR"',
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          '"Malgun Gothic"',
          "sans-serif",
        ],
        display: ['"Playfair Display"', "Georgia", "serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        terminal: {
          bg: "#0B0E14",
          panel: "#0F1319",
          line: "rgba(255,255,255,0.06)",
        },
      },
    },
  },
  plugins: [],
}
