/**
 * 리포트·UI 문자열 — JSON/unicode escape 깨짐 방지
 */

/** @param {unknown} value */
export function renderText(value) {
  if (value == null || value === "") return "—"
  let s = String(value)
  if (/\\u[0-9a-fA-F]{4}/.test(s)) {
    s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
  }
  return s.trim()
}

/** @param {unknown} value @param {number} [max] */
export function clipReportLine(value, max = 14) {
  const s = renderText(value)
  if (s === "—") return s
  const first = s.split(/[.,\n|·]/)[0]?.trim() ?? s
  if (first.length <= max) return first
  return `${first.slice(0, max)}…`
}
