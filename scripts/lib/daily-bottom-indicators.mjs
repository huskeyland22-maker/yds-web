/**
 * Daily Bottom Buy — technical indicator series (validation only).
 * RSI: Wilder(14). Stochastic: (14,3,3). Bollinger: (20,2). MA20 deviation.
 * Independent of Panic Index. Not used by product UI in this stage.
 */

/**
 * @typedef {{ date: string, open: number, high: number, low: number, close: number, volume?: number }} Bar
 */

/** @param {number[]} closes @param {number} [period] */
export function rsiWilderSeries(closes, period = 14) {
  const n = closes.length
  /** @type {(number|null)[]} */
  const out = new Array(n).fill(null)
  if (n < period + 1) return out

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1]
    if (d >= 0) avgGain += d
    else avgLoss -= d
  }
  avgGain /= period
  avgLoss /= period
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  for (let i = period + 1; i < n; i++) {
    const d = closes[i] - closes[i - 1]
    const g = d > 0 ? d : 0
    const l = d < 0 ? -d : 0
    avgGain = (avgGain * (period - 1) + g) / period
    avgLoss = (avgLoss * (period - 1) + l) / period
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return out
}

/** @param {number[]} values @param {number} period */
export function smaSeries(values, period) {
  const n = values.length
  /** @type {(number|null)[]} */
  const out = new Array(n).fill(null)
  if (n < period) return out
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

/**
 * Stochastic %K / %D (14,3,3)
 * %K = SMA3 of raw %K; %D = SMA3 of %K
 * @param {Bar[]} bars
 * @param {number} [kPeriod]
 * @param {number} [kSmooth]
 * @param {number} [dSmooth]
 */
export function stochasticSeries(bars, kPeriod = 14, kSmooth = 3, dSmooth = 3) {
  const n = bars.length
  /** @type {(number|null)[]} */
  const rawK = new Array(n).fill(null)
  for (let i = kPeriod - 1; i < n; i++) {
    let hh = -Infinity
    let ll = Infinity
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (bars[j].high > hh) hh = bars[j].high
      if (bars[j].low < ll) ll = bars[j].low
    }
    const range = hh - ll
    rawK[i] = range <= 0 ? 50 : ((bars[i].close - ll) / range) * 100
  }
  const k = smaOfNullable(rawK, kSmooth)
  const d = smaOfNullable(k, dSmooth)
  return { k, d, rawK }
}

/**
 * Bollinger (20, 2): mid, upper, lower, %B, bandwidth
 * %B = (close - lower) / (upper - lower); can be <0 or >1 (no clamp)
 * @param {number[]} closes
 * @param {number} [period]
 * @param {number} [mult]
 */
export function bollingerSeries(closes, period = 20, mult = 2) {
  const n = closes.length
  /** @type {(number|null)[]} */
  const mid = new Array(n).fill(null)
  /** @type {(number|null)[]} */
  const upper = new Array(n).fill(null)
  /** @type {(number|null)[]} */
  const lower = new Array(n).fill(null)
  /** @type {(number|null)[]} */
  const pctB = new Array(n).fill(null)
  /** @type {(number|null)[]} */
  const bandwidth = new Array(n).fill(null)

  for (let i = period - 1; i < n; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += closes[j]
    const mean = sum / period
    let varSum = 0
    for (let j = i - period + 1; j <= i; j++) {
      const d = closes[j] - mean
      varSum += d * d
    }
    const std = Math.sqrt(varSum / period)
    const up = mean + mult * std
    const lo = mean - mult * std
    mid[i] = mean
    upper[i] = up
    lower[i] = lo
    const width = up - lo
    pctB[i] = width <= 0 ? 0.5 : (closes[i] - lo) / width
    bandwidth[i] = mean === 0 ? null : width / mean
  }
  return { mid, upper, lower, pctB, bandwidth }
}

/**
 * Close vs SMA20 deviation in percent: (close - sma20) / sma20 * 100
 * @param {number[]} closes
 * @param {number} [period]
 */
export function maDeviationSeries(closes, period = 20) {
  const sma = smaSeries(closes, period)
  /** @type {(number|null)[]} */
  const out = new Array(closes.length).fill(null)
  for (let i = 0; i < closes.length; i++) {
    if (sma[i] == null || sma[i] === 0) continue
    out[i] = ((closes[i] - sma[i]) / sma[i]) * 100
  }
  return { sma, deviationPct: out }
}

/**
 * Attach indicator columns to bars (mutates copies).
 * @param {Bar[]} bars
 */
export function enrichBarsWithIndicators(bars) {
  const closes = bars.map((b) => b.close)
  const rsi = rsiWilderSeries(closes, 14)
  const stoch = stochasticSeries(bars, 14, 3, 3)
  const bb = bollingerSeries(closes, 20, 2)
  const ma20 = maDeviationSeries(closes, 20)

  return bars.map((b, i) => ({
    ...b,
    rsi14: rsi[i],
    stochK: stoch.k[i],
    stochD: stoch.d[i],
    bbPctB: bb.pctB[i],
    bbLower: bb.lower[i],
    bbUpper: bb.upper[i],
    bbMid: bb.mid[i],
    ma20: ma20.sma[i],
    ma20DevPct: ma20.deviationPct[i],
  }))
}

/** @param {(number|null)[]} values @param {number} period */
function smaOfNullable(values, period) {
  const n = values.length
  /** @type {(number|null)[]} */
  const out = new Array(n).fill(null)
  for (let i = 0; i < n; i++) {
    if (i < period - 1) continue
    let sum = 0
    let ok = true
    for (let j = i - period + 1; j <= i; j++) {
      if (values[j] == null || !Number.isFinite(values[j])) {
        ok = false
        break
      }
      sum += /** @type {number} */ (values[j])
    }
    if (ok) out[i] = sum / period
  }
  return out
}
