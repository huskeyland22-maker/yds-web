/**
 * Daily Bottom Buy V1 — product evaluation engine (API).
 * Independent of Panic Index.
 */

export const DAILY_BOTTOM_BUY_ETFS = [
  { symbol: "SMH", theme: "반도체·AI 컴퓨팅", themeShort: "반도체·AI", role: "AI의 두뇌" },
  { symbol: "GRID", theme: "전력망·전기화", themeShort: "전력망", role: "AI 데이터센터 전력 인프라" },
  { symbol: "QQQ", theme: "빅테크·AI 플랫폼", themeShort: "빅테크·AI", role: "AI 플랫폼·클라우드" },
  { symbol: "IGV", theme: "소프트웨어·클라우드", themeShort: "소프트웨어", role: "AI 수익화" },
  { symbol: "CIBR", theme: "사이버보안", themeShort: "사이버", role: "AI 시대 보안 인프라" },
  { symbol: "BOTZ", theme: "로봇·자동화", themeShort: "로봇", role: "Physical AI" },
  { symbol: "ITA", theme: "방산·항공우주", themeShort: "방산", role: "국가 전략산업·국방" },
  { symbol: "URA", theme: "원전·우라늄", themeShort: "원전", role: "에너지 안보·원전 공급망" },
  { symbol: "IBB", theme: "바이오·생명과학", themeShort: "바이오", role: "AI 신약·정밀의료·생명공학" },
]

/** V1 product constants — frozen from Train validation */
export const DAILY_BOTTOM_THRESHOLDS = {
  rsiMax: 36,
  stochKMax: 15.4,
  bbPctBMax: 0.01,
  ma20DevMax: -4.2,
}

export const SPLIT_BUY_GUIDE = {
  at3: 0.5,
  at4: 0.5,
  note: "3개 충족 시 1차 50%, 4개 충족 시 추가 50%. 4개 없이 반등하면 잔여 50%는 자동 사용하지 않음.",
}

/**
 * @param {number[]} closes
 * @param {number} [period]
 */
export function rsiWilderSeries(closes, period = 14) {
  const n = closes.length
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

function smaOfNullable(values, period) {
  const n = values.length
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
      sum += values[j]
    }
    if (ok) out[i] = sum / period
  }
  return out
}

/**
 * @param {{ high: number, low: number, close: number }[]} bars
 */
export function stochasticKLast(bars, kPeriod = 14, kSmooth = 3) {
  const n = bars.length
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
  return k[n - 1]
}

/**
 * Unclamped %B
 * @param {number[]} closes
 */
export function bollingerPctBLast(closes, period = 20, mult = 2) {
  const n = closes.length
  if (n < period) return null
  let sum = 0
  for (let i = n - period; i < n; i++) sum += closes[i]
  const mean = sum / period
  let varSum = 0
  for (let i = n - period; i < n; i++) {
    const d = closes[i] - mean
    varSum += d * d
  }
  const std = Math.sqrt(varSum / period)
  const upper = mean + mult * std
  const lower = mean - mult * std
  const width = upper - lower
  if (width <= 0) return 0.5
  return (closes[n - 1] - lower) / width
}

/**
 * @param {number[]} closes
 */
export function ma20DevPctLast(closes, period = 20) {
  const n = closes.length
  if (n < period) return null
  let sum = 0
  for (let i = n - period; i < n; i++) sum += closes[i]
  const ma = sum / period
  if (!(ma > 0)) return null
  return ((closes[n - 1] - ma) / ma) * 100
}

/**
 * @param {number} count 0..4
 */
export function stageFromCount(count) {
  if (count >= 4) {
    return {
      id: "strong",
      count,
      label: "강한 저점",
      priority: 0,
      splitHint: "추가 매수 후보 (50%)",
    }
  }
  if (count >= 3) {
    return {
      id: "primary",
      count,
      label: "1차 매수",
      priority: 1,
      splitHint: "1차 매수 후보 (50%)",
    }
  }
  if (count >= 2) {
    return {
      id: "watch",
      count,
      label: "관심",
      priority: 2,
      splitHint: "관심 · 아직 매수 단계 아님",
    }
  }
  return {
    id: "wait",
    count,
    label: "대기",
    priority: 3,
    splitHint: "대기",
  }
}

/**
 * @param {{ date?: string, open: number, high: number, low: number, close: number }[]} bars
 * @param {typeof DAILY_BOTTOM_THRESHOLDS} [th]
 */
export function evaluateBars(bars, th = DAILY_BOTTOM_THRESHOLDS) {
  if (!Array.isArray(bars) || bars.length < 25) {
    return { ok: false, error: "insufficient_bars" }
  }
  const closes = bars.map((b) => b.close)
  const rsiSeries = rsiWilderSeries(closes, 14)
  const rsi14 = rsiSeries[rsiSeries.length - 1]
  const stochK = stochasticKLast(bars, 14, 3)
  const bbPctB = bollingerPctBLast(closes, 20, 2)
  const ma20DevPct = ma20DevPctLast(closes, 20)

  const flags = {
    rsi: rsi14 != null && rsi14 <= th.rsiMax,
    stoch: stochK != null && stochK <= th.stochKMax,
    bb: bbPctB != null && bbPctB <= th.bbPctBMax,
    ma20: ma20DevPct != null && ma20DevPct <= th.ma20DevMax,
  }
  const count = [flags.rsi, flags.stoch, flags.bb, flags.ma20].filter(Boolean).length
  const stage = stageFromCount(count)
  const last = bars[bars.length - 1]

  return {
    ok: true,
    asOfDate: last.date ?? null,
    close: last.close,
    rsi14: round1(rsi14),
    stochK: round1(stochK),
    bbPctB: round3(bbPctB),
    ma20DevPct: round1(ma20DevPct),
    flags,
    count,
    stage,
    thresholds: th,
  }
}

/**
 * @param {{ symbol: string, theme: string, themeShort?: string, role?: string }} meta
 * @param {object} evaluation evaluateBars result
 */
export function buildEtfCard(meta, evaluation) {
  if (!evaluation?.ok) {
    return {
      symbol: meta.symbol,
      theme: meta.theme,
      themeShort: meta.themeShort || meta.theme,
      role: meta.role || null,
      ok: false,
      error: evaluation?.error || "error",
      count: 0,
      stage: stageFromCount(0),
    }
  }
  return {
    symbol: meta.symbol,
    theme: meta.theme,
    themeShort: meta.themeShort || meta.theme,
    role: meta.role || null,
    ok: true,
    asOfDate: evaluation.asOfDate,
    close: evaluation.close,
    rsi14: evaluation.rsi14,
    stochK: evaluation.stochK,
    bbPctB: evaluation.bbPctB,
    ma20DevPct: evaluation.ma20DevPct,
    flags: evaluation.flags,
    count: evaluation.count,
    stage: evaluation.stage,
  }
}

/**
 * Sort: strong/primary first, then watch, then wait; within bucket by count desc then symbol
 * @param {ReturnType<typeof buildEtfCard>[]} cards
 */
export function sortCardsByOpportunity(cards) {
  return [...cards].sort((a, b) => {
    const pa = a.stage?.priority ?? 9
    const pb = b.stage?.priority ?? 9
    if (pa !== pb) return pa - pb
    if ((b.count || 0) !== (a.count || 0)) return (b.count || 0) - (a.count || 0)
    return String(a.symbol).localeCompare(String(b.symbol))
  })
}

function round1(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 10) / 10
}
function round3(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 1000) / 1000
}
