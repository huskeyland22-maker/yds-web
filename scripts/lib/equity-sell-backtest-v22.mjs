/**
 * US single-stock early-path study v22 (research only).
 *
 * Asks whether the drawdown known at T+1, T+3, or T+5 separates later
 * outcomes. Later lows, the final MAE, and the window are outcomes only.
 * No sell rule is selected. v1–v21 files are not modified.
 */

import { mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { leaveOneCorrelation, sampleStdev } from "./equity-sell-backtest-v7.mjs"
import { chronologicalSplit, scoreClass, scoreContinuous } from "./equity-sell-backtest-v18.mjs"
import { SPLIT_FRACTIONS, assertV18Split, improves, metricDelta } from "./equity-sell-backtest-v19.mjs"
import {
  SELECTED_STRATEGY as V21_SELECTED_STRATEGY,
  assertBaseline,
  attachHold,
  attachRegime,
  attachSplit,
  loadOhlcv,
  selectMildEvents,
} from "./equity-sell-backtest-v21.mjs"

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
const CHECKS = [
  ["t1", 1],
  ["t3", 3],
  ["t5", 5],
]
const BUCKETS = [
  ["A", "MAE > -3%", (value) => value > -0.03],
  ["B", "-3% to -5%", (value) => value <= -0.03 && value > -0.05],
  ["C", "-5% to -10%", (value) => value <= -0.05 && value > -0.1],
  ["D", "MAE <= -10%", (value) => value <= -0.1],
]
const CONTROLS = {
  M0: ["t0", "leadership"],
  M1: ["t0", "leadership", "eventAtr"],
  M2: ["t0", "leadership", "eventAtr", "checkpointMae"],
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

export function earlyPath(closes, t0Idx, offset) {
  const entry = closes[t0Idx]
  const last = t0Idx + offset
  if (!(entry > 0) || last >= closes.length || last <= t0Idx) return null
  let mae = null
  for (let k = t0Idx + 1; k <= last; k++) {
    const value = closes[k] / entry - 1
    if (mae == null || value < mae) mae = value
  }
  const point = closes[last] / entry - 1
  return {
    return: point,
    mae,
    depth: finite(mae) ? Math.abs(Math.min(0, mae)) : null,
    rebound: finite(mae) && 1 + mae > 0 ? (1 + point) / (1 + mae) - 1 : null,
  }
}

export function maeBucket(mae) {
  if (!finite(mae)) return null
  const found = BUCKETS.find(([, , test]) => test(mae))
  return found ? found[0] : null
}

export function depthSide(mae, boundary) {
  if (!finite(mae)) return null
  return mae <= boundary ? "DEEP" : "SHALLOW"
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

export function attachEarly(events, seriesBySymbol) {
  const out = events.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`missing series ${event.ticker}`)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    if (t0Idx < 0) throw new Error(`missing date ${event.eventId}`)
    const early = {}
    for (const [key, offset] of CHECKS) {
      const path = earlyPath(series.closes, t0Idx, offset)
      const held = event.hold?.path?.[key]?.min
      if (path && finite(held) && Math.abs(path.mae - held) > 1e-8) throw new Error(`checkpoint look-ahead ${event.eventId} ${key}`)
      if (path && held == null && finite(path.mae) && event.hold?.returns?.[key] != null) {
        throw new Error(`checkpoint filled a missing hold path ${event.eventId} ${key}`)
      }
      early[key] = path
    }
    return { ...event, early }
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
  const days = lows.map((event) => event.hold.hits["10"].days).filter(finite)
  return {
    n: rows.length,
    conclusion: conclusion(rows.length),
    t10: level(rows.map((event) => event.hold.returns.t10)),
    t20: level(rows.map((event) => event.hold.returns.t20)),
    t40: level(rows.map((event) => event.hold.returns.t40)),
    window: level(rows.map((event) => event.hold.returns.window)),
    lowToWindow: level(rows.map((event) => event.hold.lowTo.window)),
    hit10: lows.length ? round2((days.length / lows.length) * 100) : null,
    hit10Reached: days.length,
    hit10Eligible: lows.length,
    hit10MedianDays: days.length ? round2(median(days)) : null,
    checkpointMae: level(rows.map((event) => event._mae)),
    checkpointDepth: level(rows.map((event) => event._depth)),
  }
}

function withMae(rows, key) {
  return rows.flatMap((event) => {
    const path = event.early[key]
    if (!path || !finite(path.mae)) return []
    return [{ ...event, _mae: path.mae, _depth: path.depth }]
  })
}

function bucketsOf(rows) {
  return BUCKETS.map(([id, label, test]) => {
    const chosen = rows.filter((event) => test(event._mae))
    return { id, label, ...outcomeBlock(chosen) }
  })
}

function sideBlock(rows, boundary) {
  const out = {}
  for (const side of ["SHALLOW", "DEEP"]) {
    out[side] = outcomeBlock(rows.filter((event) => depthSide(event._mae, boundary) === side))
  }
  return out
}

function cells(rows, boundary) {
  const out = {}
  for (const atr of ["HIGH", "MID", "LOW"]) {
    out[atr] = {}
    for (const side of ["SHALLOW", "DEEP"]) {
      const chosen = rows.filter((event) => event.atrBand === atr && depthSide(event._mae, boundary) === side)
      const block = outcomeBlock(chosen)
      out[atr][side] = {
        n: block.n,
        conclusion: block.conclusion,
        t10: block.t10.mean,
        t20: block.t20.mean,
        t40: block.t40.mean,
        window: block.window.mean,
        lowToWindow: block.lowToWindow.mean,
        hit10: block.hit10,
        checkpointMae: block.checkpointMae.mean,
      }
    }
  }
  return out
}

function linkTo(rows, readX, readY) {
  const link = spearman(rows.map((event) => ({ x: readX(event), y: readY(event) })))
  return { n: link.n, spearman: link.rho, conclusion: conclusion(link.n) }
}

function continuous(rows) {
  const reads = [
    ["t10", (event) => event.hold.returns.t10],
    ["t20", (event) => event.hold.returns.t20],
    ["t40", (event) => event.hold.returns.t40],
    ["window", (event) => event.hold.returns.window],
    ["lowWindow", (event) => event.hold.lowTo.window],
    ["hit10", (event) => (event.hold.hits["10"].reached ? event.hold.hits["10"].days : null)],
  ]
  return {
    mae: Object.fromEntries(reads.map(([key, readY]) => [key, linkTo(rows, (event) => event._mae, readY)])),
    depth: Object.fromEntries(reads.map(([key, readY]) => [key, linkTo(rows, (event) => event._depth, readY)])),
    note: "Signed MAE is the lowest return through the checkpoint. Positive additional-decline depth is abs(min(0, MAE)). A negative depth correlation means a deeper early decline lines up with a lower later outcome.",
  }
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

function design(events, yRead, fields) {
  const rows = []
  for (const event of events) {
    const y = yRead(event)
    const frame = {
      t0: event.predictors.t0,
      leadership: event.predictors.leadership,
      eventAtr: event.predictors.atrPct,
      checkpointMae: event._mae,
    }
    if (!finite(y) || fields.some((key) => !finite(frame[key]))) continue
    const row = { y }
    for (const key of fields) row[key] = frame[key]
    rows.push(row)
  }
  return rows
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

function columnStats(rows, keys) {
  const stats = {}
  for (const key of keys) {
    const values = rows.map((row) => row[key])
    stats[key] = { mean: mean(values), sd: sampleStdev(values) }
  }
  return stats
}

export function fitLinear(trainEvents, testEvents, yRead, fields) {
  const trainRows = design(trainEvents, yRead, fields)
  const testRows = design(testEvents, yRead, fields)
  const stats = columnStats(trainRows, fields)
  const scaledTrain = scaleRows(trainRows, fields, stats)
  const scaledTest = scaleRows(testRows, fields, stats)
  if (!scaledTrain.length || scaledTrain.some((row) => row == null) || scaledTest.some((row) => row == null)) return null
  const beta = ols(scaledTrain, fields)
  if (!beta) return null
  const predict = (rows) => rows.map((row) => beta[0] + fields.reduce((sum, key, index) => sum + beta[index + 1] * row[key], 0))
  const yhatTrain = predict(scaledTrain)
  const trainScore = scoreContinuous(trainRows.map((row) => row.y), yhatTrain, 100)
  const deviation = sampleStdev(trainRows.map((row) => row.y))
  const standardized = deviation > 0 ? Object.fromEntries(fields.map((key, index) => [key, round4(beta[index + 1] / deviation)])) : null
  return {
    beta,
    train: {
      n: trainRows.length,
      r2: trainScore.oosR2,
      spearman: trainScore.spearman,
      mae: trainScore.mae,
      rmse: trainScore.rmse,
      standardized,
    },
    test: scoreContinuous(testRows.map((row) => row.y), predict(scaledTest), 100),
  }
}

function inSampleModels(rows, yRead) {
  const fitted = {}
  for (const [id, fields] of Object.entries(CONTROLS)) {
    const fit = fitLinear(rows, rows, yRead, fields)
    fitted[id] = fit ? { ...fit.train, checkpointMaeBeta: fit.train.standardized?.checkpointMae ?? null } : null
  }
  const delta = (rich, base) => metricDelta(
    rich ? { test: { oosR2: rich.r2, spearman: rich.spearman, pearson: null, mae: rich.mae, rmse: rich.rmse, n: rich.n } } : null,
    base ? { test: { oosR2: base.r2, spearman: base.spearman, pearson: null, mae: base.mae, rmse: base.rmse, n: base.n } } : null,
  )
  return {
    ...fitted,
    m0m1: delta(fitted.M1, fitted.M0),
    m1m2: delta(fitted.M2, fitted.M1),
    maeSignHolds: finite(fitted.M2?.checkpointMaeBeta) && fitted.M2.checkpointMaeBeta > 0,
  }
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

export function fitClass(trainEvents, testEvents, yRead, fields) {
  const trainRows = design(trainEvents, yRead, fields)
  const testRows = design(testEvents, yRead, fields)
  const stats = columnStats(trainRows, fields)
  const scaledTrain = scaleRows(trainRows, fields, stats)
  const scaledTest = scaleRows(testRows, fields, stats)
  if (scaledTrain.some((row) => row == null) || scaledTest.some((row) => row == null)) return null
  const beta = fitLogit(scaledTrain, fields)
  if (!beta) return null
  const score = (rows) => rows.map((row) => sigmoid(beta[0] + fields.reduce((sum, key, index) => sum + beta[index + 1] * row[key], 0)))
  const trainRate = mean(trainRows.map((row) => row.y))
  return {
    beta,
    test: scoreClass(testRows.map((row) => row.y), score(scaledTest), trainRate),
  }
}

function classBlock(events, rowsFor, key) {
  const targets = {
    windowPositive: (event) => (finite(event.hold.returns.window) ? (event.hold.returns.window > 0 ? 1 : 0) : null),
    window10: (event) => (finite(event.hold.returns.window) ? (event.hold.returns.window >= 0.1 ? 1 : 0) : null),
    t20Positive: (event) => (finite(event.hold.returns.t20) ? (event.hold.returns.t20 > 0 ? 1 : 0) : null),
  }
  const marked = rowsFor(events, key)
  const out = {}
  for (const [name, fraction] of SPLIT_FRACTIONS) {
    const split = chronologicalSplit(marked, fraction)
    out[name] = {}
    for (const [target, yRead] of Object.entries(targets)) {
      const base = fitClass(split.train, split.test, yRead, CONTROLS.M1)
      const full = fitClass(split.train, split.test, yRead, CONTROLS.M2)
      out[name][target] = {
        base: base ? { n: base.test.n, rocAuc: base.test.rocAuc, balancedAccuracy: base.test.balancedAccuracy, brier: base.test.brier, conclusion: conclusion(base.test.n) } : null,
        withMae: full ? { n: full.test.n, rocAuc: full.test.rocAuc, balancedAccuracy: full.test.balancedAccuracy, brier: full.test.brier, conclusion: conclusion(full.test.n) } : null,
      }
    }
  }
  return out
}

function oosBlock(events, rowsFor) {
  const targets = {
    window: (event) => event.hold.returns.window,
    t20: (event) => event.hold.returns.t20,
  }
  const out = {}
  for (const [name, fraction] of SPLIT_FRACTIONS) {
    const split = chronologicalSplit(events, fraction)
    out[name] = {}
    for (const [target, yRead] of Object.entries(targets)) {
      out[name][target] = {
        t1: deltaOn(split, yRead, "t1", rowsFor),
        t3: deltaOn(split, yRead, "t3", rowsFor),
        t5: deltaOn(split, yRead, "t5", rowsFor),
      }
    }
  }
  return out
}

function deltaOn(split, yRead, key, rowsFor) {
  const train = rowsFor(split.train, key)
  const test = rowsFor(split.test, key)
  const base = fitLinear(train, test, yRead, CONTROLS.M1)
  const rich = fitLinear(train, test, yRead, CONTROLS.M2)
  return {
    base: base ? { n: base.test.n, oosR2: base.test.oosR2, pearson: base.test.pearson, spearman: base.test.spearman, mae: base.test.mae, rmse: base.test.rmse } : null,
    withMae: rich ? { n: rich.test.n, oosR2: rich.test.oosR2, pearson: rich.test.pearson, spearman: rich.test.spearman, mae: rich.test.mae, rmse: rich.test.rmse, checkpointMaeBeta: rich.train.standardized?.checkpointMae ?? null } : null,
    delta: metricDelta(rich, base),
    improves: improves(metricDelta(rich, base)),
    conclusion: conclusion(test.length),
  }
}

function tickerBlock(rows) {
  const usable = rows.filter((event) => finite(event._mae) && finite(event.hold.returns.window))
  const eventLink = spearman(usable.map((event) => ({ x: event._mae, y: event.hold.returns.window })))
  const groups = new Map()
  for (const event of usable) {
    const group = groups.get(event.ticker) ?? { x: [], y: [] }
    group.x.push(event._mae)
    group.y.push(event.hold.returns.window)
    groups.set(event.ticker, group)
  }
  const tickerLink = spearman([...groups].map(([, group]) => ({ x: mean(group.x), y: mean(group.y) })))
  const leave = leaveOneCorrelation(usable, (event) => event._mae, (event) => event.hold.returns.window)
  return {
    eventWeighted: { n: eventLink.n, spearman: eventLink.rho },
    tickerWeighted: { tickers: groups.size, spearman: tickerLink.rho, maxEvents: groups.size ? Math.max(...[...groups].map(([, group]) => group.y.length)) : 0 },
    leaveOneTicker: { baseline: leave.baseline.rho, min: leave.min, max: leave.max, median: leave.median, signFlips: leave.signFlips },
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

export function bootstrapDiff(high, low, trials, seed, scale) {
  if (high.length < 2 || low.length < 2) return null
  const show = scale === "ratio" ? round4 : pct
  const actual = mean(high) - mean(low)
  const random = mulberry32(seed)
  const boots = []
  for (let trial = 0; trial < trials; trial++) boots.push(mean(resample(high, random)) - mean(resample(low, random)))
  boots.sort((a, b) => a - b)
  const pool = [...high, ...low]
  let extreme = 0
  for (let trial = 0; trial < trials; trial++) {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      const swap = pool[i]
      pool[i] = pool[j]
      pool[j] = swap
    }
    const diff = mean(pool.slice(0, high.length)) - mean(pool.slice(high.length))
    if (Math.abs(diff) >= Math.abs(actual)) extreme += 1
  }
  return {
    nShallow: high.length,
    nDeep: low.length,
    meanDiff: show(actual),
    medianDiff: show(median(high) - median(low)),
    ci95: [show(boots[Math.floor(0.025 * trials)]), show(boots[Math.ceil(0.975 * trials) - 1])],
    permutationTail: round4(extreme / trials),
  }
}

function values(rows, side, boundary, read) {
  return rows.filter((event) => depthSide(event._mae, boundary) === side).map(read).filter(finite)
}

export function judgePath(input) {
  const keys = ["t1", "t3", "t5"]
  const depth = keys.map((key) => input.depthRho[key]).filter(finite)
  const negative = depth.filter((value) => value < 0).length
  const positive = depth.filter((value) => value > 0).length
  const consistent = negative === 3 && positive === 0
  const gapClear = keys.some((key) => finite(input.cut5CiLow[key]) && input.cut5CiLow[key] > 0)
    || keys.some((key) => input.cut10DeepN[key] >= 10 && finite(input.cut10CiLow[key]) && input.cut10CiLow[key] > 0)
  const controlled = keys.some((key) => input.controlled[key] === true)
  const oos = keys.some((key) => input.oosAllSplits[key] === true)
  const loo = keys.some((key) => finite(input.looBase[key]) && input.looBase[key] > 0 && finite(input.looMin[key]) && input.looMin[key] > 0)
  if (consistent && gapClear && controlled && oos && loo) return { label: "강하게 지지" }
  const anyGap = keys.some((key) => finite(input.cut5Gap[key]) && input.cut5Gap[key] > 0)
  if (negative === 0 || !anyGap) return { label: "확인 실패" }
  return { label: "부분적으로 지지" }
}

export function study(events, options = {}) {
  if (V21_SELECTED_STRATEGY !== null || SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  assertBaseline(events)
  assertV18Split(events)
  if (!events[0]?.early) throw new Error("early path is missing")
  const trials = options.bootstrap ?? BOOTSTRAP
  const fullBoot = trials >= BOOTSTRAP
  const yReads = {
    t10: (event) => event.hold.returns.t10,
    t20: (event) => event.hold.returns.t20,
    window: (event) => event.hold.returns.window,
  }
  const checkpoints = {}
  const boot = {}
  let seed = 20261022
  for (const [key] of CHECKS) {
    const rows = withMae(events, key)
    const models = {}
    for (const [target, yRead] of Object.entries(yReads)) models[target] = inSampleModels(rows, yRead)
    checkpoints[key] = {
      n: rows.length,
      buckets: bucketsOf(rows),
      cut5: sideBlock(rows, -0.05),
      cut10: sideBlock(rows, -0.1),
      cells5: cells(rows, -0.05),
      cells10: cells(rows, -0.1),
      continuous: continuous(rows),
      models,
      ticker: tickerBlock(rows),
    }
    boot[key] = {}
    for (const [boundary, name] of [[-0.05, "cut5"], [-0.1, "cut10"]]) {
      boot[key][name] = {
        window: bootstrapDiff(values(rows, "SHALLOW", boundary, (event) => event.hold.returns.window), values(rows, "DEEP", boundary, (event) => event.hold.returns.window), trials, seed),
        t20: bootstrapDiff(values(rows, "SHALLOW", boundary, (event) => event.hold.returns.t20), values(rows, "DEEP", boundary, (event) => event.hold.returns.t20), trials, seed + 1),
        hit10: bootstrapDiff(
          values(rows, "SHALLOW", boundary, (event) => (event.hold.lowDay == null ? null : event.hold.hits["10"].reached ? 1 : 0)),
          values(rows, "DEEP", boundary, (event) => (event.hold.lowDay == null ? null : event.hold.hits["10"].reached ? 1 : 0)),
          trials,
          seed + 2,
        ),
      }
      seed += 19
    }
  }
  const oos = oosBlock(events, withMae)
  const classification = {}
  for (const [key] of CHECKS) classification[key] = classBlock(events, withMae, key)
  const judgment = judgePath({
    depthRho: Object.fromEntries(CHECKS.map(([key]) => [key, checkpoints[key].continuous.depth.window.spearman])),
    cut5Gap: Object.fromEntries(CHECKS.map(([key]) => [key, boot[key].cut5.window?.meanDiff ?? null])),
    cut5CiLow: Object.fromEntries(CHECKS.map(([key]) => [key, fullBoot ? boot[key].cut5.window?.ci95?.[0] ?? null : null])),
    cut10CiLow: Object.fromEntries(CHECKS.map(([key]) => [key, fullBoot ? boot[key].cut10.window?.ci95?.[0] ?? null : null])),
    cut10DeepN: Object.fromEntries(CHECKS.map(([key]) => [key, checkpoints[key].cut10.DEEP.n])),
    controlled: Object.fromEntries(CHECKS.map(([key]) => [key, improves(checkpoints[key].models.window.m1m2) && checkpoints[key].models.window.maeSignHolds])),
    oosAllSplits: Object.fromEntries(CHECKS.map(([key]) => [key, ["70", "60", "50"].every((split) => oos[split].window[key].improves === true)])),
    looBase: Object.fromEntries(CHECKS.map(([key]) => [key, checkpoints[key].ticker.leaveOneTicker.baseline])),
    looMin: Object.fromEntries(CHECKS.map(([key]) => [key, checkpoints[key].ticker.leaveOneTicker.min])),
  })
  return {
    selectedStrategy: SELECTED_STRATEGY,
    note: "Early path uses only closes through the checkpoint. Low-to-window and +10% recovery are outcomes. Not a sell rule.",
    checkpoints,
    oos,
    classification,
    bootstrap: boot,
    judgment,
  }
}
