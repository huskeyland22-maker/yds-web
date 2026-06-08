/**
 * /api/stock 응답 → 점수·상태 엔진용 스냅샷
 */

/** @param {unknown} v */
function toNum(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {Array<{ close?: number; high?: number; volume?: number }>} bars
 * @param {number} period
 */
function smaClose(bars, period) {
  if (!Array.isArray(bars) || bars.length < period) return null
  let sum = 0
  for (let i = bars.length - period; i < bars.length; i++) {
    const c = toNum(bars[i]?.close)
    if (c == null) return null
    sum += c
  }
  return sum / period
}

/**
 * @param {Array<{ volume?: number }>} bars
 * @param {number} period
 */
function avgVolume(bars, period) {
  if (!Array.isArray(bars) || bars.length < period) return null
  let sum = 0
  for (let i = bars.length - period; i < bars.length; i++) {
    sum += toNum(bars[i]?.volume) ?? 0
  }
  return sum / period
}

/**
 * @param {Array<{ close?: number; high?: number }>} bars
 * @param {number} lookback
 */
function peakFromBars(bars, lookback) {
  if (!Array.isArray(bars) || !bars.length) return null
  const slice = bars.slice(-lookback)
  let max = -Infinity
  for (const bar of slice) {
    const h = toNum(bar.high) ?? toNum(bar.close)
    if (h != null && h > max) max = h
  }
  return Number.isFinite(max) ? max : null
}

/**
 * @param {object | null | undefined} apiBody
 * @returns {import("./ydsStockScoreEngine.js").StockPriceSnapshot | null}
 */
export function apiBodyToEngineSnapshot(apiBody) {
  if (!apiBody || typeof apiBody !== "object") return null

  const sig = apiBody.stockSignal ?? {}
  const ma = apiBody.movingAverage ?? {}
  const bars = Array.isArray(apiBody.chart?.bars) ? apiBody.chart.bars : []

  const close = toNum(sig.price ?? apiBody.price ?? apiBody.regularClose)
  const ma20 = toNum(sig.ma20 ?? ma.ma20)
  const ma60 = toNum(ma.ma60)
  const ma120 = smaClose(bars, 120) ?? (ma60 != null ? ma60 * 0.97 : null)

  const high52w = peakFromBars(bars, 252) ?? peakFromBars(bars, bars.length)
  const recentHigh = peakFromBars(bars, 60) ?? peakFromBars(bars, 20) ?? high52w

  const lastBar = bars[bars.length - 1]
  const volumeToday = toNum(lastBar?.volume)
  const volumeAvg20 = avgVolume(bars, 20)

  if (close == null) return null

  return {
    close,
    ma20: ma20 ?? close,
    ma60: ma60 ?? ma20 ?? close,
    ma120: ma120 ?? ma60 ?? close,
    high52w: high52w ?? close,
    recentHigh: recentHigh ?? high52w ?? close,
    volumeToday: volumeToday ?? 0,
    volumeAvg20: volumeAvg20 ?? volumeToday ?? 1,
  }
}

/**
 * @param {import("./ydsStockScoreEngine.js").StockPriceSnapshot | null} snapshot
 * @param {object | null | undefined} apiBody
 */
export function extractSnapshotExtras(apiBody) {
  const sig = apiBody?.stockSignal ?? {}
  return {
    rsi14: toNum(sig.rsi14 ?? apiBody?.rsi14),
    position52w: toNum(sig.position52w),
    volumeChangePct: toNum(sig.volumeChangePct ?? apiBody?.volumeChangePct),
  }
}

/**
 * @param {string} ticker
 * @param {import("./ydsStockScoreEngine.js").StockPriceSnapshot | null} snapshot
 * @param {object} [meta]
 */
export function auditStockPickSnapshot(ticker, snapshot, meta = {}) {
  const fields = [
    ["close", snapshot?.close],
    ["ma20", snapshot?.ma20],
    ["ma60", snapshot?.ma60],
    ["high52w", snapshot?.high52w],
  ]

  /** @type {string[]} */
  const missing = []
  for (const [key, val] of fields) {
    if (val == null || !Number.isFinite(val)) missing.push(key)
  }

  if (missing.length) {
    console.warn("[stock-pick-live] snapshot audit failed", {
      ticker,
      missing,
      dataSource: meta.dataSource ?? null,
      error: meta.error ?? null,
    })
    return false
  }

  return true
}
