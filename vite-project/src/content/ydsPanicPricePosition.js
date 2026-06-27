/**
 * 패닉 V2 — 가격 위치 지표 (SPY/QQQ 일봉)
 */

/** @typedef {{
 *   asOfDate: string
 *   close: number
 *   return10d: number | null
 *   return20d: number | null
 *   drawdownFromHighPct: number | null
 *   ma20GapPct: number | null
 *   ma60GapPct: number | null
 *   rsi14: number | null
 *   bollingerPctB: number | null
 *   volumeChangePct: number | null
 *   positionScore: number | null
 *   label: string
 *   trendLabel: string
 * }} PanicPricePositionReport
 */

/** @param {number} n @param {number} lo @param {number} hi */
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

/**
 * @param {Record<string, number> | null | undefined} prices
 * @param {string} [asOfDate]
 */
function buildCloseSeries(prices, asOfDate) {
  if (!prices || typeof prices !== "object") return []
  const ref = asOfDate ? String(asOfDate).slice(0, 10) : null
  return Object.entries(prices)
    .filter(([date, close]) => {
      if (!Number.isFinite(Number(close))) return false
      if (ref && date > ref) return false
      return true
    })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, close]) => ({ date, close: Number(close) }))
}

/** @param {{ close: number }[]} series @param {number} period */
function simpleMA(series, period) {
  if (series.length < period) return null
  const slice = series.slice(-period)
  return slice.reduce((s, r) => s + r.close, 0) / period
}

/** @param {{ close: number }[]} series @param {number} [period] */
function computeRsi(series, period = 14) {
  if (series.length < period + 1) return null
  const changes = []
  for (let i = series.length - period; i < series.length; i += 1) {
    changes.push(series[i].close - series[i - 1].close)
  }
  const gains = changes.filter((c) => c > 0)
  const losses = changes.filter((c) => c < 0).map((c) => Math.abs(c))
  const avgGain = gains.length ? gains.reduce((s, v) => s + v, 0) / period : 0
  const avgLoss = losses.length ? losses.reduce((s, v) => s + v, 0) / period : 0
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return Math.round(100 - 100 / (1 + rs))
}

/** @param {{ close: number }[]} series @param {number} [period] */
function computeBollingerPctB(series, period = 20) {
  if (series.length < period) return null
  const slice = series.slice(-period)
  const mean = slice.reduce((s, r) => s + r.close, 0) / period
  const variance = slice.reduce((s, r) => s + (r.close - mean) ** 2, 0) / period
  const std = Math.sqrt(variance)
  if (std <= 0) return 0.5
  const upper = mean + 2 * std
  const lower = mean - 2 * std
  const last = series[series.length - 1].close
  return clamp((last - lower) / (upper - lower), 0, 1)
}

/** @param {number | null} v @param {number} digits */
function fmtPct(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return "—"
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`
}

/**
 * @param {{
 *   return10d?: number | null
 *   return20d?: number | null
 *   drawdownFromHighPct?: number | null
 *   ma20GapPct?: number | null
 *   rsi14?: number | null
 *   bollingerPctB?: number | null
 * }} m
 */
function computePositionScore(m) {
  let score = 50
  if (m.return10d != null) score += clamp(m.return10d * 2.2, -18, 18)
  if (m.return20d != null) score += clamp(m.return20d * 1.4, -16, 16)
  if (m.drawdownFromHighPct != null) score -= clamp(m.drawdownFromHighPct * 1.1, -20, 0)
  if (m.ma20GapPct != null) score += clamp(m.ma20GapPct * 1.8, -12, 12)
  if (m.rsi14 != null) score += clamp((m.rsi14 - 50) * 0.45, -12, 12)
  if (m.bollingerPctB != null) score += clamp((m.bollingerPctB - 0.5) * 28, -10, 10)
  return Math.round(clamp(score, 0, 100))
}

/** @param {number | null} positionScore */
function resolvePriceLabel(positionScore) {
  if (positionScore == null) return "데이터 없음"
  if (positionScore <= 25) return "저점 부근"
  if (positionScore <= 42) return "저점~중립"
  if (positionScore <= 58) return "중립"
  if (positionScore <= 72) return "회복 이후"
  return "과열 구간"
}

/** @param {number | null} positionScore @param {number | null} return10d @param {number | null} return20d */
function resolveTrendLabel(positionScore, return10d, return20d) {
  if (return10d != null && return20d != null) {
    if (return10d >= 4 && return20d >= 6) return "단기 상승 추세"
    if (return10d <= -4 && return20d <= -2) return "단기 하락 추세"
    if (return10d >= 0 && return20d < 0) return "반등 후 혼조"
  }
  if (positionScore != null && positionScore >= 68) return "회복·상승 추세"
  if (positionScore != null && positionScore <= 32) return "저점·약세 추세"
  return "횡보·전환"
}

/**
 * @param {{
 *   spyPrices?: Record<string, number>
 *   qqqPrices?: Record<string, number>
 *   asOfDate?: string | null
 * }} input
 * @returns {PanicPricePositionReport | null}
 */
export function buildPanicPricePositionReport(input = {}) {
  const prices = input.qqqPrices ?? input.spyPrices ?? null
  const series = buildCloseSeries(prices, input.asOfDate ?? undefined)
  if (series.length < 25) return null

  const last = series[series.length - 1]
  const idx10 = series.length - 11
  const idx20 = series.length - 21
  const lookback = series.slice(-60)
  const high60 = Math.max(...lookback.map((r) => r.close))

  const return10d =
    idx10 >= 0 ? ((last.close - series[idx10].close) / series[idx10].close) * 100 : null
  const return20d =
    idx20 >= 0 ? ((last.close - series[idx20].close) / series[idx20].close) * 100 : null
  const drawdownFromHighPct = high60 > 0 ? ((high60 - last.close) / high60) * 100 : null

  const ma20 = simpleMA(series, 20)
  const ma60 = simpleMA(series, 60)
  const ma20GapPct = ma20 != null ? ((last.close - ma20) / ma20) * 100 : null
  const ma60GapPct = ma60 != null ? ((last.close - ma60) / ma60) * 100 : null
  const rsi14 = computeRsi(series, 14)
  const bollingerPctB = computeBollingerPctB(series, 20)

  const positionScore = computePositionScore({
    return10d,
    return20d,
    drawdownFromHighPct,
    ma20GapPct,
    rsi14,
    bollingerPctB,
  })

  return {
    asOfDate: last.date,
    close: last.close,
    return10d: return10d != null ? Math.round(return10d * 10) / 10 : null,
    return20d: return20d != null ? Math.round(return20d * 10) / 10 : null,
    drawdownFromHighPct:
      drawdownFromHighPct != null ? Math.round(drawdownFromHighPct * 10) / 10 : null,
    ma20GapPct: ma20GapPct != null ? Math.round(ma20GapPct * 10) / 10 : null,
    ma60GapPct: ma60GapPct != null ? Math.round(ma60GapPct * 10) / 10 : null,
    rsi14,
    bollingerPctB: bollingerPctB != null ? Math.round(bollingerPctB * 100) / 100 : null,
    volumeChangePct: null,
    positionScore,
    label: resolvePriceLabel(positionScore),
    trendLabel: resolveTrendLabel(positionScore, return10d, return20d),
  }
}

/** @param {PanicPricePositionReport | null} report */
export function formatPricePositionSummary(report) {
  if (!report) return "가격 데이터 없음"
  return `${report.label} · 10일 ${fmtPct(report.return10d)} · 20일 ${fmtPct(report.return20d)}`
}
