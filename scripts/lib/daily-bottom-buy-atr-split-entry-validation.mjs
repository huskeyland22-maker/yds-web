/**
 * ATR as a risk label after an unchanged 3/4 entry (research only).
 * Second-entry cases are close-to-close drops from the 3/4 close.
 * 50/50 weights are a fixed comparison, not a chosen allocation.
 * ATR bands are the prior cuts: <3, 3–4, >=4.
 */

import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import { summarizeNumeric, timeSplitBars, TRAIN_RATIO } from "./daily-bottom-buy-validation-core.mjs"
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
export const DROP_PCTS = [5, 10, 15, 20]
export const SPLIT_WEIGHTS = { w1: 0.5, w2: 0.5 }

/** Fixed letter gates. Not used to move an ATR cut or a weight. */
export const JUDGE_GATES = {
  maeImprovePp: 1,
  d60DropPp: 2,
  hit10DropPp: 8,
  signFlipPp: 1,
  minN: 30,
}

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function rate(n, d) {
  if (!d) return null
  return round2((n / d) * 100)
}

/**
 * First later close at or below entry * (1 - pct/100), inside the horizon.
 * The entry close itself is the reference and is not a hit.
 */
export function firstCloseDrop(bars, idx, pct, horizon = HORIZON) {
  const entry = bars[idx]?.close
  if (!(entry > 0)) return null
  const end = Math.min(bars.length - 1, idx + horizon)
  const line = entry * (1 - pct / 100)
  for (let j = idx + 1; j <= end; j++) {
    if (bars[j].close <= line) return j
  }
  return null
}

/**
 * Portfolio return at a horizon close.
 * w2 stays cash until the day after... on the fill day the fill price is that close,
 * so the horizon close on the fill day is exactly the fill (return 0 on that tranche).
 */
export function portfolioReturn(bars, idx, secondIdx, horizon, weights) {
  const j = idx + horizon
  if (j >= bars.length) return null
  const p1 = bars[idx].close
  if (!(p1 > 0)) return null
  const px = bars[j].close
  const { w1, w2 } = weights
  let nav = w1 * (px / p1)
  if (w2 > 0 && secondIdx != null && secondIdx <= j) {
    const p2 = bars[secondIdx].close
    if (!(p2 > 0)) return null
    nav += w2 * (px / p2)
  } else {
    nav += w2
  }
  return round2((nav - 1) * 100)
}

/**
 * Worst mark using daily lows. The second tranche is unfilled on the fill day,
 * because that day's low is before the closing fill.
 */
export function portfolioMae(bars, idx, secondIdx, horizon, weights) {
  const p1 = bars[idx].close
  if (!(p1 > 0)) return null
  const end = Math.min(bars.length - 1, idx + horizon)
  const { w1, w2 } = weights
  const p2 = secondIdx != null ? bars[secondIdx].close : null
  let minNav = Infinity
  for (let j = idx; j <= end; j++) {
    const px = bars[j].low
    if (!(px > 0)) continue
    let nav = w1 * (px / p1)
    if (w2 > 0 && secondIdx != null && p2 > 0 && j > secondIdx) nav += w2 * (px / p2)
    else nav += w2
    if (nav < minNav) minNav = nav
  }
  if (!Number.isFinite(minNav)) return null
  return round2((1 - minNav) * 100)
}

export function portfolioHit(bars, idx, secondIdx, horizon, weights, target) {
  const end = Math.min(bars.length - 1, idx + horizon)
  for (let h = 1; h <= end - idx; h++) {
    const r = portfolioReturn(bars, idx, secondIdx, h, weights)
    if (r != null && r >= target) return true
  }
  return false
}

function pathFrom(bars, idx) {
  const entry = bars[idx].close
  const end = Math.min(bars.length - 1, idx + HORIZON)
  let minLow = bars[idx].low
  let minLowIdx = idx
  let minClose = bars[idx].close
  let minCloseIdx = idx
  const hit = { 5: null, 10: null }
  for (let j = idx; j <= end; j++) {
    if (bars[j].low < minLow) {
      minLow = bars[j].low
      minLowIdx = j
    }
    if (bars[j].close < minClose) {
      minClose = bars[j].close
      minCloseIdx = j
    }
    if (j === idx) continue
    const r = ((bars[j].close - entry) / entry) * 100
    if (hit[5] == null && r >= 5) hit[5] = j - idx
    if (hit[10] == null && r >= 10) hit[10] = j - idx
  }
  const fwd = {}
  for (const h of [5, 10, 20, 40, 60]) {
    fwd[h] = idx + h < bars.length && bars[idx + h].close > 0
      ? round2(((bars[idx + h].close - entry) / entry) * 100)
      : null
  }
  const drops = {}
  for (const pct of DROP_PCTS) drops[pct] = firstCloseDrop(bars, idx, pct)
  const single = { w1: 1, w2: 0 }
  const book = (secondIdx) => ({
    d20: portfolioReturn(bars, idx, secondIdx, 20, SPLIT_WEIGHTS),
    d60: portfolioReturn(bars, idx, secondIdx, 60, SPLIT_WEIGHTS),
    mae: portfolioMae(bars, idx, secondIdx, HORIZON, SPLIT_WEIGHTS),
    hit5: portfolioHit(bars, idx, secondIdx, HORIZON, SPLIT_WEIGHTS, 5),
    hit10: portfolioHit(bars, idx, secondIdx, HORIZON, SPLIT_WEIGHTS, 10),
    filled: secondIdx != null,
    days: secondIdx != null ? secondIdx - idx : null,
  })
  return {
    mae: entry > 0 ? round2(((entry - minLow) / entry) * 100) : null,
    closeMae: entry > 0 ? round2(((entry - minClose) / entry) * 100) : null,
    minLow: round2(minLow),
    minClose: round2(minClose),
    daysToLow: minLowIdx - idx,
    daysToMinClose: minCloseIdx - idx,
    d5: fwd[5],
    d10: fwd[10],
    d20: fwd[20],
    d40: fwd[40],
    d60: fwd[60],
    hit5: hit[5] != null,
    hit10: hit[10] != null,
    singleMae: portfolioMae(bars, idx, null, HORIZON, single),
    drops,
    book10: book(drops[10]),
    book15: book(drops[15]),
  }
}

function episodeRow(bars, ep, splitIdx, symbol) {
  const path = pathFrom(bars, ep.openIdx)
  const b = bars[ep.openIdx]
  return {
    symbol,
    date: b.date,
    idx: ep.openIdx,
    split: ep.openIdx < splitIdx ? "train" : "test",
    atrPct: b.atrPct,
    atrBand: atrBand(b.atrPct),
    openCount: ep.openCount,
    ...path,
  }
}

export function analyzeAtrSplitSymbol(meta, rawBars, bench = {}) {
  if (!rawBars?.length || rawBars.length < MIN_BARS) {
    return { symbol: meta.symbol, status: rawBars?.length ? "insufficient history" : "data unavailable", rows: [], split: null }
  }
  const bars = attachObservationFeatures(enrichBarsWithIndicators(rawBars), bench.spy || null, bench.qqq || null)
  const split = timeSplitBars(bars, TRAIN_RATIO)
  const fromIdx = Math.min(WARMUP_IDX, bars.length - 1)
  const built = buildSplitBuyEpisodes(bars, FROZEN_THRESHOLDS, { fromIdx, toIdx: bars.length })
  return {
    symbol: meta.symbol,
    status: "ok",
    split,
    barCount: bars.length,
    rows: built.map((ep) => episodeRow(bars, ep, split.splitIdx, meta.symbol)),
    bars,
  }
}

function nums(rows, pick) {
  return summarizeNumeric(rows.map(pick))
}

export function packPath(rows) {
  const d60 = nums(rows, (r) => r.d60)
  const mae = nums(rows, (r) => r.mae)
  return {
    n: rows.length,
    smallSample: rows.length < JUDGE_GATES.minN,
    nD60: d60.n,
    maeMedian: mae.median,
    maeMean: mae.mean,
    maeP10: mae.p90,
    d20Median: nums(rows, (r) => r.d20).median,
    d60Median: d60.median,
    d60P10: d60.p10,
    d60Worst10Mean: worstDecileMean(rows.map((r) => r.d60)),
    hit5Pct: rate(rows.filter((r) => r.hit5).length, rows.length),
    hit10Pct: rate(rows.filter((r) => r.hit10).length, rows.length),
    closeDrop5Pct: rate(rows.filter((r) => r.drops[5] != null).length, rows.length),
    closeDrop10Pct: rate(rows.filter((r) => r.drops[10] != null).length, rows.length),
    closeDrop15Pct: rate(rows.filter((r) => r.drops[15] != null).length, rows.length),
    closeDrop20Pct: rate(rows.filter((r) => r.drops[20] != null).length, rows.length),
    daysToLowMedian: nums(rows, (r) => r.daysToLow).median,
    daysToMinCloseMedian: nums(rows, (r) => r.daysToMinClose).median,
  }
}

function worstDecileMean(values) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!xs.length) return null
  const k = Math.max(1, Math.ceil(xs.length * 0.1))
  const slice = xs.slice(0, k)
  return round2(slice.reduce((s, v) => s + v, 0) / slice.length)
}

export function packBook(rows, key) {
  const d60 = nums(rows, (r) => r[key].d60)
  const mae = nums(rows, (r) => r[key].mae)
  return {
    n: rows.length,
    smallSample: rows.length < JUDGE_GATES.minN,
    nD60: d60.n,
    filledPct: rate(rows.filter((r) => r[key].filled).length, rows.length),
    daysMedian: nums(rows.filter((r) => r[key].filled), (r) => r[key].days).median,
    d20Median: nums(rows, (r) => r[key].d20).median,
    d60Median: d60.median,
    d60P10: d60.p10,
    d60Worst10Mean: worstDecileMean(rows.map((r) => r[key].d60)),
    maeMedian: mae.median,
    maeMean: mae.mean,
    hit5Pct: rate(rows.filter((r) => r[key].hit5).length, rows.length),
    hit10Pct: rate(rows.filter((r) => r[key].hit10).length, rows.length),
  }
}

function dropCase(rows, pct) {
  const hit = rows.filter((r) => r.drops[pct] != null)
  const miss = rows.filter((r) => r.drops[pct] == null)
  return {
    n: rows.length,
    reachedPct: rate(hit.length, rows.length),
    daysMedian: nums(hit, (r) => r.drops[pct] - r.idx).median,
    reached: packPath(hit),
    missed: packPath(miss),
  }
}

function byAtr(rows, packer) {
  const out = {}
  for (const id of ["lt3", "b3_4", "ge4"]) out[id] = packer(rows.filter((r) => r.atrBand === id))
  return out
}

function symbolTable(rows, field) {
  const by = new Map()
  for (const row of rows) {
    if (!by.has(row.symbol)) by.set(row.symbol, [])
    by.get(row.symbol).push(row)
  }
  const list = [...by.entries()]
    .map(([symbol, list]) => {
      const pack = field === "path" ? packPath(list) : packBook(list, field)
      return { symbol, n: pack.n, d60Median: pack.d60Median, maeMedian: pack.maeMedian }
    })
    .sort((a, b) => b.n - a.n || a.symbol.localeCompare(b.symbol))
  const usable = list.filter((r) => r.n >= 5 && r.d60Median != null)
  const sums = new Map()
  for (const row of rows) {
    const v = field === "path" ? row.d60 : row[field].d60
    if (v == null) continue
    sums.set(row.symbol, (sums.get(row.symbol) || 0) + v)
  }
  const ranked = [...sums.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const totalAbs = ranked.reduce((s, x) => s + Math.abs(x[1]), 0)
  const top3 = ranked.slice(0, 3).map(([symbol, sumD60]) => ({
    symbol,
    sumD60: round2(sumD60),
    shareOfAbsSumPct: totalAbs > 0 ? round2((Math.abs(sumD60) / totalAbs) * 100) : null,
  }))
  return {
    equalWeightN5: {
      names: usable.length,
      d60MedianOfSymbolMedians: nums(usable, (r) => r.d60Median).median,
    },
    top3,
    top3SharePct: totalAbs > 0 ? round2((top3.reduce((s, x) => s + Math.abs(x.sumD60), 0) / totalAbs) * 100) : null,
    symbols: list,
  }
}

function gap(base, next) {
  return {
    mae: round2(base.maeMedian - next.maeMedian),
    d60: round2(next.d60Median - base.d60Median),
    hit10: round2(next.hit10Pct - base.hit10Pct),
  }
}

export function judgeAtrSplit(trainSingle, trainSplit, testSingle, testSplit, highTrainSingle, highTrainSplit, highTestSingle, highTestSplit) {
  const ready = [trainSingle, trainSplit, testSingle, testSplit, highTrainSingle, highTrainSplit, highTestSingle, highTestSplit].every(
    (p) => p && p.n >= JUDGE_GATES.minN && p.maeMedian != null && p.d60Median != null && p.hit10Pct != null,
  )
  if (!ready) return { code: "B", reason: "n below 30 or a missing metric", gates: JUDGE_GATES }
  const fullTrain = gap(trainSingle, trainSplit)
  const fullTest = gap(testSingle, testSplit)
  const highTrain = gap(highTrainSingle, highTrainSplit)
  const highTest = gap(highTestSingle, highTestSplit)
  const flip = (a, b) => a.mae * b.mae < 0 && Math.abs(a.mae) >= JUDGE_GATES.signFlipPp && Math.abs(b.mae) >= JUDGE_GATES.signFlipPp
  const worsens = (g) => g.d60 <= -JUDGE_GATES.d60DropPp || g.hit10 <= -JUDGE_GATES.hit10DropPp
  const improves = (g) => g.mae >= JUDGE_GATES.maeImprovePp && g.d60 >= -1 && g.hit10 >= -JUDGE_GATES.hit10DropPp
  let code = "B"
  if (flip(fullTrain, fullTest) || flip(highTrain, highTest)) code = "D"
  else if (worsens(fullTest) || worsens(highTest)) code = "C"
  else if (improves(fullTrain) && improves(fullTest) && improves(highTrain) && improves(highTest)) code = "A"
  return {
    code,
    fullTrain,
    fullTest,
    highTrain,
    highTest,
    gates: JUDGE_GATES,
    compared: "100% at 3/4 versus fixed 50/50 with the second half at the first -10% close. High ATR is the >=4 band. Gates are not a weight search.",
  }
}

function sideView(rows) {
  const single = {
    n: rows.length,
    d20Median: nums(rows, (r) => r.d20).median,
    d60Median: nums(rows, (r) => r.d60).median,
    d60P10: nums(rows, (r) => r.d60).p10,
    maeMedian: nums(rows, (r) => r.mae).median,
    hit5Pct: rate(rows.filter((r) => r.hit5).length, rows.length),
    hit10Pct: rate(rows.filter((r) => r.hit10).length, rows.length),
    nD60: nums(rows, (r) => r.d60).n,
  }
  return {
    path: packPath(rows),
    single,
    split10: packBook(rows, "book10"),
    split15: packBook(rows, "book15"),
    byAtr: byAtr(rows, packPath),
    byAtrSplit10: byAtr(rows, (list) => packBook(list, "book10")),
    byAtrSplit15: byAtr(rows, (list) => packBook(list, "book15")),
    drop5: dropCase(rows, 5),
    drop10: dropCase(rows, 10),
    drop15: dropCase(rows, 15),
    drop20: dropCase(rows, 20),
    drop10ByAtr: byAtr(rows, (list) => dropCase(list, 10)),
    drop15ByAtr: byAtr(rows, (list) => dropCase(list, 15)),
  }
}

export function poolAtrSplit(analyzed) {
  const rows = analyzed.flatMap((x) => x.rows || [])
  const train = rows.filter((r) => r.split === "train")
  const test = rows.filter((r) => r.split === "test")
  const trainView = sideView(train)
  const testView = sideView(test)
  const high = (view, book) => view[book].ge4 || view.byAtrSplit10.ge4
  const judgment = judgeAtrSplit(
    trainView.single,
    trainView.split10,
    testView.single,
    testView.split10,
    { ...trainView.byAtr.ge4, hit10Pct: trainView.byAtr.ge4.hit10Pct, maeMedian: trainView.byAtr.ge4.maeMedian, d60Median: trainView.byAtr.ge4.d60Median, n: trainView.byAtr.ge4.n },
    trainView.byAtrSplit10.ge4,
    testView.byAtr.ge4,
    testView.byAtrSplit10.ge4,
  )
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
    train: trainView,
    test: testView,
    symbols: {
      testSingle: symbolTable(test, "path"),
      testSplit10: symbolTable(test, "book10"),
    },
    judgment,
  }
}

export function msftAtrCase(rawBars, bench = {}) {
  if (!rawBars?.length) return { status: "data unavailable" }
  const analyzed = analyzeAtrSplitSymbol({ symbol: "MSFT" }, rawBars, bench)
  if (analyzed.status !== "ok") return { status: analyzed.status }
  const row = analyzed.rows.find((r) => r.date === "2026-06-17")
  if (!row) return { status: "2026-06-17 is not a 3/4 open", splitDate: analyzed.split?.splitDate ?? null }
  const bars = analyzed.bars
  const idx = row.idx
  const drops = {}
  for (const pct of DROP_PCTS) {
    const j = row.drops[pct]
    drops[pct] = j == null ? { reached: false } : { reached: true, date: bars[j].date, days: j - idx, close: round2(bars[j].close) }
  }
  return {
    status: "ok",
    split: row.split,
    splitDate: analyzed.split.splitDate,
    date: row.date,
    close: round2(bars[idx].close),
    atrPct: row.atrPct,
    atrBand: row.atrBand,
    openCount: row.openCount,
    minLow: row.minLow,
    minClose: row.minClose,
    mae: row.mae,
    closeMae: row.closeMae,
    daysToLow: row.daysToLow,
    d20: row.d20,
    d60: row.d60,
    hit5: row.hit5,
    hit10: row.hit10,
    drops,
    single: { d20: row.d20, d60: row.d60, mae: row.mae, hit5: row.hit5, hit10: row.hit10 },
    split10: row.book10,
    split15: row.book15,
  }
}
