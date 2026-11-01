/**
 * Individual-stock split-entry timing study (research only).
 * First buy is the existing rising-edge 3/4 episode. Later tranches fill
 * only on the first later close that meets a pre-set Day0 drop or a
 * trading-day schedule. The path low is never the fill price.
 */

import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import { summarizeNumeric, timeSplitBars, TRAIN_RATIO } from "./daily-bottom-buy-validation-core.mjs"
import { EPISODE_DEF, FROZEN_THRESHOLDS, buildSplitBuyEpisodes } from "./daily-bottom-split-buy-sim.mjs"
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
  EPISODE_DEF,
  FROZEN_THRESHOLDS,
  TRAIN_RATIO,
  atrBand,
  assertNoEtfInStudyUniverse,
}

export const HORIZON = 60
export const DROP_STEPS = [3, 5, 7.5, 10, 15]
export const TIME_STEPS = [5, 10, 15, 20, 30]

/** Weights after the opening tranche. Sum is 1 except the cash baseline. */
export const SCHEMES = [
  { id: "A", weights: [0.5, 0.5] },
  { id: "B", weights: [0.4, 0.3, 0.3] },
  { id: "C", weights: [0.5, 0.25, 0.25] },
  { id: "D", weights: [0.4, 0.2, 0.2, 0.2] },
]
export const BASELINE = { id: "BASE", weights: [0.5] }

const FULL_EPS = 1e-9

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function rate(n, d) {
  if (!d) return null
  return round2((n / d) * 100)
}

function weightSum(weights) {
  return weights.reduce((s, w) => s + w, 0)
}

/**
 * Fill indexes for each tranche. Index 0 is the opening close.
 * A later tranche may share the previous fill's close when that close
 * already stands through the deeper Day0 line. It never uses a future low.
 * @returns {Array<number|null>|null}
 */
export function planFills(bars, openIdx, weights, rule, horizon = HORIZON) {
  const entry = bars[openIdx]?.close
  if (!(entry > 0)) return null
  const end = Math.min(bars.length - 1, openIdx + horizon)
  const fills = [openIdx]
  let prev = openIdx
  for (let k = 1; k < weights.length; k++) {
    let found = null
    if (rule.kind === "drop") {
      const line = entry * (1 - (k * rule.step) / 100)
      for (let j = prev; j <= end; j++) {
        if (j === openIdx) continue
        if (bars[j].close <= line) {
          found = j
          break
        }
      }
    } else if (rule.kind === "time") {
      const j = openIdx + k * rule.days
      if (j <= end && j > prev) found = j
    } else if (rule.kind === "timeDrop") {
      const line = entry * (1 - (k * rule.step) / 100)
      const earliest = openIdx + k * rule.days
      for (let j = Math.max(prev, earliest); j <= end; j++) {
        if (j === openIdx) continue
        if (bars[j].close <= line) {
          found = j
          break
        }
      }
    } else {
      return null
    }
    if (found == null) break
    fills.push(found)
    prev = found
  }
  while (fills.length < weights.length) fills.push(null)
  return fills
}

function navAt(bars, openIdx, weights, fills, j, field, chargeFillDay) {
  const cash = 1 - weightSum(weights)
  let nav = cash
  for (let t = 0; t < weights.length; t++) {
    const w = weights[t]
    const fi = fills[t]
    const active = fi != null && (chargeFillDay ? j >= fi : t === 0 ? j >= fi : j > fi)
    if (!active) {
      nav += w
      continue
    }
    const px = bars[j][field]
    const fp = bars[fi].close
    if (!(px > 0) || !(fp > 0)) return null
    nav += w * (px / fp)
  }
  return nav
}

function reserveHalfDay(openIdx, weights, fills) {
  let extra = 0
  for (let t = 1; t < weights.length; t++) {
    if (fills[t] == null) return null
    extra += weights[t]
    if (extra + FULL_EPS >= 0.5) return fills[t] - openIdx
  }
  return null
}

/**
 * One episode under one rule. Fills stop at the horizon close.
 * Unfilled weight stays cash. Portfolio MAE marks an add at the close,
 * so that tranche does not take the fill day's low.
 */
export function simulateEpisode(bars, openIdx, weights, rule, horizon = HORIZON) {
  if (openIdx + horizon >= bars.length) return null
  const fills = planFills(bars, openIdx, weights, rule, horizon)
  if (!fills) return null
  const entry = bars[openIdx].close
  const end = openIdx + horizon
  let minNav = Infinity
  let minLow = Infinity
  const hits = { 5: false, 10: false, 15: false }
  const fwd = {}
  for (let j = openIdx; j <= end; j++) {
    const low = bars[j].low
    if (low > 0 && low < minLow) minLow = low
    const navLow = navAt(bars, openIdx, weights, fills, j, "low", false)
    if (navLow != null && navLow < minNav) minNav = navLow
    const h = j - openIdx
    if (h === 0) continue
    const navClose = navAt(bars, openIdx, weights, fills, j, "close", true)
    if (navClose == null) continue
    const ret = (navClose - 1) * 100
    if (ret >= 5) hits[5] = true
    if (ret >= 10) hits[10] = true
    if (ret >= 15) hits[15] = true
    if (h === 20 || h === 40 || h === 60) fwd[h] = round2(ret)
  }
  const addIdx = fills.slice(1).filter((v) => v != null)
  const complete = fills.every((v) => v != null) && weightSum(weights) + FULL_EPS >= 1
  const daysToFull = complete ? fills[fills.length - 1] - openIdx : null
  let furtherAfterFull = null
  if (complete) {
    const done = fills[fills.length - 1]
    const base = bars[done].close
    let worst = base
    for (let j = done + 1; j <= end; j++) {
      if (bars[j].low > 0 && bars[j].low < worst) worst = bars[j].low
    }
    furtherAfterFull = base > 0 ? round2(((base - worst) / base) * 100) : null
  }
  return {
    addCount: addIdx.length,
    daysToNext: addIdx.length ? addIdx[0] - openIdx : null,
    daysToFull,
    reserveHalfDays: reserveHalfDay(openIdx, weights, fills),
    furtherAfterFull,
    d20: fwd[20] ?? null,
    d40: fwd[40] ?? null,
    d60: fwd[60] ?? null,
    mae: Number.isFinite(minNav) ? round2((1 - minNav) * 100) : null,
    maxDrop: entry > 0 && Number.isFinite(minLow) ? round2(((entry - minLow) / entry) * 100) : null,
    hit5: hits[5],
    hit10: hits[10],
    hit15: hits[15],
    fills,
  }
}

function addDist(rows) {
  const counts = rows.map((r) => r.addCount)
  const base = summarizeNumeric(counts)
  return {
    ...base,
    pct0: rate(counts.filter((v) => v === 0).length, rows.length),
    pct1: rate(counts.filter((v) => v === 1).length, rows.length),
    pct2: rate(counts.filter((v) => v === 2).length, rows.length),
    pct3: rate(counts.filter((v) => v === 3).length, rows.length),
    pct4plus: rate(counts.filter((v) => v >= 4).length, rows.length),
  }
}

export function packEpisodes(rows) {
  const early = rows.filter((r) => r.daysToFull != null && r.daysToFull <= 10)
  const reserve10 = rows.filter((r) => r.reserveHalfDays != null && r.reserveHalfDays <= 10)
  return {
    n: rows.length,
    addCount: addDist(rows),
    daysToNext: summarizeNumeric(rows.map((r) => r.daysToNext)),
    daysToFull: summarizeNumeric(rows.map((r) => r.daysToFull)),
    fullWithin20Pct: rate(rows.filter((r) => r.daysToFull != null && r.daysToFull <= 20).length, rows.length),
    fullWithin40Pct: rate(rows.filter((r) => r.daysToFull != null && r.daysToFull <= 40).length, rows.length),
    fullWithin60Pct: rate(rows.filter((r) => r.daysToFull != null && r.daysToFull <= 60).length, rows.length),
    incomplete60Pct: rate(rows.filter((r) => r.daysToFull == null).length, rows.length),
    fullWithin10Pct: rate(early.length, rows.length),
    reserveHalfWithin10Pct: rate(reserve10.length, rows.length),
    nEarlyFull: early.length,
    continuedDrop10AfterEarlyFullPct: rate(
      early.filter((r) => r.furtherAfterFull != null && r.furtherAfterFull >= 10).length,
      early.length,
    ),
    furtherAfterEarlyFull: summarizeNumeric(early.map((r) => r.furtherAfterFull)),
    d20: summarizeNumeric(rows.map((r) => r.d20)),
    d40: summarizeNumeric(rows.map((r) => r.d40)),
    d60: summarizeNumeric(rows.map((r) => r.d60)),
    mae: summarizeNumeric(rows.map((r) => r.mae)),
    maxDrop: summarizeNumeric(rows.map((r) => r.maxDrop)),
    hit5Pct: rate(rows.filter((r) => r.hit5).length, rows.length),
    hit10Pct: rate(rows.filter((r) => r.hit10).length, rows.length),
    hit15Pct: rate(rows.filter((r) => r.hit15).length, rows.length),
  }
}

export function slicePacks(rows) {
  return {
    all: packEpisodes(rows),
    start3: packEpisodes(rows.filter((r) => r.start === "3/4")),
    start4: packEpisodes(rows.filter((r) => r.start === "4/4")),
    atr: {
      lt3: packEpisodes(rows.filter((r) => r.atrBand === "lt3")),
      b3_4: packEpisodes(rows.filter((r) => r.atrBand === "b3_4")),
      ge4: packEpisodes(rows.filter((r) => r.atrBand === "ge4")),
    },
  }
}

function applyRule(bars, episodes, weights, rule) {
  const rows = []
  for (const ep of episodes) {
    const sim = simulateEpisode(bars, ep.openIdx, weights, rule)
    if (!sim) continue
    rows.push({
      split: ep.split,
      start: ep.start,
      atrBand: ep.atrBand,
      ...sim,
    })
  }
  return rows
}

function bySplit(rows) {
  return {
    train: slicePacks(rows.filter((r) => r.split === "train")),
    test: slicePacks(rows.filter((r) => r.split === "test")),
  }
}

export function collectEpisodes(bars, splitIdx, symbol) {
  const fromIdx = Math.min(WARMUP_IDX, Math.max(0, bars.length - 1))
  const built = buildSplitBuyEpisodes(bars, FROZEN_THRESHOLDS, { fromIdx, toIdx: bars.length })
  let shortHorizon = 0
  const episodes = []
  for (const ep of built) {
    if (ep.openIdx + HORIZON >= bars.length) {
      shortHorizon += 1
      continue
    }
    const b = bars[ep.openIdx]
    episodes.push({
      symbol,
      date: b.date,
      openIdx: ep.openIdx,
      openCount: ep.openCount,
      start: ep.openCount >= 4 ? "4/4" : "3/4",
      split: ep.openIdx < splitIdx ? "train" : "test",
      atrPct: b.atrPct ?? null,
      atrBand: atrBand(b.atrPct),
    })
  }
  return { episodes, built: built.length, shortHorizon }
}

export function analyzeSplitEntrySymbol(meta, rawBars) {
  if (!rawBars?.length || rawBars.length < MIN_BARS) {
    return {
      symbol: meta.symbol,
      status: rawBars?.length ? "insufficient history" : "data unavailable",
      episodes: [],
      split: null,
      shortHorizon: 0,
      built: 0,
    }
  }
  const bars = attachObservationFeatures(enrichBarsWithIndicators(rawBars))
  const split = timeSplitBars(bars, TRAIN_RATIO)
  const collected = collectEpisodes(bars, split.splitIdx, meta.symbol)
  return { symbol: meta.symbol, status: "ok", split, bars, ...collected }
}

function nestSchemes(episodesBySymbol, specs) {
  const tree = {}
  for (const spec of specs) {
    const rows = []
    for (const block of episodesBySymbol) {
      if (!block.bars) continue
      rows.push(...applyRule(block.bars, block.episodes, spec.weights, spec.rule))
    }
    const packed = bySplit(rows)
    let node = tree
    for (let i = 0; i < spec.path.length - 1; i++) {
      node[spec.path[i]] = node[spec.path[i]] || {}
      node = node[spec.path[i]]
    }
    node[spec.path[spec.path.length - 1]] = packed
  }
  return tree
}

export function ruleSpecs() {
  const specs = [
    { weights: BASELINE.weights, rule: { kind: "drop", step: 100 }, path: ["baseline"] },
  ]
  for (const scheme of SCHEMES) {
    for (const step of DROP_STEPS) {
      specs.push({
        weights: scheme.weights,
        rule: { kind: "drop", step },
        path: ["drop", scheme.id, String(step)],
      })
    }
    for (const days of TIME_STEPS) {
      specs.push({
        weights: scheme.weights,
        rule: { kind: "time", days },
        path: ["time", scheme.id, String(days)],
      })
    }
    for (const days of TIME_STEPS) {
      for (const step of DROP_STEPS) {
        specs.push({
          weights: scheme.weights,
          rule: { kind: "timeDrop", days, step },
          path: ["timeDrop", scheme.id, String(days), String(step)],
        })
      }
    }
  }
  return specs
}

function digest(pack) {
  if (!pack) return null
  const a = pack.all
  return {
    n: a.n,
    addMean: a.addCount.mean,
    addMedian: a.addCount.median,
    pct0: a.addCount.pct0,
    pct1: a.addCount.pct1,
    pct2: a.addCount.pct2,
    pct3: a.addCount.pct3,
    pct4plus: a.addCount.pct4plus,
    daysToNextMean: a.daysToNext.mean,
    daysToNextMedian: a.daysToNext.median,
    daysToNextP25: a.daysToNext.p25,
    daysToNextP75: a.daysToNext.p75,
    daysToNextN: a.daysToNext.n,
    daysToFullMean: a.daysToFull.mean,
    daysToFullMedian: a.daysToFull.median,
    daysToFullP25: a.daysToFull.p25,
    daysToFullP75: a.daysToFull.p75,
    daysToFullN: a.daysToFull.n,
    fullWithin20Pct: a.fullWithin20Pct,
    fullWithin40Pct: a.fullWithin40Pct,
    fullWithin60Pct: a.fullWithin60Pct,
    incomplete60Pct: a.incomplete60Pct,
    fullWithin10Pct: a.fullWithin10Pct,
    reserveHalfWithin10Pct: a.reserveHalfWithin10Pct,
    continuedDrop10AfterEarlyFullPct: a.continuedDrop10AfterEarlyFullPct,
    furtherAfterEarlyFullMedian: a.furtherAfterEarlyFull.median,
    maeMedian: a.mae.median,
    maeMean: a.mae.mean,
    maxDropMedian: a.maxDrop.median,
    d20Median: a.d20.median,
    d40Median: a.d40.median,
    d60Median: a.d60.median,
    hit5Pct: a.hit5Pct,
    hit10Pct: a.hit10Pct,
    hit15Pct: a.hit15Pct,
  }
}

function side(node) {
  return { train: digest(node?.train), test: digest(node?.test) }
}

function gap(train, test, key) {
  if (train?.[key] == null || test?.[key] == null) return null
  return round2(test[key] - train[key])
}

export function buildQuestions(tree, coverage) {
  const dropSteps = ["5", "10", "15"]
  const schemes = SCHEMES.map((s) => s.id)
  const drop = {}
  const time = {}
  for (const id of schemes) {
    drop[id] = {}
    time[id] = {}
    for (const step of DROP_STEPS) drop[id][String(step)] = side(tree.drop?.[id]?.[String(step)])
    for (const days of TIME_STEPS) time[id][String(days)] = side(tree.time?.[id]?.[String(days)])
  }
  const bothA = {}
  for (const days of ["10", "20"]) {
    bothA[days] = {}
    for (const step of dropSteps) bothA[days][step] = side(tree.timeDrop?.A?.[days]?.[step])
  }
  const compare = []
  for (const id of schemes) {
    for (const step of dropSteps) {
      const row = drop[id][step]
      compare.push({
        rule: `drop ${id} -${step}%`,
        train: row.train,
        test: row.test,
        gap: {
          addMean: gap(row.train, row.test, "addMean"),
          daysToNextMedian: gap(row.train, row.test, "daysToNextMedian"),
          daysToFullMedian: gap(row.train, row.test, "daysToFullMedian"),
          incomplete60Pct: gap(row.train, row.test, "incomplete60Pct"),
          reserveHalfWithin10Pct: gap(row.train, row.test, "reserveHalfWithin10Pct"),
          maeMedian: gap(row.train, row.test, "maeMedian"),
          d60Median: gap(row.train, row.test, "d60Median"),
        },
      })
    }
  }
  const a10 = tree.drop?.A?.["10"]
  return {
    note: "Train describes the schedules. Test is shown beside it and is not used to retune a step, a weight, or an interval.",
    coverage,
    baseline: side(tree.baseline),
    drop,
    time,
    timeAndDropA: bothA,
    atrDropA10: {
      train: {
        lt3: digest(a10?.train?.atr?.lt3 ? { all: a10.train.atr.lt3 } : null),
        b3_4: digest(a10?.train?.atr?.b3_4 ? { all: a10.train.atr.b3_4 } : null),
        ge4: digest(a10?.train?.atr?.ge4 ? { all: a10.train.atr.ge4 } : null),
      },
      test: {
        lt3: digest(a10?.test?.atr?.lt3 ? { all: a10.test.atr.lt3 } : null),
        b3_4: digest(a10?.test?.atr?.b3_4 ? { all: a10.test.atr.b3_4 } : null),
        ge4: digest(a10?.test?.atr?.ge4 ? { all: a10.test.atr.ge4 } : null),
      },
    },
    startDropA10: {
      train: {
        "3/4": digest(a10?.train?.start3 ? { all: a10.train.start3 } : null),
        "4/4": digest(a10?.train?.start4 ? { all: a10.train.start4 } : null),
      },
      test: {
        "3/4": digest(a10?.test?.start3 ? { all: a10.test.start3 } : null),
        "4/4": digest(a10?.test?.start4 ? { all: a10.test.start4 } : null),
      },
    },
    trainTestGaps: compare,
  }
}

export function poolSplitEntry(blocks) {
  const ready = blocks.filter((b) => b.status === "ok")
  const tree = nestSchemes(ready, ruleSpecs())
  const episodes = ready.flatMap((b) => b.episodes)
  const coverage = {
    symbols: EQUITY_CANDIDATES.length,
    withData: ready.length,
    episodesBuilt: ready.reduce((s, b) => s + b.built, 0),
    shortHorizonExcluded: ready.reduce((s, b) => s + b.shortHorizon, 0),
    sample: episodes.length,
    train: episodes.filter((e) => e.split === "train").length,
    test: episodes.filter((e) => e.split === "test").length,
    trainStart3: episodes.filter((e) => e.split === "train" && e.start === "3/4").length,
    trainStart4: episodes.filter((e) => e.split === "train" && e.start === "4/4").length,
    testStart3: episodes.filter((e) => e.split === "test" && e.start === "3/4").length,
    testStart4: episodes.filter((e) => e.split === "test" && e.start === "4/4").length,
    trainAtr: {
      lt3: episodes.filter((e) => e.split === "train" && e.atrBand === "lt3").length,
      b3_4: episodes.filter((e) => e.split === "train" && e.atrBand === "b3_4").length,
      ge4: episodes.filter((e) => e.split === "train" && e.atrBand === "ge4").length,
    },
    testAtr: {
      lt3: episodes.filter((e) => e.split === "test" && e.atrBand === "lt3").length,
      b3_4: episodes.filter((e) => e.split === "test" && e.atrBand === "b3_4").length,
      ge4: episodes.filter((e) => e.split === "test" && e.atrBand === "ge4").length,
    },
    dataStart: ready.map((b) => b.split?.dataStart).filter(Boolean).sort()[0] ?? null,
    dataEnd: ready.map((b) => b.split?.dataEnd).filter(Boolean).sort().at(-1) ?? null,
    splitDateMin: ready.map((b) => b.split?.splitDate).filter(Boolean).sort()[0] ?? null,
    splitDateMax: ready.map((b) => b.split?.splitDate).filter(Boolean).sort().at(-1) ?? null,
  }
  return { coverage, ...tree, questions: buildQuestions(tree, coverage) }
}
