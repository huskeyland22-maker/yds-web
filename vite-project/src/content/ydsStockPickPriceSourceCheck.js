/**
 * 종목추천 현재가·스냅샷 정합성 진단 (표시는 snapshot 단일 소스)
 */

/** @param {unknown} v */
function toNum(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

const PRIORITY_TICKERS = ["058610", "005930", "000660", "010120", "298040", "PLTR", "AAPL"]

let loggedThisSession = false

/**
 * @param {import("./ydsStockPickModel.js").StockPickView[]} stocks
 */
export function logStockPickPriceSourceCheck(stocks) {
  if (loggedThisSession || typeof globalThis.window === "undefined") return
  if (!Array.isArray(stocks) || !stocks.length) return

  const live = stocks.filter((s) => s.dataSource === "live" && s.snapshot)
  if (!live.length) return

  /** @type {import("./ydsStockPickModel.js").StockPickView[]} */
  const samples = []
  for (const ticker of PRIORITY_TICKERS) {
    const row = live.find((s) => s.ticker === ticker)
    if (row && !samples.some((s) => s.ticker === row.ticker)) samples.push(row)
  }
  for (const row of live) {
    if (samples.length >= 10) break
    if (!samples.some((s) => s.ticker === row.ticker)) samples.push(row)
  }

  for (const stock of samples.slice(0, 10)) {
    const quotePrice = toNum(stock.quote?.price)
    const snapshotClose = toNum(stock.snapshot?.price ?? stock.snapshot?.close)
    const ma20 = toNum(stock.snapshot?.ma20)
    const ma60 = toNum(stock.snapshot?.ma60)

    console.info("[price-source-check]", {
      ticker: stock.ticker,
      quotePrice,
      snapshotClose,
      ma20,
      ma60,
    })

    if (quotePrice != null && snapshotClose != null && snapshotClose > 0) {
      const diffRatio = Math.abs(quotePrice - snapshotClose) / snapshotClose
      if (diffRatio >= 0.2) {
        console.warn("[price-source-check] quote vs snapshot mismatch >=20%", {
          ticker: stock.ticker,
          quotePrice,
          snapshotClose,
          diffPct: Math.round(diffRatio * 1000) / 10,
        })
      }
    }

    if (snapshotClose != null && snapshotClose > 0 && ma20 != null && ma20 / snapshotClose >= 2) {
      console.warn("[price-source-check] ma20 vs snapshot close scale mismatch", {
        ticker: stock.ticker,
        snapshotClose,
        ma20,
        ratio: Math.round((ma20 / snapshotClose) * 100) / 100,
      })
    }
  }

  loggedThisSession = true
}

/** 테스트·강제 재로그용 */
export function resetStockPickPriceSourceCheckSession() {
  loggedThisSession = false
}
