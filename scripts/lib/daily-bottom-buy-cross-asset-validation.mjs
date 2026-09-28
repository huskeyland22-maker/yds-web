/**
 * Individual-stock DBB diagnostic (research only).
 * Reuses FROZEN_THRESHOLDS + buildSplitBuyEpisodes.
 * Extra fields are observation variables, not new buy rules.
 * No threshold search. No ETF study universe.
 */

import { smaSeries, enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import { conditionFlags, summarizeNumeric } from "./daily-bottom-buy-validation-core.mjs"
import { EPISODE_DEF, FROZEN_THRESHOLDS, buildSplitBuyEpisodes } from "./daily-bottom-split-buy-sim.mjs"

export { FROZEN_THRESHOLDS, EPISODE_DEF }

/** Study universe: single names only. Benchmarks (SPY/QQQ) are not members. */
export const EQUITY_CANDIDATES = [
  { symbol: "MSFT", yahoo: "MSFT", group: "AI / Big Tech" },
  { symbol: "GOOGL", yahoo: "GOOGL", group: "AI / Big Tech" },
  { symbol: "AMZN", yahoo: "AMZN", group: "AI / Big Tech" },
  { symbol: "META", yahoo: "META", group: "AI / Big Tech" },
  { symbol: "AAPL", yahoo: "AAPL", group: "AI / Big Tech" },
  { symbol: "ORCL", yahoo: "ORCL", group: "AI / Big Tech" },
  { symbol: "NVDA", yahoo: "NVDA", group: "Semiconductor" },
  { symbol: "AVGO", yahoo: "AVGO", group: "Semiconductor" },
  { symbol: "TSM", yahoo: "TSM", group: "Semiconductor" },
  { symbol: "AMD", yahoo: "AMD", group: "Semiconductor" },
  { symbol: "ASML", yahoo: "ASML", group: "Semiconductor" },
  { symbol: "MU", yahoo: "MU", group: "Semiconductor" },
  { symbol: "AMAT", yahoo: "AMAT", group: "Semiconductor" },
  { symbol: "LRCX", yahoo: "LRCX", group: "Semiconductor" },
  { symbol: "CRWD", yahoo: "CRWD", group: "Cybersecurity" },
  { symbol: "PANW", yahoo: "PANW", group: "Cybersecurity" },
  { symbol: "ZS", yahoo: "ZS", group: "Cybersecurity" },
  { symbol: "FTNT", yahoo: "FTNT", group: "Cybersecurity" },
  { symbol: "PLTR", yahoo: "PLTR", group: "Software" },
  { symbol: "CRM", yahoo: "CRM", group: "Software" },
  { symbol: "ADBE", yahoo: "ADBE", group: "Software" },
  { symbol: "LLY", yahoo: "LLY", group: "Healthcare" },
  { symbol: "JNJ", yahoo: "JNJ", group: "Healthcare" },
  { symbol: "ABBV", yahoo: "ABBV", group: "Healthcare" },
  { symbol: "JPM", yahoo: "JPM", group: "Financial" },
  { symbol: "V", yahoo: "V", group: "Financial" },
  { symbol: "MA", yahoo: "MA", group: "Financial" },
  { symbol: "BRK.B", yahoo: "BRK-B", group: "Financial" },
  { symbol: "GE", yahoo: "GE", group: "Industrial" },
  { symbol: "CAT", yahoo: "CAT", group: "Industrial" },
  { symbol: "RTX", yahoo: "RTX", group: "Industrial" },
  { symbol: "HON", yahoo: "HON", group: "Industrial" },
  { symbol: "TSLA", yahoo: "TSLA", group: "Consumer" },
  { symbol: "HD", yahoo: "HD", group: "Consumer" },
  { symbol: "COST", yahoo: "COST", group: "Consumer" },
  { symbol: "WMT", yahoo: "WMT", group: "Consumer" },
  { symbol: "XOM", yahoo: "XOM", group: "Energy" },
  { symbol: "CVX", yahoo: "CVX", group: "Energy" },
  { symbol: "COP", yahoo: "COP", group: "Energy" },
  { symbol: "NEE", yahoo: "NEE", group: "Energy" },
  { symbol: "CEG", yahoo: "CEG", group: "Energy" },
  { symbol: "VST", yahoo: "VST", group: "Energy" },
  { symbol: "LIN", yahoo: "LIN", group: "Materials" },
  { symbol: "FCX", yahoo: "FCX", group: "Materials" },
  { symbol: "SHW", yahoo: "SHW", group: "Materials" },
  { symbol: "PLD", yahoo: "PLD", group: "REIT" },
  { symbol: "EQIX", yahoo: "EQIX", group: "REIT" },
  { symbol: "AMT", yahoo: "AMT", group: "REIT" },
]

export const BANNED_ANALYSIS_ETFS = [
  "SMH", "GRID", "QQQ", "IGV", "CIBR", "BOTZ", "ITA", "URA", "IBB",
  "XLK", "XLF", "XLY", "XLV", "SPY",
]

export const MIN_BARS = 260
export const WARMUP_IDX = 210
export const HORIZON = 60
export const SMALL_EPISODES = 8
export const FOCUS_SYMBOLS = [
  "CRWD", "PANW", "NVDA", "AVGO", "GOOGL", "AMZN", "META", "ORCL", "PLTR",
  "AMD", "ASML", "LLY", "JPM", "CAT", "GE", "CEG", "VST", "MSFT",
]

/** Fixed observation cuts. Not searched, not new entry rules. */
export const OBS_BANDS = {
  dd52Deep: -20,
  atrPctHigh: 3,
  volRatioSpike: 1.5,
}

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function round4(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 10000) / 10000
}

export function assertNoEtfInStudyUniverse(list = EQUITY_CANDIDATES) {
  const banned = new Set(BANNED_ANALYSIS_ETFS)
  const hit = list.filter((x) => banned.has(x.symbol) || banned.has(x.yahoo))
  if (hit.length) {
    throw new Error(`ETF slipped into study universe: ${hit.map((x) => x.symbol).join(",")}`)
  }
}

/**
 * Drawdown vs trailing peak of closes through index i inclusive.
 * @param {number[]} closes
 */
export function rollingDrawdownPct(closes, i, window) {
  if (i < 0 || i >= closes.length) return null
  const start = Math.max(0, i - window + 1)
  let peak = -Infinity
  for (let j = start; j <= i; j++) {
    if (closes[j] > peak) peak = closes[j]
  }
  if (!(peak > 0)) return null
  return ((closes[i] - peak) / peak) * 100
}

function atrWilder(bars, period = 14) {
  const n = bars.length
  const out = new Array(n).fill(null)
  if (n < period + 1) return out
  const tr = bars.map((b, i) => {
    if (i === 0) return b.high - b.low
    const pc = bars[i - 1].close
    return Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc))
  })
  let atr = 0
  for (let i = 1; i <= period; i++) atr += tr[i]
  atr /= period
  out[period] = atr
  for (let i = period + 1; i < n; i++) {
    atr = (atr * (period - 1) + tr[i]) / period
    out[i] = atr
  }
  return out
}

function closeLocation(bar) {
  const span = bar.high - bar.low
  if (!(span > 0)) return null
  return (bar.close - bar.low) / span
}

/**
 * Attach observation features. Each value at i uses bars[0..i] only.
 * @param {ReturnType<typeof enrichBarsWithIndicators>} enriched
 * @param {Map<string, number>|null} spyCloseByDate
 * @param {Map<string, number>|null} qqqCloseByDate
 */
export function attachObservationFeatures(enriched, spyCloseByDate = null, qqqCloseByDate = null) {
  const closes = enriched.map((b) => b.close)
  const ma50 = smaSeries(closes, 50)
  const ma100 = smaSeries(closes, 100)
  const ma200 = smaSeries(closes, 200)
  const atr = atrWilder(enriched, 14)
  const volSma = smaSeries(enriched.map((b) => b.volume || 0), 20)

  return enriched.map((b, i) => {
    const gap = (ma) => (ma != null && ma !== 0 ? ((b.close - ma) / ma) * 100 : null)
    const ma200Slope =
      i >= 20 && ma200[i] != null && ma200[i - 20] != null && ma200[i - 20] !== 0
        ? ((ma200[i] - ma200[i - 20]) / ma200[i - 20]) * 100
        : null
    const atrPct = atr[i] != null && b.close > 0 ? (atr[i] / b.close) * 100 : null
    let vol20 = null
    if (i >= 20) {
      let s = 0
      let n = 0
      for (let j = i - 19; j <= i; j++) {
        if (!(closes[j - 1] > 0)) continue
        const r = closes[j] / closes[j - 1] - 1
        s += r * r
        n++
      }
      if (n > 0) vol20 = Math.sqrt(s / n) * 100
    }
    const volRatio = volSma[i] > 0 ? (b.volume || 0) / volSma[i] : null
    let downVol = 0
    let upVol = 0
    for (let j = Math.max(1, i - 9); j <= i; j++) {
      const v = enriched[j].volume || 0
      if (enriched[j].close < enriched[j - 1].close) downVol += v
      else if (enriched[j].close > enriched[j - 1].close) upVol += v
    }
    const rsiChange = i > 0 && b.rsi14 != null && enriched[i - 1].rsi14 != null ? b.rsi14 - enriched[i - 1].rsi14 : null
    const rsiSlope = i >= 3 && b.rsi14 != null && enriched[i - 3].rsi14 != null ? b.rsi14 - enriched[i - 3].rsi14 : null
    const stochChange =
      i > 0 && b.stochK != null && enriched[i - 1].stochK != null ? b.stochK - enriched[i - 1].stochK : null
    const stochCrossUp =
      i > 0 &&
      b.stochK != null &&
      b.stochD != null &&
      enriched[i - 1].stochK != null &&
      enriched[i - 1].stochD != null &&
      enriched[i - 1].stochK <= enriched[i - 1].stochD &&
      b.stochK > b.stochD
    const higherLow = i >= 2 && b.low > enriched[i - 1].low && enriched[i - 1].low <= enriched[i - 2].low
    const lowerLowHigherClose = i >= 1 && b.low < enriched[i - 1].low && b.close > enriched[i - 1].close
    let priorLow5 = null
    if (i >= 5) {
      priorLow5 = Infinity
      for (let j = i - 5; j < i; j++) if (enriched[j].low < priorLow5) priorLow5 = enriched[j].low
    }
    const reclaimUndercut = priorLow5 != null && b.low < priorLow5 && b.close > priorLow5
    const loc = closeLocation(b)
    const longRedReversal =
      i >= 1 &&
      enriched[i - 1].open > 0 &&
      (enriched[i - 1].open - enriched[i - 1].close) / enriched[i - 1].open >= 0.02 &&
      b.close > enriched[i - 1].close &&
      loc != null &&
      loc >= 0.5
    const bullishDivergence =
      i >= 10 &&
      b.low < enriched[i - 10].low &&
      b.rsi14 != null &&
      enriched[i - 10].rsi14 != null &&
      b.rsi14 > enriched[i - 10].rsi14
    const retN = (n) => (i >= n && closes[i - n] > 0 ? ((b.close - closes[i - n]) / closes[i - n]) * 100 : null)
    const rel = (map) => {
      if (!map || i < 20) return null
      const prev = enriched[i - 20]
      const s0 = map.get(prev.date)
      const s1 = map.get(b.date)
      if (!(s0 > 0) || !(s1 > 0) || !(prev.close > 0)) return null
      const stock = (b.close - prev.close) / prev.close
      const mkt = (s1 - s0) / s0
      return (stock - mkt) * 100
    }
    const flags = conditionFlags(b, FROZEN_THRESHOLDS)
    return {
      ...b,
      ma50Gap: round2(gap(ma50[i])),
      ma100Gap: round2(gap(ma100[i])),
      ma200Gap: round2(gap(ma200[i])),
      aboveMa200: ma200[i] != null ? b.close > ma200[i] : null,
      ma50AboveMa200: ma50[i] != null && ma200[i] != null ? ma50[i] > ma200[i] : null,
      ma200Slope20: round2(ma200Slope),
      dd52: round2(rollingDrawdownPct(closes, i, 252)),
      dd26w: round2(rollingDrawdownPct(closes, i, 126)),
      dd60: round2(rollingDrawdownPct(closes, i, 60)),
      dd120: round2(rollingDrawdownPct(closes, i, 120)),
      atr14: atr[i] != null ? round4(atr[i]) : null,
      atrPct: round2(atrPct),
      vol20Pct: round2(vol20),
      volRatio: round2(volRatio),
      downUpVolRatio: upVol > 0 ? round2(downVol / upVol) : null,
      rsiChange: round2(rsiChange),
      rsiSlope3: round2(rsiSlope),
      stochChange: round2(stochChange),
      stochCrossUp: Boolean(stochCrossUp),
      closeLoc: loc != null ? round2(loc) : null,
      higherLow: Boolean(higherLow),
      lowerLowHigherClose: Boolean(lowerLowHigherClose),
      reclaimUndercut: Boolean(reclaimUndercut),
      longRedReversal: Boolean(longRedReversal),
      bullishDivergence: Boolean(bullishDivergence),
      ret3: round2(retN(3)),
      ret5: round2(retN(5)),
      rsSpy20: round2(rel(spyCloseByDate)),
      rsQqq20: round2(rel(qqqCloseByDate)),
      count: flags.count,
      flagRsi: flags.rsi,
      flagStoch: flags.stoch,
      flagBb: flags.bb,
      flagMa: flags.ma,
    }
  })
}

/**
 * @param {number|null} signalIdx
 * @param {number|null} lowIdx
 * @param {number} window
 */
export function classifyVsLow(signalIdx, lowIdx, window) {
  if (signalIdx == null || lowIdx == null) return "absent"
  const delta = signalIdx - lowIdx
  if (delta > 0) return "late"
  if (delta >= -window) return "capture"
  return "early"
}

function pathStats(bars, idx, horizon = HORIZON) {
  if (idx == null || idx < 0 || idx >= bars.length) return null
  const entry = bars[idx].close
  if (!(entry > 0)) return null
  const end = Math.min(bars.length - 1, idx + horizon)
  let minLow = entry
  let minIdx = idx
  let maxClose = entry
  for (let j = idx + 1; j <= end; j++) {
    if (bars[j].low < minLow) {
      minLow = bars[j].low
      minIdx = j
    }
    if (bars[j].close > maxClose) maxClose = bars[j].close
  }
  const mae = ((entry - minLow) / entry) * 100
  const fwd = {}
  for (const h of [20, 40, 60]) {
    if (idx + h < bars.length && bars[idx + h].close > 0) {
      fwd[h] = round2(((bars[idx + h].close - entry) / entry) * 100)
    } else fwd[h] = null
  }
  let hit5 = false
  let hit10 = false
  for (let j = idx + 1; j <= end; j++) {
    const r = ((bars[j].close - entry) / entry) * 100
    if (r >= 5) hit5 = true
    if (r >= 10) hit10 = true
  }
  return {
    maePct: round2(mae),
    lowDate: bars[minIdx].date,
    lowIdx: minIdx,
    lowPrice: round2(minLow),
    daysToLow: minIdx - idx,
    mfePct: round2(((maxClose - entry) / entry) * 100),
    d20: fwd[20],
    d40: fwd[40],
    d60: fwd[60],
    hit5,
    hit10,
    available60: idx + 60 < bars.length,
  }
}

function firstWhere(bars, from, to, pred) {
  const end = Math.min(to, bars.length - 1)
  for (let j = from; j <= end; j++) {
    if (pred(bars, j)) return j
  }
  return null
}

function hindsightMinRsi(bars, from, lowIdx) {
  let best = null
  let bestRsi = Infinity
  const end = Math.min(lowIdx, bars.length - 1)
  for (let j = from; j <= end; j++) {
    if (bars[j].rsi14 != null && bars[j].rsi14 < bestRsi) {
      bestRsi = bars[j].rsi14
      best = j
    }
  }
  return best
}

/**
 * Causal signal indexes on [from, to]. hindsight_min_rsi is evaluation-only.
 */
export function locateCandidateDates(bars, openIdx, fill4Idx, lowIdx) {
  const to = Math.min(bars.length - 1, openIdx + HORIZON)
  return {
    first_3_4: { idx: openIdx, tradable: true },
    first_4_4: { idx: fill4Idx != null && fill4Idx <= to ? fill4Idx : null, tradable: true },
    hindsight_min_rsi: { idx: hindsightMinRsi(bars, openIdx, lowIdx), tradable: false },
    first_reversal_close: {
      idx: firstWhere(bars, openIdx + 1, to, (rows, j) => {
        if (j < 2) return false
        const loc = closeLocation(rows[j])
        return rows[j - 1].close < rows[j - 2].close && rows[j].close > rows[j - 1].close && loc != null && loc >= 0.6
      }),
      tradable: true,
    },
    first_higher_low: {
      idx: firstWhere(bars, openIdx + 1, to, (rows, j) => rows[j].higherLow),
      tradable: true,
    },
    first_reclaim_undercut: {
      idx: firstWhere(bars, openIdx + 1, to, (rows, j) => rows[j].reclaimUndercut),
      tradable: true,
    },
    first_ma20_reclaim: {
      idx: firstWhere(bars, openIdx + 1, to, (rows, j) => {
        if (j < 1 || rows[j].ma20DevPct == null || rows[j - 1].ma20DevPct == null) return false
        return rows[j - 1].ma20DevPct <= 0 && rows[j].ma20DevPct > 0
      }),
      tradable: true,
    },
    first_rsi_upturn: {
      idx: firstWhere(bars, openIdx + 1, to, (rows, j) => {
        if (j < 2 || rows[j].rsi14 == null || rows[j - 1].rsi14 == null || rows[j - 2].rsi14 == null) return false
        return rows[j].rsi14 > rows[j - 1].rsi14 && rows[j - 1].rsi14 <= rows[j - 2].rsi14
      }),
      tradable: true,
    },
    first_stoch_cross_up: {
      idx: firstWhere(bars, openIdx + 1, to, (rows, j) => rows[j].stochCrossUp),
      tradable: true,
    },
  }
}

function snapshot(bar) {
  if (!bar) return null
  return {
    date: bar.date,
    close: round2(bar.close),
    low: round2(bar.low),
    rsi14: round2(bar.rsi14),
    stochK: round2(bar.stochK),
    bbPctB: round2(bar.bbPctB),
    ma20DevPct: round2(bar.ma20DevPct),
    ma50Gap: bar.ma50Gap,
    ma100Gap: bar.ma100Gap,
    ma200Gap: bar.ma200Gap,
    aboveMa200: bar.aboveMa200,
    dd52: bar.dd52,
    atrPct: bar.atrPct,
    volRatio: bar.volRatio,
    rsiChange: bar.rsiChange,
    stochChange: bar.stochChange,
    count: bar.count,
    closeLoc: bar.closeLoc,
    higherLow: bar.higherLow,
    reclaimUndercut: bar.reclaimUndercut,
    stochCrossUp: bar.stochCrossUp,
    longRedReversal: bar.longRedReversal,
    bullishDivergence: bar.bullishDivergence,
    rsSpy20: bar.rsSpy20,
    rsQqq20: bar.rsQqq20,
  }
}

function signalEval(bars, idx, lowIdx, entryClose) {
  if (idx == null) {
    return { present: false }
  }
  const path = pathStats(bars, idx)
  const px = bars[idx].close
  const lowPx = bars[lowIdx]?.low
  const vsLowPct = lowPx > 0 ? round2(((px - lowPx) / lowPx) * 100) : null
  let furtherDrop = null
  if (idx <= lowIdx && px > 0 && lowPx > 0) {
    furtherDrop = round2(((px - lowPx) / px) * 100)
  }
  return {
    present: true,
    date: bars[idx].date,
    idx,
    price: round2(px),
    daysVsLow: lowIdx - idx,
    vsLowPct,
    furtherDropToLowPct: furtherDrop,
    afterLow: idx > lowIdx,
    path,
    cheaperThanFirst3: entryClose > 0 ? round2(((entryClose - px) / entryClose) * 100) : null,
  }
}

/**
 * @param {{symbol:string, group?:string}} meta
 * @param {any[]} rawBars
 * @param {{spy?: Map<string, number>, qqq?: Map<string, number>}} [bench]
 */
export function analyzeEquity(meta, rawBars, bench = {}) {
  if (!rawBars?.length) {
    return { symbol: meta.symbol, group: meta.group || "", status: "data unavailable", episodeCount: 0, episodes: [] }
  }
  if (rawBars.length < MIN_BARS) {
    return {
      symbol: meta.symbol,
      group: meta.group || "",
      status: "insufficient history",
      barCount: rawBars.length,
      dataStart: rawBars[0]?.date ?? null,
      dataEnd: rawBars[rawBars.length - 1]?.date ?? null,
      episodeCount: 0,
      episodes: [],
    }
  }

  const enriched = attachObservationFeatures(
    enrichBarsWithIndicators(rawBars),
    bench.spy || null,
    bench.qqq || null,
  )
  const fromIdx = Math.min(WARMUP_IDX, enriched.length - 1)
  const built = buildSplitBuyEpisodes(enriched, FROZEN_THRESHOLDS, {
    fromIdx,
    toIdx: enriched.length,
  })

  const episodes = []
  for (const ep of built) {
    const base = pathStats(enriched, ep.openIdx)
    if (!base) continue
    const dates = locateCandidateDates(enriched, ep.openIdx, ep.fill4Idx, base.lowIdx)
    /** @type {Record<string, any>} */
    const signals = {}
    for (const [name, spec] of Object.entries(dates)) {
      signals[name] = {
        tradable: spec.tradable,
        ...signalEval(enriched, spec.idx, base.lowIdx, ep.openPrice),
        timing: {
          w1: classifyVsLow(spec.idx, base.lowIdx, 1),
          w3: classifyVsLow(spec.idx, base.lowIdx, 3),
          w5: classifyVsLow(spec.idx, base.lowIdx, 5),
          w10: classifyVsLow(spec.idx, base.lowIdx, 10),
        },
      }
    }
    const entryBar = enriched[ep.openIdx]
    const lowBar = enriched[base.lowIdx]
    episodes.push({
      symbol: meta.symbol,
      openDate: ep.openDate,
      openPrice: round2(ep.openPrice),
      openIdx: ep.openIdx,
      openCount: ep.openCount,
      reached4: ep.reached4,
      fill4Date: ep.fill4Date,
      fill4Price: ep.fill4Price != null ? round2(ep.fill4Price) : null,
      ...base,
      entry: snapshot(entryBar),
      atLow: snapshot(lowBar),
      signals,
      deepDrop10: base.maePct != null && base.maePct >= 10,
      deepDrop20: base.maePct != null && base.maePct >= 20,
      recoveredAfterDeep:
        base.maePct != null &&
        base.maePct >= 10 &&
        base.lowIdx + 40 < enriched.length &&
        enriched[Math.min(enriched.length - 1, base.lowIdx + 40)].close >= base.lowPrice * 1.1,
    })
  }

  const status = episodes.length < SMALL_EPISODES ? "추가 검증 필요" : "충분한 데이터"
  return {
    symbol: meta.symbol,
    group: meta.group || "",
    status,
    barCount: enriched.length,
    dataStart: enriched[0]?.date ?? null,
    dataEnd: enriched[enriched.length - 1]?.date ?? null,
    episodeCount: episodes.length,
    reached4Count: episodes.filter((e) => e.reached4).length,
    episodes,
    dailyByDate: null,
  }
}

function medianOf(vals) {
  return summarizeNumeric(vals.filter((v) => Number.isFinite(v))).median
}

function meanOf(vals) {
  return summarizeNumeric(vals.filter((v) => Number.isFinite(v))).mean
}

function rate(n, d) {
  if (!d) return null
  return round2((n / d) * 100)
}

const DROP_LEVELS = [3, 5, 10, 15, 20]

export function poolCrossAsset(results) {
  const ok = results.filter((r) => r.episodes?.length)
  const episodes = ok.flatMap((r) => r.episodes)
  const n = episodes.length

  const drop = {}
  for (const lv of DROP_LEVELS) {
    const hit = episodes.filter((e) => e.maePct != null && e.maePct >= lv).length
    drop[`ge${lv}`] = { n: hit, pct: rate(hit, n) }
  }

  const maeVals = episodes.map((e) => e.maePct).filter((v) => v != null)
  const d20 = episodes.map((e) => e.d20).filter((v) => v != null)
  const d60 = episodes.map((e) => e.d60).filter((v) => v != null)

  const signalNames = episodes[0] ? Object.keys(episodes[0].signals) : []
  const signalTable = {}
  for (const name of signalNames) {
    const fired = episodes.filter((e) => e.signals[name]?.present)
    const timing = (w) => {
      const labels = episodes.map((e) => e.signals[name]?.timing?.[w] || "absent")
      const capture = labels.filter((x) => x === "capture").length
      const early = labels.filter((x) => x === "early").length
      const late = labels.filter((x) => x === "late").length
      const absent = labels.filter((x) => x === "absent").length
      const firedN = capture + early + late
      return {
        captureRate: rate(capture, n),
        earlyRateAmongFired: rate(early, firedN),
        lateRateAmongFired: rate(late, firedN),
        absent,
        nCapture: capture,
        nEarly: early,
        nLate: late,
      }
    }
    const paths = fired.map((e) => e.signals[name].path).filter(Boolean)
    const further = fired.map((e) => e.signals[name].furtherDropToLowPct).filter((v) => v != null)
    signalTable[name] = {
      nFired: fired.length,
      tradable: episodes[0].signals[name].tradable,
      timingW5: timing("w5"),
      timingW10: timing("w10"),
      timingW1: timing("w1"),
      timingW3: timing("w3"),
      medianFurtherDropToLow: medianOf(further),
      meanFurtherDropToLow: meanOf(further),
      maeMedian: medianOf(paths.map((p) => p.maePct)),
      d20Median: medianOf(paths.map((p) => p.d20)),
      d40Median: medianOf(paths.map((p) => p.d40)),
      d60Median: medianOf(paths.map((p) => p.d60)),
      hit5Pct: rate(paths.filter((p) => p.hit5).length, paths.length),
      hit10Pct: rate(paths.filter((p) => p.hit10).length, paths.length),
    }
  }

  const bySymbol = ok.map((r) => {
    const eps = r.episodes
    const d60s = eps.map((e) => e.d60).filter((v) => v != null)
    const wins = d60s.filter((v) => v > 0)
    const losses = d60s.filter((v) => v < 0)
    const exp =
      d60s.length === 0
        ? null
        : round2(
            (wins.length / d60s.length) * (wins.length ? wins.reduce((s, v) => s + v, 0) / wins.length : 0) -
              (losses.length / d60s.length) *
                (losses.length ? Math.abs(losses.reduce((s, v) => s + v, 0) / losses.length) : 0),
          )
    return {
      symbol: r.symbol,
      group: r.group,
      status: r.status,
      dataStart: r.dataStart,
      dataEnd: r.dataEnd,
      barCount: r.barCount,
      episodeCount: r.episodeCount,
      reached4Count: r.reached4Count,
      hit5Pct: rate(eps.filter((e) => e.hit5).length, eps.length),
      hit10Pct: rate(eps.filter((e) => e.hit10).length, eps.length),
      d20Median: medianOf(eps.map((e) => e.d20)),
      d60Median: medianOf(d60s),
      d60Expectancy: exp,
      maeMedian: medianOf(eps.map((e) => e.maePct)),
      maeGe10Pct: rate(eps.filter((e) => e.maePct >= 10).length, eps.length),
      maeGe20Pct: rate(eps.filter((e) => e.maePct >= 20).length, eps.length),
      extra10Pct: rate(eps.filter((e) => e.deepDrop10).length, eps.length),
      extra20Pct: rate(eps.filter((e) => e.deepDrop20).length, eps.length),
    }
  })

  const aux = observationSplits(episodes)
  const nearLow = nearLowSignature(episodes.filter((e) => e.deepDrop10))

  return {
    nSymbolsWithEpisodes: ok.length,
    nEpisodes: n,
    nReached4: episodes.filter((e) => e.reached4).length,
    nFull60: episodes.filter((e) => e.available60).length,
    dropFrom3: drop,
    from3: {
      maeMedian: medianOf(maeVals),
      maeMean: meanOf(maeVals),
      d20Median: medianOf(d20),
      d60Median: medianOf(d60),
      hit5Pct: rate(episodes.filter((e) => e.hit5).length, n),
      hit10Pct: rate(episodes.filter((e) => e.hit10).length, n),
    },
    signalTable,
    bySymbol,
    aux,
    nearLowOnDeepDrop: nearLow,
    focus: FOCUS_SYMBOLS.map((sym) => {
      const row = bySymbol.find((s) => s.symbol === sym) || null
      const eps = episodes.filter((e) => e.symbol === sym && e.deepDrop10)
      const rsiBefore = eps.filter((e) => {
        const s = e.signals.first_rsi_upturn
        return s?.present && !s.afterLow
      }).length
      return {
        symbol: sym,
        summary: row,
        deepDrop10: eps.length,
        rsiUpturnOnOrBeforeLow: rsiBefore,
        higherLowOnOrBeforeLow: eps.filter((e) => e.signals.first_higher_low?.present && !e.signals.first_higher_low.afterLow).length,
      }
    }),
  }
}

function splitPair(episodes, pred) {
  const a = episodes.filter(pred)
  const b = episodes.filter((e) => !pred(e))
  const pack = (xs) => ({
    n: xs.length,
    maeMedian: medianOf(xs.map((e) => e.maePct)),
    d60Median: medianOf(xs.map((e) => e.d60)),
    hit10Pct: rate(xs.filter((e) => e.hit10).length, xs.length),
  })
  const A = pack(a)
  const B = pack(b)
  return {
    nTrue: A.n,
    nFalse: B.n,
    true: A,
    false: B,
    maeMedianDiff: A.maeMedian != null && B.maeMedian != null ? round2(A.maeMedian - B.maeMedian) : null,
    d60MedianDiff: A.d60Median != null && B.d60Median != null ? round2(A.d60Median - B.d60Median) : null,
  }
}

function observationSplits(episodes) {
  const withEntry = episodes.filter((e) => e.entry)
  return {
    aboveMa200: splitPair(withEntry, (e) => e.entry.aboveMa200 === true),
    dd52AtMostNeg20: splitPair(withEntry, (e) => e.entry.dd52 != null && e.entry.dd52 <= OBS_BANDS.dd52Deep),
    atrPctAtLeast3: splitPair(withEntry, (e) => e.entry.atrPct != null && e.entry.atrPct >= OBS_BANDS.atrPctHigh),
    volSpike: splitPair(withEntry, (e) => e.entry.volRatio != null && e.entry.volRatio >= OBS_BANDS.volRatioSpike),
    rsiAlreadyRisingAtEntry: splitPair(withEntry, (e) => e.entry.rsiChange != null && e.entry.rsiChange > 0),
    stochCrossAtEntry: splitPair(withEntry, (e) => e.entry.stochCrossUp === true),
    rsSpy20Negative: splitPair(withEntry, (e) => e.entry.rsSpy20 != null && e.entry.rsSpy20 < 0),
    note: "Fixed observation bands only. Differences are observed gaps, not significance tests and not new rules.",
  }
}

function nearLowSignature(deep) {
  if (!deep.length) return { n: 0 }
  const share = (pred) => rate(deep.filter(pred).length, deep.length)
  return {
    n: deep.length,
    entryRsiMedian: medianOf(deep.map((e) => e.entry?.rsi14)),
    lowRsiMedian: medianOf(deep.map((e) => e.atLow?.rsi14)),
    entryAtrMedian: medianOf(deep.map((e) => e.entry?.atrPct)),
    lowAtrMedian: medianOf(deep.map((e) => e.atLow?.atrPct)),
    entryVolMedian: medianOf(deep.map((e) => e.entry?.volRatio)),
    lowVolMedian: medianOf(deep.map((e) => e.atLow?.volRatio)),
    entryDd52Median: medianOf(deep.map((e) => e.entry?.dd52)),
    lowDd52Median: medianOf(deep.map((e) => e.atLow?.dd52)),
    shareRsiRisingAtLow: share((e) => e.atLow?.rsiChange != null && e.atLow.rsiChange > 0),
    shareRsiRisingAtEntry: share((e) => e.entry?.rsiChange != null && e.entry.rsiChange > 0),
    shareHigherLowAtLow: share((e) => e.atLow?.higherLow),
    shareReclaimAtLow: share((e) => e.atLow?.reclaimUndercut),
    shareStochCrossAtLow: share((e) => e.atLow?.stochCrossUp),
    shareDivergenceAtLow: share((e) => e.atLow?.bullishDivergence),
    shareCount4AtLow: share((e) => (e.atLow?.count ?? 0) >= 4),
    shareCountGe3AtLow: share((e) => (e.atLow?.count ?? 0) >= 3),
  }
}

/**
 * MSFT daily slice around 2026-06-08 through 15 sessions after the window low.
 * Evaluation low is used only to bound the table, not to create a signal.
 */
export function extractMsft2026Window(rawBars) {
  if (!rawBars?.length) return { status: "data unavailable" }
  const enriched = attachObservationFeatures(enrichBarsWithIndicators(rawBars))
  const start = enriched.findIndex((b) => b.date >= "2026-06-08")
  if (start < 0) return { status: "data unavailable", note: "No bar on or after 2026-06-08" }
  const windowEnd = enriched.findIndex((b) => b.date > "2026-08-31")
  const last = windowEnd < 0 ? enriched.length - 1 : windowEnd - 1
  if (last < start) return { status: "insufficient history", note: "2026-06 window not fully present" }

  let lowIdx = start
  for (let i = start; i <= last; i++) {
    if (enriched[i].low < enriched[lowIdx].low) lowIdx = i
  }
  const tableEnd = Math.min(enriched.length - 1, lowIdx + 15)
  const rows = []
  for (let i = start; i <= tableEnd; i++) {
    const b = enriched[i]
    rows.push({
      date: b.date,
      close: round2(b.close),
      low: round2(b.low),
      rsi14: round2(b.rsi14),
      stochK: round2(b.stochK),
      bbPctB: round2(b.bbPctB),
      ma20DevPct: round2(b.ma20DevPct),
      ma50Gap: b.ma50Gap,
      ma100Gap: b.ma100Gap,
      ma200Gap: b.ma200Gap,
      dd52: b.dd52,
      atrPct: b.atrPct,
      volRatio: b.volRatio,
      rsiChange: b.rsiChange,
      stochChange: b.stochChange,
      count: b.count,
      is3: b.count >= 3,
      is4: b.count >= 4,
      higherLow: b.higherLow,
      reclaimUndercut: b.reclaimUndercut,
      stochCrossUp: b.stochCrossUp,
      longRedReversal: b.longRedReversal,
      bullishDivergence: b.bullishDivergence,
      closeLoc: b.closeLoc,
      isEvalLow: i === lowIdx,
    })
  }
  const day = enriched[start]
  return {
    status: "ok",
    anchorDate: day.date,
    anchorIsExact0608: day.date === "2026-06-08",
    anchorCount: day.count,
    anchorClose: round2(day.close),
    evalLowDate: enriched[lowIdx].date,
    evalLowPrice: round2(enriched[lowIdx].low),
    extraDropFromAnchorPct: round2(((day.close - enriched[lowIdx].low) / day.close) * 100),
    daysAnchorToLow: lowIdx - start,
    rows,
  }
}
