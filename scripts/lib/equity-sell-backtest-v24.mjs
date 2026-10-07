/**
 * US single-stock recovery-transition study v24 (research only).
 *
 * Asks whether the price at T+5 has already turned up from its own early low.
 * Predictors stop at the checkpoint. The final low, the final MAE, and the
 * window are outcomes only. No sell rule is selected. v1–v23 files are not modified.
 *
 * T+5 state priority, fixed before outcomes:
 * 1. RECOVERING: T+5 return is strictly above T+3 and T+5 MAE is not deeper.
 * 2. STABILIZING: T+5 return is at or above T+3 and T+5 MAE is strictly deeper.
 * 3. STILL_FALLING: every remaining path, including an unchanged return and MAE.
 */

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

export {
  SPLIT_FRACTIONS,
  assertBaseline,
  assertV18Split,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  chronologicalSplit,
  loadOhlcv,
  measureCheckpoint,
  pathType,
  selectMildEvents,
}

export const SELECTED_STRATEGY = null
export const BOOTSTRAP = 10000
export const VIF_LIMIT = 5
export const STRONG_RECOVERY = 0.03
export const STRONG_RECOVERY_ALT = 0.05
const CHECKS = ["t1", "t3", "t5"]
const STATES = ["RECOVERING", "STABILIZING", "STILL_FALLING"]
const RECOVERY_MODELS = {
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
const OOS_MODELS = { A: "M2", B: "M3", C: "M4", D: "M5" }

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

export function recoveryPoint(checkpoint) {
  if (!checkpoint || !finite(checkpoint.point) || !finite(checkpoint.mae)) return null
  const fromMae = Math.max(0, checkpoint.point - checkpoint.mae)
  const ratio = Math.abs(checkpoint.mae) < 1e-12 ? null : fromMae / Math.abs(checkpoint.mae)
  return {
    return: checkpoint.point,
    mae: checkpoint.mae,
    depth: checkpoint.depth,
    fromMae,
    ratio,
  }
}

/**
 * Fixed priority: RECOVERING, then STABILIZING, then STILL_FALLING.
 * Uses only the T+3 and T+5 checkpoint return and MAE.
 */
export function recoveryState(t3, t5) {
  if (!t3 || !t5 || !finite(t3.return) || !finite(t5.return) || !finite(t3.mae) || !finite(t5.mae)) return null
  const returnUp = t5.return > t3.return + 1e-12
  const returnNotDown = t5.return + 1e-12 >= t3.return
  const noNewLow = t5.mae + 1e-12 >= t3.mae
  const newLow = t5.mae < t3.mae - 1e-12
  if (returnUp && noNewLow) return "RECOVERING"
  if (returnNotDown && newLow) return "STABILIZING"
  return "STILL_FALLING"
}

export function recoveryStrength(state, fromMae, cut) {
  if (state !== "RECOVERING" || !finite(fromMae) || !finite(cut)) return null
  return fromMae + 1e-12 >= cut ? "RECOVERING_STRONG" : "RECOVERING_PARTIAL"
}

export function attachRecovery(events) {
  const out = events.map((event) => {
    if (!event.shape?.t5 || !event.shape?.t3 || !event.shape?.t1) throw new Error(`checkpoint path missing ${event.eventId}`)
    const point = {}
    for (const key of CHECKS) point[key] = recoveryPoint(event.shape[key])
    const state = recoveryState(point.t3, point.t5)
    return {
      ...event,
      recovery: {
        ...point,
        state,
        strength3: recoveryStrength(state, point.t5.fromMae, STRONG_RECOVERY),
        strength5: recoveryStrength(state, point.t5.fromMae, STRONG_RECOVERY_ALT),
        returnImprovement: point.t5.return - point.t3.return,
        maeImprovement: point.t5.mae - point.t3.mae,
        recoveryAcceleration: point.t5.fromMae - point.t3.fromMae,
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
  const link = spearman(rows.map((event) => ({ x: readX(event), y: readY(event) })))
  return { n: link.n, spearman: link.rho, conclusion: conclusion(link.n) }
}

function correlationTable(events) {
  const targets = [
    ["window", (event) => event.hold.returns.window],
    ["t20", (event) => event.hold.returns.t20],
    ["hit10", (event) => (event.hold.hits["10"].reached ? event.hold.hits["10"].days : null)],
  ]
  const table = {}
  for (const key of CHECKS) {
    table[key] = {
      fromMae: {},
      ratio: {},
    }
    for (const [name, readY] of targets) {
      table[key].fromMae[name] = linkTo(events, (event) => event.recovery[key].fromMae, readY)
      table[key].ratio[name] = linkTo(events, (event) => event.recovery[key].ratio, readY)
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
    depth: event.recovery.t5.depth,
    recovery: event.recovery.t5.fromMae,
    ratio: event.recovery.t5.ratio,
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

function inSample(events, yRead, spec, overlap) {
  const fitted = {}
  for (const [id, fields] of Object.entries(spec)) {
    const joint = fields.includes("depth") && (fields.includes("recovery") || fields.includes("ratio"))
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

function oosBlock(events, overlap) {
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
      for (const [id, model] of Object.entries(OOS_MODELS)) {
        const fields = RECOVERY_MODELS[model]
        if (fields.includes("depth") && fields.includes("recovery") && overlap.joint === "skipped") fits[id] = { skipped: "VIF" }
        else fits[id] = packTest(fitFields(split.train, split.test, yRead, fields))
      }
      const delta = (richId, baseId) => metricDelta(
        fits[richId]?.oosR2 == null ? null : { test: fits[richId] },
        fits[baseId]?.oosR2 == null ? null : { test: fits[baseId] },
      )
      out[name][target] = {
        ...fits,
        aToB: delta("B", "A"),
        aToC: delta("C", "A"),
        bToD: delta("D", "B"),
        cToD: delta("D", "C"),
        aToBImproves: improves(delta("B", "A")),
        aToCImproves: improves(delta("C", "A")),
        bToDImproves: improves(delta("D", "B")),
        cToDImproves: improves(delta("D", "C")),
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

function classBlock(events, overlap) {
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
      for (const [id, model] of Object.entries(OOS_MODELS)) {
        const fields = RECOVERY_MODELS[model]
        if (fields.includes("depth") && fields.includes("recovery") && overlap.joint === "skipped") out[name][target][id] = { skipped: "VIF" }
        else out[name][target][id] = classScore(split.train, split.test, yRead, fields)
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

function ratioDistribution(events) {
  const values = events.map((event) => event.recovery.t5.ratio)
  const finiteValues = values.filter(finite).sort((a, b) => a - b)
  const at = (q) => (finiteValues.length ? finiteValues[Math.min(finiteValues.length - 1, Math.floor(q * (finiteValues.length - 1)))] : null)
  return {
    n: events.length,
    missing: values.filter((value) => !finite(value)).length,
    min: pct(finiteValues[0]),
    p10: pct(at(0.1)),
    median: pct(at(0.5)),
    p90: pct(at(0.9)),
    max: pct(finiteValues[finiteValues.length - 1]),
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

export function judgeRecovery(input) {
  const gapClear = input.recoverN >= 20 && input.fallN >= 20 && finite(input.windowGap) && input.windowGap > 0 && finite(input.windowCiLow) && input.windowCiLow > 0
  const betaHolds = finite(input.recoveryBeta) && input.recoveryBeta > 0 && input.depthControlledImproves === true
  const oos = ["70", "60", "50"].every((split) => input.bToD[split] === true)
  const ticker = finite(input.looMin) && input.looMin > 0 && !(input.signFlips || []).length
  if (gapClear && betaHolds && oos && ticker) return { label: "강하게 지지" }
  const someOos = ["70", "60", "50"].filter((split) => input.bToD[split] === true || input.aToC[split] === true).length
  const directional = finite(input.windowGap) && input.windowGap > 0 && input.recoverN >= 10 && input.fallN >= 10
  if (betaHolds || someOos >= 2 || directional) return { label: "부분적으로 지지" }
  return { label: "확인 실패" }
}

function cellGrid(events, readGroup) {
  const names = [...new Set(events.map(readGroup))].filter((name) => name != null)
  const out = {}
  for (const name of names) {
    out[name] = {}
    for (const state of STATES) out[name][state] = outcomeBlock(events.filter((event) => readGroup(event) === name && event.recovery.state === state))
  }
  return out
}

export function study(events, options = {}) {
  if (V23_SELECTED_STRATEGY !== null || SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  assertBaseline(events)
  assertV18Split(events)
  if (!events[0]?.recovery?.t5) throw new Error("recovery path is missing")
  const trials = options.bootstrap ?? BOOTSTRAP
  const fullBoot = trials >= BOOTSTRAP
  const depthValues = events.map((event) => event.recovery.t5.depth).filter(finite)
  const depthMedian = median(depthValues)
  for (const event of events) event.pathType = pathType(event.shape, depthMedian)
  const yReads = {
    window: (event) => event.hold.returns.window,
    t20: (event) => event.hold.returns.t20,
    t10: (event) => event.hold.returns.t10,
  }
  const recoveryOverlap = overlapOf(events, "depth", "recovery")
  const ratioOverlap = overlapOf(events, "depth", "ratio")
  const models = { recovery: {}, ratio: {} }
  for (const [target, yRead] of Object.entries(yReads)) {
    models.recovery[target] = inSample(events, yRead, RECOVERY_MODELS, recoveryOverlap)
    models.ratio[target] = inSample(events, yRead, RATIO_MODELS, ratioOverlap)
  }
  const byState = Object.fromEntries(STATES.map((state) => [state, outcomeBlock(events.filter((event) => event.recovery.state === state))]))
  const recovering = events.filter((event) => event.recovery.state === "RECOVERING")
  const falling = events.filter((event) => event.recovery.state === "STILL_FALLING")
  const deep = events.filter((event) => event.recovery.t5.depth > depthMedian)
  const shallow = events.filter((event) => event.recovery.t5.depth <= depthMedian)
  const side = (rows, state) => rows.filter((event) => event.recovery.state === state)
  const hitValues = (rows) => rows.filter((event) => event.hold.lowDay != null).map((event) => (event.hold.hits["10"].reached ? 1 : 0))
  let seed = 20261024
  const windowGap = bootstrapDiff(valuesOf(recovering, (event) => event.hold.returns.window), valuesOf(falling, (event) => event.hold.returns.window), trials, seed)
  const t20Gap = bootstrapDiff(valuesOf(recovering, (event) => event.hold.returns.t20), valuesOf(falling, (event) => event.hold.returns.t20), trials, seed + 1)
  const hitGap = bootstrapDiff(hitValues(recovering), hitValues(falling), trials, seed + 2)
  const deepWindow = bootstrapDiff(
    valuesOf(side(deep, "RECOVERING"), (event) => event.hold.returns.window),
    valuesOf(side(deep, "STILL_FALLING"), (event) => event.hold.returns.window),
    trials,
    seed + 3,
  )
  const oos = oosBlock(events, recoveryOverlap)
  const ticker = {
    recoveryWindow: tickerLink(events, (event) => event.recovery.t5.fromMae, (event) => event.hold.returns.window),
    recoveryT20: tickerLink(events, (event) => event.recovery.t5.fromMae, (event) => event.hold.returns.t20),
    depthWindow: tickerLink(events, (event) => event.recovery.t5.depth, (event) => event.hold.returns.window),
  }
  const judgment = judgeRecovery({
    recoverN: recovering.length,
    fallN: falling.length,
    windowGap: windowGap?.meanDiff ?? null,
    windowCiLow: fullBoot ? windowGap?.ci95?.[0] ?? null : null,
    recoveryBeta: models.recovery.window.M5?.standardized?.recovery ?? models.recovery.window.M4?.standardized?.recovery ?? null,
    depthControlledImproves: improves(models.recovery.window.m3m5),
    bToD: Object.fromEntries(["70", "60", "50"].map((split) => [split, oos[split].window.bToDImproves === true])),
    aToC: Object.fromEntries(["70", "60", "50"].map((split) => [split, oos[split].window.aToCImproves === true])),
    looMin: ticker.recoveryWindow.leaveOneTicker?.min ?? null,
    signFlips: ticker.recoveryWindow.leaveOneTicker?.signFlips ?? [],
  })
  return {
    selectedStrategy: SELECTED_STRATEGY,
    note: "Recovery uses the checkpoint close and the low through that checkpoint only. State priority is RECOVERING, then STABILIZING, then STILL_FALLING. The 3% and 5% recovery cuts are sensitivity counts. Not a sell rule.",
    rules: {
      depthMedian: round4(depthMedian),
      strongRecovery: STRONG_RECOVERY,
      strongRecoveryAlt: STRONG_RECOVERY_ALT,
      vifLimit: VIF_LIMIT,
      priority: ["RECOVERING", "STABILIZING", "STILL_FALLING"],
    },
    transition: {
      returnUp: events.filter((event) => event.recovery.returnImprovement > 1e-12).length,
      noNewLow: events.filter((event) => event.recovery.maeImprovement >= -1e-12).length,
      newLow: events.filter((event) => event.recovery.maeImprovement < -1e-12).length,
      strong3: events.filter((event) => event.recovery.strength3 === "RECOVERING_STRONG").length,
      partial3: events.filter((event) => event.recovery.strength3 === "RECOVERING_PARTIAL").length,
      strong5: events.filter((event) => event.recovery.strength5 === "RECOVERING_STRONG").length,
      partial5: events.filter((event) => event.recovery.strength5 === "RECOVERING_PARTIAL").length,
    },
    correlations: correlationTable(events),
    overlap: { recovery: recoveryOverlap, ratio: ratioOverlap },
    ratioDistribution: ratioDistribution(events),
    models,
    states: byState,
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
    classification: classBlock(events, recoveryOverlap),
    ticker,
    bootstrap: { window: windowGap, t20: t20Gap, hit10: hitGap, deepWindow, fullSample: fullBoot },
    judgment,
  }
}
