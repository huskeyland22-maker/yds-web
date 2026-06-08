/**
 * Phase 2-3 더미 가격·거래량 스냅샷 프로필
 * 향후 API 응답을 StockPriceSnapshot 형태로 치환
 */

/** @typedef {'trend' | 'dip' | 'interest' | 'overheat'} SnapshotProfileStatus */

/**
 * @typedef {{
 *   high52wRatio?: number
 *   drawdown?: number
 *   volumeRatio?: number
 *   ma20Gap?: number
 *   ma60Gap?: number
 *   ma120Gap?: number
 * }} SnapshotProfileTune
 */

/** @type {Record<SnapshotProfileStatus, SnapshotProfileTune>} */
const STATUS_DEFAULTS = {
  trend: {
    high52wRatio: 0.96,
    drawdown: 0.05,
    volumeRatio: 1.15,
    ma20Gap: 0.04,
    ma60Gap: 0.1,
    ma120Gap: 0.18,
  },
  interest: {
    high52wRatio: 0.9,
    drawdown: 0.1,
    volumeRatio: 1.05,
    ma20Gap: 0.02,
    ma60Gap: 0.06,
    ma120Gap: 0.12,
  },
  dip: {
    high52wRatio: 0.84,
    drawdown: 0.14,
    volumeRatio: 0.92,
    ma20Gap: -0.02,
    ma60Gap: 0.03,
    ma120Gap: 0.08,
  },
  overheat: {
    high52wRatio: 0.99,
    drawdown: 0.015,
    volumeRatio: 1.35,
    ma20Gap: 0.06,
    ma60Gap: 0.12,
    ma120Gap: 0.2,
  },
}

/** @type {Record<string, SnapshotProfileTune>} */
const TICKER_OVERRIDES = {
  NVDA: { high52wRatio: 0.98, drawdown: 0.04, volumeRatio: 1.18, ma20Gap: 0.05, ma60Gap: 0.11, ma120Gap: 0.2 },
  AVGO: { high52wRatio: 0.97, drawdown: 0.05, volumeRatio: 1.12 },
  META: { high52wRatio: 0.93, drawdown: 0.09, volumeRatio: 1.1 },
  AMD: { high52wRatio: 0.86, drawdown: 0.13, volumeRatio: 0.95 },
  PLTR: { high52wRatio: 0.88, drawdown: 0.12, volumeRatio: 1.08 },
  SMCI: { high52wRatio: 0.99, drawdown: 0.01, volumeRatio: 1.42 },
  "257720": { high52wRatio: 0.97, drawdown: 0.02, volumeRatio: 1.28 },
}

/**
 * @param {string} ticker
 * @param {SnapshotProfileStatus} status
 * @param {number} [basePrice]
 * @returns {import("./ydsStockScoreEngine.js").StockPriceSnapshot}
 */
export function buildStockPriceSnapshot(ticker, status, basePrice = 100) {
  const defaults = STATUS_DEFAULTS[status] ?? STATUS_DEFAULTS.interest
  const tune = { ...defaults, ...(TICKER_OVERRIDES[ticker] ?? {}) }

  const close = basePrice
  const recentHigh = close / (1 - (tune.drawdown ?? 0.1))
  const high52w = close / (tune.high52wRatio ?? 0.9)

  const ma20 = close * (1 - (tune.ma20Gap ?? 0.02))
  const ma60 = close * (1 - (tune.ma60Gap ?? 0.08))
  const ma120 = close * (1 - (tune.ma120Gap ?? 0.14))

  const volumeAvg20 = 1_000_000
  const volumeToday = volumeAvg20 * (tune.volumeRatio ?? 1)

  return {
    close,
    ma20,
    ma60,
    ma120,
    high52w,
    recentHigh,
    volumeToday,
    volumeAvg20,
  }
}
