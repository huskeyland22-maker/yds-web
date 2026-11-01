/**
 * US single-stock out-of-sample study v18 (research only).
 *
 * Fits the v17 predictors on earlier correction events and scores later
 * events without refitting. No sell rule is selected.
 *
 * Judgment thresholds below are fixed before the stored sample is scored.
 */

import { mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { sampleStdev } from "./equity-sell-backtest-v7.mjs"
import { loadOhlcv, selectMildEvents } from "./equity-sell-backtest-v12.mjs"
import { periodOf } from "./equity-sell-backtest-v14.mjs"
import { attachSplit } from "./equity-sell-backtest-v16.mjs"
import { assertBaseline, attachRegime } from "./equity-sell-backtest-v17.mjs"

export { loadOhlcv, selectMildEvents, attachSplit, attachRegime, assertBaseline, periodOf }

export const SELECTED_STRATEGY = null
export const PERMUTATIONS = 10000
export const CLASS_CUTOFF = 0.5
export const WEAK_SPEARMAN = 0.1
export const SPLIT_FRACTIONS = [
  ["70", 0.7],
  ["60", 0.6],
  ["50", 0.5],
]

const CONTINUOUS = ["M0", "A", "B", "C", "D"]
const CLASS_MODELS = ["A", "B", "C", "D", "E"]

export const MODEL_SPEC = {
  M0: { fields: ["t0"], interactions: [] },
  A: { fields: ["t0", "leadership"], interactions: [] },
  B: { fields: ["t0", "leadership", "eventAtr"], interactions: [] },
  C: {
    fields: ["t0", "leadership", "withinAtr", "spyRet20"],
    interactions: [{ name: "withinXspy", left: "withinAtr", right: "spyRet20" }],
  },
  D: {
    fields: ["t0", "leadership", "eventAtr", "spyRet20"],
    interactions: [{ name: "eventXspy", left: "eventAtr", right: "spyRet20" }],
  },
  E: {
    fields: ["t0", "leadership", "eventAtr", "withinAtr", "spyRet20"],
    interactions: [
      { name: "eventXspy", left: "eventAtr", right: "spyRet20" },
      { name: "withinXspy", left: "withinAtr", right: "spyRet20" },
    ],
  },
}

function finite(value) {
  return Number.isFinite(value)
}

function round4(value) {
  return finite(value) ? Math.round(value * 10000) / 10000 : null
}

function sampleLabel(n) {
  if (n >= 10) return "제한적"
  if (n >= 5) return "숫자만"
  return "결론 금지"
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
  const beta = solveLinear(xtx, xty)
  if (!beta) return null
  return beta
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

function sigmoid(value) {
  if (value >= 0) return 1 / (1 + Math.exp(-value))
  const exp = Math.exp(value)
  return exp / (1 + exp)
}

export function targetTrainCount(n, fraction) {
  return Math.round(n * fraction)
}

export function chronologicalSplit(events, fraction) {
  const ordered = [...events].sort((a, b) => a.t0Date.localeCompare(b.t0Date) || a.ticker.localeCompare(b.ticker) || a.eventId.localeCompare(b.eventId))
  const groups = []
  for (const event of ordered) {
    const last = groups.at(-1)
    if (last && last.date === event.t0Date) last.events.push(event)
    else groups.push({ date: event.t0Date, events: [event] })
  }
  const target = targetTrainCount(ordered.length, fraction)
  const train = []
  let index = 0
  while (index < groups.length && train.length + groups[index].events.length <= target) {
    train.push(...groups[index].events)
    index += 1
  }
  if (!train.length && groups.length) {
    train.push(...groups[0].events)
    index = 1
  }
  const test = groups.slice(index).flatMap((group) => group.events)
  const tickers = (rows) => new Set(rows.map((event) => event.ticker))
  const trainTickers = tickers(train)
  const testTickers = tickers(test)
  return {
    fraction,
    target,
    train,
    test,
    trainN: train.length,
    testN: test.length,
    trainTickers: trainTickers.size,
    testTickers: testTickers.size,
    sharedTickers: [...trainTickers].filter((ticker) => testTickers.has(ticker)).length,
    trainStart: train[0]?.t0Date ?? null,
    trainEnd: train.at(-1)?.t0Date ?? null,
    testStart: test[0]?.t0Date ?? null,
    testEnd: test.at(-1)?.t0Date ?? null,
  }
}

function frameOf(event) {
  return {
    t0: event.predictors.t0,
    leadership: event.predictors.leadership,
    eventAtr: event.predictors.atrPct,
    withinAtr: event.predictors.withinAtr,
    spyRet20: event.predictors.spyRet20,
    spyAtr: event.predictors.spyAtr,
  }
}

function parentsOf(spec) {
  return [...new Set(spec.interactions.flatMap((term) => [term.left, term.right]))]
}

export function centeredProduct(left, right, leftMean, rightMean) {
  return (left - leftMean) * (right - rightMean)
}

function designRows(events, yRead, spec, means) {
  const needed = [...spec.fields, ...parentsOf(spec)]
  const keys = [...spec.fields, ...spec.interactions.map((term) => term.name)]
  const rows = []
  for (const event of events) {
    const y = yRead(event)
    const frame = frameOf(event)
    if (!finite(y) || needed.some((key) => !finite(frame[key]))) continue
    const row = { y, event, t0Date: event.t0Date, ticker: event.ticker, eventId: event.eventId }
    for (const key of spec.fields) row[key] = frame[key]
    for (const term of spec.interactions) row[term.name] = centeredProduct(frame[term.left], frame[term.right], means[term.left], means[term.right])
    rows.push(row)
  }
  return { rows, keys }
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

export function scoreContinuous(y, yhat, unit = 100) {
  const n = y.length
  if (n < 2) return { n, oosR2: null, pearson: null, spearman: null, mae: null, rmse: null, conclusion: sampleLabel(n) }
  const center = mean(y)
  let sse = 0
  let sst = 0
  let abs = 0
  for (let i = 0; i < n; i++) {
    const error = y[i] - yhat[i]
    sse += error * error
    sst += (y[i] - center) ** 2
    abs += Math.abs(error)
  }
  return {
    n,
    oosR2: round4(sst === 0 ? null : 1 - sse / sst),
    pearson: round4(pearson(yhat, y)),
    spearman: spearman(yhat.map((value, index) => ({ x: value, y: y[index] }))).rho,
    mae: round4((abs / n) * unit),
    rmse: round4(Math.sqrt(sse / n) * unit),
    conclusion: sampleLabel(n),
  }
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
  const parents = parentsOf(spec)
  const probe = designRows(trainEvents, yRead, { ...spec, interactions: [] }, {})
  const means = {}
  for (const key of parents) means[key] = mean(probe.rows.map((row) => frameOf(row.event)[key]))
  const train = designRows(trainEvents, yRead, spec, means)
  const test = designRows(testEvents, yRead, spec, means)
  const stats = columnStats(train.rows, train.keys)
  const scaledTrain = train.rows.map((row) => scaleRow(row, train.keys, stats))
  const scaledTest = test.rows.map((row) => scaleRow(row, train.keys, stats))
  if (scaledTrain.some((row) => row == null) || scaledTest.some((row) => row == null)) return null
  const beta = ols(scaledTrain, train.keys)
  if (!beta) return null
  const yhatTrain = predictLinear(scaledTrain, train.keys, beta)
  const yhatTest = predictLinear(scaledTest, train.keys, beta)
  const fitted = inSampleFit(train.rows.map((row) => row.y), yhatTrain, train.keys.length + 1)
  const std = standardizedBeta(train.rows, train.keys, beta)
  const directionKey = spec.interactions[0]?.name ?? (train.keys.includes("eventAtr") ? "eventAtr" : null)
  return {
    train: {
      n: train.rows.length,
      ...fitted,
      rawCoefficient: rawBeta(train.rows, train.keys),
      standardizedBeta: std,
      direction: directionKey && std ? Math.sign(std[directionKey] ?? 0) : null,
    },
    test: scoreContinuous(test.rows.map((row) => row.y), yhatTest, spec.errorUnit ?? 100),
    pairs: test.rows.map((row, index) => ({
      eventId: row.eventId,
      t0Date: row.t0Date,
      ticker: row.ticker,
      y: row.y,
      yhat: yhatTest[index],
    })),
  }
}

function fitLogit(rows, keys) {
  const labels = new Set(rows.map((row) => row.y))
  if (labels.size < 2) return null
  const n = rows.length
  const p = keys.length + 1
  if (n <= p) return null
  const xRows = rows.map((row) => [1, ...keys.map((key) => row[key])])
  let beta = Array(p).fill(0)
  for (let iter = 0; iter < 100; iter++) {
    const xtwx = Array.from({ length: p }, () => Array(p).fill(0))
    const xtwz = Array(p).fill(0)
    for (let i = 0; i < n; i++) {
      const eta = xRows[i].reduce((sum, value, index) => sum + value * beta[index], 0)
      const pHat = sigmoid(eta)
      const weight = Math.max(pHat * (1 - pHat), 1e-6)
      const z = eta + (rows[i].y - pHat) / weight
      for (let a = 0; a < p; a++) {
        xtwz[a] += xRows[i][a] * weight * z
        for (let b = 0; b < p; b++) xtwx[a][b] += xRows[i][a] * weight * xRows[i][b]
      }
    }
    const next = solveLinear(xtwx, xtwz)
    if (!next) return null
    const delta = Math.max(...next.map((value, index) => Math.abs(value - beta[index])))
    beta = next
    if (delta < 1e-8) return { beta, converged: true, iterations: iter + 1 }
  }
  return { beta, converged: false, iterations: 100 }
}

function rocAuc(y, scores) {
  const pos = []
  const neg = []
  for (let i = 0; i < y.length; i++) (y[i] === 1 ? pos : neg).push(scores[i])
  if (!pos.length || !neg.length) return null
  let wins = 0
  for (const left of pos) {
    for (const right of neg) {
      if (left > right) wins += 1
      else if (left === right) wins += 0.5
    }
  }
  return wins / (pos.length * neg.length)
}

function prAuc(y, scores) {
  const total = y.filter((value) => value === 1).length
  if (!total || total === y.length) return null
  const order = scores.map((score, index) => ({ score, y: y[index] })).sort((a, b) => b.score - a.score || b.y - a.y)
  let hit = 0
  let seen = 0
  let area = 0
  let recall = 0
  for (const row of order) {
    seen += 1
    if (row.y === 1) hit += 1
    const nextRecall = hit / total
    area += (nextRecall - recall) * (hit / seen)
    recall = nextRecall
  }
  return area
}

function calibration(y, scores) {
  const bins = [0, 0.2, 0.4, 0.6, 0.8, 1.0000001]
  return bins.slice(0, -1).map((low, index) => {
    const high = bins[index + 1]
    const chosen = []
    for (let i = 0; i < y.length; i++) if (scores[i] >= low && scores[i] < high) chosen.push(i)
    return {
      low,
      high: index === 4 ? 1 : high,
      n: chosen.length,
      meanScore: chosen.length ? round4(mean(chosen.map((i) => scores[i]))) : null,
      observed: chosen.length ? round4(mean(chosen.map((i) => y[i]))) : null,
    }
  })
}

export function scoreClass(y, scores, trainRate) {
  const n = y.length
  let correct = 0
  let tp = 0
  let tn = 0
  let pos = 0
  let neg = 0
  let brier = 0
  for (let i = 0; i < n; i++) {
    const predicted = scores[i] >= CLASS_CUTOFF ? 1 : 0
    if (predicted === y[i]) correct += 1
    if (y[i] === 1) {
      pos += 1
      if (predicted === 1) tp += 1
    } else {
      neg += 1
      if (predicted === 0) tn += 1
    }
    brier += (scores[i] - y[i]) ** 2
  }
  const tpr = pos ? tp / pos : null
  const tnr = neg ? tn / neg : null
  let constantBrier = 0
  for (let i = 0; i < n; i++) constantBrier += (trainRate - y[i]) ** 2
  return {
    n,
    accuracy: n ? round4(correct / n) : null,
    balancedAccuracy: tpr == null || tnr == null ? null : round4((tpr + tnr) / 2),
    rocAuc: round4(rocAuc(y, scores)),
    prAuc: round4(prAuc(y, scores)),
    brier: n ? round4(brier / n) : null,
    constantBrier: n ? round4(constantBrier / n) : null,
    calibration: calibration(y, scores),
    conclusion: sampleLabel(n),
    cutoff: CLASS_CUTOFF,
  }
}

export function transferClass(trainEvents, testEvents, yRead, spec) {
  const parents = parentsOf(spec)
  const probe = designRows(trainEvents, yRead, { ...spec, interactions: [] }, {})
  const means = {}
  for (const key of parents) means[key] = mean(probe.rows.map((row) => frameOf(row.event)[key]))
  const train = designRows(trainEvents, yRead, spec, means)
  const test = designRows(testEvents, yRead, spec, means)
  const stats = columnStats(train.rows, train.keys)
  const scaledTrain = train.rows.map((row) => scaleRow(row, train.keys, stats))
  const scaledTest = test.rows.map((row) => scaleRow(row, train.keys, stats))
  if (scaledTrain.some((row) => row == null) || scaledTest.some((row) => row == null)) return null
  const fit = fitLogit(scaledTrain, train.keys)
  if (!fit?.beta) return null
  const score = (rows) => rows.map((row) => sigmoid(fit.beta[0] + train.keys.reduce((sum, key, index) => sum + fit.beta[index + 1] * row[key], 0)))
  const trainRate = mean(train.rows.map((row) => row.y))
  return {
    trainN: train.rows.length,
    trainRate: round4(trainRate),
    converged: fit.converged,
    test: scoreClass(test.rows.map((row) => row.y), score(scaledTest), trainRate),
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

export function permutationTail(y, yhat, trials, seed) {
  const actual = scoreContinuous(y, yhat)
  if (!finite(actual.spearman) || !finite(actual.oosR2)) return null
  const random = mulberry32(seed)
  const shuffled = [...y]
  let spearmanGreater = 0
  let r2Greater = 0
  for (let trial = 0; trial < trials; trial++) {
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      const swap = shuffled[i]
      shuffled[i] = shuffled[j]
      shuffled[j] = swap
    }
    const scored = scoreContinuous(shuffled, yhat)
    if (finite(scored.spearman) && scored.spearman > actual.spearman) spearmanGreater += 1
    if (finite(scored.oosR2) && scored.oosR2 > actual.oosR2) r2Greater += 1
  }
  return {
    trials,
    spearmanGreater: round4(spearmanGreater / trials),
    oosR2Greater: round4(r2Greater / trials),
  }
}

function level(values) {
  const rows = values.filter(finite)
  return {
    n: rows.length,
    avg: rows.length ? round4(mean(rows) * 100) : null,
    median: rows.length ? round4(median(rows) * 100) : null,
  }
}

function regimeProfile(events) {
  return {
    n: events.length,
    spyRet20: level(events.map((event) => event.predictors.spyRet20)),
    spyAtr: level(events.map((event) => event.predictors.spyAtr)),
    eventAtr: level(events.map((event) => event.predictors.atrPct)),
    withinAtr: level(events.map((event) => event.predictors.withinAtr)),
  }
}

const lowWindow = (event) => event.lowToWindow
const lowT20 = (event) => event.fromLow?.t20
const hitTiming = (event) => (event.hits?.["10"]?.reached ? event.hits["10"].days : null)
const recovered = (event) => (event.lowDay == null ? null : event.hits?.["10"]?.reached ? 1 : 0)

function beatsSimple(complex, simple) {
  if (!complex?.test || !simple?.test) return false
  const left = complex.test
  const right = simple.test
  return finite(left.oosR2) && finite(right.oosR2) && left.oosR2 > right.oosR2
    && finite(left.spearman) && finite(right.spearman) && left.spearman > right.spearman
    && finite(left.mae) && finite(right.mae) && left.mae < right.mae
    && left.oosR2 > 0
    && left.spearman > 0
}

function failsPrimary(model) {
  const row = model?.test
  if (!row || !finite(row.oosR2) || !finite(row.spearman)) return true
  return row.oosR2 <= 0 || row.spearman < WEAK_SPEARMAN
}

export function judgeOos(input) {
  if (!(input.testN >= 10)) return { label: "D", text: "표본 부족" }
  const wins = (model) => {
    const signs = []
    for (const key of ["70", "60", "50"]) {
      const block = input.splits[key]
      if (!beatsSimple(block[model], block.A)) return false
      signs.push(block[model].train.direction)
    }
    return signs.every((sign) => sign === signs[0] && sign !== 0)
  }
  if (wins("C") || wins("D")) return { label: "A", text: "OOS 재현 확인" }
  if (failsPrimary(input.splits["70"].C) && failsPrimary(input.splits["70"].D)) return { label: "C", text: "재현 실패" }
  return { label: "B", text: "부분 재현" }
}

function publicLinear(fit) {
  if (!fit) return null
  return {
    train: fit.train,
    test: fit.test,
  }
}

function periodErrors(pairs) {
  const rows = pairs.filter((row) => periodOf(row.t0Date) === "B" && finite(row.y) && finite(row.yhat))
  const errors = rows.map((row) => row.y - row.yhat)
  return {
    n: rows.length,
    mae: rows.length ? round4(mean(errors.map((error) => Math.abs(error))) * 100) : null,
    meanError: rows.length ? round4(mean(errors) * 100) : null,
    conclusion: sampleLabel(rows.length),
  }
}

export function study(events, options = {}) {
  assertBaseline(events)
  const trials = options.permutations ?? PERMUTATIONS
  const outcomes = { lowWindow, lowT20, hitTiming }
  const splits = {}
  for (const [name, fraction] of SPLIT_FRACTIONS) {
    const split = chronologicalSplit(events, fraction)
    const models = {}
    for (const id of CONTINUOUS) {
      models[id] = {}
      for (const [outcome, read] of Object.entries(outcomes)) {
        const spec = outcome === "hitTiming" ? { ...MODEL_SPEC[id], errorUnit: 1 } : MODEL_SPEC[id]
        models[id][outcome] = transferLinear(split.train, split.test, read, spec)
      }
    }
    const classes = {}
    for (const id of CLASS_MODELS) classes[id] = transferClass(split.train, split.test, recovered, MODEL_SPEC[id])
    const permutation = {}
    if (trials > 0) {
      for (const id of ["A", "B", "C", "D"]) {
        const fit = models[id].lowWindow
        permutation[id] = fit ? permutationTail(fit.pairs.map((row) => row.y), fit.pairs.map((row) => row.yhat), trials, 20261006 + name.charCodeAt(0) * 100 + id.charCodeAt(0)) : null
      }
    }
    const periodB = events.filter((event) => periodOf(event.t0Date) === "B")
    const periodBTest = split.test.filter((event) => periodOf(event.t0Date) === "B")
    splits[name] = {
      trainN: split.trainN,
      testN: split.testN,
      target: split.target,
      trainTickers: split.trainTickers,
      testTickers: split.testTickers,
      sharedTickers: split.sharedTickers,
      trainStart: split.trainStart,
      trainEnd: split.trainEnd,
      testStart: split.testStart,
      testEnd: split.testEnd,
      testRegime: regimeProfile(split.test),
      models: Object.fromEntries(CONTINUOUS.map((id) => [id, {
        lowWindow: publicLinear(models[id].lowWindow),
        lowT20: publicLinear(models[id].lowT20),
        hitTiming: publicLinear(models[id].hitTiming),
      }])),
      classification: classes,
      permutation,
      periodB: {
        all: { ...regimeProfile(periodB), lowWindow: level(periodB.map(lowWindow)) },
        inTest: periodBTest.length,
        inTrain: periodB.length - periodBTest.length,
        testErrorA: periodErrors(models.A.lowWindow?.pairs ?? []),
        testErrorC: periodErrors(models.C.lowWindow?.pairs ?? []),
      },
    }
  }
  const judgment = judgeOos({
    testN: splits["70"].models.A.lowWindow?.test.n ?? 0,
    splits: Object.fromEntries(["70", "60", "50"].map((key) => [key, {
      A: splits[key].models.A.lowWindow,
      C: splits[key].models.C.lowWindow,
      D: splits[key].models.D.lowWindow,
    }])),
  })
  return { splits, judgment }
}
