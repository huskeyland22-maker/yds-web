/**
 * Individual-stock train/test comparison (research only).
 * Baseline is the frozen 3/4 episode. The candidate is not a new buy rule:
 * one row per decline at the first trailing-120d-high drawdown of -10% or deeper,
 * then described by fixed ATR and SPY-120d relative-strength bands.
 * Thresholds are not refit. Deeper bands are a late-entry description.
 */

import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import { conditionFlags, summarizeNumeric, timeSplitBars, TRAIN_RATIO } from "./daily-bottom-buy-validation-core.mjs"
import { EPISODE_DEF, FROZEN_THRESHOLDS, buildSplitBuyEpisodes } from "./daily-bottom-split-buy-sim.mjs"
import {
  EQUITY_CANDIDATES,
  MIN_BARS,
  WARMUP_IDX,
  attachObservationFeatures,
  assertNoEtfInStudyUniverse,
} from "./daily-bottom-buy-cross-asset-validation.mjs"
import {
  drawdownFromRollingHigh,
  outcomeFrom,
  rollingHighAt,
} from "./daily-bottom-buy-correction-stage-validation.mjs"
import { attachTrendFields } from "./daily-bottom-buy-trend-regime-validation.mjs"

export {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  EPISODE_DEF,
  TRAIN_RATIO,
  assertNoEtfInStudyUniverse,
}

export const DEPTH_WINDOW = 120
export const DEPTH_LEVELS = [10, 15, 20, 25, 30]
export const EPISODE_MAX_DAYS = 252
export const RECOVER_GAP = 0.02

/** Fixed conclusion gates. Not used to pick a threshold. */
export const JUDGE_GATES = {
  maeImprovePp: 1,
  maeWorsePp: 2,
  d60DropPp: 1,
  tailWorsenPp: 5,
  minN: 30,
}

export const CRASH_WINDOWS = [
  { id: "covid_2020", start: "2020-02-20", end: "2020-04-30" },
  { id: "bear_2022", start: "2022-01-03", end: "2022-10-14" },
]

const STRETCH_LABEL = {
  0: "wait",
  1: "wait",
  2: "interest",
  3: "first_buy",
  4: "strong_low",
}

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

/**
 * Non-overlapping partition of trailing drawdown (%).
 * "lt10" is a decline shallower than 10% (drawdown > -10).
 */
export function depthBand(dd) {
  if (dd == null || !Number.isFinite(dd)) return null
  if (dd > -10) return "lt10"
  if (dd > -15) return "m10_15"
  if (dd > -20) return "m15_20"
  if (dd > -25) return "m20_25"
  if (dd > -30) return "m25_30"
  return "le30"
}

export function atrBand(v) {
  if (v == null || !Number.isFinite(v)) return null
  if (v < 3) return "lt3"
  if (v < 4) return "b3_4"
  return "ge4"
}

export function rsBand(v) {
  if (v == null || !Number.isFinite(v)) return null
  return v >= 0 ? "ge0" : "lt0"
}

/**
 * Long-term state only. DOWN requires a strictly negative MA200 slope.
 * @param {{ close: number, ma200: number|null, slope: number|null, ma50Above: boolean|null }} row
 */
export function classifyStudyRegime(row) {
  const { close, ma200, slope, ma50Above } = row
  if (ma200 == null || slope == null || ma50Above == null || !(close > 0)) return "unknown"
  if (close > ma200 && slope > 0 && ma50Above === true) return "up"
  if (close < ma200 && slope < 0 && ma50Above === false) return "down"
  return "neutral"
}

export function judgeReplacement(trainBase, trainNew, testBase, testNew) {
  const packs = [trainBase, trainNew, testBase, testNew]
  const ready = packs.every(
    (p) => p && p.n >= JUDGE_GATES.minN && p.maeMedian != null && p.d60Median != null && p.tail10Pct != null && p.tail20Pct != null,
  )
  const gap = (base, next) => ({
    mae: round2(base.maeMedian - next.maeMedian),
    d60: round2(next.d60Median - base.d60Median),
    tail10: round2(next.tail10Pct - base.tail10Pct),
    tail20: round2(next.tail20Pct - base.tail20Pct),
  })
  if (!ready) {
    return { code: "B", reason: "one side has n below 30 or a missing metric", train: null, test: null }
  }
  const tr = gap(trainBase, trainNew)
  const te = gap(testBase, testNew)
  const improves = (g) =>
    g.mae >= JUDGE_GATES.maeImprovePp &&
    g.d60 >= -JUDGE_GATES.d60DropPp &&
    g.tail10 < JUDGE_GATES.tailWorsenPp &&
    g.tail20 < JUDGE_GATES.tailWorsenPp
  let code = "B"
  if (te.tail10 >= JUDGE_GATES.tailWorsenPp || te.tail20 >= JUDGE_GATES.tailWorsenPp || te.mae <= -JUDGE_GATES.maeWorsePp) {
    code = "D"
  } else if (improves(tr) && te.mae < 0.5) {
    code = "C"
  } else if (improves(tr) && improves(te)) {
    code = "A"
  }
  return {
    code,
    train: tr,
    test: te,
    compared: "baseline first 3/4 versus the first trailing -10% cross, all ATR bands included",
    gates: JUDGE_GATES,
  }
}

function rate(n, d) {
  if (!d) return null
  return round2((n / d) * 100)
}

export function packEntries(rows) {
  const mae = summarizeNumeric(rows.map((r) => r.mae))
  const d20 = summarizeNumeric(rows.map((r) => r.d20))
  const d60 = summarizeNumeric(rows.map((r) => r.d60))
  const days = summarizeNumeric(rows.map((r) => r.daysToLow))
  return {
    n: rows.length,
    smallSample: rows.length < JUDGE_GATES.minN,
    nD60: d60.n,
    maeMedian: mae.median,
    maeMean: mae.mean,
    d20Median: d20.median,
    d60Median: d60.median,
    hit5Pct: rate(rows.filter((r) => r.hit5).length, rows.length),
    hit10Pct: rate(rows.filter((r) => r.hit10).length, rows.length),
    tail10Pct: rate(rows.filter((r) => r.mae != null && r.mae >= 10).length, rows.length),
    tail20Pct: rate(rows.filter((r) => r.mae != null && r.mae >= 20).length, rows.length),
    daysToLowMedian: days.median,
  }
}

function snapshotRow(bars, idx, splitIdx, extra) {
  const b = bars[idx]
  const dd = idx >= DEPTH_WINDOW - 1 ? round2(drawdownFromRollingHigh(bars, idx, DEPTH_WINDOW)) : null
  const flags = conditionFlags(b, FROZEN_THRESHOLDS)
  const outcome = outcomeFrom(bars, idx)
  const regime = classifyStudyRegime({
    close: b.close,
    ma200: b.ma200Level,
    slope: b.ma200Slope,
    ma50Above: b.ma50AboveMa200,
  })
  return {
    symbol: extra.symbol,
    date: b.date,
    idx,
    split: idx < splitIdx ? "train" : "test",
    ddTrail: dd,
    depthBand: depthBand(dd),
    atrPct: b.atrPct,
    atrBand: atrBand(b.atrPct),
    rsSpy120: b.rsSpy120,
    rsBand: rsBand(b.rsSpy120),
    stretch: flags.count,
    stretchLabel: STRETCH_LABEL[flags.count] || "wait",
    regime,
    mae: outcome?.maePct ?? null,
    d20: outcome?.d20 ?? null,
    d60: outcome?.d60 ?? null,
    hit5: Boolean(outcome?.hit5),
    hit10: Boolean(outcome?.hit10),
    daysToLow: outcome?.daysToLow ?? null,
    ...extra,
  }
}

export function buildTrailingDepthEpisodes(bars, fromIdx, window = DEPTH_WINDOW) {
  const episodes = []
  let i = Math.max(fromIdx, window - 1)
  while (i < bars.length) {
    const dd = drawdownFromRollingHigh(bars, i, window)
    const prev = i > window - 1 ? drawdownFromRollingHigh(bars, i - 1, window) : null
    const crossed = dd != null && dd <= -10 && (prev == null || prev > -10)
    if (!crossed) {
      i++
      continue
    }
    const { peak } = rollingHighAt(bars, i, window)
    const hits = {}
    let endIdx = i
    const last = Math.min(bars.length - 1, i + EPISODE_MAX_DAYS)
    for (let j = i; j <= last; j++) {
      endIdx = j
      const tdd = drawdownFromRollingHigh(bars, j, window)
      for (const level of DEPTH_LEVELS) {
        if (hits[level] == null && tdd != null && tdd <= -level) hits[level] = j
      }
      if (j > i && peak > 0 && bars[j].close >= peak * (1 - RECOVER_GAP)) break
    }
    episodes.push({
      startIdx: i,
      endIdx,
      peak,
      hits,
      startDate: bars[i].date,
      endDate: bars[endIdx].date,
    })
    i = endIdx + 1
  }
  return episodes
}

function inWindow(date, w) {
  return date >= w.start && date <= w.end
}

function groupPack(rows, keyFn) {
  const buckets = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (key == null) continue
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(row)
  }
  const out = {}
  for (const [key, list] of buckets) out[key] = packEntries(list)
  return out
}

function symbolTable(rows) {
  const by = groupPack(rows, (r) => r.symbol)
  const list = Object.entries(by)
    .map(([symbol, pack]) => ({ symbol, ...pack }))
    .sort((a, b) => b.n - a.n || a.symbol.localeCompare(b.symbol))
  const usable = list.filter((r) => r.n >= 5 && r.d60Median != null && r.maeMedian != null)
  const eqD60 = summarizeNumeric(usable.map((r) => r.d60Median))
  const eqMae = summarizeNumeric(usable.map((r) => r.maeMedian))
  const sums = new Map()
  for (const row of rows) {
    if (row.d60 == null) continue
    sums.set(row.symbol, (sums.get(row.symbol) || 0) + row.d60)
  }
  const ranked = [...sums.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const totalAbs = ranked.reduce((s, x) => s + Math.abs(x[1]), 0)
  const top3 = ranked.slice(0, 3).map(([symbol, sumD60]) => ({
    symbol,
    sumD60: round2(sumD60),
    shareOfAbsSumPct: totalAbs > 0 ? round2((Math.abs(sumD60) / totalAbs) * 100) : null,
  }))
  return {
    symbols: list,
    equalWeightN5: {
      names: usable.length,
      d60MedianOfSymbolMedians: eqD60.median,
      maeMedianOfSymbolMedians: eqMae.median,
    },
    top3AbsSumD60: top3,
    top3SharePct: totalAbs > 0 ? round2((top3.reduce((s, x) => s + Math.abs(x.sumD60), 0) / totalAbs) * 100) : null,
  }
}

function crashSplit(rows) {
  const out = {}
  for (const w of CRASH_WINDOWS) {
    out[w.id] = {
      inside: packEntries(rows.filter((r) => inWindow(r.date, w))),
      outside: packEntries(rows.filter((r) => !inWindow(r.date, w))),
    }
  }
  return out
}

function yearSplit(rows) {
  return groupPack(rows, (r) => r.date.slice(0, 4))
}

function lateItems(episodes, bars, splitIdx, symbol) {
  const train = []
  const test = []
  for (const ep of episodes) {
    const start = ep.hits[10]
    if (start == null) continue
    const row10 = snapshotRow(bars, start, splitIdx, { symbol, kind: "depth10" })
    const hit20 = ep.hits[20]
    const hit30 = ep.hits[30]
    const reachedLater20 = hit20 != null && hit20 > start
    const reachedLater30 = hit30 != null && hit30 > start
    let pathTo20 = null
    let row20 = null
    if (reachedLater20) {
      const px0 = bars[start].close
      const px1 = bars[hit20].close
      pathTo20 = px0 > 0 ? round2(((px1 - px0) / px0) * 100) : null
      row20 = snapshotRow(bars, hit20, splitIdx, { symbol, kind: "depth20" })
    }
    const item = { row10, row20, pathTo20, reachedLater20, reachedLater30 }
    if (start < splitIdx) train.push(item)
    else test.push(item)
  }
  return { train, test }
}

function ladderRows(episodes, bars, splitIdx, symbol) {
  const rows = []
  for (const ep of episodes) {
    for (const level of DEPTH_LEVELS) {
      const idx = ep.hits[level]
      if (idx == null) continue
      rows.push(
        snapshotRow(bars, idx, splitIdx, {
          symbol,
          kind: "ladder",
          level,
          laterThanStart: idx > ep.startIdx,
        }),
      )
    }
  }
  return rows
}

export function analyzeSymbolTrainTest(meta, rawBars, bench = {}) {
  if (!rawBars?.length || rawBars.length < MIN_BARS) {
    return {
      symbol: meta.symbol,
      status: rawBars?.length ? "insufficient history" : "data unavailable",
      baseline: [],
      depth10: [],
      ladder: [],
      lateItems: { train: [], test: [] },
      split: null,
    }
  }
  const bars = attachTrendFields(
    attachObservationFeatures(enrichBarsWithIndicators(rawBars), bench.spy || null, bench.qqq || null),
    bench.spy || null,
    bench.qqq || null,
  )
  const split = timeSplitBars(bars, TRAIN_RATIO)
  const fromIdx = Math.min(WARMUP_IDX, bars.length - 1)
  const built = buildSplitBuyEpisodes(bars, FROZEN_THRESHOLDS, { fromIdx, toIdx: bars.length })
  const baseline = []
  for (const ep of built) {
    baseline.push(snapshotRow(bars, ep.openIdx, split.splitIdx, { symbol: meta.symbol, kind: "baseline3", openCount: ep.openCount }))
    if (ep.fill4Idx != null) {
      baseline.push(
        snapshotRow(bars, ep.fill4Idx, split.splitIdx, { symbol: meta.symbol, kind: "baseline4", openCount: 4 }),
      )
    }
  }
  const depthEpisodes = buildTrailingDepthEpisodes(bars, fromIdx)
  const depth10 = depthEpisodes.map((ep) =>
    snapshotRow(bars, ep.startIdx, split.splitIdx, { symbol: meta.symbol, kind: "depth10" }),
  )
  return {
    symbol: meta.symbol,
    status: "ok",
    split,
    barCount: bars.length,
    baseline,
    depth10,
    ladder: ladderRows(depthEpisodes, bars, split.splitIdx, meta.symbol),
    lateItems: lateItems(depthEpisodes, bars, split.splitIdx, meta.symbol),
  }
}

function sidePacks(rows) {
  const train = rows.filter((r) => r.split === "train")
  const test = rows.filter((r) => r.split === "test")
  return {
    train: packEntries(train),
    test: packEntries(test),
    trainByAtr: groupPack(train, (r) => r.atrBand),
    testByAtr: groupPack(test, (r) => r.atrBand),
    trainByRs: groupPack(train, (r) => r.rsBand),
    testByRs: groupPack(test, (r) => r.rsBand),
    trainByDepth: groupPack(train, (r) => r.depthBand),
    testByDepth: groupPack(test, (r) => r.depthBand),
    trainByRegime: groupPack(train, (r) => r.regime),
    testByRegime: groupPack(test, (r) => r.regime),
    trainByStretch: groupPack(train, (r) => String(r.stretch)),
    testByStretch: groupPack(test, (r) => String(r.stretch)),
    trainByAtrRs: groupPack(train, (r) => (r.atrBand && r.rsBand ? `${r.atrBand}|${r.rsBand}` : null)),
    testByAtrRs: groupPack(test, (r) => (r.atrBand && r.rsBand ? `${r.atrBand}|${r.rsBand}` : null)),
  }
}

export function poolTrainTest(analyzed) {
  const baseline3 = analyzed.flatMap((x) => x.baseline.filter((r) => r.kind === "baseline3"))
  const baseline4 = analyzed.flatMap((x) => x.baseline.filter((r) => r.kind === "baseline4"))
  const depth10 = analyzed.flatMap((x) => x.depth10)
  const ladder = analyzed.flatMap((x) => x.ladder)
  const modelA = sidePacks(baseline3)
  const modelA4 = sidePacks(baseline4)
  const modelB = sidePacks(depth10)
  const ladderPack = {}
  for (const level of DEPTH_LEVELS) {
    const rows = ladder.filter((r) => r.level === level)
    ladderPack[level] = {
      train: packEntries(rows.filter((r) => r.split === "train")),
      test: packEntries(rows.filter((r) => r.split === "test")),
      trainLater: packEntries(rows.filter((r) => r.split === "train" && r.laterThanStart)),
      testLater: packEntries(rows.filter((r) => r.split === "test" && r.laterThanStart)),
    }
  }
  const judgment = judgeReplacement(modelA.train, modelB.train, modelA.test, modelB.test)
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
    modelA: modelA,
    modelA4: modelA4,
    modelB: modelB,
    modelC: {
      note: "Same first -10% entries as model B, split by SPY 120d relative strength and by ATR x RS. No composite score.",
      trainByRs: modelB.trainByRs,
      testByRs: modelB.testByRs,
      trainByAtrRs: modelB.trainByAtrRs,
      testByAtrRs: modelB.testByAtrRs,
    },
    ladder: ladderPack,
    symbols: {
      baseline3Train: symbolTable(baseline3.filter((r) => r.split === "train")),
      baseline3Test: symbolTable(baseline3.filter((r) => r.split === "test")),
      depth10Train: symbolTable(depth10.filter((r) => r.split === "train")),
      depth10Test: symbolTable(depth10.filter((r) => r.split === "test")),
    },
    crash: {
      baseline3Train: crashSplit(baseline3.filter((r) => r.split === "train")),
      baseline3Test: crashSplit(baseline3.filter((r) => r.split === "test")),
      depth10Train: crashSplit(depth10.filter((r) => r.split === "train")),
      depth10Test: crashSplit(depth10.filter((r) => r.split === "test")),
    },
    years: {
      baseline3Test: yearSplit(baseline3.filter((r) => r.split === "test")),
      depth10Test: yearSplit(depth10.filter((r) => r.split === "test")),
    },
    judgment,
    counts: {
      baseline3Train: modelA.train.n,
      baseline3Test: modelA.test.n,
      baseline4Train: modelA4.train.n,
      baseline4Test: modelA4.test.n,
      depth10Train: modelB.train.n,
      depth10Test: modelB.test.n,
    },
  }
}

export function summarizeLate(analyzed) {
  const sides = { train: [], test: [] }
  for (const block of analyzed) {
    if (!block.lateItems) continue
    sides.train.push(...block.lateItems.train)
    sides.test.push(...block.lateItems.test)
  }
  const packSide = (list) => {
    const reached = list.filter((x) => x.reachedLater20)
    const missed = list.filter((x) => !x.reachedLater20)
    return {
      n: list.length,
      reachedLater20Pct: rate(reached.length, list.length),
      reachedLater30Pct: rate(list.filter((x) => x.reachedLater30).length, list.length),
      paired20: {
        n: reached.length,
        path10to20Median: summarizeNumeric(reached.map((x) => x.pathTo20)).median,
        from10: packEntries(reached.map((x) => x.row10)),
        from20: packEntries(reached.map((x) => x.row20).filter(Boolean)),
      },
      neverReached20: packEntries(missed.map((x) => x.row10)),
    }
  }
  return { train: packSide(sides.train), test: packSide(sides.test) }
}

export function msftCase(rawBars, bench, splitFromSymbol) {
  if (!rawBars?.length) return { status: "data unavailable" }
  const bars = attachTrendFields(
    attachObservationFeatures(enrichBarsWithIndicators(rawBars), bench.spy || null, bench.qqq || null),
    bench.spy || null,
    bench.qqq || null,
  )
  const split = splitFromSymbol || timeSplitBars(bars, TRAIN_RATIO)
  const byDate = new Map(bars.map((b, i) => [b.date, i]))
  const fromIdx = Math.min(WARMUP_IDX, bars.length - 1)
  const depthEpisodes = buildTrailingDepthEpisodes(bars, fromIdx)
  const built = buildSplitBuyEpisodes(bars, FROZEN_THRESHOLDS, { fromIdx, toIdx: bars.length })
  const days = {}
  for (const date of ["2026-06-08", "2026-06-17", "2026-06-25"]) {
    const idx = byDate.get(date)
    if (idx == null) {
      days[date] = { status: "date missing" }
      continue
    }
    const row = snapshotRow(bars, idx, split.splitIdx, { symbol: "MSFT", kind: "case" })
    const ep = depthEpisodes.find((e) => idx >= e.startIdx && idx <= e.endIdx)
    const base = built.find((e) => e.openDate === date)
    days[date] = {
      ...row,
      inDepthEpisode: Boolean(ep),
      depthEpisodeStart: ep?.startDate ?? null,
      isBaselineOpen: Boolean(base),
      baselineOpenCount: base?.openCount ?? null,
    }
  }
  return { status: "ok", splitDate: split.splitDate, days }
}
