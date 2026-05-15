/**
 * 종목 코드 분류: 국내 KRX(6자리) → KIS 전용, 해외·ETF·지수 → Yahoo 전용.
 */

/** @param {string | null | undefined} raw */
export function classifyStockInput(raw) {
  const s = String(raw ?? "").trim()
  if (!s) return { kind: "invalid", code: null, yahooTicker: null }

  if (/[A-Za-z]/.test(s) || s.startsWith("^")) {
    const ticker = s.replace(/\s+/g, "")
    return { kind: "yahoo_global", code: ticker, yahooTicker: ticker }
  }

  const digits = s.replace(/\D/g, "")
  if (digits.length >= 4 && digits.length <= 6) {
    return { kind: "domestic_krx", code: digits.padStart(6, "0"), yahooTicker: null }
  }

  return { kind: "invalid", code: null, yahooTicker: null }
}

/** @param {string | null | undefined} code */
export function isDomesticKrxCode(code) {
  return classifyStockInput(code).kind === "domestic_krx"
}
