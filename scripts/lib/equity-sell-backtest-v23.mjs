/**
 * US single-stock early-path shape study v23 (research only).
 *
 * Separates the depth of the decline known by T+1, T+3, or T+5 from how
 * fast that decline arrived and whether new lows kept printing. Later lows,
 * the final MAE, and the window are outcomes only. No sell rule is selected.
 * v1–v22 files are not modified.
 */

import { mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { leaveOneCorrelation, sampleStdev } from "./equity-sell-backtest-v7.mjs"
import { chronologicalSplit, scoreClass, scoreContinuous } from "./equity-sell-backtest-v18.mjs"
import { SPLIT_FRACTIONS, assertV18Split, improves, metricDelta } from "./equity-sell-backtest-v19.mjs"
import {
  SELECTED_STRATEGY as V22_SELECTED_STRATEGY,
  assertBaseline,
  attachHold,
  attachRegime,
  attachSplit,
  earlyPath,
  loadOhlcv,
  selectMildEvents,
} from "./equity-sell-backtest-v22.mjs"

export {
  SPLIT_FRACTIONS,
  assertBaseline,
  assertV18Split,
  attachHold,
  attachRegime,
  attachSplit,
  chronologicalSplit,
  loadOhlcv,
  selectMildEvents,
}

export const SELECTED_STRATEGY = null
export const BOOTSTRAP = 10000
export const FAST_MAX_DAYS = 2
export const VIF_LIMIT = 5
const CHECKS = [["t1", 1], ["t3", 3], ["t5", 5]]
const MODELS = {
  M0: ["t0"],
  M1: ["t0", "leadership"],
  M2: ["t0", "leadership", "eventAtr"],
  M3: ["t0", "leadership", "eventAtr", "depth"],
  M4: ["t0", "leadership", "eventAtr", "velocity"],
  M5: ["t0", "leadership", "eventAtr", "persistence"],
  M6: ["t0", "leadership", "eventAtr", "depth", "velocity"],
  M7: ["t0", "leadership", "eventAtr", "depth", "persistence"],
  M8: ["t0", "leadership", "eventAtr", "depth", "velocity", "persistence"],
}
const OOS_MODELS = { A: "M2", B: "M3", C: "M6", D: "M7", E: "M8" }

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

function dateIndex(dates, date) {
  let lo = 0
  let hi = dates.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (dates[mid] === date) return mid
    if (dates[mid] < date) lo = mid + 1
    else hi = mid - 1
  }
  return -1
}

export function measureCheckpoint(closes, t0Idx, offset) {
  const entry = closes[t0Idx]
  if (!(entry > 0) || offset < 1) return null
  const returns = []
  for (let day = 1; day <= offset; day++) {
    if (t0Idx + day >= closes.length) return null
    returns.push(closes[t0Idx + day] / entry - 1)
  }
  let mae = returns[0]
  let daysToMae = 1
  let running = returns[0]
  let renewalCount = 0
  for (let i = 1; i < returns.length; i++) {
    if (returns[i] < running - 1e-12) {
      renewalCount += 1
      running = returns[i]
    }
    if (returns[i] < mae) {
      mae = returns[i]
      daysToMae = i + 1
    }
  }
  const depth = Math.abs(Math.min(0, mae))
  const point = returns[returns.length - 1]
  const recentSlope = offset === 1 ? point : offset === 3 ? (returns[2] - returns[0]) / 2 : (returns[4] - returns[2]) / 2
  return {
    mae,
    depth,
    point,
    avgVelocity: depth / offset,
    recentSlope,
    daysToMae,
    arrivalSpeed: offset / daysToMae,
    renewalCount,
  }
}

export function pathType(shape, depthMedian) {
  const t5 = shape?.t5
  if (!t5 || !finite(depthMedian)) return null
  if (t5.bothSteps === 1) return "PERSISTENT_DROP"
  if (t5.depth > depthMedian && t5.daysToMae <= FAST_MAX_DAYS) return "FAST_DROP"
  if (t5.depth > depthMedian) return "GRADUAL"
  return "STABLE"
}

export function attachShape(events, seriesBySymbol) {
  const out = events.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`missing series ${event.ticker}`)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    if (t0Idx < 0) throw new Error(`missing date ${event.eventId}`)
    const shape = {}
    for (const [key, offset] of CHECKS) {
      const measured = measureCheckpoint(series.closes, t0Idx, offset)
      const prior = earlyPath(series.closes, t0Idx, offset)
      if (measured && prior && Math.abs(measured.mae - prior.mae) > 1e-8) throw new Error(`checkpoint MAE drifted ${event.eventId} ${key}`)
      shape[key] = measured
    }
    if (shape.t1) shape.t1.deterioration = null
    if (shape.t1 && shape.t3) shape.t3.deterioration = shape.t3.mae < shape.t1.mae - 1e-12 ? 1 : 0
    if (shape.t3 && shape.t5) {
      shape.t5.deterioration = shape.t5.mae < shape.t3.mae - 1e-12 ? 1 : 0
      shape.t5.bothSteps = shape.t3.deterioration === 1 && shape.t5.deterioration === 1 ? 1 : 0
    }
    return { ...event, shape }
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

function linkTo(rows, readX, readY) {
  const link = spearman(rows.map((event) => ({ x: readX(event), y: readY(event) })))
  return { n: link.n, spearman: link.rho, conclusion: conclusion(link.n) }
}

function outcomeReads() {
  return [
    ["t10", (event) => event.hold.returns.t10],
    ["t20", (event) => event.hold.returns.t20],
    ["t40", (event) => event.hold.returns.t40],
    ["window", (event) => event.hold.returns.window],
    ["lowWindow", (event) => event.hold.lowTo.window],
    ["hit10", (event) => (event.hold.hits["10"].reached ? event.hold.hits["10"].days : null)],
  ]
}

function predictorReads(key) {
  return [
    ["depth", (event) => event.shape[key].depth],
    ["avgVelocity", (event) => event.shape[key].avgVelocity],
    ["recentSlope", (event) => event.shape[key].recentSlope],
    ["arrivalSpeed", (event) => event.shape[key].arrivalSpeed],
    ["daysToMae", (event) => event.shape[key].daysToMae],
    ["renewalCount", (event) => event.shape[key].renewalCount],
    ["deterioration", (event) => event.shape[key].deterioration],
  ]
}

function correlationTable(events) {
  const table = {}
  for (const [key] of CHECKS) {
    const ready = events.filter((event) => event.shape[key])
    table[key] = {}
    for (const [name, readX] of predictorReads(key)) {
      table[key][name] = {}
      for (const [target, readY] of outcomeReads()) table[key][name][target] = linkTo(ready, readX, readY)
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

function frameOf(event, key) {
  const path = event.shape[key]
  return {
    t0: event.predictors.t0,
    leadership: event.predictors.leadership,
    eventAtr: event.predictors.atrPct,
    depth: path?.depth,
    velocity: path?.recentSlope,
    persistence: path?.renewalCount,
  }
}

function design(events, yRead, fields, key) {
  const rows = []
  for (const event of events) {
    const y = yRead(event)
    const frame = frameOf(event, key)
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

export function fitFields(trainEvents, testEvents, yRead, fields, key) {
  const trainRows = design(trainEvents, yRead, fields, key)
  const testRows = design(testEvents, yRead, fields, key)
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
  const adjusted = trainScore.oosR2 == null || trainRows.length <= p ? null : round4(1 - ((1 - trainScore.oosR2) * (trainRows.length - 1)) / (trainRows.length - p))
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
  const y = rows.map((row) => row[yKey])
  const yhat = rows.map((row) => beta[0] + keys.reduce((sum, key, index) => sum + beta[index + 1] * row[key], 0))
  return scoreContinuous(y, yhat, 1).oosR2
}

function vifBlock(events, key) {
  const frames = events.map((event) => frameOf(event, key)).filter((row) => finite(row.depth) && finite(row.velocity))
  const varying = ["depth", "velocity", "persistence"].filter((field) => sampleStdev(frames.map((row) => row[field]).filter(finite)) > 0)
  const pairs = {
    depth_velocity: linkTo(frames, (row) => row.depth, (row) => row.velocity),
    depth_persistence: linkTo(frames, (row) => row.depth, (row) => row.persistence),
    velocity_persistence: linkTo(frames, (row) => row.velocity, (row) => row.persistence),
  }
  const vif = {}
  for (const field of varying) {
    const others = varying.filter((name) => name !== field)
    const complete = frames.filter((row) => others.every((name) => finite(row[name])) && finite(row[field]))
    const score = others.length ? r2Of(complete, field, others) : 0
    vif[field] = score == null || score >= 0.9999 ? null : round2(1 / (1 - score))
  }
  const pairScore = r2Of(frames.filter((row) => finite(row.depth) && finite(row.velocity)), "depth", ["velocity"])
  const pairVif = pairScore == null || pairScore >= 0.9999 ? null : 1 / (1 - pairScore)
  const velocityBlocked = !finite(pairVif) || pairVif >= VIF_LIMIT
  const fullBlocked = velocityBlocked || varying.length < 3 || Object.values(vif).some((value) => value == null || value >= VIF_LIMIT)
  return {
    n: frames.length,
    varying,
    pairs,
    vif,
    depthVelocityVif: finite(pairVif) ? round2(pairVif) : null,
    averageVelocityNote: "Average decline rate equals depth divided by a fixed day count, so it is not entered beside depth.",
    velocityJoint: velocityBlocked ? "skipped" : "fit",
    fullJoint: fullBlocked ? "skipped" : "fit",
  }
}

function publicTrain(fit) {
  if (!fit || fit.skipped) return fit
  if (!fit.train) return null
  return fit.train
}

function inSampleModels(events, key, yRead, overlap) {
  const fitted = {}
  for (const [id, fields] of Object.entries(MODELS)) {
    if (fields.includes("persistence") && key === "t1") {
      fitted[id] = { skipped: "T+1 renewal count does not vary" }
      continue
    }
    const withVelocity = fields.includes("depth") && fields.includes("velocity")
    const withAll = withVelocity && fields.includes("persistence")
    if ((withAll && overlap.fullJoint === "skipped") || (withVelocity && overlap.velocityJoint === "skipped")) {
      fitted[id] = { skipped: "VIF" }
      continue
    }
    fitted[id] = publicTrain(fitFields(events, events, yRead, fields, key))
  }
  const delta = (rich, base) => metricDelta(
    rich?.r2 == null ? null : { test: { n: rich.n, oosR2: rich.r2, spearman: rich.spearman, pearson: null, mae: rich.mae, rmse: rich.rmse } },
    base?.r2 == null ? null : { test: { n: base.n, oosR2: base.r2, spearman: base.spearman, pearson: null, mae: base.mae, rmse: base.rmse } },
  )
  return {
    ...fitted,
    m2m3: delta(fitted.M3, fitted.M2),
    m3m4: delta(fitted.M4, fitted.M3),
    m3m6: delta(fitted.M6, fitted.M3),
    m3m5: delta(fitted.M5, fitted.M3),
    m3m7: delta(fitted.M7, fitted.M3),
    m3m8: delta(fitted.M8, fitted.M3),
  }
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

function oosBlock(events, overlapByKey) {
  const targets = {
    window: (event) => event.hold.returns.window,
    t20: (event) => event.hold.returns.t20,
  }
  const out = {}
  for (const [name, fraction] of SPLIT_FRACTIONS) {
    const split = chronologicalSplit(events, fraction)
    out[name] = {}
    for (const [target, yRead] of Object.entries(targets)) {
      out[name][target] = {}
      for (const [key] of CHECKS) {
        const fits = {}
        for (const [id, model] of Object.entries(OOS_MODELS)) {
          const fields = MODELS[model]
          const withVelocity = fields.includes("depth") && fields.includes("velocity")
          const withAll = withVelocity && fields.includes("persistence")
          if (fields.includes("persistence") && key === "t1") fits[id] = { skipped: "T+1 renewal count does not vary" }
          else if ((withAll && overlapByKey[key].fullJoint === "skipped") || (withVelocity && overlapByKey[key].velocityJoint === "skipped")) fits[id] = { skipped: "VIF" }
          else fits[id] = packTest(fitFields(split.train, split.test, yRead, fields, key))
        }
        const delta = (richId, baseId) => metricDelta(
          fits[richId]?.oosR2 == null ? null : { test: fits[richId] },
          fits[baseId]?.oosR2 == null ? null : { test: fits[baseId] },
        )
        out[name][target][key] = {
          ...fits,
          aToB: delta("B", "A"),
          bToC: delta("C", "B"),
          bToD: delta("D", "B"),
          bToE: delta("E", "B"),
          aToBImproves: improves(delta("B", "A")),
          bToCImproves: improves(delta("C", "B")),
          bToDImproves: improves(delta("D", "B")),
          bToEImproves: improves(delta("E", "B")),
        }
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
    const delta = Math.max(...next.map((value, index) => Math.abs(value - beta[index])))
    beta = next
    if (delta < 1e-8) return beta
  }
  return beta
}

function classScore(trainEvents, testEvents, yRead, fields, key) {
  const trainRows = design(trainEvents, yRead, fields, key)
  const testRows = design(testEvents, yRead, fields, key)
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

function classBlock(events, overlapByKey) {
  const targets = {
    windowPositive: (event) => (finite(event.hold.returns.window) ? (event.hold.returns.window > 0 ? 1 : 0) : null),
    window10: (event) => (finite(event.hold.returns.window) ? (event.hold.returns.window >= 0.1 ? 1 : 0) : null),
    t20Positive: (event) => (finite(event.hold.returns.t20) ? (event.hold.returns.t20 > 0 ? 1 : 0) : null),
  }
  const out = {}
  for (const [key] of CHECKS) {
    out[key] = {}
    for (const [name, fraction] of SPLIT_FRACTIONS) {
      const split = chronologicalSplit(events, fraction)
      out[key][name] = {}
      for (const [target, yRead] of Object.entries(targets)) {
        out[key][name][target] = {}
        for (const [id, model] of Object.entries(OOS_MODELS)) {
          const fields = MODELS[model]
          const withVelocity = fields.includes("depth") && fields.includes("velocity")
          const withAll = withVelocity && fields.includes("persistence")
          if (fields.includes("persistence") && key === "t1") out[key][name][target][id] = { skipped: "T+1 renewal count does not vary" }
          else if ((withAll && overlapByKey[key].fullJoint === "skipped") || (withVelocity && overlapByKey[key].velocityJoint === "skipped")) out[key][name][target][id] = { skipped: "VIF" }
          else out[key][name][target][id] = classScore(split.train, split.test, yRead, fields, key)
        }
      }
    }
  }
  return out
}

function outcomeBlock(rows) {
  const lows = rows.filter((event) => event.hold.lowDay != null)
  const days = lows.map((event) => event.hold.hits["10"].days).filter(finite)
  return {
    n: rows.length,
    conclusion: conclusion(rows.length),
    t10: level(rows.map((event) => event.hold.returns.t10)).mean,
    t20: level(rows.map((event) => event.hold.returns.t20)).mean,
    t40: level(rows.map((event) => event.hold.returns.t40)).mean,
    window: level(rows.map((event) => event.hold.returns.window)),
    lowToWindow: level(rows.map((event) => event.hold.lowTo.window)).mean,
    hit10: lows.length ? round2((days.length / lows.length) * 100) : null,
  }
}

function groupGrid(events, readGroup) {
  const types = ["STABLE", "GRADUAL", "FAST_DROP", "PERSISTENT_DROP"]
  const names = [...new Set(events.map(readGroup))].filter((name) => name != null)
  const out = {}
  for (const name of names) {
    out[name] = {}
    for (const type of types) out[name][type] = outcomeBlock(events.filter((event) => readGroup(event) === name && event.pathType === type))
    out[name].FAST_OR_PERSISTENT = outcomeBlock(events.filter((event) => readGroup(event) === name && (event.pathType === "FAST_DROP" || event.pathType === "PERSISTENT_DROP")))
  }
  return out
}

function tickerLink(events, key, readX) {
  const usable = events.filter((event) => event.shape[key] && finite(readX(event)) && finite(event.hold.returns.window))
  const eventLink = spearman(usable.map((event) => ({ x: readX(event), y: event.hold.returns.window })))
  const groups = new Map()
  for (const event of usable) {
    const group = groups.get(event.ticker) ?? { x: [], y: [] }
    group.x.push(readX(event))
    group.y.push(event.hold.returns.window)
    groups.set(event.ticker, group)
  }
  const tickerLink = spearman([...groups].map(([, group]) => ({ x: mean(group.x), y: mean(group.y) })))
  const leave = groups.size ? leaveOneCorrelation(usable, readX, (event) => event.hold.returns.window) : null
  return {
    eventWeighted: { n: eventLink.n, spearman: eventLink.rho },
    tickerWeighted: { tickers: groups.size, spearman: tickerLink.rho, maxEvents: groups.size ? Math.max(...[...groups].map(([, group]) => group.y.length)) : 0 },
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

function windowValues(rows) {
  return rows.map((event) => event.hold.returns.window).filter(finite)
}

export function judgeShape(input) {
  const velocityOos = ["70", "60", "50"].every((split) => input.bToC[split] === true)
  const persistenceOos = ["70", "60", "50"].every((split) => input.bToD[split] === true)
  const within = (input.fastSlowUsable === true && finite(input.fastSlowCiLow) && input.fastSlowCiLow > 0)
    || (input.persistUsable === true && finite(input.persistCiLow) && input.persistCiLow > 0)
  const slopeSign = finite(input.slopeBeta) && input.slopeBeta > 0 && finite(input.slopeLooMin) && input.slopeLooMin > 0
  const renewalSign = finite(input.renewalBeta) && input.renewalBeta < 0 && finite(input.renewalLooMax) && input.renewalLooMax < 0
  if ((velocityOos || persistenceOos) && within && (slopeSign || renewalSign)) return { label: "강하게 지지" }
  const someOos = ["70", "60", "50"].filter((split) => input.bToC[split] === true || input.bToD[split] === true).length
  const inSample = input.inSampleVelocity === true || input.inSamplePersistence === true
  const directional = (finite(input.fastSlowGap) && input.fastSlowGap > 0) || (finite(input.persistGap) && input.persistGap > 0)
  if (someOos >= 2 || inSample || (directional && (input.fastSlowUsable || input.persistUsable))) return { label: "부분적으로 지지" }
  return { label: "확인 실패" }
}

export function study(events, options = {}) {
  if (V22_SELECTED_STRATEGY !== null || SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  assertBaseline(events)
  assertV18Split(events)
  if (!events[0]?.shape?.t5) throw new Error("shape path is missing")
  const trials = options.bootstrap ?? BOOTSTRAP
  const fullBoot = trials >= BOOTSTRAP
  const depthValues = events.map((event) => event.shape.t5?.depth).filter(finite)
  const depthMedian = median(depthValues)
  for (const event of events) event.pathType = pathType(event.shape, depthMedian)
  const overlap = {}
  for (const [key] of CHECKS) overlap[key] = vifBlock(events, key)
  const yReads = {
    t10: (event) => event.hold.returns.t10,
    t20: (event) => event.hold.returns.t20,
    window: (event) => event.hold.returns.window,
  }
  const models = {}
  for (const [key] of CHECKS) {
    models[key] = {}
    for (const [target, yRead] of Object.entries(yReads)) models[key][target] = inSampleModels(events, key, yRead, overlap[key])
  }
  const deep = events.filter((event) => event.shape.t5 && event.shape.t5.depth > depthMedian)
  const fast = deep.filter((event) => event.shape.t5.daysToMae <= FAST_MAX_DAYS)
  const slow = deep.filter((event) => event.shape.t5.daysToMae > FAST_MAX_DAYS)
  const persistent = deep.filter((event) => event.shape.t5.deterioration === 1)
  const calm = deep.filter((event) => event.shape.t5.deterioration === 0)
  let seed = 20261023
  const fastSlow = bootstrapDiff(windowValues(slow), windowValues(fast), trials, seed)
  const persistGap = bootstrapDiff(windowValues(calm), windowValues(persistent), trials, seed + 1)
  const types = ["STABLE", "GRADUAL", "FAST_DROP", "PERSISTENT_DROP"]
  const pathCounts = Object.fromEntries(types.map((type) => [type, outcomeBlock(events.filter((event) => event.pathType === type))]))
  const typeBoot = {}
  for (const type of ["GRADUAL", "FAST_DROP", "PERSISTENT_DROP"]) {
    const left = windowValues(events.filter((event) => event.pathType === "STABLE"))
    const right = windowValues(events.filter((event) => event.pathType === type))
    typeBoot[type] = bootstrapDiff(left, right, trials, seed)
    seed += 3
  }
  const oos = oosBlock(events, overlap)
  const ticker = {
    t5: {
      depth: tickerLink(events, "t5", (event) => event.shape.t5.depth),
      velocity: tickerLink(events, "t5", (event) => event.shape.t5.recentSlope),
      persistence: tickerLink(events, "t5", (event) => event.shape.t5.renewalCount),
    },
  }
  const finalJudgment = judgeShape({
    bToC: Object.fromEntries(["70", "60", "50"].map((split) => [split, oos[split].window.t5.bToCImproves === true])),
    bToD: Object.fromEntries(["70", "60", "50"].map((split) => [split, oos[split].window.t5.bToDImproves === true])),
    fastSlowUsable: fastSlow?.usable === true,
    persistUsable: persistGap?.usable === true,
    fastSlowCiLow: fullBoot ? fastSlow?.ci95?.[0] ?? null : null,
    persistCiLow: fullBoot ? persistGap?.ci95?.[0] ?? null : null,
    fastSlowGap: fastSlow?.meanDiff ?? null,
    persistGap: persistGap?.meanDiff ?? null,
    slopeBeta: models.t5.window.M6?.standardized?.velocity ?? models.t5.window.M4?.standardized?.velocity ?? null,
    renewalBeta: models.t5.window.M7?.standardized?.persistence ?? models.t5.window.M5?.standardized?.persistence ?? null,
    slopeLooMin: ticker.t5.velocity.leaveOneTicker?.min ?? null,
    renewalLooMax: ticker.t5.persistence.leaveOneTicker?.max ?? null,
    inSampleVelocity: improves(models.t5.window.m3m6) || improves(models.t5.window.m3m4),
    inSamplePersistence: improves(models.t5.window.m3m7) || improves(models.t5.window.m3m5),
  })
  return {
    selectedStrategy: SELECTED_STRATEGY,
    note: "Depth, velocity, and persistence use only closes through the checkpoint. Average velocity is depth divided by a fixed day count. Regression velocity is the recent signed slope. Path types use the T+5 predictor median and a 2-day arrival cut, not the later outcome. Not a sell rule.",
    rules: { depthMedian: round4(depthMedian), fastMaxDays: FAST_MAX_DAYS, vifLimit: VIF_LIMIT },
    correlations: correlationTable(events),
    overlap,
    models,
    pathTypes: pathCounts,
    withinDeep: {
      n: deep.length,
      fast: outcomeBlock(fast),
      slow: outcomeBlock(slow),
      persistent: outcomeBlock(persistent),
      nonPersistent: outcomeBlock(calm),
      slope: linkTo(deep, (event) => event.shape.t5.recentSlope, (event) => event.hold.returns.window),
      renewal: linkTo(deep, (event) => event.shape.t5.renewalCount, (event) => event.hold.returns.window),
    },
    atrPath: groupGrid(events, (event) => event.atrBand),
    leadershipPath: groupGrid(events, (event) => event.leadershipGroup),
    oos,
    classification: classBlock(events, overlap),
    ticker,
    bootstrap: { fastSlow, persistent: persistGap, versusStable: typeBoot, fullSample: fullBoot },
    judgment: finalJudgment,
  }
}
