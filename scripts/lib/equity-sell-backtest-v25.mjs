/**
 * US single-stock early-recovery study v25 (research only).
 *
 * Asks whether the T+3 recovery already separates later outcomes, and how
 * close that early signal stays to the T+5 recovery from v24.
 * A T+3 predictor uses closes through T+3 only. A T+5 predictor uses closes
 * through T+5 only. Window, T+10, T+20, T+40, and the final low are outcomes.
 * No sell rule is selected. v1–v24 files are not modified.
 *
 * State priority at each checkpoint, fixed before outcomes:
 * 1. RECOVERING: current return is strictly above the previous checkpoint
 *    and the current MAE is not deeper.
 * 2. STABILIZING: current return is at or above the previous checkpoint
 *    and the current MAE is strictly deeper.
 * 3. STILL_FALLING: every remaining path.
 * T+3 compares T+3 with T+1. T+5 compares T+5 with T+3.
 *
 * Strong support is locked here, before the sample is scored:
 * both T+3 groups have n>=20, the window gap is positive, the 10,000-trial
 * window CI sits above 0, the T+3 recovery beta stays positive after T+3
 * depth, A→B improves on all three window splits, T+3 stays close to T+5
 * on all three window splits, and leave-one-ticker-out does not flip sign.
 * Close means the T+3/T+5 OOS R² ratio and Spearman ratio are at least 0.70
 * when T+5 OOS R² exceeds 0.02; otherwise T+3 OOS R² is within 0.02 of T+5.
 * Partial support needs the depth-controlled in-sample gain, or A→B on at
 * least two window splits. A positive gap alone is not partial support.
 */

import { createHash } from "node:crypto"
import { dateIndex } from "./equity-sell-backtest-v3.mjs"
import { mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { leaveOneCorrelation, sampleStdev } from "./equity-sell-backtest-v7.mjs"
import { chronologicalSplit, scoreClass, scoreContinuous } from "./equity-sell-backtest-v18.mjs"
import { SPLIT_FRACTIONS, assertV18Split, improves, metricDelta } from "./equity-sell-backtest-v19.mjs"
import {
  SELECTED_STRATEGY as V23_SELECTED_STRATEGY,
  assertBaseline,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  loadOhlcv,
  measureCheckpoint,
  pathType,
  selectMildEvents,
} from "./equity-sell-backtest-v23.mjs"
import { recoveryPoint, recoveryState } from "./equity-sell-backtest-v24.mjs"

export {
  SPLIT_FRACTIONS,
  assertBaseline,
  assertV18Split,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  chronologicalSplit,
  dateIndex,
  loadOhlcv,
  measureCheckpoint,
  pathType,
  recoveryPoint,
  recoveryState,
  selectMildEvents,
}

export const SELECTED_STRATEGY = null
export const BOOTSTRAP = 10000
export const VIF_LIMIT = 5
export const CLOSE_RATIO = 0.7
export const CLOSE_R2_FLOOR = 0.02
export const EXPECTED_EVENT_HASH = "ee62b52e68befa38133839e99ca81db178a5a2edc1acd4167d949d5431eb7818"
const STATES = ["RECOVERING", "STABILIZING", "STILL_FALLING"]
const PRIMARY_TRANSITIONS = [
  ["RECOVERING", "RECOVERING"],
  ["RECOVERING", "STILL_FALLING"],
  ["STILL_FALLING", "RECOVERING"],
  ["STILL_FALLING", "STILL_FALLING"],
]
const T3_MODELS = {
  M0: ["t0"],
  M1: ["t0", "leadership"],
  M2: ["t0", "leadership", "eventAtr"],
  M3: ["t0", "leadership", "eventAtr", "depth"],
  M4: ["t0", "leadership", "eventAtr", "recovery"],
  M5: ["t0", "leadership", "eventAtr", "depth", "recovery"],
}
const RATIO_MODELS = {
  M2: ["t0", "leadership", "eventAtr"],
  M3: ["t0", "leadership", "eventAtr", "depth"],
  M4: ["t0", "leadership", "eventAtr", "ratio"],
  M5: ["t0", "leadership", "eventAtr", "depth", "ratio"],
}
const OOS_FIELDS = {
  A: ["t0", "leadership", "eventAtr"],
  B: ["t0", "leadership", "eventAtr", "recoveryT3"],
  C: ["t0", "leadership", "eventAtr", "recoveryT5"],
  D: ["t0", "leadership", "eventAtr", "recoveryT3", "recoveryT5"],
}
const CLASS_FIELDS = {
  A: ["t0", "leadership", "eventAtr"],
  B: ["t0", "leadership", "eventAtr", "recoveryT3"],
  S: ["t0", "leadership", "eventAtr", "stateT3"],
}

function finite(value) {
  return Number.isFinite(value)
}

function round2(value) {
  return finite(value) ? Math.round(value * 100) / 100 : null
}

function round4(value) {
  return finite(value) ? Math.round(value * 10000) / 10000 : null
}

function pct(value) {
  return finite(value) ? round2(value * 100) : null
}

function conclusion(n) {
  if (n < 10) return "결론 금지"
  if (n < 20) return "수치만"
  return "제한적"
}

function share(flags) {
  if (!flags.length) return null
  return round2((flags.filter(Boolean).length / flags.length) * 100)
}

export function assertEventList(events) {
  const keys = events.map((event) => `${event.eventId}|${event.t0Date}`).sort()
  const hash = createHash("sha256").update(keys.join("\n")).digest("hex")
  if (keys.length !== 103 || hash !== EXPECTED_EVENT_HASH) {
    throw new Error(`event list drifted from v24 (${keys.length}, ${hash})`)
  }
}

export function attachEarly(events) {
  const out = events.map((event) => {
    if (!event.shape?.t1 || !event.shape?.t3 || !event.shape?.t5) throw new Error(`checkpoint path missing ${event.eventId}`)
    const t1 = recoveryPoint(event.shape.t1)
    const t3 = recoveryPoint(event.shape.t3)
    const t5 = recoveryPoint(event.shape.t5)
    t1.recentSlope = event.shape.t1.recentSlope
    t3.recentSlope = event.shape.t3.recentSlope
    t5.recentSlope = event.shape.t5.recentSlope
    return {
      ...event,
      early: {
        t1,
        t3,
        t5,
        stateT3: recoveryState(t1, t3),
        stateT5: recoveryState(t3, t5),
      },
    }
  })
  out.bandCounts = events.bandCounts
  return out
}

function level(values) {
  const xs = values.filter(finite)
  return {
    n: xs.length,
    mean: pct(xs.length ? mean(xs) : null),
    median: pct(xs.length ? median(xs) : null),
    winRate: share(xs.map((value) => value > 0)),
  }
}

function outcomeBlock(rows) {
  const lows = rows.filter((event) => event.hold.lowDay != null)
  const days = lows.map((event) => (event.hold.hits["10"].reached ? event.hold.hits["10"].days : null)).filter(finite)
  return {
    n: rows.length,
    conclusion: conclusion(rows.length),
    t10: level(rows.map((event) => event.hold.returns.t10)).mean,
    t20: level(rows.map((event) => event.hold.returns.t20)).mean,
    t40: level(rows.map((event) => event.hold.returns.t40)).mean,
    window: level(rows.map((event) => event.hold.returns.window)),
    lowToWindow: level(rows.map((event) => event.hold.lowTo.window)).mean,
    hit10: lows.length ? round2((days.length / lows.length) * 100) : null,
    hit10MedianDays: days.length ? median(days) : null,
  }
}

function linkTo(rows, readX, readY) {
  const pairs = rows.map((event) => ({ x: readX(event), y: readY(event) })).filter((pair) => finite(pair.x) && finite(pair.y))
  const xs = pairs.map((pair) => pair.x)
  if (xs.length < 3 || !(sampleStdev(xs) > 0)) {
    return { n: pairs.length, spearman: null, conclusion: "정의상 상수" }
  }
  const link = spearman(pairs)
  return { n: link.n, spearman: link.rho, conclusion: conclusion(link.n) }
}

function correlationTable(events) {
  const targets = [
    ["window", (event) => event.hold.returns.window],
    ["t20", (event) => event.hold.returns.t20],
    ["t40", (event) => event.hold.returns.t40],
    ["hit10", (event) => (event.hold.hits["10"].reached ? event.hold.hits["10"].days : null)],
  ]
  const table = {}
  for (const key of ["t1", "t3", "t5"]) {
    table[key] = { fromMae: {}, ratio: {} }
    for (const [name, readY] of targets) {
      table[key].fromMae[name] = linkTo(events, (event) => event.early[key].fromMae, readY)
      table[key].ratio[name] = linkTo(events, (event) => event.early[key].ratio, readY)
    }
  }
  return table
}

function solveLinear(matrix, vector) {
  const n = vector.length
  const rows = matrix.map((row, index) => [...row, vector[index]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row
    const swap = rows[col]
    rows[col] = rows[pivot]
    rows[pivot] = swap
    const scale = rows[col][col]
    if (!finite(scale) || Math.abs(scale) < 1e-12) return null
    for (let col2 = col; col2 <= n; col2++) rows[col][col2] /= scale
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = rows[row][col]
      for (let col2 = col; col2 <= n; col2++) rows[row][col2] -= factor * rows[col][col2]
    }
  }
  return rows.map((row) => row[n])
}

function ols(rows, keys) {
  const p = keys.length + 1
  if (rows.length <= p) return null
  const xtx = Array.from({ length: p }, () => Array(p).fill(0))
  const xty = Array(p).fill(0)
  for (const row of rows) {
    const x = [1, ...keys.map((key) => row[key])]
    for (let i = 0; i < p; i++) {
      xty[i] += x[i] * row.y
      for (let j = 0; j < p; j++) xtx[i][j] += x[i] * x[j]
    }
  }
  return solveLinear(xtx, xty)
}

function frameOf(event) {
  return {
    t0: event.predictors.t0,
    leadership: event.predictors.leadership,
    eventAtr: event.predictors.atrPct,
    depth: event.early.t3.depth,
    recovery: event.early.t3.fromMae,
    ratio: event.early.t3.ratio,
    recoveryT3: event.early.t3.fromMae,
    recoveryT5: event.early.t5.fromMae,
    stateT3: event.early.stateT3 === "RECOVERING" ? 1 : 0,
  }
}

function design(events, yRead, fields) {
  const rows = []
  for (const event of events) {
    const y = yRead(event)
    const frame = frameOf(event)
    if (!finite(y) || fields.some((field) => !finite(frame[field]))) continue
    const row = { y }
    for (const field of fields) row[field] = frame[field]
    rows.push(row)
  }
  return rows
}

function columnStats(rows, keys) {
  const stats = {}
  for (const key of keys) {
    const values = rows.map((row) => row[key])
    stats[key] = { mean: mean(values), sd: sampleStdev(values) }
  }
  return stats
}

function scaleRows(rows, keys, stats) {
  return rows.map((row) => {
    const scaled = { y: row.y }
    for (const key of keys) {
      if (!(stats[key].sd > 0)) return null
      scaled[key] = (row[key] - stats[key].mean) / stats[key].sd
    }
    return scaled
  })
}

export function fitFields(trainEvents, testEvents, yRead, fields) {
  const trainRows = design(trainEvents, yRead, fields)
  const testRows = design(testEvents, yRead, fields)
  const stats = columnStats(trainRows, fields)
  if (fields.some((field) => !(stats[field]?.sd > 0))) return { skipped: "no variation" }
  const scaledTrain = scaleRows(trainRows, fields, stats)
  const scaledTest = scaleRows(testRows, fields, stats)
  if (!scaledTrain.length || scaledTrain.some((row) => row == null) || scaledTest.some((row) => row == null)) return null
  const beta = ols(scaledTrain, fields)
  if (!beta) return null
  const predict = (rows) => rows.map((row) => beta[0] + fields.reduce((sum, field, index) => sum + beta[index + 1] * row[field], 0))
  const trainScore = scoreContinuous(trainRows.map((row) => row.y), predict(scaledTrain), 100)
  const deviation = sampleStdev(trainRows.map((row) => row.y))
  const standardized = deviation > 0 ? Object.fromEntries(fields.map((field, index) => [field, round4(beta[index + 1] / deviation)])) : null
  const p = fields.length + 1
  const adjusted = trainScore.oosR2 == null || trainRows.length <= p
    ? null
    : round4(1 - ((1 - trainScore.oosR2) * (trainRows.length - 1)) / (trainRows.length - p))
  return {
    train: {
      n: trainRows.length,
      r2: trainScore.oosR2,
      adjustedR2: adjusted,
      spearman: trainScore.spearman,
      mae: trainScore.mae,
      rmse: trainScore.rmse,
      standardized,
    },
    test: scoreContinuous(testRows.map((row) => row.y), predict(scaledTest), 100),
  }
}

function r2Of(rows, yKey, keys) {
  const beta = ols(rows.map((row) => ({ ...row, y: row[yKey] })), keys)
  if (!beta) return null
  return scoreContinuous(rows.map((row) => row[yKey]), rows.map((row) => beta[0] + keys.reduce((sum, key, index) => sum + beta[index + 1] * row[key], 0)), 1).oosR2
}

function overlapOf(events, left, right) {
  const rows = events.map(frameOf).filter((row) => finite(row[left]) && finite(row[right]))
  const score = r2Of(rows, left, [right])
  const vif = score == null || score >= 0.9999 ? null : round2(1 / (1 - score))
  return {
    n: rows.length,
    spearman: linkTo(rows, (row) => row[left], (row) => row[right]),
    vif,
    joint: !finite(vif) || vif >= VIF_LIMIT ? "skipped" : "fit",
  }
}

function publicTrain(fit) {
  if (!fit?.skipped) return fit?.train || null
  return fit
}

function deltaOf(rich, base) {
  return metricDelta(
    rich?.r2 == null ? null : { test: { n: rich.n, oosR2: rich.r2, spearman: rich.spearman, pearson: null, mae: rich.mae, rmse: rich.rmse } },
    base?.r2 == null ? null : { test: { n: base.n, oosR2: base.r2, spearman: base.spearman, pearson: null, mae: base.mae, rmse: base.rmse } },
  )
}

function inSample(events, yRead, spec, overlap, jointFields) {
  const fitted = {}
  for (const [id, fields] of Object.entries(spec)) {
    const joint = jointFields.every((field) => fields.includes(field))
    if (joint && overlap.joint === "skipped") fitted[id] = { skipped: "VIF" }
    else fitted[id] = publicTrain(fitFields(events, events, yRead, fields))
  }
  return { ...fitted, m2m4: deltaOf(fitted.M4, fitted.M2), m3m5: deltaOf(fitted.M5, fitted.M3) }
}

function packTest(fit) {
  if (!fit || fit.skipped || !fit.test) return fit?.skipped ? fit : null
  return {
    n: fit.test.n,
    oosR2: fit.test.oosR2,
    pearson: fit.test.pearson,
    spearman: fit.test.spearman,
    mae: fit.test.mae,
    rmse: fit.test.rmse,
    standardized: fit.train.standardized,
    conclusion: conclusion(fit.test.n),
  }
}

export function closeToLater(early, later) {
  if (!early || !later || !finite(early.oosR2) || !finite(later.oosR2) || !finite(early.spearman) || !finite(later.spearman)) return false
  if (!(early.spearman > 0)) return false
  if (later.oosR2 > CLOSE_R2_FLOOR) {
    if (!(later.oosR2 > 0) || early.oosR2 / later.oosR2 < CLOSE_RATIO) return false
    if (later.spearman > 0 && early.spearman / later.spearman < CLOSE_RATIO) return false
    return true
  }
  return early.oosR2 >= later.oosR2 - CLOSE_R2_FLOOR
}

function oosBlock(events, pairOverlap) {
  const targets = {
    window: (event) => event.hold.returns.window,
    t20: (event) => event.hold.returns.t20,
  }
  const out = {}
  for (const [name, fraction] of SPLIT_FRACTIONS) {
    const split = chronologicalSplit(events, fraction)
    out[name] = {}
    for (const [target, yRead] of Object.entries(targets)) {
      const fits = {}
      for (const [id, fields] of Object.entries(OOS_FIELDS)) {
        if (id === "D" && pairOverlap.joint === "skipped") fits[id] = { skipped: "VIF" }
        else fits[id] = packTest(fitFields(split.train, split.test, yRead, fields))
      }
      const delta = (richId, baseId) => metricDelta(
        fits[richId]?.oosR2 == null ? null : { test: fits[richId] },
        fits[baseId]?.oosR2 == null ? null : { test: fits[baseId] },
      )
      const aToB = delta("B", "A")
      const aToC = delta("C", "A")
      const bToC = delta("C", "B")
      const bToD = delta("D", "B")
      const cToD = delta("D", "C")
      out[name][target] = {
        ...fits,
        aToB,
        aToC,
        bToC,
        bToD,
        cToD,
        aToBImproves: improves(aToB),
        aToCImproves: improves(aToC),
        bToCImproves: improves(bToC),
        bToDImproves: improves(bToD),
        cToDImproves: improves(cToD),
        proximity: {
          r2Ratio: fits.C?.oosR2 > 0 && finite(fits.B?.oosR2) ? round4(fits.B.oosR2 / fits.C.oosR2) : null,
          spearmanRatio: fits.C?.spearman > 0 && finite(fits.B?.spearman) ? round4(fits.B.spearman / fits.C.spearman) : null,
          close: closeToLater(fits.B, fits.C),
        },
      }
    }
  }
  return out
}

function sigmoid(value) {
  if (value >= 0) return 1 / (1 + Math.exp(-value))
  const exp = Math.exp(value)
  return exp / (1 + exp)
}

function fitLogit(rows, keys) {
  const labels = new Set(rows.map((row) => row.y))
  if (labels.size < 2 || rows.length <= keys.length + 1) return null
  const xRows = rows.map((row) => [1, ...keys.map((key) => row[key])])
  let beta = Array(keys.length + 1).fill(0)
  for (let iter = 0; iter < 80; iter++) {
    const xtwx = Array.from({ length: beta.length }, () => Array(beta.length).fill(0))
    const xtwz = Array(beta.length).fill(0)
    for (let i = 0; i < rows.length; i++) {
      const eta = xRows[i].reduce((sum, value, index) => sum + value * beta[index], 0)
      const pHat = sigmoid(eta)
      const weight = Math.max(pHat * (1 - pHat), 1e-6)
      const z = eta + (rows[i].y - pHat) / weight
      for (let a = 0; a < beta.length; a++) {
        xtwz[a] += xRows[i][a] * weight * z
        for (let b = 0; b < beta.length; b++) xtwx[a][b] += xRows[i][a] * weight * xRows[i][b]
      }
    }
    const next = solveLinear(xtwx, xtwz)
    if (!next || next.some((value) => !finite(value))) return null
    const moved = Math.max(...next.map((value, index) => Math.abs(value - beta[index])))
    beta = next
    if (moved < 1e-8) return beta
  }
  return beta
}

function classScore(trainEvents, testEvents, yRead, fields) {
  const trainRows = design(trainEvents, yRead, fields)
  const testRows = design(testEvents, yRead, fields)
  const stats = columnStats(trainRows, fields)
  if (fields.some((field) => !(stats[field]?.sd > 0))) return { skipped: "no variation" }
  const scaledTrain = scaleRows(trainRows, fields, stats)
  const scaledTest = scaleRows(testRows, fields, stats)
  if (scaledTrain.some((row) => row == null) || scaledTest.some((row) => row == null)) return null
  const beta = fitLogit(scaledTrain, fields)
  if (!beta) return null
  const score = (rows) => rows.map((row) => sigmoid(beta[0] + fields.reduce((sum, field, index) => sum + beta[index + 1] * row[field], 0)))
  const scored = scoreClass(testRows.map((row) => row.y), score(scaledTest), mean(trainRows.map((row) => row.y)))
  return { n: scored.n, rocAuc: scored.rocAuc, balancedAccuracy: scored.balancedAccuracy, brier: scored.brier, conclusion: conclusion(scored.n) }
}

function classBlock(events) {
  const targets = {
    windowPositive: (event) => (finite(event.hold.returns.window) ? (event.hold.returns.window > 0 ? 1 : 0) : null),
    window10: (event) => (finite(event.hold.returns.window) ? (event.hold.returns.window >= 0.1 ? 1 : 0) : null),
    t20Positive: (event) => (finite(event.hold.returns.t20) ? (event.hold.returns.t20 > 0 ? 1 : 0) : null),
  }
  const out = {}
  for (const [name, fraction] of SPLIT_FRACTIONS) {
    const split = chronologicalSplit(events, fraction)
    out[name] = {}
    for (const [target, yRead] of Object.entries(targets)) {
      out[name][target] = {}
      for (const [id, fields] of Object.entries(CLASS_FIELDS)) {
        out[name][target][id] = classScore(split.train, split.test, yRead, fields)
      }
    }
  }
  return out
}

function tickerLink(events, readX, readY) {
  const usable = events.filter((event) => finite(readX(event)) && finite(readY(event)))
  const eventLink = spearman(usable.map((event) => ({ x: readX(event), y: readY(event) })))
  const groups = new Map()
  for (const event of usable) {
    const group = groups.get(event.ticker) ?? { x: [], y: [] }
    group.x.push(readX(event))
    group.y.push(readY(event))
    groups.set(event.ticker, group)
  }
  const byTicker = spearman([...groups].map(([, group]) => ({ x: mean(group.x), y: mean(group.y) })))
  const leave = groups.size ? leaveOneCorrelation(usable, readX, readY) : null
  return {
    eventWeighted: { n: eventLink.n, spearman: eventLink.rho },
    tickerWeighted: { tickers: groups.size, spearman: byTicker.rho, maxEvents: groups.size ? Math.max(...[...groups].map(([, group]) => group.y.length)) : 0 },
    leaveOneTicker: leave ? { baseline: leave.baseline.rho, min: leave.min, max: leave.max, median: leave.median, signFlips: leave.signFlips } : null,
    withinStock: "결론 금지",
  }
}

function ratioDistribution(events, key) {
  const values = events.map((event) => event.early[key].ratio)
  const finiteValues = values.filter(finite).sort((a, b) => a - b)
  const at = (q) => (finiteValues.length ? finiteValues[Math.min(finiteValues.length - 1, Math.floor(q * (finiteValues.length - 1)))] : null)
  return {
    n: events.length,
    missing: values.filter((value) => !finite(value)).length,
    min: round4(finiteValues[0]),
    p10: round4(at(0.1)),
    median: round4(at(0.5)),
    p90: round4(at(0.9)),
    max: round4(finiteValues[finiteValues.length - 1]),
  }
}

function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function resample(values, random) {
  const out = []
  for (let i = 0; i < values.length; i++) out.push(values[Math.floor(random() * values.length)])
  return out
}

export function bootstrapDiff(left, right, trials, seed, asPercent = true) {
  if (left.length < 2 || right.length < 2) return null
  const actual = mean(left) - mean(right)
  const random = mulberry32(seed)
  const boots = []
  for (let trial = 0; trial < trials; trial++) boots.push(mean(resample(left, random)) - mean(resample(right, random)))
  boots.sort((a, b) => a - b)
  const pool = [...left, ...right]
  let extreme = 0
  for (let trial = 0; trial < trials; trial++) {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      const swap = pool[i]
      pool[i] = pool[j]
      pool[j] = swap
    }
    const diff = mean(pool.slice(0, left.length)) - mean(pool.slice(left.length))
    if (Math.abs(diff) >= Math.abs(actual)) extreme += 1
  }
  const show = (value) => (asPercent ? pct(value) : round4(value))
  return {
    nLeft: left.length,
    nRight: right.length,
    meanDiff: show(actual),
    ci95: [show(boots[Math.floor(0.025 * trials)]), show(boots[Math.ceil(0.975 * trials) - 1])],
    permutationTail: round4(extreme / trials),
    usable: left.length >= 10 && right.length >= 10,
  }
}

function valuesOf(rows, read) {
  return rows.map(read).filter(finite)
}

export function judgeEarly(input) {
  const gapClear = input.recoverN >= 20 && input.fallN >= 20 && finite(input.windowGap) && input.windowGap > 0 && finite(input.windowCiLow) && input.windowCiLow > 0
  const betaHolds = finite(input.recoveryBeta) && input.recoveryBeta > 0 && input.depthControlledImproves === true
  const oos = ["70", "60", "50"].every((split) => input.aToB[split] === true)
  const close = ["70", "60", "50"].every((split) => input.close[split] === true)
  const ticker = finite(input.looMin) && input.looMin > 0 && !(input.signFlips || []).length
  if (gapClear && betaHolds && oos && close && ticker) return { label: "조기 회복 신호: 강하게 지지" }
  const someOos = ["70", "60", "50"].filter((split) => input.aToB[split] === true).length
  if (betaHolds || someOos >= 2) return { label: "조기 회복 신호: 부분적으로 지지" }
  return { label: "조기 회복 신호: 확인 실패" }
}

function cellGrid(events, readGroup) {
  const names = [...new Set(events.map(readGroup))].filter((name) => name != null)
  const out = {}
  for (const name of names) {
    out[name] = {}
    for (const state of STATES) {
      out[name][state] = outcomeBlock(events.filter((event) => readGroup(event) === name && event.early.stateT3 === state))
    }
  }
  return out
}

function transitionBlock(events) {
  const primary = {}
  for (const [from, to] of PRIMARY_TRANSITIONS) {
    primary[`${from}→${to}`] = outcomeBlock(events.filter((event) => event.early.stateT3 === from && event.early.stateT5 === to))
  }
  const full = {}
  for (const from of STATES) {
    full[from] = {}
    for (const to of STATES) {
      full[from][to] = outcomeBlock(events.filter((event) => event.early.stateT3 === from && event.early.stateT5 === to))
    }
  }
  return { primary, full }
}

function sameNumber(left, right) {
  if (left == null || right == null) return left == null && right == null
  return Math.abs(left - right) < 1e-10
}

function checkpointFromCloses(closes, t0Idx, offset) {
  const measured = measureCheckpoint(closes, t0Idx, offset)
  const point = recoveryPoint(measured)
  if (point && measured) point.recentSlope = measured.recentSlope
  return point
}

export function auditLookAhead(events, seriesBySymbol) {
  let checked = 0
  for (const event of events) {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`look-ahead series missing ${event.eventId}`)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    if (t0Idx < 0) throw new Error(`look-ahead date missing ${event.eventId}`)
    const limits = { t3: 3, t5: 5 }
    for (const [key, offset] of Object.entries(limits)) {
      const sliced = checkpointFromCloses(series.closes.slice(0, t0Idx + offset + 1), t0Idx, offset)
      const stored = event.early[key]
      if (!sliced || !stored) throw new Error(`look-ahead checkpoint missing ${event.eventId} ${key}`)
      for (const field of ["return", "mae", "depth", "fromMae", "ratio", "recentSlope"]) {
        if (!sameNumber(sliced[field], stored[field])) throw new Error(`look-ahead mismatch ${event.eventId} ${key} ${field}`)
      }
      checked += 1
    }
    const t1 = checkpointFromCloses(series.closes.slice(0, t0Idx + 2), t0Idx, 1)
    const t3 = checkpointFromCloses(series.closes.slice(0, t0Idx + 4), t0Idx, 3)
    const t5 = checkpointFromCloses(series.closes.slice(0, t0Idx + 6), t0Idx, 5)
    if (recoveryState(t1, t3) !== event.early.stateT3) throw new Error(`look-ahead T+3 state ${event.eventId}`)
    if (recoveryState(t3, t5) !== event.early.stateT5) throw new Error(`look-ahead T+5 state ${event.eventId}`)
    const poisoned = series.closes.slice()
    const future = Math.min(poisoned.length - 1, t0Idx + 6)
    if (future > t0Idx + 5) poisoned[future] = poisoned[t0Idx] * 0.5
    const poisonedT3 = checkpointFromCloses(poisoned, t0Idx, 3)
    const poisonedT5 = checkpointFromCloses(poisoned, t0Idx, 5)
    if (!sameNumber(poisonedT3.fromMae, event.early.t3.fromMae) || !sameNumber(poisonedT5.fromMae, event.early.t5.fromMae)) {
      throw new Error(`look-ahead future bar changed a checkpoint ${event.eventId}`)
    }
    if (event.hold && ("window" in event.early || "lowDay" in event.early)) throw new Error(`outcome stored on predictor ${event.eventId}`)
  }
  return { ok: true, checked, t3LastBar: "T+3 close", t5LastBar: "T+5 close", violations: 0 }
}

export function study(events, options = {}) {
  if (V23_SELECTED_STRATEGY !== null || SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  assertBaseline(events)
  assertV18Split(events)
  assertEventList(events)
  if (!events[0]?.early?.t3 || !events[0]?.early?.t5) throw new Error("early recovery path is missing")
  if (events.some((event) => !event.early.stateT3 || !event.early.stateT5)) throw new Error("recovery state missing")
  const trials = options.bootstrap ?? BOOTSTRAP
  const fullBoot = trials >= BOOTSTRAP
  const t3Depths = events.map((event) => event.early.t3.depth).filter(finite)
  const t5Depths = events.map((event) => event.early.t5.depth).filter(finite)
  const t3DepthMedian = median(t3Depths)
  const t5DepthMedian = median(t5Depths)
  for (const event of events) event.pathType = pathType(event.shape, t5DepthMedian)
  const yReads = {
    window: (event) => event.hold.returns.window,
    t20: (event) => event.hold.returns.t20,
    t10: (event) => event.hold.returns.t10,
  }
  const depthOverlap = overlapOf(events, "depth", "recovery")
  const ratioOverlap = overlapOf(events, "depth", "ratio")
  const pairOverlap = overlapOf(events, "recoveryT3", "recoveryT5")
  const models = { recovery: {}, ratio: {} }
  for (const [target, yRead] of Object.entries(yReads)) {
    models.recovery[target] = inSample(events, yRead, T3_MODELS, depthOverlap, ["depth", "recovery"])
    models.ratio[target] = inSample(events, yRead, RATIO_MODELS, ratioOverlap, ["depth", "ratio"])
  }
  const byState = Object.fromEntries(STATES.map((state) => [state, outcomeBlock(events.filter((event) => event.early.stateT3 === state))]))
  const recovering = events.filter((event) => event.early.stateT3 === "RECOVERING")
  const falling = events.filter((event) => event.early.stateT3 === "STILL_FALLING")
  const shallow = events.filter((event) => event.early.t3.depth <= t3DepthMedian)
  const deep = events.filter((event) => event.early.t3.depth > t3DepthMedian)
  const side = (rows, state) => rows.filter((event) => event.early.stateT3 === state)
  const hitValues = (rows) => rows.filter((event) => event.hold.lowDay != null).map((event) => (event.hold.hits["10"].reached ? 1 : 0))
  const seed = 20261025
  const windowGap = bootstrapDiff(valuesOf(recovering, (event) => event.hold.returns.window), valuesOf(falling, (event) => event.hold.returns.window), trials, seed)
  const t20Gap = bootstrapDiff(valuesOf(recovering, (event) => event.hold.returns.t20), valuesOf(falling, (event) => event.hold.returns.t20), trials, seed + 1)
  const t40Gap = bootstrapDiff(valuesOf(recovering, (event) => event.hold.returns.t40), valuesOf(falling, (event) => event.hold.returns.t40), trials, seed + 2)
  const hitGap = bootstrapDiff(hitValues(recovering), hitValues(falling), trials, seed + 3)
  const oos = oosBlock(events, pairOverlap)
  const ticker = {
    recoveryWindow: tickerLink(events, (event) => event.early.t3.fromMae, (event) => event.hold.returns.window),
    recoveryT20: tickerLink(events, (event) => event.early.t3.fromMae, (event) => event.hold.returns.t20),
    depthWindow: tickerLink(events, (event) => event.early.t3.depth, (event) => event.hold.returns.window),
  }
  const judgment = judgeEarly({
    recoverN: recovering.length,
    fallN: falling.length,
    windowGap: windowGap?.meanDiff ?? null,
    windowCiLow: fullBoot ? windowGap?.ci95?.[0] ?? null : null,
    recoveryBeta: models.recovery.window.M5?.standardized?.recovery ?? models.recovery.window.M4?.standardized?.recovery ?? null,
    depthControlledImproves: improves(models.recovery.window.m3m5),
    aToB: Object.fromEntries(["70", "60", "50"].map((split) => [split, oos[split].window.aToBImproves === true])),
    close: Object.fromEntries(["70", "60", "50"].map((split) => [split, oos[split].window.proximity.close === true])),
    looMin: ticker.recoveryWindow.leaveOneTicker?.min ?? null,
    signFlips: ticker.recoveryWindow.leaveOneTicker?.signFlips ?? [],
  })
  return {
    selectedStrategy: SELECTED_STRATEGY,
    note: "T+3 predictors stop at the T+3 close. T+5 predictors stop at the T+5 close. State priority is RECOVERING, then STABILIZING, then STILL_FALLING. v23 path types stay on the T+5 definition and are crossed with the separate T+3 state. Not a sell rule.",
    rules: {
      t3DepthMedian: round4(t3DepthMedian),
      t5DepthMedian: round4(t5DepthMedian),
      closeRatio: CLOSE_RATIO,
      closeR2Floor: CLOSE_R2_FLOOR,
      vifLimit: VIF_LIMIT,
      priority: STATES,
      t3Previous: "T+1",
      t5Previous: "T+3",
    },
    correlations: correlationTable(events),
    overlap: { recovery: depthOverlap, ratio: ratioOverlap, t3t5: pairOverlap },
    ratioDistribution: { t3: ratioDistribution(events, "t3"), t5: ratioDistribution(events, "t5") },
    models,
    states: byState,
    transitions: transitionBlock(events),
    withinDepth: {
      shallow: {
        n: shallow.length,
        recovering: outcomeBlock(side(shallow, "RECOVERING")),
        stillFalling: outcomeBlock(side(shallow, "STILL_FALLING")),
      },
      deep: {
        n: deep.length,
        recovering: outcomeBlock(side(deep, "RECOVERING")),
        stillFalling: outcomeBlock(side(deep, "STILL_FALLING")),
      },
    },
    atr: cellGrid(events, (event) => event.atrBand),
    leadership: cellGrid(events, (event) => event.leadershipGroup),
    pathCross: cellGrid(events, (event) => event.pathType),
    oos,
    classification: classBlock(events),
    ticker,
    bootstrap: { window: windowGap, t20: t20Gap, t40: t40Gap, hit10: hitGap, fullSample: fullBoot },
    judgment,
  }
}
