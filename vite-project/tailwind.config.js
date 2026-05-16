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
      fontSize: {
        /** 모바일 퍼스트: 본문 13~15px, 제목 18~22px 구간 */
        "trading-xs": ["0.6875rem", { lineHeight: "1.35" }],
        "trading-2xs": ["0.625rem", { lineHeight: "1.3" }],
        "trading-sm": ["0.8125rem", { lineHeight: "1.4" }],
        "trading-base": ["0.875rem", { lineHeight: "1.45" }],
        "trading-md": ["0.9375rem", { lineHeight: "1.45" }],
        "trading-lg": ["1.125rem", { lineHeight: "1.35" }],
        "trading-xl": ["1.25rem", { lineHeight: "1.3" }],
        "trading-2xl": ["1.375rem", { lineHeight: "1.25" }],
      },
      spacing: {
        /** 카드 내부 컴팩트 간격 */
        "dense": "0.375rem",
        "dense-2": "0.5rem",
      },
      borderRadius: {
        /** 투자 도구형 카드 12~16px */
        card: "0.875rem",
        "card-lg": "1rem",
      },
      boxShadow: {
        "trading-card":
          "0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
        "trading-card-hover":
          "0 0 0 1px rgba(99,102,241,0.12), 0 12px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)",
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
