/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          '"Malgun Gothic"',
          '"맑은 고딕"',
          '"Apple SD Gothic Neo"',
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
}
