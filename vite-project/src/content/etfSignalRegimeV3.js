/**
 * ETF signal regime comparison v3 (research only).
 * Regime uses QQQ closes through the signal date. Returns stay the stored v1 values.
 */
import { sortBy60DayMedian, summarizeSymbol } from "./etfSignalCompare.js"

export const REGIME_ORDER = ["bull", "bear", "sideways", "unclassified"]

/** Fixed before reading the 905-signal outcomes. Same rule as classifyTrendRegime. */
export const REGIME_RULE = {
  market: "QQQ",
  price: "일봉 종가",
  maFast: 50,
  maSlow: 200,
  slopeLookback: 20,
  smallSampleComplete: 30,
  bull: "상승장: 당일 종가 > 200일 이평, 50일 이평 > 200일 이평, 200일 이평의 20거래일 기울기 > 0",
  bear: "하락장: 당일 종가 < 200일 이평, 50일 이평 < 200일 이평, 200일 이평의 20거래일 기울기 ≤ 0",
  sideways: "횡보장: 세 지표가 모두 계산되지만 상승장·하락장 조건이 아닌 경우",
  unclassified: "분류 불가: 신호일 QQQ 종가가 없거나, 200일 이평과 그 20거래일 전 이평을 만들 과거 종가가 부족한 경우",
  asOf: "신호 발생일 종가까지만 사용한다. 그 다음 거래일 이후 가격은 국면 분류에 넣지 않는다.",
  fixed: "기존 추세 국면 분류를 QQQ에 그대로 적용한다. 이번 신호 성과를 보고 임계값을 바꾸지 않는다.",
}

export const REGIME_LABEL = {
  bull: "상승장",
  bear: "하락장",
  sideways: "횡보장",
  unclassified: "분류 불가",
}

function smaAt(closes, index, period) {
  if (index < period - 1) return null
  let sum = 0
  for (let j = index - period + 1; j <= index; j++) {
    const close = closes[j]
    if (!Number.isFinite(close) || !(close > 0)) return null
    sum += close
  }
  return sum / period
}

/**
 * Regime of the last close only. Earlier closes are the history; nothing after index is read.
 * @param {number[]} closes
 */
export function regimeFromCloses(closes) {
  const index = (closes || []).length - 1
  if (index < 0) return "unclassified"
  const maSlow = smaAt(closes, index, REGIME_RULE.maSlow)
  const maFast = smaAt(closes, index, REGIME_RULE.maFast)
  const maSlowPrev = smaAt(closes, index - REGIME_RULE.slopeLookback, REGIME_RULE.maSlow)
  const close = closes[index]
  if (![close, maSlow, maFast, maSlowPrev].every((value) => Number.isFinite(value) && value > 0)) {
    return "unclassified"
  }
  const aboveMa200 = close > maSlow
  const ma50AboveMa200 = maFast > maSlow
  const ma200Slope = ((maSlow - maSlowPrev) / maSlowPrev) * 100
  if (aboveMa200 === true && ma200Slope > 0 && ma50AboveMa200 === true) return "bull"
  if (aboveMa200 === false && ma200Slope <= 0 && ma50AboveMa200 === false) return "bear"
  return "sideways"
}

function usableBars(bars) {
  const out = []
  for (const bar of bars || []) {
    const close = Number(bar?.close)
    if (typeof bar?.date !== "string" || !Number.isFinite(close) || !(close > 0)) continue
    if (out.length && !(bar.date > out[out.length - 1].date)) continue
    out.push({ date: bar.date, close })
  }
  return out
}

function smaSeries(closes, period) {
  const out = new Array(closes.length).fill(null)
  let sum = 0
  let count = 0
  for (let i = 0; i < closes.length; i++) {
    const close = closes[i]
    if (!Number.isFinite(close) || !(close > 0)) {
      sum = 0
      count = 0
      continue
    }
    sum += close
    count += 1
    if (count > period) {
      sum -= closes[i - period]
      count -= 1
    }
    if (count === period) out[i] = sum / period
  }
  return out
}

/** @returns {Map<string, "bull"|"bear"|"sideways"|"unclassified">} */
export function buildRegimeByDate(bars) {
  const series = usableBars(bars)
  const closes = series.map((bar) => bar.close)
  const maFast = smaSeries(closes, REGIME_RULE.maFast)
  const maSlow = smaSeries(closes, REGIME_RULE.maSlow)
  const byDate = new Map()
  for (let i = 0; i < series.length; i++) {
    const prev = i - REGIME_RULE.slopeLookback
    const slow = maSlow[i]
    const slowPrev = prev >= 0 ? maSlow[prev] : null
    const fast = maFast[i]
    const close = closes[i]
    if (![close, slow, fast, slowPrev].every((value) => Number.isFinite(value) && value > 0)) {
      byDate.set(series[i].date, "unclassified")
      continue
    }
    const slope = ((slow - slowPrev) / slowPrev) * 100
    if (close > slow && slope > 0 && fast > slow) byDate.set(series[i].date, "bull")
    else if (close < slow && slope <= 0 && fast < slow) byDate.set(series[i].date, "bear")
    else byDate.set(series[i].date, "sideways")
  }
  return byDate
}

function metasFromReport(report) {
  const episodes = Array.isArray(report?.episodes) ? report.episodes : []
  const universe = Array.isArray(report?.universe) && report.universe.length
    ? report.universe
    : [...new Set(episodes.map((episode) => episode.symbol).filter(Boolean))]
  return universe.map((symbol) => {
    const sample = episodes.find((episode) => episode?.symbol === symbol)
    return { symbol, themeShort: sample?.themeShort || symbol }
  })
}

/**
 * @param {{ universe?: string[], episodes?: object[] }} report stored v1 file
 * @param {Array<{ date: string, close: number }>} qqqBars
 */
export function analyzeSignalRegimes(report, qqqBars) {
  const episodes = Array.isArray(report?.episodes) ? report.episodes : []
  const byDate = buildRegimeByDate(qqqBars)
  const tagged = episodes.map((episode) => ({
    ...episode,
    regime: episode?.signalDate && byDate.has(episode.signalDate) ? byDate.get(episode.signalDate) : "unclassified",
  }))
  const counts = { total: episodes.length }
  for (const regime of REGIME_ORDER) {
    counts[regime] = tagged.filter((episode) => episode.regime === regime).length
  }
  const metas = metasFromReport(report)
  const regimes = {}
  for (const regime of REGIME_ORDER) {
    const list = tagged.filter((episode) => episode.regime === regime)
    const bySymbol = new Map()
    for (const episode of list) {
      if (!episode?.symbol) continue
      const rows = bySymbol.get(episode.symbol) || []
      rows.push(episode)
      bySymbol.set(episode.symbol, rows)
    }
    const rows = sortBy60DayMedian(metas.map((meta) => summarizeSymbol(meta, bySymbol.get(meta.symbol) || [])))
    const total = summarizeSymbol({ symbol: "전체", themeShort: "전체" }, list)
    regimes[regime] = {
      total,
      rows,
      smallSample: total.horizons["60"].complete < REGIME_RULE.smallSampleComplete,
    }
  }
  const series = usableBars(qqqBars)
  return {
    version: 3,
    researchOnly: true,
    source: "etf_signal_track_v1",
    independentSamples: false,
    rule: REGIME_RULE,
    qqqAsOf: series.length ? series[series.length - 1].date : null,
    qqqBars: series.length,
    counts,
    regimes,
  }
}
