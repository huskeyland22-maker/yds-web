/**
 * 시장 상태 V2 — 가격 구조 (Action-first)
 * QQQ/SPY 일봉 기반: MA, 스윙, 모멘텀
 */

/** @typedef {{
 *   asOfDate: string
 *   close: number
 *   aboveMa20: boolean | null
 *   aboveMa60: boolean | null
 *   ma20GapPct: number | null
 *   ma60GapPct: number | null
 *   ma20SlopePct: number | null
 *   ma60SlopePct: number | null
 *   return5d: number | null
 *   return10d: number | null
 *   higherHigh: boolean | null
 *   higherLow: boolean | null
 *   lowerHigh: boolean | null
 *   lowerLow: boolean | null
 *   swingHigh: number | null
 *   swingLow: number | null
 *   volumeIncrease: boolean | null
 *   structureScore: number
 *   trendLabel: string
 *   bullets: string[]
 * }} MarketStatePriceStructureReport
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

/** @param {{ close: number }[]} series @param {number} period @param {number} offset */
function maAtOffset(series, period, offset) {
  const end = series.length - offset
  if (end < period) return null
  const slice = series.slice(end - period, end)
  return slice.reduce((s, r) => s + r.close, 0) / period
}

/**
 * @param {{ close: number }[]} series
 * @param {number} [radius]
 * @returns {Array<{ index: number; value: number; kind: 'high' | 'low' }>}
 */
function findSwingPoints(series, radius = 2) {
  /** @type {Array<{ index: number; value: number; kind: 'high' | 'low' }>} */
  const points = []
  for (let i = radius; i < series.length - radius; i += 1) {
    const c = series[i].close
    let isHigh = true
    let isLow = true
    for (let j = 1; j <= radius; j += 1) {
      if (series[i - j].close >= c || series[i + j].close >= c) isHigh = false
      if (series[i - j].close <= c || series[i + j].close <= c) isLow = false
    }
    if (isHigh) points.push({ index: i, value: c, kind: "high" })
    if (isLow) points.push({ index: i, value: c, kind: "low" })
  }
  return points
}

/** @param {number | null} v @param {number} digits */
function fmtPct(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return "—"
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`
}

/**
 * @param {MarketStatePriceStructureReport['bullets']} bullets
 * @param {string} text
 */
function pushBullet(bullets, text) {
  if (text && !bullets.includes(text)) bullets.push(text)
}

/**
 * @param {{
 *   return5d?: number | null
 *   return10d?: number | null
 *   ma20GapPct?: number | null
 *   ma60GapPct?: number | null
 *   ma20SlopePct?: number | null
 *   ma60SlopePct?: number | null
 *   aboveMa20?: boolean | null
 *   aboveMa60?: boolean | null
 *   higherHigh?: boolean | null
 *   higherLow?: boolean | null
 *   lowerHigh?: boolean | null
 *   lowerLow?: boolean | null
 * }} m
 */
function computeStructureScore(m) {
  let score = 50
  if (m.aboveMa20 != null) score += m.aboveMa20 ? 8 : -8
  if (m.aboveMa60 != null) score += m.aboveMa60 ? 10 : -10
  if (m.ma20SlopePct != null) score += clamp(m.ma20SlopePct * 2.5, -12, 12)
  if (m.ma60SlopePct != null) score += clamp(m.ma60SlopePct * 2, -10, 10)
  if (m.return5d != null) score += clamp(m.return5d * 2.8, -14, 14)
  if (m.return10d != null) score += clamp(m.return10d * 1.6, -12, 12)
  if (m.higherHigh) score += 6
  if (m.higherLow) score += 6
  if (m.lowerHigh) score -= 7
  if (m.lowerLow) score -= 7
  if (m.ma20GapPct != null) score += clamp(m.ma20GapPct * 1.2, -8, 8)
  return Math.round(clamp(score, 0, 100))
}

/** @param {number | null} score */
function resolveTrendLabel(score) {
  if (score == null) return "—"
  if (score >= 72) return "상승 추세"
  if (score >= 58) return "상승 추세 내 조정"
  if (score >= 42) return "횡보·전환"
  if (score >= 28) return "조정·약세"
  return "하락 추세"
}

/**
 * @param {{
 *   spyPrices?: Record<string, number>
 *   qqqPrices?: Record<string, number>
 *   asOfDate?: string | null
 * }} input
 * @returns {MarketStatePriceStructureReport | null}
 */
export function buildMarketStatePriceStructureReport(input = {}) {
  const prices = input.qqqPrices ?? input.spyPrices ?? null
  const series = buildCloseSeries(prices, input.asOfDate ?? undefined)
  if (series.length < 65) return null

  const last = series[series.length - 1]
  const idx5 = series.length - 6
  const idx10 = series.length - 11

  const ma20 = simpleMA(series, 20)
  const ma60 = simpleMA(series, 60)
  const ma20Prev = maAtOffset(series, 20, 5)
  const ma60Prev = maAtOffset(series, 60, 5)

  const ma20GapPct = ma20 != null ? ((last.close - ma20) / ma20) * 100 : null
  const ma60GapPct = ma60 != null ? ((last.close - ma60) / ma60) * 100 : null
  const ma20SlopePct =
    ma20 != null && ma20Prev != null && ma20Prev > 0
      ? ((ma20 - ma20Prev) / ma20Prev) * 100
      : null
  const ma60SlopePct =
    ma60 != null && ma60Prev != null && ma60Prev > 0
      ? ((ma60 - ma60Prev) / ma60Prev) * 100
      : null

  const return5d =
    idx5 >= 0 ? ((last.close - series[idx5].close) / series[idx5].close) * 100 : null
  const return10d =
    idx10 >= 0 ? ((last.close - series[idx10].close) / series[idx10].close) * 100 : null

  const swings = findSwingPoints(series.slice(-45), 2)
  const highs = swings.filter((p) => p.kind === "high")
  const lows = swings.filter((p) => p.kind === "low")

  let higherHigh = null
  let lowerHigh = null
  let higherLow = null
  let lowerLow = null
  let swingHigh = null
  let swingLow = null

  if (highs.length >= 2) {
    const prev = highs[highs.length - 2].value
    const cur = highs[highs.length - 1].value
    swingHigh = cur
    higherHigh = cur > prev
    lowerHigh = cur < prev
  } else if (highs.length === 1) {
    swingHigh = highs[0].value
  }

  if (lows.length >= 2) {
    const prev = lows[lows.length - 2].value
    const cur = lows[lows.length - 1].value
    swingLow = cur
    higherLow = cur > prev
    lowerLow = cur < prev
  } else if (lows.length === 1) {
    swingLow = lows[0].value
  }

  const aboveMa20 = ma20 != null ? last.close >= ma20 : null
  const aboveMa60 = ma60 != null ? last.close >= ma60 : null

  const structureScore = computeStructureScore({
    return5d,
    return10d,
    ma20GapPct,
    ma60GapPct,
    ma20SlopePct,
    ma60SlopePct,
    aboveMa20,
    aboveMa60,
    higherHigh,
    higherLow,
    lowerHigh,
    lowerLow,
  })

  /** @type {string[]} */
  const bullets = []
  if (aboveMa60) pushBullet(bullets, "MA60 상승 유지")
  else if (aboveMa60 === false && (ma60SlopePct ?? 0) > 0) {
    pushBullet(bullets, "장기 상승추세 유지")
  } else if (aboveMa60 === false) {
    pushBullet(bullets, "MA60 하회")
  }

  if (aboveMa20) pushBullet(bullets, "MA20 상단 유지")
  else if (aboveMa20 === false && ma20GapPct != null && ma20GapPct > -2) {
    pushBullet(bullets, "MA20 지지 테스트")
  } else if (aboveMa20 === false) {
    pushBullet(bullets, "MA20 하향 이탈")
  }

  if (ma20SlopePct != null) {
    if (ma20SlopePct > 0.15) pushBullet(bullets, "MA20 기울기 상승")
    else if (ma20SlopePct < -0.15) pushBullet(bullets, "MA20 기울기 하락")
  }
  if (ma60SlopePct != null && ma60SlopePct > 0.1) {
    pushBullet(bullets, "MA60 기울기 상승")
  }

  if (return5d != null) pushBullet(bullets, `최근 5일 ${fmtPct(return5d)}`)
  if (return10d != null) pushBullet(bullets, `최근 10일 ${fmtPct(return10d)}`)

  if (higherHigh) pushBullet(bullets, "Higher High 형성")
  if (lowerHigh) pushBullet(bullets, "Lower High 발생")
  if (higherLow) pushBullet(bullets, "Higher Low 유지")
  if (lowerLow) pushBullet(bullets, "Lower Low 발생")

  if (return5d != null && return5d < -1 && return5d > -6) {
    pushBullet(bullets, "단기 모멘텀 둔화")
  }

  return {
    asOfDate: last.date,
    close: last.close,
    aboveMa20,
    aboveMa60,
    ma20GapPct: ma20GapPct != null ? Math.round(ma20GapPct * 10) / 10 : null,
    ma60GapPct: ma60GapPct != null ? Math.round(ma60GapPct * 10) / 10 : null,
    ma20SlopePct: ma20SlopePct != null ? Math.round(ma20SlopePct * 100) / 100 : null,
    ma60SlopePct: ma60SlopePct != null ? Math.round(ma60SlopePct * 100) / 100 : null,
    return5d: return5d != null ? Math.round(return5d * 10) / 10 : null,
    return10d: return10d != null ? Math.round(return10d * 10) / 10 : null,
    higherHigh,
    higherLow,
    lowerHigh,
    lowerLow,
    swingHigh,
    swingLow,
    volumeIncrease: null,
    structureScore,
    trendLabel: resolveTrendLabel(structureScore),
    bullets,
  }
}

/**
 * @param {MarketStatePriceStructureReport | null | undefined} price
 */
export function isPriceBearishStructure(price) {
  if (!price) return false
  return (
    price.lowerHigh === true &&
    price.lowerLow === true &&
    (price.ma20SlopePct ?? 0) < 0 &&
    (price.return5d ?? 0) < 0
  )
}

/**
 * @param {MarketStatePriceStructureReport | null | undefined} price
 */
export function isPriceBullishStructure(price) {
  if (!price) return false
  return (
    price.higherHigh === true &&
    price.higherLow === true &&
    (price.ma20SlopePct ?? 0) > 0 &&
    (price.ma60SlopePct ?? 0) > 0
  )
}

/**
 * @param {MarketStatePriceStructureReport | null | undefined} price
 */
export function isPricePullbackInUptrend(price) {
  if (!price) return false
  return (
    (price.aboveMa60 === true || (price.ma60SlopePct ?? 0) > 0) &&
    (price.return5d ?? 0) < 0 &&
    (price.lowerHigh === true || (price.ma20GapPct ?? 0) < 2)
  )
}
