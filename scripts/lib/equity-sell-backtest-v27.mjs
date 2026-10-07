/**
 * US single-stock T+5 recovery independence study v27 (research only).
 *
 * Asks whether T+5 RecoveryFromMAE still explains later outcomes after the
 * T+5 return and T+5 depth are known, and whether the T+5 state changes the
 * value of holding past that close. No sell rule is selected. v1–v26 files
 * are not modified.
 *
 * RecoveryFromMAE equals T+5 return minus T+5 MAE. Once both of those prices
 * are in the model, Recovery adds nothing. That identity is recorded and is
 * not called a fully independent variable. The independence test is the
 * model that already contains T+5 return and T+5 depth.
 *
 * Strong independence, fixed before the sample is scored, needs all of:
 * the return-and-depth model plus Recovery actually fits, the Recovery beta
 * is positive, that step improves Window and T+20 in sample, B→C improves
 * on all three Window splits and at least two T+20 splits, leave-one-ticker
 * Recovery→Window keeps a positive sign, and the 10,000-trial Window and
 * T+20 intervals for RECOVERING minus STILL_FALLING sit above 0.
 * Partial independence needs the fitted positive beta on at least one
 * in-sample target, or B→C on at least two Window splits.
 * A skipped or singular Recovery step is a failed independence test.
 *
 * Hold advantage is the return from the T+5 close. Selling at T+5 adds 0
 * after that close. Entry-relative path levels stay in the profile because
 * they connect to v20 and v21. Strong decision value needs both state
 * groups at n>=20, positive forward Window and T+20 gaps, both intervals
 * above 0, a Window permutation tail below 0.05, and a smaller Window<=-10%
 * share in RECOVERING than in STILL_FALLING. Partial decision value needs
 * a positive forward Window gap with both groups at n>=10.
 */

import { mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { dateIndex } from "./equity-sell-backtest-v3.mjs"
import { pearsonCorrelation } from "./equity-sell-backtest-v4.mjs"
import { leaveOneCorrelation, sampleStdev } from "./equity-sell-backtest-v7.mjs"
import { chronologicalSplit, scoreContinuous } from "./equity-sell-backtest-v18.mjs"
import { SPLIT_FRACTIONS, assertV18Split, improves, metricDelta } from "./equity-sell-backtest-v19.mjs"
import { ratioOf } from "./equity-sell-backtest-v21.mjs"
import {
  SELECTED_STRATEGY as V23_SELECTED_STRATEGY,
  assertBaseline,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  loadOhlcv,
  measureCheckpoint,
  selectMildEvents,
} from "./equity-sell-backtest-v23.mjs"
import { recoveryPoint, recoveryState } from "./equity-sell-backtest-v24.mjs"
import { assertEventList, attachEarly } from "./equity-sell-backtest-v25.mjs"

export {
  SPLIT_FRACTIONS,
  assertBaseline,
  assertEventList,
  assertV18Split,
  attachEarly,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  chronologicalSplit,
  dateIndex,
  loadOhlcv,
  measureCheckpoint,
  recoveryPoint,
  recoveryState,
  selectMildEvents,
}

export const SELECTED_STRATEGY = null
export const BOOTSTRAP = 10000
export const VIF_LIMIT = 5
const STATES = ["RECOVERING", "STABILIZING", "STILL_FALLING"]
const FIELDS = {
  M0: ["t0"],
  M1: ["t0", "leadership"],
  M2: ["t0", "leadership", "eventAtr"],
  M3: ["t0", "leadership", "eventAtr", "returnT5"],
  M4: ["t0", "leadership", "eventAtr", "depthT5"],
  M5: ["t0", "leadership", "eventAtr", "returnT5", "depthT5"],
  M6: ["t0", "leadership", "eventAtr", "recoveryT5"],
  M7: ["t0", "leadership", "eventAtr", "returnT5", "depthT5", "recoveryT5"],
  M8: ["t0", "leadership", "eventAtr", "returnT5", "maeT5"],
  M9: ["t0", "leadership", "eventAtr", "returnT5", "maeT5", "recoveryT5"],
  S: ["t0", "leadership", "eventAtr", "stateRecovering"],
  A: ["t0", "leadership", "eventAtr"],
  B: ["t0", "leadership", "eventAtr", "returnT5", "depthT5"],
  C: ["t0", "leadership", "eventAtr", "returnT5", "depthT5", "recoveryT5"],
  D: ["t0", "leadership", "eventAtr", "recoveryT5"],
  T3: ["t0", "leadership", "eventAtr", "recoveryT3"],
  T3C: ["t0", "leadership", "eventAtr", "recoveryT3", "returnT5", "depthT5"],
  T3D: ["t0", "leadership", "eventAtr", "recoveryT3", "returnT5", "depthT5", "recoveryT5"],
  Rgap: ["t0", "leadership", "eventAtr", "returnGap"],
  Mgap: ["t0", "leadership", "eventAtr", "maeGap"],
  Agap: ["t0", "leadership", "eventAtr", "recoveryGap"],
}
const JOINT = {
  M5: ["returnT5", "depthT5"],
  M7: ["returnT5", "depthT5", "recoveryT5"],
  M8: ["returnT5", "maeT5"],
  M9: ["returnT5", "maeT5", "recoveryT5"],
  B: ["returnT5", "depthT5"],
  C: ["returnT5", "depthT5", "recoveryT5"],
  T3C: ["recoveryT3", "returnT5", "depthT5"],
  T3D: ["recoveryT3", "returnT5", "depthT5", "recoveryT5"],
}
const OOS_IDS = ["A", "B", "C", "D", "T3", "T3C", "T3D"]

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

function quantile(values, p) {
  const xs = values.filter(finite).sort((a, b) => a - b)
  if (!xs.length) return null
  const index = (xs.length - 1) * p
  const lo = Math.floor(index)
  const hi = Math.ceil(index)
  if (lo === hi) return xs[lo]
  return xs[lo] * (hi - index) + xs[hi] * (index - lo)
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

function shape(values, scale) {
  const xs = values.filter(finite)
  const show = scale === "ratio" ? round2 : pct
  return {
    n: xs.length,
    mean: xs.length ? show(mean(xs)) : null,
    median: xs.length ? show(median(xs)) : null,
    p5: xs.length ? show(quantile(xs, 0.05)) : null,
    p25: xs.length ? show(quantile(xs, 0.25)) : null,
  }
}

export function recoveryAlgebra(point) {
  if (!point || !finite(point.return) || !finite(point.mae) || !finite(point.depth) || !finite(point.fromMae)) return null
  const versusMae = Math.abs(point.fromMae - (point.return - point.mae)) < 1e-8
  const versusDepth = point.mae < -1e-12 && Math.abs(point.fromMae - (point.return + point.depth)) < 1e-8
  return { equalsReturnMinusMae: versusMae, equalsReturnPlusDepthWhenMaeNegative: versusDepth }
}

export function attachForward(events, seriesBySymbol) {
  const out = events.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`forward series missing ${event.eventId}`)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    const baseIdx = t0Idx + 5
    const windowIdx = event.hold?.windowIdx
    const base = series.closes[baseIdx]
    if (t0Idx < 0 || !(base > 0) || !finite(windowIdx) || windowIdx >= series.closes.length) {
      throw new Error(`forward path missing ${event.eventId}`)
    }
    const rel = (idx) => (idx >= baseIdx && idx < series.closes.length ? series.closes[idx] / base - 1 : null)
    let mae = null
    let mfe = null
    for (let k = baseIdx; k <= windowIdx; k++) {
      const value = series.closes[k] / base - 1
      if (mae == null || value < mae) mae = value
      if (mfe == null || value > mfe) mfe = value
    }
    return {
      ...event,
      forward: {
        t10: rel(t0Idx + 10),
        t20: rel(t0Idx + 20),
        t40: rel(t0Idx + 40),
        window: rel(windowIdx),
        mae,
        mfe,
        immediateSell: 0,
      },
    }
  })
  out.bandCounts = events.bandCounts
  return out
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
  const t5 = event.early.t5
  const t3 = event.early.t3
  return {
    t0: event.predictors.t0,
    leadership: event.predictors.leadership,
    eventAtr: event.predictors.atrPct,
    returnT5: t5.return,
    depthT5: t5.depth,
    maeT5: t5.mae,
    recoveryT5: t5.fromMae,
    ratioT5: t5.ratio,
    slopeT5: t5.recentSlope,
    returnT3: t3.return,
    recoveryT3: t3.fromMae,
    maeT3: t3.mae,
    returnGap: t5.return - t3.return,
    maeGap: t5.mae - t3.mae,
    recoveryGap: t5.fromMae - t3.fromMae,
    stateRecovering: event.early.stateT5 === "RECOVERING" ? 1 : 0,
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
  for (const key of keys) stats[key] = { mean: mean(rows.map((row) => row[key])), sd: sampleStdev(rows.map((row) => row[key])) }
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

function vifOf(events, fields) {
  if (fields.length < 2) return { vif: null, joint: "fit" }
  const frames = events.map(frameOf).filter((row) => fields.every((field) => finite(row[field])))
  let max = 0
  for (const field of fields) {
    const others = fields.filter((item) => item !== field)
    const score = r2Of(frames, field, others)
    if (score == null || score >= 0.9999) return { vif: null, joint: "skipped" }
    max = Math.max(max, 1 / (1 - score))
  }
  const vif = round2(max)
  return { vif, joint: vif >= VIF_LIMIT ? "skipped" : "fit" }
}

function publicTrain(fit) {
  if (!fit) return null
  if (fit.skipped) return fit
  return fit.train
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
    standardized: fit.train?.standardized ?? null,
    conclusion: conclusion(fit.test.n),
  }
}

function deltaOf(rich, base) {
  return metricDelta(
    rich?.r2 == null && rich?.oosR2 == null ? null : { test: rich.oosR2 == null ? { n: rich.n, oosR2: rich.r2, spearman: rich.spearman, pearson: null, mae: rich.mae, rmse: rich.rmse } : rich },
    base?.r2 == null && base?.oosR2 == null ? null : { test: base.oosR2 == null ? { n: base.n, oosR2: base.r2, spearman: base.spearman, pearson: null, mae: base.mae, rmse: base.rmse } : base },
  )
}

function bothLinks(rows, readX, readY) {
  const pairs = rows.map((row) => ({ x: readX(row), y: readY(row) })).filter((pair) => finite(pair.x) && finite(pair.y))
  if (pairs.length < 3 || !(sampleStdev(pairs.map((pair) => pair.x)) > 0) || !(sampleStdev(pairs.map((pair) => pair.y)) > 0)) {
    return { n: pairs.length, spearman: null, pearson: null, conclusion: "정의상 상수" }
  }
  return {
    n: pairs.length,
    spearman: spearman(pairs).rho,
    pearson: pearsonCorrelation(pairs).rho,
    conclusion: conclusion(pairs.length),
  }
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

export function bootstrapDiff(left, right, trials, seed) {
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
  return {
    nLeft: left.length,
    nRight: right.length,
    meanDiff: pct(actual),
    medianDiff: pct(median(left) - median(right)),
    ci95: [pct(boots[Math.floor(0.025 * trials)]), pct(boots[Math.ceil(0.975 * trials) - 1])],
    permutationTail: round4(extreme / trials),
    usable: left.length >= 10 && right.length >= 10,
  }
}

export function judgeIndependence(input) {
  const controlled = input.m7Fit === true && finite(input.recoveryBeta) && input.recoveryBeta > 0 && input.m5ToM7Window === true && input.m5ToM7T20 === true
  const loo = finite(input.looMin) && input.looMin > 0 && !(input.signFlips || []).length
  const boot = finite(input.windowCiLow) && input.windowCiLow > 0 && finite(input.t20CiLow) && input.t20CiLow > 0
  if (controlled && input.bToCWindow >= 3 && input.bToCHold >= 2 && loo && boot && input.lookAheadViolations === 0) {
    return { label: "T+5 Recovery: 독립 신호 강하게 지지" }
  }
  const inSampleDirection = input.m7Fit === true && finite(input.recoveryBeta) && input.recoveryBeta > 0 && (input.m5ToM7Window === true || input.m5ToM7T20 === true)
  if (inSampleDirection || input.bToCWindow >= 2) return { label: "T+5 Recovery: 독립 신호 부분적으로 지지" }
  return { label: "T+5 Recovery: 독립 신호 확인 실패" }
}

export function judgeDecision(input) {
  const both = input.recoverN >= 20 && input.fallN >= 20
  const gaps = finite(input.forwardWindowGap) && input.forwardWindowGap > 0 && finite(input.forwardT20Gap) && input.forwardT20Gap > 0
  const stable = finite(input.forwardWindowCiLow) && input.forwardWindowCiLow > 0 && finite(input.forwardT20CiLow) && input.forwardT20CiLow > 0
  const tailBetter = finite(input.recoverTail10) && finite(input.fallTail10) && input.recoverTail10 < input.fallTail10
  if (both && gaps && stable && tailBetter && finite(input.permWindow) && input.permWindow < 0.05 && input.lookAheadViolations === 0) {
    return { label: "실제 의사결정 가치: 강하게 지지" }
  }
  if (finite(input.forwardWindowGap) && input.forwardWindowGap > 0 && input.recoverN >= 10 && input.fallN >= 10) {
    return { label: "실제 의사결정 가치: 부분적으로 지지" }
  }
  return { label: "실제 의사결정 가치: 확인 실패" }
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
    if (t0Idx < 0 || t0Idx + 5 >= series.closes.length) throw new Error(`look-ahead date missing ${event.eventId}`)
    const sliced = checkpointFromCloses(series.closes.slice(0, t0Idx + 6), t0Idx, 5)
    const stored = event.early.t5
    for (const field of ["return", "mae", "depth", "fromMae", "ratio", "recentSlope"]) {
      if (!sameNumber(sliced?.[field], stored?.[field])) throw new Error(`look-ahead mismatch ${event.eventId} ${field}`)
    }
    if (series.dates[t0Idx + 5] == null) throw new Error(`look-ahead date missing ${event.eventId}`)
    const poisoned = series.closes.slice()
    const future = t0Idx + 6
    if (future < poisoned.length) poisoned[future] = poisoned[t0Idx] * 0.5
    else poisoned.push(poisoned[t0Idx] * 0.5)
    const again = checkpointFromCloses(poisoned, t0Idx, 5)
    if (!sameNumber(again?.fromMae, stored.fromMae) || !sameNumber(again?.return, stored.return) || !sameNumber(again?.depth, stored.depth)) {
      throw new Error(`look-ahead future bar changed T+5 ${event.eventId}`)
    }
    const t3 = checkpointFromCloses(series.closes.slice(0, t0Idx + 4), t0Idx, 3)
    const t5 = checkpointFromCloses(series.closes.slice(0, t0Idx + 6), t0Idx, 5)
    if (recoveryState(t3, t5) !== event.early.stateT5) throw new Error(`look-ahead state changed ${event.eventId}`)
    checked += 1
  }
  return { ok: true, checked, violations: 0, t5LastBar: "T+5 close" }
}

function valuesOf(rows, read) {
  return rows.map(read).filter(finite)
}

function groupSummary(rows) {
  const lows = rows.filter((event) => event.hold.lowDay != null)
  const recovery = rows.map((event) => event.early.t5.fromMae).filter(finite)
  return {
    n: rows.length,
    conclusion: conclusion(rows.length),
    recoveryMean: pct(recovery.length ? mean(recovery) : null),
    entry: {
      t10: level(rows.map((event) => event.hold.returns.t10)),
      t20: level(rows.map((event) => event.hold.returns.t20)),
      t40: level(rows.map((event) => event.hold.returns.t40)),
      window: level(rows.map((event) => event.hold.returns.window)),
    },
    forward: {
      t10: level(rows.map((event) => event.forward.t10)),
      t20: level(rows.map((event) => event.forward.t20)),
      t40: level(rows.map((event) => event.forward.t40)),
      window: level(rows.map((event) => event.forward.window)),
      mae: shape(rows.map((event) => event.forward.mae), "pct"),
      mfe: shape(rows.map((event) => event.forward.mfe), "pct"),
    },
    risk: {
      window: shape(rows.map((event) => event.risk.window), "pct"),
      mae: shape(rows.map((event) => event.risk.mae), "pct"),
      mfe: shape(rows.map((event) => event.risk.mfe), "pct"),
      ratio: shape(rows.map((event) => event.risk.ratio), "ratio"),
      reboundPerDepth: shape(rows.map((event) => event.risk.reboundPerDepth), "ratio"),
      lowToPerCheckpointDepth: shape(rows.map((event) => ratioOf(event.hold.lowTo.window, event.early.t5.depth)), "ratio"),
      lowToWindow: level(rows.map((event) => event.hold.lowTo.window)),
    },
    hit10: lows.length ? round2((lows.filter((event) => event.hold.hits["10"].reached).length / lows.length) * 100) : null,
    tail: {
      le5: share(rows.map((event) => finite(event.hold.returns.window) && event.hold.returns.window <= -0.05)),
      le10: share(rows.map((event) => finite(event.hold.returns.window) && event.hold.returns.window <= -0.1)),
      le15: share(rows.map((event) => finite(event.hold.returns.window) && event.hold.returns.window <= -0.15)),
      le20: share(rows.map((event) => finite(event.hold.returns.window) && event.hold.returns.window <= -0.2)),
    },
  }
}

function splitGap(events, fraction) {
  const values = events.map((event) => event.early.t5.fromMae).filter(finite)
  const lo = quantile(values, fraction)
  const hi = quantile(values, 1 - fraction)
  const bottom = events.filter((event) => event.early.t5.fromMae <= lo)
  const top = events.filter((event) => event.early.t5.fromMae >= hi)
  const gapOf = (read) => {
    const high = mean(top.map(read))
    const low = mean(bottom.map(read))
    return finite(high) && finite(low) ? round2((high - low) * 100) : null
  }
  const windowGap = gapOf((event) => event.hold.returns.window)
  const t20Gap = gapOf((event) => event.hold.returns.t20)
  return {
    lowCut: round4(lo),
    highCut: round4(hi),
    top: groupSummary(top),
    bottom: groupSummary(bottom),
    windowGap,
    t20Gap,
    windowSign: finite(windowGap) && windowGap !== 0 ? Math.sign(windowGap) : null,
    t20Sign: finite(t20Gap) && t20Gap !== 0 ? Math.sign(t20Gap) : null,
  }
}

function fitMap(events, yRead, overlaps, ids) {
  const fitted = {}
  for (const id of ids) {
    if (id === "M9") {
      fitted[id] = { skipped: "linear identity", note: "Recovery = Return - MAE" }
      continue
    }
    if (JOINT[id] && overlaps[id]?.joint === "skipped") fitted[id] = { skipped: "VIF", vif: overlaps[id].vif }
    else fitted[id] = publicTrain(fitFields(events, events, yRead, FIELDS[id]))
  }
  return fitted
}

export function study(events, options = {}) {
  if (V23_SELECTED_STRATEGY !== null || SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  assertBaseline(events)
  assertV18Split(events)
  assertEventList(events)
  if (events.some((event) => !event.early?.stateT5 || !event.forward || !event.risk)) throw new Error("T+5 decision path missing")
  const algebra = events.map((event) => recoveryAlgebra(event.early.t5))
  if (algebra.some((row) => !row?.equalsReturnMinusMae)) throw new Error("T+5 recovery drifted from return minus MAE")
  const negative = events.filter((event) => event.early.t5.mae < -1e-12)
  const depthGaps = negative.map((event) => Math.abs(event.early.t5.fromMae - (event.early.t5.return + event.early.t5.depth)))
  const identity = {
    recoveryEqualsReturnMinusMae: true,
    maeNegative: negative.length,
    maeNonNegative: events.length - negative.length,
    maxAbsReturnPlusDepthGap: depthGaps.length ? round4(Math.max(...depthGaps)) : null,
    phrase: "기존 T+5 가격 상태를 통제한 뒤 추가적인 설명력이 남는가",
  }
  const trials = options.bootstrap ?? BOOTSTRAP
  const fullBoot = trials >= BOOTSTRAP
  const overlaps = {}
  for (const [id, fields] of Object.entries(JOINT)) overlaps[id] = vifOf(events, fields)
  const yReads = {
    window: (event) => event.hold.returns.window,
    t20: (event) => event.hold.returns.t20,
    t10: (event) => event.hold.returns.t10,
  }
  const models = {}
  for (const [target, yRead] of Object.entries(yReads)) {
    const fitted = fitMap(events, yRead, overlaps, Object.keys(FIELDS))
    models[target] = {
      ...fitted,
      chain: {
        m0ToM1: deltaOf(fitted.M1, fitted.M0),
        m1ToM2: deltaOf(fitted.M2, fitted.M1),
        m2ToM3: deltaOf(fitted.M3, fitted.M2),
        m2ToM4: deltaOf(fitted.M4, fitted.M2),
        m2ToM5: deltaOf(fitted.M5, fitted.M2),
        m2ToM6: deltaOf(fitted.M6, fitted.M2),
        m5ToM7: deltaOf(fitted.M7, fitted.M5),
        m8ToM9: { deltaR2: 0, deltaSpearman: 0, deltaMae: 0, reason: "Recovery = Return - MAE" },
        aToT3: deltaOf(fitted.T3, fitted.A),
        t3ToT3C: deltaOf(fitted.T3C, fitted.T3),
        t3cToT3d: deltaOf(fitted.T3D, fitted.T3C),
        bToC: deltaOf(fitted.C, fitted.B),
        cToT3D: deltaOf(fitted.T3D, fitted.C),
      },
    }
  }
  const substitutes = {}
  for (const [name, id] of [["return", "M3"], ["depth", "M4"], ["recovery", "M6"], ["returnAcceleration", "Rgap"], ["maeChange", "Mgap"], ["recoveryAcceleration", "Agap"]]) {
    substitutes[name] = {
      window: { fit: models.window[id], delta: models.window.chain[`m2To${id}`] || deltaOf(models.window[id], models.window.M2) },
      t20: { fit: models.t20[id], delta: deltaOf(models.t20[id], models.t20.M2) },
    }
  }
  const readRecovery = (event) => event.early.t5.fromMae
  const associations = {
    returnT5: bothLinks(events, readRecovery, (event) => event.early.t5.return),
    depthT5: bothLinks(events, readRecovery, (event) => event.early.t5.depth),
    maeT5: bothLinks(events, readRecovery, (event) => event.early.t5.mae),
    eventAtr: bothLinks(events, readRecovery, (event) => event.predictors.atrPct),
    leadership: bothLinks(events, readRecovery, (event) => event.predictors.leadership),
    t0: bothLinks(events, readRecovery, (event) => event.predictors.t0),
    slopeT5: bothLinks(events, readRecovery, (event) => event.early.t5.recentSlope),
    ratioWindow: bothLinks(events, (event) => event.early.t5.ratio, (event) => event.hold.returns.window),
    ratioT20: bothLinks(events, (event) => event.early.t5.ratio, (event) => event.hold.returns.t20),
  }
  const accel = {}
  for (const [name, readX] of [
    ["recovery", readRecovery],
    ["recoveryAcceleration", (event) => event.early.t5.fromMae - event.early.t3.fromMae],
    ["returnAcceleration", (event) => event.early.t5.return - event.early.t3.return],
    ["maeChange", (event) => event.early.t5.mae - event.early.t3.mae],
  ]) {
    accel[name] = {
      window: bothLinks(events, readX, (event) => event.hold.returns.window),
      t20: bothLinks(events, readX, (event) => event.hold.returns.t20),
    }
  }
  const states = Object.fromEntries(STATES.map((state) => [state, groupSummary(events.filter((event) => event.early.stateT5 === state))]))
  const transition = {}
  for (const from of ["RECOVERING", "STILL_FALLING"]) {
    for (const to of ["RECOVERING", "STILL_FALLING"]) {
      transition[`${from}→${to}`] = groupSummary(events.filter((event) => event.early.stateT3 === from && event.early.stateT5 === to))
    }
  }
  const medianCut = median(events.map((event) => event.early.t5.fromMae))
  const above = events.filter((event) => event.early.t5.fromMae > medianCut)
  const below = events.filter((event) => event.early.t5.fromMae <= medianCut)
  const pairedGap = (read) => {
    const high = mean(above.map(read))
    const low = mean(below.map(read))
    return finite(high) && finite(low) ? round2((high - low) * 100) : null
  }
  const medianWindow = pairedGap((event) => event.hold.returns.window)
  const medianT20 = pairedGap((event) => event.hold.returns.t20)
  const thresholds = {
    q25: splitGap(events, 0.25),
    q30: splitGap(events, 0.3),
    median: {
      cut: round4(medianCut),
      above: groupSummary(above),
      below: groupSummary(below),
      windowGap: medianWindow,
      t20Gap: medianT20,
      windowSign: finite(medianWindow) && medianWindow !== 0 ? Math.sign(medianWindow) : null,
      t20Sign: finite(medianT20) && medianT20 !== 0 ? Math.sign(medianT20) : null,
    },
  }
  const signs = [thresholds.q25, thresholds.q30, thresholds.median].flatMap((row) => [row.windowSign, row.t20Sign]).filter(finite)
  thresholds.sameSign = signs.length > 0 && signs.every((sign) => sign === signs[0])
  const oos = {}
  for (const [name, fraction] of SPLIT_FRACTIONS) {
    const split = chronologicalSplit(events, fraction)
    oos[name] = {}
    for (const [target, yRead] of Object.entries({ window: yReads.window, t20: yReads.t20 })) {
      const fits = {}
      for (const id of OOS_IDS) {
        if (JOINT[id] && overlaps[id]?.joint === "skipped") fits[id] = { skipped: "VIF", vif: overlaps[id].vif }
        else fits[id] = packTest(fitFields(split.train, split.test, yRead, FIELDS[id]))
      }
      const delta = (rich, base) => metricDelta(
        fits[rich]?.oosR2 == null ? null : { test: fits[rich] },
        fits[base]?.oosR2 == null ? null : { test: fits[base] },
      )
      const bToC = delta("C", "B")
      const cToT3D = delta("T3D", "C")
      const t3cToT3d = delta("T3D", "T3C")
      oos[name][target] = {
        ...fits,
        bToC,
        cToT3D,
        t3cToT3d,
        bToCImproves: improves(bToC),
        cToT3DImproves: improves(cToT3D),
        t3cToT3dImproves: improves(t3cToT3d),
      }
    }
  }
  const seed = 20261027
  const gap = (read, salt) => bootstrapDiff(
    valuesOf(events.filter((event) => event.early.stateT5 === "RECOVERING"), read),
    valuesOf(events.filter((event) => event.early.stateT5 === "STILL_FALLING"), read),
    trials,
    seed + salt,
  )
  const bootstrap = {
    entryWindow: gap((event) => event.hold.returns.window, 0),
    entryT20: gap((event) => event.hold.returns.t20, 1),
    entryT40: gap((event) => event.hold.returns.t40, 2),
    forwardT10: gap((event) => event.forward.t10, 3),
    forwardT20: gap((event) => event.forward.t20, 4),
    forwardT40: gap((event) => event.forward.t40, 5),
    forwardWindow: gap((event) => event.forward.window, 6),
    fullSample: fullBoot,
  }
  const cross = (key, labels) => {
    const out = {}
    for (const label of labels) {
      out[label] = {
        RECOVERING: groupSummary(events.filter((event) => event[key] === label && event.early.stateT5 === "RECOVERING")),
        STILL_FALLING: groupSummary(events.filter((event) => event[key] === label && event.early.stateT5 === "STILL_FALLING")),
      }
    }
    return out
  }
  const ticker = {
    window: tickerLink(events, readRecovery, (event) => event.hold.returns.window),
    t20: tickerLink(events, readRecovery, (event) => event.hold.returns.t20),
    mae: tickerLink(events, readRecovery, (event) => event.risk.mae),
    mfe: tickerLink(events, readRecovery, (event) => event.risk.mfe),
  }
  const counts = {
    bToCWindow: ["70", "60", "50"].filter((split) => oos[split].window.bToCImproves).length,
    bToCHold: ["70", "60", "50"].filter((split) => oos[split].t20.bToCImproves).length,
    cToDWindow: ["70", "60", "50"].filter((split) => oos[split].window.cToT3DImproves).length,
    t3ControlledWindow: ["70", "60", "50"].filter((split) => oos[split].window.t3cToT3dImproves).length,
  }
  const ciLow = (row) => (fullBoot ? row?.ci95?.[0] ?? null : null)
  const independence = judgeIndependence({
    m7Fit: models.window.M7?.r2 != null,
    recoveryBeta: models.window.M7?.standardized?.recoveryT5 ?? null,
    m5ToM7Window: improves(models.window.chain.m5ToM7),
    m5ToM7T20: improves(models.t20.chain.m5ToM7),
    bToCWindow: counts.bToCWindow,
    bToCHold: counts.bToCHold,
    looMin: ticker.window.leaveOneTicker?.min ?? null,
    signFlips: ticker.window.leaveOneTicker?.signFlips ?? [],
    windowCiLow: ciLow(bootstrap.entryWindow),
    t20CiLow: ciLow(bootstrap.entryT20),
    lookAheadViolations: options.lookAheadViolations,
  })
  const decision = judgeDecision({
    recoverN: states.RECOVERING.n,
    fallN: states.STILL_FALLING.n,
    forwardWindowGap: bootstrap.forwardWindow?.meanDiff ?? null,
    forwardT20Gap: bootstrap.forwardT20?.meanDiff ?? null,
    forwardWindowCiLow: ciLow(bootstrap.forwardWindow),
    forwardT20CiLow: ciLow(bootstrap.forwardT20),
    permWindow: fullBoot ? bootstrap.forwardWindow?.permutationTail ?? null : null,
    recoverTail10: states.RECOVERING.tail.le10,
    fallTail10: states.STILL_FALLING.tail.le10,
    lookAheadViolations: options.lookAheadViolations,
  })
  return {
    selectedStrategy: SELECTED_STRATEGY,
    note: "T+5 Recovery equals T+5 return minus T+5 MAE, so it is not a fully separate variable. The independence test is the added fit after T+5 return and T+5 depth. Hold advantage is the return after the T+5 close. Not a sell rule.",
    identity,
    associations,
    overlap: overlaps,
    models,
    substitutes,
    acceleration: accel,
    states,
    transitions: transition,
    thresholds,
    oos,
    counts,
    atrCross: cross("atrBand", ["HIGH", "LOW", "MID"]),
    leadershipCross: cross("leadershipGroup", ["HIGH", "MID", "LOW"]),
    ticker,
    bootstrap,
    judgment: { independence, decision },
  }
}
