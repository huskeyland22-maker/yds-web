/**
 * US single-stock Event ATR independence study v19 (research only).
 *
 * Asks whether correction-day ATR still explains the later low-to-window
 * rebound after T0, leadership, and recent realized volatility. No sell rule
 * is selected. v1–v18 files are not modified.
 */

import { mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { leaveOneCorrelation, sampleStdev, volatilityBlock } from "./equity-sell-backtest-v7.mjs"
import { fitInferred } from "./equity-sell-backtest-v9.mjs"
import { periodOf } from "./equity-sell-backtest-v14.mjs"
import {
  SELECTED_STRATEGY as V18_SELECTED_STRATEGY,
  SPLIT_FRACTIONS,
  assertBaseline,
  attachRegime,
  attachSplit,
  chronologicalSplit,
  loadOhlcv,
  permutationTail,
  scoreContinuous,
  selectMildEvents,
} from "./equity-sell-backtest-v18.mjs"

export {
  SPLIT_FRACTIONS,
  assertBaseline,
  attachRegime,
  attachSplit,
  chronologicalSplit,
  loadOhlcv,
  periodOf,
  selectMildEvents,
}

export const SELECTED_STRATEGY = null
export const PERMUTATIONS = 10000

export const V18_SPLIT = {
  "70": { trainN: 72, testN: 31, target: 72, trainStart: "2016-05-06", trainEnd: "2022-11-03", testStart: "2023-01-04", testEnd: "2026-07-29" },
  "60": { trainN: 59, testN: 44, target: 62, trainStart: "2016-05-06", trainEnd: "2022-06-10", testStart: "2022-06-13", testEnd: "2026-07-29" },
  "50": { trainN: 52, testN: 51, target: 52, trainStart: "2016-05-06", trainEnd: "2022-02-23", testStart: "2022-04-06", testEnd: "2026-07-29" },
}

export const MODEL_SPEC = {
  M0: { fields: ["t0"] },
  M1: { fields: ["t0", "leadership"] },
  M2: { fields: ["t0", "leadership", "eventAtr"] },
  M3: { fields: ["t0", "leadership", "stockVol20"] },
  M4: { fields: ["t0", "leadership", "eventAtr", "stockVol20"] },
  M5: { fields: ["t0", "leadership", "eventAtr", "stockVol20", "spyVol20"] },
  M6: { fields: ["t0", "leadership", "eventAtr", "spyAtr"] },
  M7: { fields: ["t0", "leadership", "eventAtr", "stockVol20", "spyAtr"] },
  M8: { fields: ["t0", "leadership", "betweenAtr"] },
  M9: { fields: ["t0", "leadership", "withinAtr"] },
}

const MODEL_IDS = Object.keys(MODEL_SPEC)
const COMPARE = [
  ["m1m2", "M1", "M2"],
  ["m3m4", "M3", "M4"],
  ["m2m4", "M2", "M4"],
  ["m2m5", "M2", "M5"],
  ["m2m6", "M2", "M6"],
  ["m2m7", "M2", "M7"],
]

function finite(value) {
  return Number.isFinite(value)
}

function round4(value) {
  return finite(value) ? Math.round(value * 10000) / 10000 : null
}

function conclusion(n) {
  if (n < 10) return "결론 금지"
  if (n < 20) return "수치만"
  return "제한적"
}

function solveLinear(matrix, vector) {
  const n = vector.length
  const a = matrix.map((row, index) => [...row, vector[index]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row
    if (Math.abs(a[pivot][col]) < 1e-12) return null
    const swap = a[col]
    a[col] = a[pivot]
    a[pivot] = swap
    const div = a[col][col]
    for (let j = col; j <= n; j++) a[col][j] /= div
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = a[row][col]
      for (let j = col; j <= n; j++) a[row][j] -= factor * a[col][j]
    }
  }
  return a.map((row) => row[n])
}

function ols(rows, keys) {
  const n = rows.length
  const p = keys.length + 1
  if (n <= p) return null
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

function pearson(xs, ys) {
  const n = xs.length
  if (n < 2) return null
  const mx = mean(xs)
  const my = mean(ys)
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx
    const b = ys[i] - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  if (dx === 0 || dy === 0) return null
  return num / Math.sqrt(dx * dy)
}

export function attachStockVol(events, seriesBySymbol) {
  const out = events.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`missing series ${event.ticker}`)
    const index = series.dates.indexOf(event.t0Date)
    if (index < 0) throw new Error(`missing date ${event.eventId}`)
    const fresh = volatilityBlock(series.highs, series.lows, series.closes, index).vol20
    if (finite(event.predictors.vol20) && finite(fresh) && Math.abs(event.predictors.vol20 - fresh) > 1e-10) {
      throw new Error(`stock vol differs ${event.eventId}`)
    }
    if (!finite(event.predictors.spyVol20)) throw new Error(`missing SPY vol ${event.eventId}`)
    return { ...event, predictors: { ...event.predictors, stockVol20: fresh } }
  })
  out.bandCounts = events.bandCounts
  return out
}

function frameOf(event) {
  return {
    t0: event.predictors.t0,
    leadership: event.predictors.leadership,
    eventAtr: event.predictors.atrPct,
    stockVol20: event.predictors.stockVol20,
    spyVol20: event.predictors.spyVol20,
    spyAtr: event.predictors.spyAtr,
    betweenAtr: event.predictors.betweenAtr,
    withinAtr: event.predictors.withinAtr,
  }
}

function designRows(events, yRead, fields) {
  const rows = []
  for (const event of events) {
    const y = yRead(event)
    const frame = frameOf(event)
    if (!finite(y) || fields.some((key) => !finite(frame[key]))) continue
    const row = { y, event, t0Date: event.t0Date, ticker: event.ticker, eventId: event.eventId }
    for (const key of fields) row[key] = frame[key]
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

function scaleRow(row, keys, stats) {
  const scaled = { y: row.y, event: row.event, t0Date: row.t0Date, ticker: row.ticker, eventId: row.eventId }
  for (const key of keys) {
    if (!(stats[key].sd > 0)) return null
    scaled[key] = (row[key] - stats[key].mean) / stats[key].sd
  }
  return scaled
}

function predictLinear(rows, keys, beta) {
  return rows.map((row) => beta[0] + keys.reduce((sum, key, index) => sum + beta[index + 1] * row[key], 0))
}

function inSampleFit(y, yhat, p) {
  const n = y.length
  const center = mean(y)
  let sse = 0
  let sst = 0
  for (let i = 0; i < n; i++) {
    sse += (y[i] - yhat[i]) ** 2
    sst += (y[i] - center) ** 2
  }
  const r2 = sst === 0 ? null : 1 - sse / sst
  const adjustedR2 = r2 == null || n <= p ? null : 1 - ((1 - r2) * (n - 1)) / (n - p)
  return { r2: round4(r2), adjustedR2: round4(adjustedR2) }
}

function standardizedBeta(rows, keys, scaledBeta) {
  const deviation = sampleStdev(rows.map((row) => row.y))
  if (!(deviation > 0)) return null
  return Object.fromEntries(keys.map((key, index) => [key, round4(scaledBeta[index + 1] / deviation)]))
}

function rawBeta(rows, keys) {
  const beta = ols(rows, keys)
  if (!beta) return null
  return {
    intercept: round4(beta[0]),
    ...Object.fromEntries(keys.map((key, index) => [key, round4(beta[index + 1])])),
  }
}

export function transferLinear(trainEvents, testEvents, yRead, spec) {
  const keys = spec.fields
  const trainRows = designRows(trainEvents, yRead, keys)
  const testRows = designRows(testEvents, yRead, keys)
  const stats = columnStats(trainRows, keys)
  const scaledTrain = trainRows.map((row) => scaleRow(row, keys, stats))
  const scaledTest = testRows.map((row) => scaleRow(row, keys, stats))
  if (!scaledTrain.length || scaledTrain.some((row) => row == null) || scaledTest.some((row) => row == null)) return null
  const beta = ols(scaledTrain, keys)
  if (!beta) return null
  const yhatTrain = predictLinear(scaledTrain, keys, beta)
  const yhatTest = predictLinear(scaledTest, keys, beta)
  const fitted = inSampleFit(trainRows.map((row) => row.y), yhatTrain, keys.length + 1)
  const std = standardizedBeta(trainRows, keys, beta)
  const directionKey = keys.includes("eventAtr") ? "eventAtr" : keys.at(-1)
  return {
    train: {
      n: trainRows.length,
      ...fitted,
      rawCoefficient: rawBeta(trainRows, keys),
      standardizedBeta: std,
      direction: std ? Math.sign(std[directionKey] ?? 0) : null,
    },
    test: { ...scoreContinuous(testRows.map((row) => row.y), yhatTest, spec.errorUnit ?? 100), conclusion: conclusion(testRows.length) },
    pairs: testRows.map((row, index) => ({ y: row.y, yhat: yhatTest[index] })),
  }
}

function publicFit(fit) {
  if (!fit) return null
  return { train: fit.train, test: fit.test }
}

function subtract(left, right) {
  if (!finite(left) || !finite(right)) return null
  return round4(left - right)
}

export function metricDelta(rich, base) {
  const next = rich?.test
  const prev = base?.test
  if (!next || !prev) return null
  return {
    n: next.n,
    deltaR2: subtract(next.oosR2, prev.oosR2),
    deltaSpearman: subtract(next.spearman, prev.spearman),
    deltaPearson: subtract(next.pearson, prev.pearson),
    deltaMae: subtract(next.mae, prev.mae),
    deltaRmse: subtract(next.rmse, prev.rmse),
  }
}

export function improves(delta) {
  return Boolean(delta
    && finite(delta.deltaR2) && delta.deltaR2 > 0
    && finite(delta.deltaSpearman) && delta.deltaSpearman > 0
    && finite(delta.deltaMae) && delta.deltaMae < 0)
}

function vifOf(rows, keys) {
  if (keys.length < 2) return []
  return keys.map((key) => {
    const others = keys.filter((item) => item !== key)
    const fit = fitInferred(rows.map((row) => ({ ...row, y: row[key] })), others)
    const vif = finite(fit.r2) && fit.r2 < 1 ? 1 / (1 - fit.r2) : null
    return { key, vif: finite(vif) ? Math.round(vif * 100) / 100 : null, high: finite(vif) && vif >= 5 }
  })
}

function correlationBlock(events) {
  const keys = ["eventAtr", "stockVol20", "spyAtr", "spyVol20", "betweenAtr", "withinAtr"]
  const rows = designRows(events, (event) => event.lowToWindow, keys)
  const matrix = {}
  for (const left of keys) {
    matrix[left] = {}
    for (const right of keys) {
      matrix[left][right] = round4(pearson(rows.map((row) => row[left]), rows.map((row) => row[right])))
    }
  }
  return { n: rows.length, matrix }
}

function tickerWeighted(events) {
  const groups = new Map()
  for (const event of events) {
    if (!finite(event.lowToWindow) || !finite(event.predictors.atrPct)) continue
    const group = groups.get(event.ticker) ?? { x: [], y: [] }
    group.x.push(event.predictors.atrPct)
    group.y.push(event.lowToWindow)
    groups.set(event.ticker, group)
  }
  const points = [...groups].map(([ticker, group]) => ({ ticker, n: group.x.length, x: mean(group.x), y: mean(group.y) }))
  const link = spearman(points)
  return {
    tickers: points.length,
    spearman: link.rho,
    n: link.n,
    maxEvents: points.length ? Math.max(...points.map((row) => row.n)) : 0,
    withinStock: points.some((row) => row.n >= 10) ? "제한적" : "결론 금지",
  }
}

function eventWeighted(events) {
  const link = spearman(events.map((event) => ({ x: event.predictors.atrPct, y: event.lowToWindow })))
  return { n: link.n, spearman: link.rho }
}

function periodBlock(events) {
  const names = { A: "2016–2020", B: "2021–2023", C: "2024–current" }
  const out = {}
  for (const [key, label] of Object.entries(names)) {
    const rows = events.filter((event) => periodOf(event.t0Date) === key)
    const link = spearman(rows.map((event) => ({ x: event.predictors.atrPct, y: event.lowToWindow })))
    out[key] = {
      label,
      n: link.n,
      spearman: link.rho,
      conclusion: conclusion(link.n),
    }
  }
  return out
}

export function assertV18Split(events) {
  if (V18_SELECTED_STRATEGY !== null || SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  for (const [name, fraction] of SPLIT_FRACTIONS) {
    const split = chronologicalSplit(events, fraction)
    const expected = V18_SPLIT[name]
    const actual = {
      trainN: split.trainN,
      testN: split.testN,
      target: split.target,
      trainStart: split.trainStart,
      trainEnd: split.trainEnd,
      testStart: split.testStart,
      testEnd: split.testEnd,
    }
    for (const [key, value] of Object.entries(expected)) {
      if (actual[key] !== value) throw new Error(`split ${name} ${key} ${actual[key]} !== ${value}`)
    }
  }
}

const lowWindow = (event) => event.lowToWindow
const lowT20 = (event) => event.fromLow?.t20
const hitTiming = (event) => (event.hits?.["10"]?.reached ? event.hits["10"].days : null)

export function judgeIndependence(input) {
  const keys = ["70", "60", "50"]
  const m1m2Wins = keys.filter((key) => improves(input.deltas[key].m1m2)).length
  const m3m4Wins = keys.filter((key) => improves(input.deltas[key].m3m4)).length
  const m2m4Wins = keys.filter((key) => improves(input.deltas[key].m2m4)).length
  const signs = keys.map((key) => input.signs[key].M2)
  const consistent = signs.every((sign) => sign === signs[0] && sign !== 0)
  const survivesVol = keys.every((key) => input.signs[key].M4 === input.signs[key].M2 && input.signs[key].M2 !== 0)
  const looHolds = finite(input.loo.baseline) && input.loo.baseline !== 0
    && Math.sign(input.loo.min) === Math.sign(input.loo.baseline)
    && Math.sign(input.loo.max) === Math.sign(input.loo.baseline)
  const permSupports = keys.every((key) => finite(input.permutation[key].M2) && input.permutation[key].M2 <= 0.05
    && finite(input.permutation[key].M4) && input.permutation[key].M4 <= 0.05)
  if (m1m2Wins === 3 && m3m4Wins === 3 && m2m4Wins === 3 && survivesVol && consistent && looHolds && permSupports) {
    return { label: "강하게 지지" }
  }
  if (m1m2Wins < 2 || !consistent) return { label: "확인 실패" }
  return { label: "부분적으로 지지" }
}

export function study(events, options = {}) {
  assertBaseline(events)
  assertV18Split(events)
  const trials = options.permutations ?? PERMUTATIONS
  const outcomes = { lowWindow, lowT20, hitTiming }
  const splits = {}
  const deltas = {}
  const signs = {}
  const permutation = {}
  for (const [name, fraction] of SPLIT_FRACTIONS) {
    const split = chronologicalSplit(events, fraction)
    const models = {}
    for (const id of MODEL_IDS) {
      models[id] = {}
      for (const [outcome, read] of Object.entries(outcomes)) {
        const spec = outcome === "hitTiming" ? { ...MODEL_SPEC[id], errorUnit: 1 } : MODEL_SPEC[id]
        models[id][outcome] = transferLinear(split.train, split.test, read, spec)
      }
    }
    const packed = Object.fromEntries(MODEL_IDS.map((id) => [id, {
      lowWindow: publicFit(models[id].lowWindow),
      lowT20: publicFit(models[id].lowT20),
      hitTiming: publicFit(models[id].hitTiming),
    }]))
    const compare = {}
    for (const [id, base, rich] of COMPARE) compare[id] = metricDelta(packed[rich].lowWindow, packed[base].lowWindow)
    const tails = {}
    if (trials > 0) {
      for (const id of MODEL_IDS) {
        const fit = models[id].lowWindow
        tails[id] = fit ? permutationTail(fit.pairs.map((row) => row.y), fit.pairs.map((row) => row.yhat), trials, 20261019 + name.charCodeAt(0) * 100 + id.charCodeAt(1)) : null
      }
    }
    splits[name] = {
      trainN: split.trainN,
      testN: split.testN,
      target: split.target,
      trainStart: split.trainStart,
      trainEnd: split.trainEnd,
      testStart: split.testStart,
      testEnd: split.testEnd,
      models: packed,
      compare,
      permutation: Object.fromEntries(MODEL_IDS.map((id) => [id, tails[id]?.spearmanGreater ?? null])),
    }
    deltas[name] = compare
    signs[name] = {
      M2: packed.M2.lowWindow?.train.direction ?? null,
      M4: packed.M4.lowWindow?.train.standardizedBeta?.eventAtr == null ? null : Math.sign(packed.M4.lowWindow.train.standardizedBeta.eventAtr),
    }
    permutation[name] = { M2: splits[name].permutation.M2, M4: splits[name].permutation.M4 }
  }
  const lowEvents = events.filter((event) => finite(event.lowToWindow))
  const leave = leaveOneCorrelation(lowEvents, (event) => event.predictors.atrPct, lowWindow)
  const loo = {
    baseline: leave.baseline.rho,
    n: leave.baseline.n,
    min: leave.min,
    max: leave.max,
    median: leave.median,
    signFlips: leave.signFlips,
  }
  const vif = {}
  for (const id of MODEL_IDS) {
    const fields = MODEL_SPEC[id].fields
    const rows = designRows(lowEvents, lowWindow, fields)
    vif[id] = { n: rows.length, rows: vifOf(rows, fields) }
  }
  const judgment = judgeIndependence({ deltas, signs, loo, permutation })
  return {
    selectedStrategy: SELECTED_STRATEGY,
    splits,
    vif,
    correlation: correlationBlock(lowEvents),
    robustness: {
      eventWeighted: eventWeighted(lowEvents),
      tickerWeighted: tickerWeighted(lowEvents),
      leaveOneTicker: loo,
    },
    periods: periodBlock(lowEvents),
    judgment,
  }
}
