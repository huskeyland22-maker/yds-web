/**
 * Correction-stage diagnostic for individual stocks (research only).
 * Episode starts use only the trailing window through that close.
 * The later low is an evaluation label, not an input to episode start.
 * No new buy rules. Thresholds unchanged. ETFs are not subjects.
 */

import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import { summarizeNumeric } from "./daily-bottom-buy-validation-core.mjs"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  attachObservationFeatures,
  assertNoEtfInStudyUniverse,
} from "./daily-bottom-buy-cross-asset-validation.mjs"

export { EQUITY_CANDIDATES, FROZEN_THRESHOLDS, assertNoEtfInStudyUniverse }

export const STAGE_PCTS = [5, 10, 15, 20, 25, 30, 35, 40]
export const ROLL_WINDOWS = [60, 120]
export const DD52_PCTS = [10, 20, 30, 40, 50]
export const HORIZON = 60
export const RECOVER_GAP = 0.02
export const MAX_EPISODE_DAYS = 252

export const ATR_BUCKETS = [
  { id: "lt2", label: "<2%", test: (v) => v != null && v < 2 },
  { id: "2_3", label: "2–3%", test: (v) => v != null && v >= 2 && v < 3 },
  { id: "3_4", label: "3–4%", test: (v) => v != null && v >= 3 && v < 4 },
  { id: "4_5", label: "4–5%", test: (v) => v != null && v >= 4 && v < 5 },
  { id: "gt5", label: ">5%", test: (v) => v != null && v >= 5 },
]

export const VOL_BUCKETS = [
  { id: "lt075", label: "<0.75", test: (v) => v != null && v < 0.75 },
  { id: "075_1", label: "0.75–1", test: (v) => v != null && v >= 0.75 && v < 1 },
  { id: "1_15", label: "1–1.5", test: (v) => v != null && v >= 1 && v < 1.5 },
  { id: "15_2", label: "1.5–2", test: (v) => v != null && v >= 1.5 && v < 2 },
  { id: "gt2", label: ">2", test: (v) => v != null && v >= 2 },
]

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function median(vals) {
  return summarizeNumeric(vals.filter((v) => Number.isFinite(v))).median
}

function rate(n, d) {
  if (!d) return null
  return round2((n / d) * 100)
}

/**
 * Max high on [i-window+1, i]. Causal.
 */
export function rollingHighAt(bars, i, window) {
  const start = Math.max(0, i - window + 1)
  let peak = -Infinity
  let peakIdx = start
  for (let j = start; j <= i; j++) {
    if (bars[j].high > peak) {
      peak = bars[j].high
      peakIdx = j
    }
  }
  return { peak, peakIdx }
}

export function drawdownFromRollingHigh(bars, i, window) {
  if (i < window - 1) return null
  const { peak } = rollingHighAt(bars, i, window)
  if (!(peak > 0)) return null
  return ((bars[i].close - peak) / peak) * 100
}

/**
 * First pattern index on or before lowIdx. Later prints are not leading.
 */
export function firstLeadingIndex(indexes, lowIdx) {
  const before = indexes.filter((idx) => idx != null && idx <= lowIdx)
  if (!before.length) return null
  return Math.min(...before)
}

function retN(bars, i, n) {
  if (i < n || !(bars[i - n].close > 0)) return null
  return ((bars[i].close - bars[i - n].close) / bars[i - n].close) * 100
}

function volVs(bars, i, n) {
  if (i < n - 1) return null
  let s = 0
  for (let j = i - n + 1; j <= i; j++) s += bars[j].volume || 0
  const avg = s / n
  if (!(avg > 0)) return null
  return (bars[i].volume || 0) / avg
}

function snapshot(bars, i) {
  const b = bars[i]
  return {
    date: b.date,
    idx: i,
    close: round2(b.close),
    low: round2(b.low),
    rsi14: round2(b.rsi14),
    stochK: round2(b.stochK),
    bbPctB: round2(b.bbPctB),
    ma20DevPct: round2(b.ma20DevPct),
    count: b.count,
    ma50Gap: b.ma50Gap,
    ma100Gap: b.ma100Gap,
    ma200Gap: b.ma200Gap,
    aboveMa200: b.aboveMa200,
    ma50AboveMa200: b.ma50AboveMa200,
    ma200Slope20: b.ma200Slope20,
    atr14: b.atr14,
    atrPct: b.atrPct,
    vol20Pct: b.vol20Pct,
    volume: b.volume ?? null,
    volRatio20: b.volRatio,
    volRatio60: round2(volVs(bars, i, 60)),
    ret5: round2(retN(bars, i, 5)),
    ret20: round2(retN(bars, i, 20)),
    ret60: round2(retN(bars, i, 60)),
    dd52: b.dd52,
    rsSpy20: b.rsSpy20,
    rsQqq20: b.rsQqq20,
    rsiChange: b.rsiChange,
    stochCrossUp: b.stochCrossUp,
    higherLow: b.higherLow,
    reclaimUndercut: b.reclaimUndercut,
    closeLoc: b.closeLoc,
  }
}

/**
 * Forward path from a stage close. Low is evaluation-only.
 */
export function outcomeFrom(bars, idx, horizon = HORIZON) {
  if (idx == null || idx < 0 || idx >= bars.length) return null
  const entry = bars[idx].close
  if (!(entry > 0)) return null
  const end = Math.min(bars.length - 1, idx + horizon)
  let minLow = bars[idx].low
  let minIdx = idx
  const hit = { 3: null, 5: null, 10: null, 15: null, 20: null }
  for (let j = idx; j <= end; j++) {
    if (bars[j].low < minLow) {
      minLow = bars[j].low
      minIdx = j
    }
    if (j === idx) continue
    const r = ((bars[j].close - entry) / entry) * 100
    for (const t of [3, 5, 10, 15, 20]) {
      if (hit[t] == null && r >= t) hit[t] = j - idx
    }
  }
  const fwd = {}
  for (const h of [5, 10, 20, 40, 60]) {
    fwd[h] = idx + h < bars.length && bars[idx + h].close > 0
      ? round2(((bars[idx + h].close - entry) / entry) * 100)
      : null
  }
  return {
    maePct: round2(((entry - minLow) / entry) * 100),
    lowDate: bars[minIdx].date,
    lowIdx: minIdx,
    lowPrice: round2(minLow),
    daysToLow: minIdx - idx,
    d5: fwd[5],
    d10: fwd[10],
    d20: fwd[20],
    d40: fwd[40],
    d60: fwd[60],
    daysToPlus: hit,
    hit5: hit[5] != null,
    hit10: hit[10] != null,
  }
}

function walkEpisode(bars, startIdx, peak, peakIdx, levels) {
  /** @type {Record<number, number>} */
  const stageIdx = {}
  let endIdx = startIdx
  const last = Math.min(bars.length - 1, startIdx + MAX_EPISODE_DAYS)
  for (let j = startIdx; j <= last; j++) {
    endIdx = j
    const dd = ((bars[j].close - peak) / peak) * 100
    for (const s of levels) {
      if (stageIdx[s] == null && dd <= -s) stageIdx[s] = j
    }
    if (j > startIdx && bars[j].close >= peak * (1 - RECOVER_GAP)) break
  }
  let evalLowIdx = startIdx
  for (let j = startIdx; j <= endIdx; j++) {
    if (bars[j].low < bars[evalLowIdx].low) evalLowIdx = j
  }
  const stages = {}
  for (const s of levels) {
    const idx = stageIdx[s]
    if (idx == null) continue
    const snap = snapshot(bars, idx)
    snap.drawdownFromPeak = round2(((bars[idx].close - peak) / peak) * 100)
    stages[s] = { idx, snap, outcome: outcomeFrom(bars, idx) }
  }
  return {
    startIdx,
    endIdx,
    startDate: bars[startIdx].date,
    endDate: bars[endIdx].date,
    peak,
    peakIdx,
    peakDate: bars[peakIdx].date,
    evalLowIdx,
    evalLowDate: bars[evalLowIdx].date,
    evalLowPrice: round2(bars[evalLowIdx].low),
    stages,
  }
}

/**
 * Correction episodes from trailing-high crosses. Start does not use a future low.
 * @param {any[]} bars enriched
 * @param {number} window
 * @param {number[]} [levels]
 */
export function buildCorrectionEpisodes(bars, window, levels = STAGE_PCTS) {
  const episodes = []
  let i = window - 1
  while (i < bars.length) {
    const dd = drawdownFromRollingHigh(bars, i, window)
    const prev = i > window - 1 ? drawdownFromRollingHigh(bars, i - 1, window) : 0
    const crossed = dd != null && dd <= -levels[0] && (prev == null || prev > -levels[0])
    if (!crossed) {
      i++
      continue
    }
    const rh = rollingHighAt(bars, i, window)
    const ep = walkEpisode(bars, i, rh.peak, rh.peakIdx, levels)
    episodes.push(ep)
    i = ep.endIdx + 1
  }
  return episodes
}

function stageRows(episodes, level) {
  const rows = []
  for (const ep of episodes) {
    const st = ep.stages[level]
    if (!st?.outcome) continue
    const next = level + 5
    rows.push({
      symbol: ep.symbol,
      aboveMa200: st.snap.aboveMa200,
      atrPct: st.snap.atrPct,
      volRatio20: st.snap.volRatio20,
      dd52: st.snap.dd52,
      reachedNext: next <= 40 && ep.stages[next] != null,
      reached30: ep.stages[30] != null && level < 30,
      outcome: st.outcome,
      snap: st.snap,
      evalLowIdx: ep.evalLowIdx,
      episode: ep,
    })
  }
  return rows
}

function summarizeStage(rows, level) {
  const outs = rows.map((r) => r.outcome)
  const d60 = outs.map((o) => o.d60).filter((v) => v != null)
  return {
    level: `-${level}%`,
    n: rows.length,
    maeMedian: median(outs.map((o) => o.maePct)),
    d5Median: median(outs.map((o) => o.d5)),
    d10Median: median(outs.map((o) => o.d10)),
    d20Median: median(outs.map((o) => o.d20)),
    d40Median: median(outs.map((o) => o.d40)),
    d60Median: median(d60),
    d60NegativePct: rate(d60.filter((v) => v < 0).length, d60.length),
    hit5Pct: rate(outs.filter((o) => o.hit5).length, outs.length),
    hit10Pct: rate(outs.filter((o) => o.hit10).length, outs.length),
    hit15Pct: rate(outs.filter((o) => o.daysToPlus[15] != null).length, outs.length),
    hit20Pct: rate(outs.filter((o) => o.daysToPlus[20] != null).length, outs.length),
    daysToPlus5Median: median(outs.map((o) => o.daysToPlus[5]).filter((v) => v != null)),
    daysToPlus10Median: median(outs.map((o) => o.daysToPlus[10]).filter((v) => v != null)),
    daysToLowMedian: median(outs.map((o) => o.daysToLow)),
    nextStagePct: level < 40 ? rate(rows.filter((r) => r.reachedNext).length, rows.length) : null,
    onTo30Pct: level < 30 ? rate(rows.filter((r) => r.reached30).length, rows.length) : null,
  }
}

function splitMa200(rows) {
  const pack = (xs) => summarizeStage(xs, 0)
  const above = rows.filter((r) => r.aboveMa200 === true)
  const below = rows.filter((r) => r.aboveMa200 === false)
  return {
    above: { n: above.length, maeMedian: pack(above).maeMedian, d20Median: pack(above).d20Median, d60Median: pack(above).d60Median, hit5Pct: pack(above).hit5Pct, hit10Pct: pack(above).hit10Pct },
    below: { n: below.length, maeMedian: pack(below).maeMedian, d20Median: pack(below).d20Median, d60Median: pack(below).d60Median, hit5Pct: pack(below).hit5Pct, hit10Pct: pack(below).hit10Pct },
  }
}

function bucketize(rows, buckets, field) {
  return buckets.map((b) => {
    const xs = rows.filter((r) => b.test(r[field]))
    const s = summarizeStage(xs, 0)
    return {
      id: b.id,
      label: b.label,
      n: xs.length,
      maeMedian: s.maeMedian,
      d20Median: s.d20Median,
      d60Median: s.d60Median,
      hit5Pct: s.hit5Pct,
      hit10Pct: s.hit10Pct,
      daysToLowMedian: s.daysToLowMedian,
    }
  })
}

const PATTERN_PREDS = {
  rsi_stabilize: (bars, j) => {
    if (j < 5 || bars[j].rsi14 == null || bars[j - 5].rsi14 == null || bars[j - 1].rsi14 == null) return false
    return bars[j].rsi14 - bars[j - 5].rsi14 <= -8 && bars[j].rsi14 >= bars[j - 1].rsi14
  },
  rsi_upturn: (bars, j) => {
    if (j < 2 || bars[j].rsi14 == null || bars[j - 1].rsi14 == null || bars[j - 2].rsi14 == null) return false
    return bars[j].rsi14 > bars[j - 1].rsi14 && bars[j - 1].rsi14 <= bars[j - 2].rsi14
  },
  stoch_upturn: (bars, j) => Boolean(bars[j].stochCrossUp),
  volume_spike: (bars, j) => bars[j].volRatio != null && bars[j].volRatio >= 1.5,
  reclaim_undercut: (bars, j) => Boolean(bars[j].reclaimUndercut),
  strong_close: (bars, j) => bars[j].closeLoc != null && bars[j].closeLoc >= 0.7,
  higher_low: (bars, j) => Boolean(bars[j].higherLow),
  ma20_gap_improving: (bars, j) => {
    if (j < 1 || bars[j].ma20DevPct == null || bars[j - 1].ma20DevPct == null) return false
    return bars[j - 1].ma20DevPct < 0 && bars[j].ma20DevPct > bars[j - 1].ma20DevPct
  },
  ret5_turn: (bars, j) => {
    if (j < 6) return false
    const now = retN(bars, j, 5)
    const prev = retN(bars, j - 1, 5)
    return prev != null && now != null && prev < 0 && now > prev && bars[j].close > bars[j - 1].close
  },
  three_higher_closes: (bars, j) =>
    j >= 3 &&
    bars[j].close > bars[j - 1].close &&
    bars[j - 1].close > bars[j - 2].close &&
    bars[j - 2].close > bars[j - 3].close,
}

function patternStats(bars, episodes) {
  const out = {}
  for (const [name, pred] of Object.entries(PATTERN_PREDS)) {
    const leadDays = []
    const maes = []
    const d20s = []
    const d60s = []
    let nLate = 0
    let nAbsent = 0
    for (const ep of episodes) {
      const hits = []
      for (let j = ep.startIdx; j <= ep.endIdx; j++) {
        if (pred(bars, j)) hits.push(j)
      }
      const lead = firstLeadingIndex(hits, ep.evalLowIdx)
      if (lead == null) {
        if (hits.some((idx) => idx > ep.evalLowIdx)) nLate++
        else nAbsent++
        continue
      }
      leadDays.push(ep.evalLowIdx - lead)
      const oc = outcomeFrom(bars, lead)
      if (!oc) continue
      maes.push(oc.maePct)
      if (oc.d20 != null) d20s.push(oc.d20)
      if (oc.d60 != null) d60s.push(oc.d60)
    }
    const dist = summarizeNumeric(leadDays)
    out[name] = {
      nLeading: leadDays.length,
      nLate,
      nAbsent,
      daysBeforeLow: { median: dist.median, p25: dist.p25, p75: dist.p75, mean: dist.mean },
      maeMedian: median(maes),
      d20Median: median(d20s),
      d60Median: median(d60s),
      note: "Days-before uses only prints on or before the evaluation low.",
    }
  }
  return out
}

/**
 * Retrospective description of a path into the -15% stage. Not a buy rule.
 * Compared with the -5% snapshot of the same episode.
 */
function patternA(episodes) {
  const reached = episodes.filter((ep) => ep.stages[5] && ep.stages[15])
  const flagged = []
  const rest = []
  for (const ep of reached) {
    const a = ep.stages[5].snap
    const b = ep.stages[15].snap
    const setup =
      a.aboveMa200 === true &&
      b.rsi14 != null &&
      a.rsi14 != null &&
      b.rsi14 < a.rsi14 &&
      b.ma20DevPct != null &&
      a.ma20DevPct != null &&
      b.ma20DevPct < a.ma20DevPct &&
      b.dd52 != null &&
      a.dd52 != null &&
      b.dd52 < a.dd52 &&
      b.atrPct != null &&
      a.atrPct != null &&
      b.atrPct > a.atrPct &&
      b.volRatio20 != null &&
      a.volRatio20 != null &&
      b.volRatio20 >= a.volRatio20
    const bucket = setup ? flagged : rest
    bucket.push(ep.stages[15].outcome)
  }
  const pack = (xs) => ({
    n: xs.length,
    maeMedian: median(xs.map((o) => o?.maePct)),
    maeMean: summarizeNumeric(xs.map((o) => o?.maePct).filter((v) => Number.isFinite(v))).mean,
    d20Median: median(xs.map((o) => o?.d20)),
    d60Median: median(xs.map((o) => o?.d60)),
  })
  return {
    definition:
      "At -15% vs same episode -5%: still above MA200 at -5%, RSI lower, MA20 gap wider, 52w drawdown wider, ATR% higher, volume ratio not lower. Measured from the -15% close. Not a buy rule.",
    nReached15: reached.length,
    sharePct: rate(flagged.length, reached.length),
    whenPresent: pack(flagged),
    whenAbsent: pack(rest),
  }
}

function poolWindow(symbolEpisodes, barsBySymbol, levels, opts = {}) {
  const episodes = symbolEpisodes.flatMap((x) => x.episodes)
  const byLevel = {}
  const ma200 = {}
  for (const level of levels) {
    const next = levels[levels.indexOf(level) + 1]
    const rows = []
    for (const block of symbolEpisodes) {
      for (const ep of block.episodes) {
        const st = ep.stages[level]
        if (!st?.outcome) continue
        rows.push({
          aboveMa200: st.snap.aboveMa200,
          atrPct: st.snap.atrPct,
          volRatio20: st.snap.volRatio20,
          reachedNext: next != null && ep.stages[next] != null,
          reached30: ep.stages[30] != null && level < 30,
          outcome: st.outcome,
        })
      }
    }
    byLevel[level] = summarizeStage(rows, level)
    ma200[level] = splitMa200(rows)
  }
  const ten = []
  for (const block of symbolEpisodes) {
    for (const ep of block.episodes) {
      const st = ep.stages[10]
      if (!st) continue
      ten.push({
        atrPct: st.snap.atrPct,
        volRatio20: st.snap.volRatio20,
        aboveMa200: st.snap.aboveMa200,
        reachedNext: false,
        reached30: false,
        outcome: st.outcome,
      })
    }
  }
  return {
    nEpisodes: episodes.length,
    byLevel,
    ma200,
    atrAtMinus10: bucketize(ten, ATR_BUCKETS, "atrPct"),
    volumeAtMinus10: bucketize(ten, VOL_BUCKETS, "volRatio20"),
    patterns: opts.patterns ? patternStatsPooled(symbolEpisodes, barsBySymbol) : null,
    patternA: opts.patternA ? patternA(episodes) : null,
  }
}

function patternStatsPooled(symbolEpisodes, barsBySymbol) {
  const merged = []
  for (const block of symbolEpisodes) {
    const bars = barsBySymbol.get(block.symbol)
    if (!bars) continue
    for (const ep of block.episodes) merged.push({ bars, ep })
  }
  const out = {}
  for (const [name, pred] of Object.entries(PATTERN_PREDS)) {
    const leadDays = []
    const maes = []
    const d20s = []
    const d60s = []
    let nLate = 0
    let nAbsent = 0
    for (const { bars, ep } of merged) {
      const hits = []
      for (let j = ep.startIdx; j <= ep.endIdx; j++) {
        if (pred(bars, j)) hits.push(j)
      }
      const lead = firstLeadingIndex(hits, ep.evalLowIdx)
      if (lead == null) {
        if (hits.some((idx) => idx > ep.evalLowIdx)) nLate++
        else nAbsent++
        continue
      }
      leadDays.push(ep.evalLowIdx - lead)
      const oc = outcomeFrom(bars, lead)
      if (!oc) continue
      maes.push(oc.maePct)
      if (oc.d20 != null) d20s.push(oc.d20)
      if (oc.d60 != null) d60s.push(oc.d60)
    }
    const dist = summarizeNumeric(leadDays)
    out[name] = {
      nLeading: leadDays.length,
      nLate,
      nAbsent,
      daysBeforeLow: { median: dist.median, p25: dist.p25, p75: dist.p75, mean: dist.mean },
      maeMedian: median(maes),
      d20Median: median(d20s),
      d60Median: median(d60s),
    }
  }
  return out
}

export function analyzeSymbolCorrections(meta, rawBars, bench = {}) {
  if (!rawBars?.length) {
    return { symbol: meta.symbol, status: "data unavailable", byWindow: {} }
  }
  const bars = attachObservationFeatures(enrichBarsWithIndicators(rawBars), bench.spy || null, bench.qqq || null)
  const byWindow = {}
  for (const window of [...ROLL_WINDOWS, 252]) {
    const levels = window === 252 ? DD52_PCTS : STAGE_PCTS
    const episodes = buildCorrectionEpisodes(bars, window, levels).map((ep) => ({
      ...ep,
      symbol: meta.symbol,
    }))
    byWindow[window] = { n: episodes.length, episodes }
  }
  return { symbol: meta.symbol, status: "ok", barCount: bars.length, bars, byWindow }
}

export function poolCorrectionStudy(analyzed) {
  const ok = analyzed.filter((a) => a.status === "ok")
  const barsBySymbol = new Map(ok.map((a) => [a.symbol, a.bars]))
  const pack = (window, levels, opts) => {
    const blocks = ok.map((a) => ({ symbol: a.symbol, episodes: a.byWindow[window].episodes }))
    return poolWindow(blocks, barsBySymbol, levels, opts)
  }
  return {
    nSymbols: ok.length,
    window60: pack(60, STAGE_PCTS, { patterns: true, patternA: true }),
    window120: pack(120, STAGE_PCTS, { patterns: true, patternA: true }),
    dd52: pack(252, DD52_PCTS, { patterns: false, patternA: false }),
  }
}

const MSFT_DATES = ["2026-06-08", "2026-06-17", "2026-06-25", "2026-06-26"]

export function msftStageContext(rawBars) {
  if (!rawBars?.length) return { status: "data unavailable" }
  const bars = attachObservationFeatures(enrichBarsWithIndicators(rawBars))
  const byDate = new Map(bars.map((b, i) => [b.date, i]))
  const focus = {}
  for (const d of MSFT_DATES) {
    const idx = byDate.get(d)
    if (idx == null) {
      focus[d] = { status: "date missing" }
      continue
    }
    focus[d] = snapshot(bars, idx)
  }
  const placement = {}
  for (const window of [60, 120]) {
    const episodes = buildCorrectionEpisodes(bars, window)
    placement[window] = MSFT_DATES.map((d) => {
      const idx = byDate.get(d)
      if (idx == null) return { date: d, inEpisode: false }
      const ep = episodes.find((e) => idx >= e.startIdx && idx <= e.endIdx)
      if (!ep) return { date: d, inEpisode: false }
      let stage = null
      for (const s of STAGE_PCTS) {
        if (ep.stages[s] && ep.stages[s].idx <= idx) stage = s
      }
      return {
        date: d,
        inEpisode: true,
        episodeStart: ep.startDate,
        peakDate: ep.peakDate,
        stageReachedByThen: stage,
        drawdownFromFrozenPeak: round2(((bars[idx].close - ep.peak) / ep.peak) * 100),
      }
    })
  }
  return { status: "ok", focus, placement }
}
