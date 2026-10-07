/**
 * US single-stock observation-timing study v26 (research only).
 *
 * Compares T+1, T+3, and T+5 as decision points on the same 103 events.
 * A predictor at T+k uses closes through that checkpoint only. Window, later
 * returns, and the final low are outcomes. No sell rule is selected.
 * v1–v25 files are not modified.
 *
 * T+1 recovery is identically zero, so T+1 is scored with return, depth, and
 * slope. T+1 slope equals the T+1 return by the checkpoint definition.
 *
 * A practical early substitute for T+5, fixed before the sample is scored,
 * requires at least two of the three window splits to keep both the OOS R²
 * ratio and the OOS Spearman ratio at or above 0.70, the same OOS R²
 * direction versus the baseline on at least two splits, and no leave-one-ticker
 * sign flip. Strong support also needs both window bootstrap intervals above
 * zero and a clean look-ahead audit. The per-day ratio is reported and is not
 * used for the judgment. Partial support needs a positive T+3 recovery beta
 * after T+3 depth, or a T+3 recovery model that improves on at least two
 * window splits.
 */

import { mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { dateIndex } from "./equity-sell-backtest-v3.mjs"
import { leaveOneCorrelation, sampleStdev } from "./equity-sell-backtest-v7.mjs"
import { chronologicalSplit, scoreContinuous } from "./equity-sell-backtest-v18.mjs"
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
export const CLOSE_RATIO = 0.7
export const CLOSE_R2_FLOOR = 0.02
const DAYS = { t1: 1, t3: 3, t5: 5 }
const STATES = ["RECOVERING", "STABILIZING", "STILL_FALLING"]
const FIELDS = {
  A: ["t0", "leadership", "eventAtr"],
  B1: ["t0", "leadership", "eventAtr", "depthT1"],
  R1: ["t0", "leadership", "eventAtr", "returnT1"],
  L1: ["t0", "leadership", "eventAtr", "slopeT1"],
  B3: ["t0", "leadership", "eventAtr", "depthT3"],
  R3: ["t0", "leadership", "eventAtr", "recoveryT3"],
  L3: ["t0", "leadership", "eventAtr", "slopeT3"],
  P3: ["t0", "leadership", "eventAtr", "depthT3", "recoveryT3"],
  S3: ["t0", "leadership", "eventAtr", "recoveryT3", "slopeT3"],
  B5: ["t0", "leadership", "eventAtr", "depthT5"],
  R5: ["t0", "leadership", "eventAtr", "recoveryT5"],
  L5: ["t0", "leadership", "eventAtr", "slopeT5"],
  P5: ["t0", "leadership", "eventAtr", "depthT5", "recoveryT5"],
  S5: ["t0", "leadership", "eventAtr", "recoveryT5", "slopeT5"],
  D: ["t0", "leadership", "eventAtr", "recoveryT3", "recoveryT5"],
  N1: ["t0", "leadership", "eventAtr", "depthT1"],
  N3: ["t0", "leadership", "eventAtr", "depthT1", "recoveryT3"],
  N5: ["t0", "leadership", "eventAtr", "depthT1", "recoveryT3", "recoveryT5"],
}
const JOINT = {
  P3: ["depthT3", "recoveryT3"],
  S3: ["recoveryT3", "slopeT3"],
  P5: ["depthT5", "recoveryT5"],
  S5: ["recoveryT5", "slopeT5"],
  D: ["recoveryT3", "recoveryT5"],
  N3: ["depthT1", "recoveryT3"],
  N5: ["depthT1", "recoveryT3", "recoveryT5"],
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
  const pairs = rows.map((row) => ({ x: readX(row), y: readY(row) })).filter((pair) => finite(pair.x) && finite(pair.y))
  if (pairs.length < 3 || !(sampleStdev(pairs.map((pair) => pair.x)) > 0)) {
    return { n: pairs.length, spearman: null, conclusion: "정의상 상수" }
  }
  const link = spearman(pairs)
  return { n: link.n, spearman: link.rho, conclusion: conclusion(link.n) }
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
  const point = (key) => event.early[key]
  return {
    t0: event.predictors.t0,
    leadership: event.predictors.leadership,
    eventAtr: event.predictors.atrPct,
    depthT1: point("t1").depth,
    returnT1: point("t1").return,
    slopeT1: point("t1").recentSlope,
    depthT3: point("t3").depth,
    returnT3: point("t3").return,
    recoveryT3: point("t3").fromMae,
    ratioT3: point("t3").ratio,
    slopeT3: point("t3").recentSlope,
    depthT5: point("t5").depth,
    returnT5: point("t5").return,
    recoveryT5: point("t5").fromMae,
    ratioT5: point("t5").ratio,
    slopeT5: point("t5").recentSlope,
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

function efficiency(delta, days) {
  if (!delta) return null
  return {
    ...delta,
    maeImprovement: finite(delta.deltaMae) ? round4(-delta.deltaMae) : null,
    perDayR2: finite(delta.deltaR2) ? round4(delta.deltaR2 / days) : null,
    perDaySpearman: finite(delta.deltaSpearman) ? round4(delta.deltaSpearman / days) : null,
    days,
  }
}

function correlationTable(events) {
  const targets = [
    ["window", (event) => event.hold.returns.window],
    ["t10", (event) => event.hold.returns.t10],
    ["t20", (event) => event.hold.returns.t20],
    ["t40", (event) => event.hold.returns.t40],
    ["lowWindow", (event) => event.hold.lowTo.window],
  ]
  const reads = {
    t1: {
      return: (event) => event.early.t1.return,
      depth: (event) => event.early.t1.depth,
      slope: (event) => event.early.t1.recentSlope,
    },
    t3: {
      return: (event) => event.early.t3.return,
      depth: (event) => event.early.t3.depth,
      recovery: (event) => event.early.t3.fromMae,
      ratio: (event) => event.early.t3.ratio,
      slope: (event) => event.early.t3.recentSlope,
    },
    t5: {
      return: (event) => event.early.t5.return,
      depth: (event) => event.early.t5.depth,
      recovery: (event) => event.early.t5.fromMae,
      ratio: (event) => event.early.t5.ratio,
      slope: (event) => event.early.t5.recentSlope,
    },
  }
  const table = {}
  for (const [key, predictors] of Object.entries(reads)) {
    table[key] = {}
    for (const [name, readX] of Object.entries(predictors)) {
      table[key][name] = {}
      for (const [target, readY] of targets) table[key][name][target] = linkTo(events, readX, readY)
    }
  }
  table.t1.recovery = Object.fromEntries(targets.map(([target]) => [target, { n: events.length, spearman: null, conclusion: "정의상 상수" }]))
  return table
}

function inSampleBlock(events, yRead, overlaps) {
  const fitted = {}
  for (const id of Object.keys(FIELDS)) {
    const fit = JOINT[id] && overlaps[id]?.joint === "skipped"
      ? { skipped: "VIF", vif: overlaps[id].vif }
      : publicTrain(fitFields(events, events, yRead, FIELDS[id]))
    fitted[id] = fit
  }
  const base = fitted.A
  const versus = {}
  for (const id of Object.keys(FIELDS)) {
    if (id === "A") continue
    const days = id.includes("1") ? 1 : id.includes("3") ? 3 : id.includes("5") ? 5 : null
    versus[id] = days ? efficiency(deltaOf(fitted[id], base), days) : deltaOf(fitted[id], base)
  }
  return {
    ...fitted,
    versusA: versus,
    chain: {
      aToN1: deltaOf(fitted.N1, fitted.A),
      n1ToN3: deltaOf(fitted.N3, fitted.N1),
      n3ToN5: deltaOf(fitted.N5, fitted.N3),
      b3ToP3: deltaOf(fitted.P3, fitted.B3),
      b5ToP5: deltaOf(fitted.P5, fitted.B5),
    },
  }
}

function oosBlock(events, overlaps) {
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
      for (const id of Object.keys(FIELDS)) {
        if (JOINT[id] && overlaps[id]?.joint === "skipped") fits[id] = { skipped: "VIF", vif: overlaps[id].vif }
        else fits[id] = packTest(fitFields(split.train, split.test, yRead, FIELDS[id]))
      }
      const delta = (rich, base) => metricDelta(
        fits[rich]?.oosR2 == null ? null : { test: fits[rich] },
        fits[base]?.oosR2 == null ? null : { test: fits[base] },
      )
      const aToR3 = delta("R3", "A")
      const aToR5 = delta("R5", "A")
      out[name][target] = {
        ...fits,
        aToB1: delta("B1", "A"),
        aToR1: delta("R1", "A"),
        aToL1: delta("L1", "A"),
        aToB3: delta("B3", "A"),
        aToR3,
        aToL3: delta("L3", "A"),
        aToB5: delta("B5", "A"),
        aToR5,
        aToL5: delta("L5", "A"),
        aToS3: delta("S3", "A"),
        aToS5: delta("S5", "A"),
        r3ToR5: delta("R5", "R3"),
        r5ToD: delta("D", "R5"),
        r3ToD: delta("D", "R3"),
        aToN1: delta("N1", "A"),
        n1ToN3: delta("N3", "N1"),
        n3ToN5: delta("N5", "N3"),
        aToR3Improves: improves(aToR3),
        aToR5Improves: improves(aToR5),
        r3ToR5Improves: improves(delta("R5", "R3")),
        r5ToDImproves: improves(delta("D", "R5")),
        r3ToDImproves: improves(delta("D", "R3")),
        sameDirection: finite(aToR3?.deltaR2) && finite(aToR5?.deltaR2) && Math.sign(aToR3.deltaR2) === Math.sign(aToR5.deltaR2),
        proximity: {
          r2Ratio: fits.R5?.oosR2 > 0 && finite(fits.R3?.oosR2) ? round4(fits.R3.oosR2 / fits.R5.oosR2) : null,
          spearmanRatio: fits.R5?.spearman > 0 && finite(fits.R3?.spearman) ? round4(fits.R3.spearman / fits.R5.spearman) : null,
          close: Boolean(
            fits.R5?.oosR2 > CLOSE_R2_FLOOR
            && fits.R5?.spearman > 0
            && fits.R3?.spearman > 0
            && fits.R3.oosR2 / fits.R5.oosR2 >= CLOSE_RATIO
            && fits.R3.spearman / fits.R5.spearman >= CLOSE_RATIO,
          ),
        },
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
    ci95: [pct(boots[Math.floor(0.025 * trials)]), pct(boots[Math.ceil(0.975 * trials) - 1])],
    permutationTail: round4(extreme / trials),
    usable: left.length >= 10 && right.length >= 10,
  }
}

export function judgeTiming(input) {
  const substitute = input.closeSplits >= 2 && input.directionSplits >= 2 && finite(input.looMin) && input.looMin > 0 && !(input.signFlips || []).length
  const stable = finite(input.t3WindowGap) && input.t3WindowGap > 0 && finite(input.t3WindowCiLow) && input.t3WindowCiLow > 0
    && finite(input.t5WindowGap) && input.t5WindowGap > 0 && finite(input.t5WindowCiLow) && input.t5WindowCiLow > 0
  if (substitute && stable && input.lookAheadViolations === 0) return { label: "T+3 조기 판단: 강하게 지지", substituteCandidate: true }
  const betaHolds = finite(input.t3Beta) && input.t3Beta > 0 && input.t3DepthControlled === true
  const directional = finite(input.t3WindowGap) && input.t3WindowGap > 0 && input.recoverN3 >= 10 && input.fallN3 >= 10
  if (betaHolds || input.r3Improves >= 2 || directional) return { label: "T+3 조기 판단: 부분적으로 지지", substituteCandidate: substitute }
  return { label: "T+3 조기 판단: 확인 실패", substituteCandidate: false }
}

function valuesOf(rows, read) {
  return rows.map(read).filter(finite)
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
  const limits = { t1: 1, t3: 3, t5: 5 }
  for (const event of events) {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`look-ahead series missing ${event.eventId}`)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    if (t0Idx < 0) throw new Error(`look-ahead date missing ${event.eventId}`)
    for (const [key, offset] of Object.entries(limits)) {
      if (t0Idx + offset >= series.closes.length) throw new Error(`look-ahead short series ${event.eventId}`)
      const sliced = checkpointFromCloses(series.closes.slice(0, t0Idx + offset + 1), t0Idx, offset)
      const stored = event.early[key]
      for (const field of ["return", "mae", "depth", "fromMae", "ratio", "recentSlope"]) {
        if (!sameNumber(sliced?.[field], stored?.[field])) throw new Error(`look-ahead mismatch ${event.eventId} ${key} ${field}`)
      }
      if (series.dates[t0Idx + offset] == null) throw new Error(`look-ahead date missing ${event.eventId} ${key}`)
      checked += 1
    }
    const poisoned = series.closes.slice()
    const future = t0Idx + 6
    if (future < poisoned.length) poisoned[future] = poisoned[t0Idx] * 0.5
    else poisoned.push(poisoned[t0Idx] * 0.5)
    for (const [key, offset] of Object.entries(limits)) {
      const again = checkpointFromCloses(poisoned, t0Idx, offset)
      if (!sameNumber(again?.fromMae, event.early[key].fromMae) || !sameNumber(again?.return, event.early[key].return) || !sameNumber(again?.depth, event.early[key].depth)) {
        throw new Error(`look-ahead future bar changed ${key} ${event.eventId}`)
      }
    }
    const t1 = checkpointFromCloses(series.closes.slice(0, t0Idx + 2), t0Idx, 1)
    const t3 = checkpointFromCloses(series.closes.slice(0, t0Idx + 4), t0Idx, 3)
    const t5 = checkpointFromCloses(series.closes.slice(0, t0Idx + 6), t0Idx, 5)
    if (recoveryState(t1, t3) !== event.early.stateT3 || recoveryState(t3, t5) !== event.early.stateT5) {
      throw new Error(`look-ahead state changed ${event.eventId}`)
    }
  }
  return { ok: true, checked, violations: 0, t1LastBar: "T+1 close", t3LastBar: "T+3 close", t5LastBar: "T+5 close" }
}

function depthSplit(events, depthKey, stateKey) {
  const depths = events.map((event) => event.early[depthKey].depth).filter(finite)
  const cut = median(depths)
  const shallow = events.filter((event) => event.early[depthKey].depth <= cut)
  const deep = events.filter((event) => event.early[depthKey].depth > cut)
  const side = (rows, state) => rows.filter((event) => event.early[stateKey] === state)
  return {
    median: round4(cut),
    shallow: { n: shallow.length, recovering: outcomeBlock(side(shallow, "RECOVERING")), stillFalling: outcomeBlock(side(shallow, "STILL_FALLING")) },
    deep: { n: deep.length, recovering: outcomeBlock(side(deep, "RECOVERING")), stillFalling: outcomeBlock(side(deep, "STILL_FALLING")) },
  }
}

export function study(events, options = {}) {
  if (V23_SELECTED_STRATEGY !== null || SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  assertBaseline(events)
  assertV18Split(events)
  assertEventList(events)
  if (events.some((event) => !event.early?.stateT3 || !event.early?.stateT5)) throw new Error("recovery state missing")
  const slopeGap = Math.max(...events.map((event) => Math.abs(event.early.t1.recentSlope - event.early.t1.return)))
  if (slopeGap > 1e-12) throw new Error("T+1 slope drifted from the T+1 return")
  if (events.some((event) => event.early.t1.fromMae !== 0)) throw new Error("T+1 recovery is not identically zero")
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
  for (const [target, yRead] of Object.entries(yReads)) models[target] = inSampleBlock(events, yRead, overlaps)
  const byCheckpoint = {
    t3: Object.fromEntries(STATES.map((state) => [state, outcomeBlock(events.filter((event) => event.early.stateT3 === state))])),
    t5: Object.fromEntries(STATES.map((state) => [state, outcomeBlock(events.filter((event) => event.early.stateT5 === state))])),
  }
  const transition = {}
  for (const from of ["RECOVERING", "STILL_FALLING"]) {
    for (const to of ["RECOVERING", "STILL_FALLING"]) {
      transition[`${from}→${to}`] = outcomeBlock(events.filter((event) => event.early.stateT3 === from && event.early.stateT5 === to))
    }
  }
  const waiting = {
    fromRecovering: {
      stayRecovering: transition["RECOVERING→RECOVERING"],
      turnFalling: transition["RECOVERING→STILL_FALLING"],
    },
    fromFalling: {
      turnRecovering: transition["STILL_FALLING→RECOVERING"],
      stayFalling: transition["STILL_FALLING→STILL_FALLING"],
    },
  }
  const seed = 20261026
  const gap = (rows, stateKey, state, read, salt) => bootstrapDiff(
    valuesOf(rows.filter((event) => event.early[stateKey] === "RECOVERING"), read),
    valuesOf(rows.filter((event) => event.early[stateKey] === "STILL_FALLING"), read),
    trials,
    seed + salt,
  )
  const t3Window = gap(events, "stateT3", "RECOVERING", (event) => event.hold.returns.window, 0)
  const t3T20 = gap(events, "stateT3", "RECOVERING", (event) => event.hold.returns.t20, 1)
  const t5Window = gap(events, "stateT5", "RECOVERING", (event) => event.hold.returns.window, 2)
  const t5T20 = gap(events, "stateT5", "RECOVERING", (event) => event.hold.returns.t20, 3)
  const oos = oosBlock(events, overlaps)
  const ticker = {
    t1DepthWindow: tickerLink(events, (event) => event.early.t1.depth, (event) => event.hold.returns.window),
    t1ReturnWindow: tickerLink(events, (event) => event.early.t1.return, (event) => event.hold.returns.window),
    t1DepthT20: tickerLink(events, (event) => event.early.t1.depth, (event) => event.hold.returns.t20),
    t3RecoveryWindow: tickerLink(events, (event) => event.early.t3.fromMae, (event) => event.hold.returns.window),
    t3RecoveryT20: tickerLink(events, (event) => event.early.t3.fromMae, (event) => event.hold.returns.t20),
    t3DepthWindow: tickerLink(events, (event) => event.early.t3.depth, (event) => event.hold.returns.window),
    t5RecoveryWindow: tickerLink(events, (event) => event.early.t5.fromMae, (event) => event.hold.returns.window),
    t5RecoveryT20: tickerLink(events, (event) => event.early.t5.fromMae, (event) => event.hold.returns.t20),
    t5DepthWindow: tickerLink(events, (event) => event.early.t5.depth, (event) => event.hold.returns.window),
  }
  const closeSplits = ["70", "60", "50"].filter((split) => oos[split].window.proximity.close === true).length
  const directionSplits = ["70", "60", "50"].filter((split) => oos[split].window.sameDirection === true).length
  const judgment = judgeTiming({
    closeSplits,
    directionSplits,
    looMin: ticker.t3RecoveryWindow.leaveOneTicker?.min ?? null,
    signFlips: ticker.t3RecoveryWindow.leaveOneTicker?.signFlips ?? [],
    t3WindowGap: t3Window?.meanDiff ?? null,
    t3WindowCiLow: fullBoot ? t3Window?.ci95?.[0] ?? null : null,
    t5WindowGap: t5Window?.meanDiff ?? null,
    t5WindowCiLow: fullBoot ? t5Window?.ci95?.[0] ?? null : null,
    lookAheadViolations: options.lookAheadViolations,
    t3Beta: models.window.P3?.standardized?.recoveryT3 ?? models.window.R3?.standardized?.recoveryT3 ?? null,
    t3DepthControlled: improves(models.window.chain.b3ToP3),
    r3Improves: ["70", "60", "50"].filter((split) => oos[split].window.aToR3Improves === true).length,
    recoverN3: byCheckpoint.t3.RECOVERING.n,
    fallN3: byCheckpoint.t3.STILL_FALLING.n,
  })
  return {
    selectedStrategy: SELECTED_STRATEGY,
    note: "Each decision point uses closes through that checkpoint only. T+1 recovery is identically zero. The 70% OOS ratio is the precommitted substitute bar and the per-day ratio is not the judgment. Not a sell rule.",
    rules: { closeRatio: CLOSE_RATIO, closeR2Floor: CLOSE_R2_FLOOR, vifLimit: VIF_LIMIT, days: DAYS, t1SlopeEqualsReturn: true },
    correlations: correlationTable(events),
    overlap: overlaps,
    models,
    oos,
    states: byCheckpoint,
    transitions: transition,
    waiting,
    withinDepth: { t3: depthSplit(events, "t3", "stateT3"), t5: depthSplit(events, "t5", "stateT5") },
    ticker,
    bootstrap: { t3Window, t3T20, t5Window, t5T20, fullSample: fullBoot },
    counts: { closeSplits, directionSplits },
    judgment,
  }
}
