/**
 * Recovery-confirmation candidates after an unchanged 3/4 day (research only).
 * Each flag uses only bars through that session. The later low is not an input.
 * No composite score. ATR bands stay <3, 3–4, >=4 and are labels only.
 */

import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import { conditionFlags, summarizeNumeric, timeSplitBars, TRAIN_RATIO } from "./daily-bottom-buy-validation-core.mjs"
import { FROZEN_THRESHOLDS, buildSplitBuyEpisodes } from "./daily-bottom-split-buy-sim.mjs"
import {
  EQUITY_CANDIDATES,
  MIN_BARS,
  WARMUP_IDX,
  attachObservationFeatures,
  assertNoEtfInStudyUniverse,
} from "./daily-bottom-buy-cross-asset-validation.mjs"
import { atrBand } from "./daily-bottom-buy-individual-stock-train-test-validation.mjs"

export {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  TRAIN_RATIO,
  atrBand,
  assertNoEtfInStudyUniverse,
}

export const HORIZON = 60
export const SIGNAL_WINDOW = 30
export const SIGNAL_IDS = ["rsiUp", "rsi3d", "stochCross", "higherLow", "price5d", "ma20Up", "volume15"]

export const CRASH_WINDOWS = [
  { id: "covid_2020", start: "2020-02-20", end: "2020-04-30" },
  { id: "bear_2022", start: "2022-01-03", end: "2022-10-14" },
]

/** Fixed letter gates. Not used to edit a signal rule. */
export const JUDGE_GATES = {
  minN: 30,
  occLow: 10,
  occHigh: 90,
  improvePp: 1,
  worsenPp: 2,
  top3ShareMax: 40,
}

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function round4(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 10000) / 10000
}

function rate(n, d) {
  if (!d) return null
  return round2((n / d) * 100)
}

export function pearson(xs, ys) {
  const pairs = []
  for (let i = 0; i < xs.length; i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) pairs.push([xs[i], ys[i]])
  }
  const n = pairs.length
  if (n < 5) return { n, r: null }
  const mx = pairs.reduce((s, p) => s + p[0], 0) / n
  const my = pairs.reduce((s, p) => s + p[1], 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (const [x, y] of pairs) {
    const a = x - mx
    const b = y - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  if (dx <= 0 || dy <= 0) return { n, r: null }
  return { n, r: round4(num / Math.sqrt(dx * dy)) }
}

function minLow(bars, from, to) {
  let v = Infinity
  for (let j = from; j <= to; j++) if (bars[j].low < v) v = bars[j].low
  return v
}

/** Volume / mean of the 20 sessions ending today. Today is included. */
export function volumeRatio20(bars, t) {
  if (t < 19) return null
  let s = 0
  for (let j = t - 19; j <= t; j++) s += bars[j].volume || 0
  const avg = s / 20
  if (!(avg > 0)) return null
  return (bars[t].volume || 0) / avg
}

/**
 * True/false from information through index t only.
 * @param {string} id
 */
export function signalTrue(bars, t, id) {
  const b = bars[t]
  if (!b) return false
  if (id === "rsiUp") {
    return t >= 1 && b.rsi14 != null && bars[t - 1].rsi14 != null && b.rsi14 > bars[t - 1].rsi14
  }
  if (id === "rsi3d") {
    return t >= 3 && b.rsi14 != null && bars[t - 3].rsi14 != null && b.rsi14 > bars[t - 3].rsi14
  }
  if (id === "stochCross") {
    if (t < 1) return false
    const k0 = bars[t - 1].stochK
    const d0 = bars[t - 1].stochD
    const k1 = b.stochK
    const d1 = b.stochD
    return k0 != null && d0 != null && k1 != null && d1 != null && k0 <= d0 && k1 > d1
  }
  if (id === "higherLow") {
    if (t < 9) return false
    return minLow(bars, t - 4, t) > minLow(bars, t - 9, t - 5)
  }
  if (id === "price5d") {
    return t >= 5 && bars[t - 5].close > 0 && b.close > bars[t - 5].close
  }
  if (id === "ma20Up") {
    return t >= 3 && b.ma20 != null && bars[t - 3].ma20 != null && b.ma20 > bars[t - 3].ma20
  }
  if (id === "volume15") {
    const ratio = volumeRatio20(bars, t)
    return ratio != null && ratio >= 1.5
  }
  return false
}

/** First session in (openIdx, openIdx+30]. Day 0 is not a hit. */
export function firstSignalIndex(bars, openIdx, id, window = SIGNAL_WINDOW) {
  const end = Math.min(bars.length - 1, openIdx + window)
  for (let t = openIdx + 1; t <= end; t++) {
    if (signalTrue(bars, t, id)) return t
  }
  return null
}

export function forwardStats(bars, idx, horizon = HORIZON) {
  if (idx == null || idx < 0 || idx >= bars.length) return null
  const entry = bars[idx].close
  if (!(entry > 0)) return null
  const end = Math.min(bars.length - 1, idx + horizon)
  let minLowPx = bars[idx].low
  let minIdx = idx
  const hit = { 5: false, 10: false }
  const drop = { 5: false, 10: false }
  for (let j = idx; j <= end; j++) {
    if (bars[j].low < minLowPx) {
      minLowPx = bars[j].low
      minIdx = j
    }
    if (j === idx) continue
    const r = ((bars[j].close - entry) / entry) * 100
    if (r >= 5) hit[5] = true
    if (r >= 10) hit[10] = true
    if (r <= -5) drop[5] = true
    if (r <= -10) drop[10] = true
  }
  const at = (h) =>
    idx + h < bars.length && bars[idx + h].close > 0
      ? round2(((bars[idx + h].close - entry) / entry) * 100)
      : null
  return {
    d5: at(5),
    d10: at(10),
    d20: at(20),
    d40: at(40),
    d60: at(60),
    mae: round2(((entry - minLowPx) / entry) * 100),
    daysToLow: minIdx - idx,
    hit5: hit[5],
    hit10: hit[10],
    drop5: drop[5],
    drop10: drop[10],
  }
}

function pack(rows, pick) {
  const stats = rows.map(pick).filter(Boolean)
  const d60 = summarizeNumeric(stats.map((s) => s.d60))
  return {
    n: rows.length,
    nWithPath: stats.length,
    nD60: d60.n,
    smallSample: rows.length < JUDGE_GATES.minN,
    d5Median: summarizeNumeric(stats.map((s) => s.d5)).median,
    d10Median: summarizeNumeric(stats.map((s) => s.d10)).median,
    d20Median: summarizeNumeric(stats.map((s) => s.d20)).median,
    d40Median: summarizeNumeric(stats.map((s) => s.d40)).median,
    d60Median: d60.median,
    maeMedian: summarizeNumeric(stats.map((s) => s.mae)).median,
    hit5Pct: rate(stats.filter((s) => s.hit5).length, stats.length),
    hit10Pct: rate(stats.filter((s) => s.hit10).length, stats.length),
    drop5Pct: rate(stats.filter((s) => s.drop5).length, stats.length),
    drop10Pct: rate(stats.filter((s) => s.drop10).length, stats.length),
    daysToLowMedian: summarizeNumeric(stats.map((s) => s.daysToLow)).median,
  }
}

function top3Share(rows, valueOf) {
  const sums = new Map()
  for (const row of rows) {
    const v = valueOf(row)
    if (v == null || !Number.isFinite(v)) continue
    sums.set(row.symbol, (sums.get(row.symbol) || 0) + v)
  }
  const ranked = [...sums.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const totalAbs = ranked.reduce((s, x) => s + Math.abs(x[1]), 0)
  const top3 = ranked.slice(0, 3).map(([symbol, sumD60]) => ({
    symbol,
    sumD60: round2(sumD60),
    shareOfAbsSumPct: totalAbs > 0 ? round2((Math.abs(sumD60) / totalAbs) * 100) : null,
  }))
  const share = totalAbs > 0 ? round2((top3.reduce((s, x) => s + Math.abs(x.sumD60), 0) / totalAbs) * 100) : null
  return { top3, top3SharePct: share }
}

function indicatorState(rows, bars, indexOf) {
  const hist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
  const rsi = []
  const stoch = []
  const bb = []
  const ma = []
  for (const row of rows) {
    const idx = indexOf(row)
    if (idx == null) continue
    const bar = bars.get(row.symbol)?.[idx]
    if (!bar) continue
    const flags = conditionFlags(bar, FROZEN_THRESHOLDS)
    hist[flags.count] = (hist[flags.count] || 0) + 1
    rsi.push(bar.rsi14)
    stoch.push(bar.stochK)
    bb.push(bar.bbPctB)
    ma.push(bar.ma20DevPct)
  }
  return {
    count: hist,
    rsiMedian: summarizeNumeric(rsi).median,
    stochMedian: summarizeNumeric(stoch).median,
    bbMedian: summarizeNumeric(bb).median,
    ma20Median: summarizeNumeric(ma).median,
  }
}

function inWindow(date, w) {
  return date >= w.start && date <= w.end
}

export function judgeRecovery(rows) {
  const passes = []
  const related = []
  const flips = []
  for (const row of rows) {
    const tr = row.train
    const te = row.test
    if (!tr || !te || tr.d60Gap == null || te.d60Gap == null || tr.d20Gap == null || te.d20Gap == null) continue
    const enough =
      te.n >= JUDGE_GATES.minN &&
      te.missN >= JUDGE_GATES.minN &&
      te.occ >= JUDGE_GATES.occLow &&
      te.occ <= JUDGE_GATES.occHigh
    const same = (a, b) => a * b > 0 && Math.abs(a) >= JUDGE_GATES.improvePp && Math.abs(b) >= JUDGE_GATES.improvePp
    const flip = (a, b) => a * b < 0 && Math.abs(a) >= JUDGE_GATES.improvePp && Math.abs(b) >= JUDGE_GATES.improvePp
    if (flip(tr.d60Gap, te.d60Gap) || flip(tr.d20Gap, te.d20Gap)) flips.push(row.id)
    const d60Up =
      same(tr.d60Gap, te.d60Gap) &&
      tr.d60Gap >= JUDGE_GATES.improvePp &&
      te.d60Gap >= JUDGE_GATES.improvePp &&
      te.d20Gap >= -JUDGE_GATES.worsenPp
    const d20Up =
      same(tr.d20Gap, te.d20Gap) &&
      tr.d20Gap >= JUDGE_GATES.improvePp &&
      te.d20Gap >= JUDGE_GATES.improvePp &&
      te.d60Gap >= -JUDGE_GATES.worsenPp
    const concentrated = te.top3SharePct != null && te.top3SharePct > JUDGE_GATES.top3ShareMax
    if (enough && (d60Up || d20Up) && !concentrated) passes.push(row.id)
    else if (same(tr.d60Gap, te.d60Gap) || same(tr.d20Gap, te.d20Gap)) related.push(row.id)
  }
  let code = "C"
  if (passes.length) code = "A"
  else if (related.length) code = "B"
  return {
    code,
    passes,
    related,
    flips,
    gates: JUDGE_GATES,
    note: "Gap is the signal-day median minus the no-signal group's day-0 median. A lower MAE alone is not a pass.",
  }
}

export function analyzeRecoverySymbol(meta, rawBars) {
  if (!rawBars?.length || rawBars.length < MIN_BARS) {
    return {
      symbol: meta.symbol,
      status: rawBars?.length ? "insufficient history" : "data unavailable",
      rows: [],
      split: null,
      bars: null,
    }
  }
  const bars = attachObservationFeatures(enrichBarsWithIndicators(rawBars), null, null)
  const split = timeSplitBars(bars, TRAIN_RATIO)
  const fromIdx = Math.min(WARMUP_IDX, bars.length - 1)
  const built = buildSplitBuyEpisodes(bars, FROZEN_THRESHOLDS, { fromIdx, toIdx: bars.length })
  const rows = built.map((ep) => {
    const open = ep.openIdx
    const signals = {}
    for (const id of SIGNAL_IDS) {
      const idx = firstSignalIndex(bars, open, id)
      signals[id] = idx == null ? null : { idx, day: idx - open, date: bars[idx].date }
    }
    return {
      symbol: meta.symbol,
      date: bars[open].date,
      idx: open,
      split: open < split.splitIdx ? "train" : "test",
      atrPct: bars[open].atrPct ?? null,
      atrBand: atrBand(bars[open].atrPct),
      openCount: ep.openCount,
      day0: forwardStats(bars, open),
      signals,
    }
  })
  return { symbol: meta.symbol, status: "ok", split, bars, rows }
}

function signalView(rows, id, barsBySymbol) {
  const fired = rows.filter((r) => r.signals[id])
  const missed = rows.filter((r) => !r.signals[id])
  const firedPack = pack(fired, (r) => forwardFromCache(r, id))
  const missedPack = pack(missed, (r) => r.day0)
  const firedDay0 = pack(fired, (r) => r.day0)
  const days = summarizeNumeric(fired.map((r) => r.signals[id].day))
  const conc = top3Share(fired, (r) => forwardFromCache(r, id)?.d60)
  const state = barsBySymbol ? indicatorState(fired, barsBySymbol, (r) => r.signals[id].idx) : null
  const day0State = barsBySymbol ? indicatorState(fired, barsBySymbol, (r) => r.idx) : null
  return {
    n: fired.length,
    missN: missed.length,
    occ: rate(fired.length, rows.length),
    absentPct: rate(missed.length, rows.length),
    firstDayMedian: days.median,
    firstDayMean: days.mean,
    fromSignal: firedPack,
    fromDay0SameEpisodes: firedDay0,
    missedFromDay0: missedPack,
    d20Gap: gapOf(firedPack.d20Median, missedPack.d20Median),
    d60Gap: gapOf(firedPack.d60Median, missedPack.d60Median),
    maeGap: gapOf(missedPack.maeMedian, firedPack.maeMedian),
    top3: conc.top3,
    top3SharePct: conc.top3SharePct,
    atSignal: state,
    atDay0: day0State,
  }
}

function gapOf(a, b) {
  if (a == null || b == null) return null
  return round2(a - b)
}

function forwardFromCache(row, id) {
  return row.signalPaths?.[id] ?? null
}

function correlations(rows) {
  const out = []
  for (let i = 0; i < SIGNAL_IDS.length; i++) {
    for (let j = i + 1; j < SIGNAL_IDS.length; j++) {
      const a = SIGNAL_IDS[i]
      const b = SIGNAL_IDS[j]
      const xs = rows.map((r) => (r.signals[a] ? 1 : 0))
      const ys = rows.map((r) => (r.signals[b] ? 1 : 0))
      const both = rows.filter((r) => r.signals[a] && r.signals[b]).length
      out.push({ a, b, ...pearson(xs, ys), bothPct: rate(both, rows.length) })
    }
  }
  return out
}

function atrSplit(rows, id) {
  const out = {}
  for (const band of ["lt3", "b3_4", "ge4"]) {
    const sub = rows.filter((r) => r.atrBand === band)
    const fired = sub.filter((r) => r.signals[id])
    const missed = sub.filter((r) => !r.signals[id])
    out[band] = {
      n: sub.length,
      fired: pack(fired, (r) => r.signalPaths[id]),
      missed: pack(missed, (r) => r.day0),
      firedFromDay0: pack(fired, (r) => r.day0),
      occ: rate(fired.length, sub.length),
    }
  }
  return out
}

function crashSplit(rows, id) {
  const out = {}
  for (const w of CRASH_WINDOWS) {
    const inside = rows.filter((r) => inWindow(r.date, w))
    const fired = inside.filter((r) => r.signals[id])
    const missed = inside.filter((r) => !r.signals[id])
    out[w.id] = {
      n: inside.length,
      fired: pack(fired, (r) => r.signalPaths[id]),
      missed: pack(missed, (r) => r.day0),
      occ: rate(fired.length, inside.length),
    }
  }
  const outside = rows.filter((r) => !CRASH_WINDOWS.some((w) => inWindow(r.date, w)))
  const fired = outside.filter((r) => r.signals[id])
  out.outside = {
    n: outside.length,
    fired: pack(fired, (r) => r.signalPaths[id]),
    occ: rate(fired.length, outside.length),
  }
  return out
}

export function poolRecovery(analyzed) {
  const barsBySymbol = new Map()
  const rows = []
  for (const block of analyzed) {
    if (block.status !== "ok") continue
    if (block.bars) barsBySymbol.set(block.symbol, block.bars)
    for (const row of block.rows) {
      const signalPaths = {}
      const bars = block.bars
      for (const id of SIGNAL_IDS) {
        const hit = row.signals[id]
        signalPaths[id] = hit && bars ? forwardStats(bars, hit.idx) : null
      }
      rows.push({ ...row, signalPaths })
    }
  }
  const train = rows.filter((r) => r.split === "train")
  const test = rows.filter((r) => r.split === "test")
  const signals = {}
  const judgeRows = []
  for (const id of SIGNAL_IDS) {
    const trainView = signalView(train, id, barsBySymbol)
    const testView = signalView(test, id, barsBySymbol)
    signals[id] = {
      train: trainView,
      test: testView,
      testByAtr: atrSplit(test, id),
      crash: { train: crashSplit(train, id), test: crashSplit(test, id) },
    }
    judgeRows.push({
      id,
      train: { n: trainView.n, missN: trainView.missN, occ: trainView.occ, d20Gap: trainView.d20Gap, d60Gap: trainView.d60Gap, top3SharePct: trainView.top3SharePct },
      test: { n: testView.n, missN: testView.missN, occ: testView.occ, d20Gap: testView.d20Gap, d60Gap: testView.d60Gap, top3SharePct: testView.top3SharePct },
    })
  }
  const splits = analyzed.map((x) => x.split).filter(Boolean)
  return {
    coverage: {
      symbols: analyzed.length,
      withData: analyzed.filter((x) => x.status === "ok").length,
      dataStart: splits.map((s) => s.dataStart).filter(Boolean).sort()[0] ?? null,
      dataEnd: splits.map((s) => s.dataEnd).filter(Boolean).sort().at(-1) ?? null,
      splitDateMin: splits.map((s) => s.splitDate).filter(Boolean).sort()[0] ?? null,
      splitDateMax: splits.map((s) => s.splitDate).filter(Boolean).sort().at(-1) ?? null,
    },
    counts: { train: train.length, test: test.length },
    baseline: { train: pack(train, (r) => r.day0), test: pack(test, (r) => r.day0) },
    signals,
    correlation: { train: correlations(train), test: correlations(test) },
    judgment: judgeRecovery(judgeRows),
  }
}

export function msftRecoveryCase(rawBars) {
  const block = analyzeRecoverySymbol({ symbol: "MSFT" }, rawBars)
  if (block.status !== "ok") return { status: block.status }
  const row = block.rows.find((r) => r.date === "2026-06-17")
  if (!row) return { status: "2026-06-17 is not a 3/4 open", splitDate: block.split?.splitDate ?? null }
  const bars = block.bars
  const open = row.idx
  const end = Math.min(bars.length - 1, open + SIGNAL_WINDOW)
  const days = []
  for (let t = open; t <= end; t++) {
    const flags = {}
    for (const id of SIGNAL_IDS) flags[id] = t === open ? false : signalTrue(bars, t, id)
    days.push({ date: bars[t].date, day: t - open, close: round2(bars[t].close), rsi14: round2(bars[t].rsi14), flags })
  }
  const first = {}
  for (const id of SIGNAL_IDS) {
    const hit = row.signals[id]
    if (!hit) {
      first[id] = { reached: false }
      continue
    }
    const path = forwardStats(bars, hit.idx)
    first[id] = { reached: true, date: hit.date, day: hit.day, ...path }
  }
  return {
    status: "ok",
    split: row.split,
    splitDate: block.split.splitDate,
    date: row.date,
    close: round2(bars[open].close),
    atrPct: row.atrPct,
    atrBand: row.atrBand,
    openCount: row.openCount,
    day0: row.day0,
    first,
    days,
  }
}
