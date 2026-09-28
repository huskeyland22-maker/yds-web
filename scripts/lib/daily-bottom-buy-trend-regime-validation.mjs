/**
 * Trend-regime vs correction-stage diagnostic (research only).
 * Regime uses only data through that close. Not a buy rule or a rating.
 * 120-day trailing-high episodes come from the prior correction-stage study.
 */

import { smaSeries, enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import { summarizeNumeric } from "./daily-bottom-buy-validation-core.mjs"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  attachObservationFeatures,
  assertNoEtfInStudyUniverse,
} from "./daily-bottom-buy-cross-asset-validation.mjs"
import {
  STAGE_PCTS,
  buildCorrectionEpisodes,
} from "./daily-bottom-buy-correction-stage-validation.mjs"

export { EQUITY_CANDIDATES, FROZEN_THRESHOLDS, STAGE_PCTS, assertNoEtfInStudyUniverse }

export const FOCUS_STAGES = [10, 15, 20, 25, 30]
export const ATR_SPLIT = { lowMax: 3, highMin: 4 }

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function median(vals) {
  return summarizeNumeric(vals.filter((v) => Number.isFinite(v))).median
}

function mean(vals) {
  return summarizeNumeric(vals.filter((v) => Number.isFinite(v))).mean
}

function rate(n, d) {
  if (!d) return null
  return round2((n / d) * 100)
}

/**
 * Research labels only. Unknown when MA200 is not available yet.
 * @param {{ aboveMa200: boolean|null, ma200Slope: number|null, ma50AboveMa200: boolean|null }} row
 */
export function classifyTrendRegime(row) {
  const { aboveMa200, ma200Slope, ma50AboveMa200 } = row
  if (aboveMa200 == null || ma200Slope == null || ma50AboveMa200 == null) return "unknown"
  if (aboveMa200 === true && ma200Slope > 0 && ma50AboveMa200 === true) return "up"
  if (aboveMa200 === false && ma200Slope <= 0 && ma50AboveMa200 === false) return "down"
  return "neutral"
}

function slope20(series, i) {
  if (i < 20 || series[i] == null || series[i - 20] == null || series[i - 20] === 0) return null
  return ((series[i] - series[i - 20]) / series[i - 20]) * 100
}

function relRet(bars, i, n, map) {
  if (!map || i < n) return null
  const prev = bars[i - n]
  const c0 = map.get(prev.date)
  const c1 = map.get(bars[i].date)
  if (!(c0 > 0) || !(c1 > 0) || !(prev.close > 0)) return null
  return (bars[i].close / prev.close - c1 / c0) * 100
}

function riseFromLow(bars, i, window) {
  const start = Math.max(0, i - window + 1)
  let mn = Infinity
  for (let j = start; j <= i; j++) if (bars[j].low < mn) mn = bars[j].low
  if (!(mn > 0) || i - start + 1 < window) return null
  return ((bars[i].close - mn) / mn) * 100
}

/**
 * Adds causal trend fields. Does not look past index i.
 * @param {any[]} bars already indicator-enriched
 */
export function attachTrendFields(bars, spyMap = null, qqqMap = null) {
  const closes = bars.map((b) => b.close)
  const ma50 = smaSeries(closes, 50)
  const ma100 = smaSeries(closes, 100)
  const ma200 = smaSeries(closes, 200)
  return bars.map((b, i) => {
    const aboveMa200 = ma200[i] != null ? b.close > ma200[i] : null
    const ma50AboveMa200 = ma50[i] != null && ma200[i] != null ? ma50[i] > ma200[i] : null
    const ma200Slope = slope20(ma200, i)
    const regime = classifyTrendRegime({ aboveMa200, ma200Slope, ma50AboveMa200 })
    const ret = (n) => (i >= n && closes[i - n] > 0 ? ((closes[i] - closes[i - n]) / closes[i - n]) * 100 : null)
    return {
      ...b,
      ma50Level: ma50[i] != null ? round2(ma50[i]) : null,
      ma100Level: ma100[i] != null ? round2(ma100[i]) : null,
      ma200Level: ma200[i] != null ? round2(ma200[i]) : null,
      aboveMa100: ma100[i] != null ? b.close > ma100[i] : null,
      aboveMa50: ma50[i] != null ? b.close > ma50[i] : null,
      ma100Slope20: round2(slope20(ma100, i)),
      ma200Slope: round2(ma200Slope),
      riseFrom252Low: round2(riseFromLow(bars, i, 252)),
      ret60: round2(ret(60)),
      ret120: round2(ret(120)),
      ret252: round2(ret(252)),
      rsSpy60: round2(relRet(bars, i, 60, spyMap)),
      rsSpy120: round2(relRet(bars, i, 120, spyMap)),
      rsQqq120: round2(relRet(bars, i, 120, qqqMap)),
      regime,
    }
  })
}

function packOutcomes(rows) {
  const outs = rows.map((r) => r.outcome).filter(Boolean)
  const d20 = outs.map((o) => o.d20).filter((v) => v != null)
  const d60 = outs.map((o) => o.d60).filter((v) => v != null)
  return {
    n: rows.length,
    maeMedian: median(outs.map((o) => o.maePct)),
    maeMean: mean(outs.map((o) => o.maePct)),
    d20Median: median(d20),
    d60Median: median(d60),
    d20PositivePct: rate(d20.filter((v) => v > 0).length, d20.length),
    d60PositivePct: rate(d60.filter((v) => v > 0).length, d60.length),
    hit5Pct: rate(outs.filter((o) => o.hit5).length, outs.length),
    hit10Pct: rate(outs.filter((o) => o.hit10).length, outs.length),
    d60LossPct: rate(d60.filter((v) => v < 0).length, d60.length),
    daysToLowMedian: median(outs.map((o) => o.daysToLow)),
  }
}

function groupByRegime(rows) {
  const out = {}
  for (const name of ["up", "neutral", "down", "unknown"]) {
    out[name] = packOutcomes(rows.filter((r) => r.regime === name))
  }
  return out
}

function atrBand(v) {
  if (v == null || !Number.isFinite(v)) return null
  if (v < 2) return "lt2"
  if (v < 3) return "2_3"
  if (v < 4) return "3_4"
  if (v < 5) return "4_5"
  return "gt5"
}

function atrSide(v) {
  if (v == null || !Number.isFinite(v)) return null
  if (v < ATR_SPLIT.lowMax) return "low"
  if (v >= ATR_SPLIT.highMin) return "high"
  return "mid"
}

const FEATURE_KEYS = [
  "rsi14",
  "ma20DevPct",
  "ma50Gap",
  "ma200Gap",
  "dd52",
  "atrPct",
  "volRatio",
  "ret120",
  "rsSpy120",
]

function featureMedians(rows) {
  const out = {}
  for (const key of FEATURE_KEYS) {
    out[key] = median(rows.map((r) => r.features?.[key]))
  }
  return out
}

function stageRowsFromEpisodes(episodes, bars) {
  /** @type {Record<number, any[]>} */
  const byStage = {}
  for (const level of STAGE_PCTS) byStage[level] = []
  for (const ep of episodes) {
    for (const level of STAGE_PCTS) {
      const st = ep.stages[level]
      if (!st?.outcome) continue
      const b = bars[st.idx]
      byStage[level].push({
        symbol: ep.symbol,
        date: b.date,
        level,
        regime: b.regime,
        atrPct: b.atrPct,
        atrBand: atrBand(b.atrPct),
        atrSide: atrSide(b.atrPct),
        outcome: st.outcome,
        features: {
          rsi14: b.rsi14,
          ma20DevPct: b.ma20DevPct,
          ma50Gap: b.ma50Gap,
          ma200Gap: b.ma200Gap,
          dd52: b.dd52,
          atrPct: b.atrPct,
          volRatio: b.volRatio,
          ret120: b.ret120,
          rsSpy120: b.rsSpy120,
        },
      })
    }
  }
  return byStage
}

export function analyzeSymbolTrend(meta, rawBars, bench = {}) {
  if (!rawBars?.length) return { symbol: meta.symbol, status: "data unavailable", episodes: [] }
  const base = attachObservationFeatures(
    enrichBarsWithIndicators(rawBars),
    bench.spy || null,
    bench.qqq || null,
  )
  const bars = attachTrendFields(base, bench.spy || null, bench.qqq || null)
  const episodes = buildCorrectionEpisodes(bars, 120).map((ep) => ({ ...ep, symbol: meta.symbol }))
  return { symbol: meta.symbol, status: "ok", bars, episodes }
}

export function poolTrendRegime(analyzed) {
  const ok = analyzed.filter((a) => a.status === "ok")
  const allRows = []
  for (const a of ok) {
    const part = stageRowsFromEpisodes(a.episodes, a.bars)
    for (const level of STAGE_PCTS) allRows.push(...part[level])
  }
  const byStage = {}
  for (const level of STAGE_PCTS) {
    const rows = allRows.filter((r) => r.level === level)
    byStage[level] = groupByRegime(rows)
  }

  const focusRows = allRows.filter((r) => FOCUS_STAGES.includes(r.level))
  const band10to30 = {
    note: "Each stage entry is one row. One episode can appear at more than one depth.",
    up: packOutcomes(focusRows.filter((r) => r.regime === "up")),
    neutral: packOutcomes(focusRows.filter((r) => r.regime === "neutral")),
    down: packOutcomes(focusRows.filter((r) => r.regime === "down")),
  }

  const features = {}
  for (const level of [10, 15, 20]) {
    const rows = allRows.filter((r) => r.level === level)
    features[level] = {
      up: featureMedians(rows.filter((r) => r.regime === "up")),
      down: featureMedians(rows.filter((r) => r.regime === "down")),
      neutral: featureMedians(rows.filter((r) => r.regime === "neutral")),
    }
  }

  const atrInUptrend = {}
  for (const level of [10, 15, 20]) {
    const rows = allRows.filter((r) => r.level === level && r.regime === "up")
    atrInUptrend[level] = {}
    for (const band of ["lt2", "2_3", "3_4", "4_5", "gt5"]) {
      atrInUptrend[level][band] = packOutcomes(rows.filter((r) => r.atrBand === band))
    }
  }

  const combos = {}
  for (const level of [10, 15, 20]) {
    const rows = allRows.filter((r) => r.level === level)
    combos[level] = {
      up_lowAtr: packOutcomes(rows.filter((r) => r.regime === "up" && r.atrSide === "low")),
      up_highAtr: packOutcomes(rows.filter((r) => r.regime === "up" && r.atrSide === "high")),
      down_lowAtr: packOutcomes(rows.filter((r) => r.regime === "down" && r.atrSide === "low")),
      down_highAtr: packOutcomes(rows.filter((r) => r.regime === "down" && r.atrSide === "high")),
      atrCut: "low = ATR% < 3, high = ATR% >= 4. Fixed observation cut, not searched.",
    }
  }

  const large = allRows.filter((r) => FOCUS_STAGES.includes(r.level) && r.outcome?.maePct != null && r.outcome.maePct >= 20)
  const top = (regime) =>
    large
      .filter((r) => r.regime === regime)
      .sort((a, b) => b.outcome.maePct - a.outcome.maePct)
      .slice(0, 12)
      .map((r) => ({
        symbol: r.symbol,
        date: r.date,
        level: r.level,
        maePct: r.outcome.maePct,
        d60: r.outcome.d60,
        regime: r.regime,
        atrPct: r.atrPct,
      }))

  return {
    nSymbols: ok.length,
    nEpisodes120: ok.reduce((s, a) => s + a.episodes.length, 0),
    byStage,
    band10to30,
    features,
    atrInUptrend,
    combos,
    largeMae: {
      upCount: large.filter((r) => r.regime === "up").length,
      downCount: large.filter((r) => r.regime === "down").length,
      neutralCount: large.filter((r) => r.regime === "neutral").length,
      upExamples: top("up"),
      downExamples: top("down"),
    },
  }
}

const MSFT_DATES = ["2026-06-08", "2026-06-17", "2026-06-25"]

export function msftTrendSnapshot(rawBars, bench = {}) {
  if (!rawBars?.length) return { status: "data unavailable" }
  const base = attachObservationFeatures(enrichBarsWithIndicators(rawBars), bench.spy || null, bench.qqq || null)
  const bars = attachTrendFields(base, bench.spy || null, bench.qqq || null)
  const byDate = new Map(bars.map((b, i) => [b.date, i]))
  const days = {}
  for (const d of MSFT_DATES) {
    const i = byDate.get(d)
    if (i == null) {
      days[d] = { status: "date missing" }
      continue
    }
    const b = bars[i]
    days[d] = {
      date: b.date,
      close: round2(b.close),
      ma50: b.ma50Level,
      ma100: b.ma100Level,
      ma200: b.ma200Level,
      ma200Slope: b.ma200Slope,
      ma50AboveMa200: b.ma50AboveMa200,
      aboveMa200: b.aboveMa200,
      aboveMa100: b.aboveMa100,
      aboveMa50: b.aboveMa50,
      dd52: b.dd52,
      riseFrom252Low: b.riseFrom252Low,
      ret60: b.ret60,
      ret120: b.ret120,
      ret252: b.ret252,
      rsSpy60: b.rsSpy60,
      rsSpy120: b.rsSpy120,
      rsQqq120: b.rsQqq120,
      atrPct: b.atrPct,
      count: b.count,
      regime: b.regime,
    }
  }
  return { status: "ok", days }
}
