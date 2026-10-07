/**
 * US single-stock hold-conviction study v32 (research only).
 *
 * Asks whether information known at the T+5 close separates later
 * buy-and-hold results. The loss limits are evaluation cuts, not inputs.
 * Recovery time and future tails are outcomes only. The predictor list and
 * the M0–M8 ladder are fixed before the sample is scored. No threshold is
 * chosen because it raised the window return. v1–v31 files are not modified.
 * selectedStrategy stays null. This is not a sell rule.
 *
 * A predictor clears the return bar when its window Spearman interval
 * excludes 0, the permutation tail is below 0.05, T+20 has the same sign,
 * at least two chronological test splits with n>=10 keep that sign, leaving
 * out one ticker does not flip the sign, and the ticker-equal-weight
 * correlation has the same sign. It also clears the -20% bar when both
 * median-split sides have n>=10 and the bootstrap interval for the -20%
 * tail gap — the lower-return side minus the higher-return side — sits
 * above 0.
 *
 * Strong support needs look-ahead violations of 0 and at least two
 * pre-specified predictors clearing both bars. One predictor is not enough.
 * Partial support, when that fails, needs one predictor that clears both
 * bars, or at least one that clears the return bar. Evidence against needs
 * no return-bar predictor and test R² at or below 0 on at least two splits
 * for every model. Otherwise the hold-conviction signal is not supported.
 */

import { mean, median } from "./equity-sell-backtest-v2.mjs"
import { chronologicalSplit, SPLIT_FRACTIONS } from "./equity-sell-backtest-v18.mjs"
import { sampleStdev, leaveOneCorrelation, priceStateBlock } from "./equity-sell-backtest-v7.mjs"
import { SELECTED_STRATEGY as V23_SELECTED_STRATEGY, measureCheckpoint } from "./equity-sell-backtest-v23.mjs"
import { SELECTED_STRATEGY as V27_SELECTED_STRATEGY } from "./equity-sell-backtest-v27.mjs"
import { SELECTED_STRATEGY as V28_SELECTED_STRATEGY } from "./equity-sell-backtest-v28.mjs"
import { SELECTED_STRATEGY as V29_SELECTED_STRATEGY } from "./equity-sell-backtest-v29.mjs"
import { SELECTED_STRATEGY as V30_SELECTED_STRATEGY, recoveryPoint, recoveryState } from "./equity-sell-backtest-v30.mjs"
import {
  SELECTED_STRATEGY as V31_SELECTED_STRATEGY,
  assertBaseline,
  assertEventList,
  assertV18Split,
  attachEarly,
  attachForward,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  auditDecisionLookAhead,
  dateIndex,
  loadOhlcv,
  selectMildEvents,
} from "./equity-sell-backtest-v31.mjs"

export {
  SPLIT_FRACTIONS,
  assertBaseline,
  assertEventList,
  assertV18Split,
  attachEarly,
  attachForward,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  auditDecisionLookAhead,
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
const SEED = 20261030
const TOLERANCE = 1e-10
const HEADLINE_SPLIT = "70"
const CONTINUOUS = [
  "t0", "leadership", "eventAtr", "withinAtr",
  "maeT1", "maeT3", "maeT5", "fromMae", "returnT5", "depthT5",
  "correctionDuration", "correctionSpeed",
  "ret20", "distMa20", "distMa50Prior", "pos60", "pos120",
  "spyRet20", "spyAtr",
]
const QUARTILE_KEYS = ["t0", "leadership", "eventAtr", "withinAtr", "returnT5", "fromMae", "correctionSpeed"]
const MODEL_ORDER = ["M0", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8"]
const MODELS = {
  M0: ["t0"],
  M1: ["t0", "leadership"],
  M2: ["t0", "leadership", "eventAtr"],
  M3: ["t0", "leadership", "eventAtr", "returnT5"],
  M4: ["t0", "leadership", "eventAtr", "returnT5", "depthT5"],
  M5: ["t0", "leadership", "eventAtr", "returnT5", "depthT5", "stateRecovering"],
  M6: ["t0", "leadership", "eventAtr", "returnT5", "depthT5", "stateRecovering", "correctionSpeed"],
  M7: ["t0", "leadership", "eventAtr", "returnT5", "depthT5", "stateRecovering", "correctionSpeed", "ret20", "distMa20", "distMa50Prior", "pos60", "pos120"],
  M8: ["t0", "leadership", "eventAtr", "returnT5", "depthT5", "stateRecovering", "correctionSpeed", "ret20", "distMa20", "distMa50Prior", "pos60", "pos120", "spyRet20", "spyAtr"],
}
const FORBIDDEN = ["window", "t10", "t20", "t40", "tail20", "tail10", "days5", "days10", "daysEntry", "futureLow"]

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
  if (n < 5) return "결론 금지"
  if (n < 10) return "수치만"
  return "제한적"
}

function share(flags) {
  if (!flags.length) return null
  return round2((flags.filter(Boolean).length / flags.length) * 100)
}

function isTail(value, level) {
  return finite(value) && value <= -level + 1e-12
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

function ranksOf(values) {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value || a.index - b.index)
  const ranks = Array(values.length)
  for (let i = 0; i < order.length;) {
    let j = i
    while (j + 1 < order.length && order[j + 1].value === order[i].value) j += 1
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k += 1) ranks[order[k].index] = avg
    i = j + 1
  }
  return ranks
}

export function rawSpearman(xs, ys) {
  if (xs.length !== ys.length || xs.length < 2) return null
  const rx = ranksOf(xs)
  const ry = ranksOf(ys)
  const mx = mean(rx)
  const my = mean(ry)
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < rx.length; i += 1) {
    const a = rx[i] - mx
    const b = ry[i] - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  if (dx === 0 || dy === 0) return null
  return num / Math.sqrt(dx * dy)
}

function rawPearson(xs, ys) {
  if (xs.length !== ys.length || xs.length < 2) return null
  const mx = mean(xs)
  const my = mean(ys)
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < xs.length; i += 1) {
    const a = xs[i] - mx
    const b = ys[i] - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  if (dx === 0 || dy === 0) return null
  return num / Math.sqrt(dx * dy)
}

function usablePairs(rows, xKey, yKey) {
  const pairs = []
  for (const row of rows) {
    if (finite(row[xKey]) && finite(row[yKey])) pairs.push(row)
  }
  return pairs
}

function bootstrapSpearman(pairs, xKey, yKey, trials, seed) {
  const n = pairs.length
  if (n < 2) return null
  const xs = pairs.map((row) => row[xKey])
  const ys = pairs.map((row) => row[yKey])
  const actual = rawSpearman(xs, ys)
  if (!finite(actual)) return null
  const random = mulberry32(seed)
  const boots = []
  const sampleX = Array(n)
  const sampleY = Array(n)
  for (let trial = 0; trial < trials; trial += 1) {
    for (let i = 0; i < n; i += 1) {
      const draw = Math.floor(random() * n)
      sampleX[i] = xs[draw]
      sampleY[i] = ys[draw]
    }
    const rho = rawSpearman(sampleX, sampleY)
    if (finite(rho)) boots.push(rho)
  }
  boots.sort((a, b) => a - b)
  let extreme = 0
  const shuffled = ys.slice()
  for (let trial = 0; trial < trials; trial += 1) {
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1))
      const swap = shuffled[i]
      shuffled[i] = shuffled[j]
      shuffled[j] = swap
    }
    const rho = rawSpearman(xs, shuffled)
    if (finite(rho) && Math.abs(rho) >= Math.abs(actual) - 1e-15) extreme += 1
  }
  return {
    n,
    rho: round4(actual),
    rawRho: actual,
    pearson: round4(rawPearson(xs, ys)),
    ci95: boots.length ? [round4(boots[Math.floor(0.025 * boots.length)]), round4(boots[Math.ceil(0.975 * boots.length) - 1])] : null,
    rawCi: boots.length ? [boots[Math.floor(0.025 * boots.length)], boots[Math.ceil(0.975 * boots.length) - 1]] : null,
    permutationTail: round4(extreme / trials),
  }
}

function bootstrapMeanGap(left, right, trials, seed) {
  const a = left.filter(finite)
  const b = right.filter(finite)
  if (a.length < 2 || b.length < 2) return null
  const actual = mean(a) - mean(b)
  const random = mulberry32(seed)
  const boots = []
  for (let trial = 0; trial < trials; trial += 1) {
    let sumA = 0
    let sumB = 0
    for (let i = 0; i < a.length; i += 1) sumA += a[Math.floor(random() * a.length)]
    for (let i = 0; i < b.length; i += 1) sumB += b[Math.floor(random() * b.length)]
    boots.push(sumA / a.length - sumB / b.length)
  }
  boots.sort((leftValue, rightValue) => leftValue - rightValue)
  const pooled = a.concat(b)
  let extreme = 0
  for (let trial = 0; trial < trials; trial += 1) {
    for (let i = pooled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1))
      const swap = pooled[i]
      pooled[i] = pooled[j]
      pooled[j] = swap
    }
    const gap = mean(pooled.slice(0, a.length)) - mean(pooled.slice(a.length))
    if (Math.abs(gap) >= Math.abs(actual) - 1e-15) extreme += 1
  }
  return {
    meanDiff: pct(actual),
    rawDiff: actual,
    ci95: [pct(boots[Math.floor(0.025 * trials)]), pct(boots[Math.ceil(0.975 * trials) - 1])],
    rawCi: [boots[Math.floor(0.025 * trials)], boots[Math.ceil(0.975 * trials) - 1]],
    permutationTail: round4(extreme / trials),
  }
}

function solveLinear(matrix, vector) {
  const n = vector.length
  const rows = matrix.map((row, index) => [...row, vector[index]])
  for (let col = 0; col < n; col += 1) {
    let pivot = col
    for (let row = col + 1; row < n; row += 1) if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row
    const swap = rows[col]
    rows[col] = rows[pivot]
    rows[pivot] = swap
    const scale = rows[col][col]
    if (!finite(scale) || Math.abs(scale) < 1e-12) return null
    for (let col2 = col; col2 <= n; col2 += 1) rows[col][col2] /= scale
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue
      const factor = rows[row][col]
      for (let col2 = col; col2 <= n; col2 += 1) rows[row][col2] -= factor * rows[col][col2]
    }
  }
  return rows.map((row) => row[n])
}

function fitLinear(train, test, keys, allowOverlap = false) {
  const complete = (rows) => rows.filter((row) => finite(row.window) && keys.every((key) => finite(row[key])))
  const tr = complete(train)
  const te = complete(test)
  const p = keys.length + 1
  if (tr.length <= p) return { identified: false, trainN: tr.length, testN: te.length }
  const stats = {}
  for (const key of keys) {
    const values = tr.map((row) => row[key])
    stats[key] = { mean: mean(values), sd: sampleStdev(values) }
    if (!(stats[key].sd > 0)) return { identified: false, trainN: tr.length, testN: te.length }
  }
  const scaled = (row) => keys.map((key) => (row[key] - stats[key].mean) / stats[key].sd)
  const xtx = Array.from({ length: p }, () => Array(p).fill(0))
  const xty = Array(p).fill(0)
  for (const row of tr) {
    const x = [1, ...scaled(row)]
    for (let i = 0; i < p; i += 1) {
      xty[i] += x[i] * row.window
      for (let j = 0; j < p; j += 1) xtx[i][j] += x[i] * x[j]
    }
  }
  const beta = solveLinear(xtx, xty)
  if (!beta) return { identified: false, trainN: tr.length, testN: te.length }
  const predict = (row) => {
    const x = scaled(row)
    let value = beta[0]
    for (let i = 0; i < keys.length; i += 1) value += beta[i + 1] * x[i]
    return value
  }
  const score = (rows) => {
    const y = rows.map((row) => row.window)
    const yhat = rows.map(predict)
    const center = mean(y)
    let sse = 0
    let sst = 0
    let abs = 0
    for (let i = 0; i < y.length; i += 1) {
      const error = y[i] - yhat[i]
      sse += error * error
      sst += (y[i] - center) ** 2
      abs += Math.abs(error)
    }
    const r2 = sst === 0 ? null : 1 - sse / sst
    const adjusted = r2 == null || rows.length <= p ? null : 1 - ((1 - r2) * (rows.length - 1)) / (rows.length - p)
    return {
      n: rows.length,
      r2: round4(r2),
      rawR2: r2,
      adjustedR2: round4(adjusted),
      spearman: round4(rawSpearman(yhat, y)),
      rawSpearman: rawSpearman(yhat, y),
      mae: round4((abs / rows.length) * 100),
      y,
      yhat,
    }
  }
  const trainIds = new Set(tr.map((row) => row.eventId))
  if (!allowOverlap && te.some((row) => trainIds.has(row.eventId))) throw new Error("train and test events overlap")
  return { identified: true, train: score(tr), test: te.length >= 2 ? score(te) : null, keys }
}

export function withPreEntryTrend(events, seriesBySymbol) {
  const out = events.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`trend series missing ${event.eventId}`)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    if (t0Idx < 0) throw new Error(`trend date missing ${event.eventId}`)
    const state = priceStateBlock(series.closes, t0Idx)
    return {
      ...event,
      predictors: {
        ...event.predictors,
        ret20: state.ret20,
        distMa20: state.distMa20,
        distMa50Prior: state.distMa50,
      },
    }
  })
  out.bandCounts = events.bandCounts
  return out
}

export function predictorFrame(event) {
  const predictors = event.predictors ?? {}
  const t5 = event.early?.t5 ?? {}
  const t3 = event.early?.t3 ?? {}
  const t1 = event.early?.t1 ?? {}
  return {
    t0: predictors.t0,
    leadership: predictors.leadership,
    eventAtr: predictors.atrPct,
    withinAtr: predictors.withinAtr,
    maeT1: t1.mae,
    maeT3: t3.mae,
    maeT5: t5.mae,
    fromMae: t5.fromMae,
    returnT5: t5.return,
    depthT5: t5.depth,
    correctionDuration: predictors.correctionDuration,
    correctionSpeed: predictors.correctionSpeed,
    ret20: predictors.ret20,
    distMa20: predictors.distMa20,
    distMa50Prior: predictors.distMa50Prior,
    pos60: predictors.pos60,
    pos120: predictors.pos120,
    spyRet20: predictors.spyRet20,
    spyAtr: predictors.spyAtr,
    stateRecovering: event.early?.stateT5 === "RECOVERING" ? 1 : 0,
  }
}

function firstHit(closes, start, end, target) {
  for (let k = start + 1; k <= end; k += 1) {
    if (closes[k] >= target - 1e-12) return k - start
  }
  return null
}

function buildRows(events, seriesBySymbol) {
  return events.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`hold series missing ${event.eventId}`)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    const t5Idx = t0Idx + 5
    const windowIdx = event.hold?.windowIdx
    const t5Close = series.closes[t5Idx]
    if (t0Idx < 0 || !(t5Close > 0)) throw new Error(`hold path missing ${event.eventId}`)
    const bh = (idx) => (finite(idx) && idx >= t5Idx && idx < series.closes.length && series.closes[idx] > 0 ? series.closes[idx] / t5Close - 1 : null)
    const window = bh(windowIdx)
    const searchable = finite(windowIdx) && windowIdx >= t5Idx
    const days5 = searchable ? firstHit(series.closes, t5Idx, windowIdx, t5Close * 1.05) : null
    const days10 = searchable ? firstHit(series.closes, t5Idx, windowIdx, t5Close * 1.1) : null
    const daysEntry = searchable ? firstHit(series.closes, t5Idx, windowIdx, t5Close) : null
    return {
      eventId: event.eventId,
      ticker: event.ticker,
      t0Date: event.t0Date,
      state: event.early.stateT5,
      atrBand: event.atrBand,
      leadershipGroup: event.leadershipGroup,
      ...predictorFrame(event),
      t10: bh(t0Idx + 10),
      t20: bh(t0Idx + 20),
      t40: bh(t0Idx + 40),
      window,
      forwardWindow: event.forward?.window ?? null,
      forwardT20: event.forward?.t20 ?? null,
      days5,
      days10,
      daysEntry,
      miss5: searchable ? (days5 == null ? 1 : 0) : null,
      miss10: searchable ? (days10 == null ? 1 : 0) : null,
      missEntry: searchable ? (daysEntry == null ? 1 : 0) : null,
    }
  })
}

function level(rows, key) {
  const xs = rows.map((row) => row[key]).filter(finite)
  const n = xs.length
  const base = { n, conclusion: conclusion(n) }
  if (n < 5) return { ...base, mean: null, median: null, win: null, tail5: null, tail10: null, tail15: null, tail20: null }
  return {
    ...base,
    mean: pct(mean(xs)),
    median: pct(median(xs)),
    win: share(xs.map((value) => value > 0)),
    tail5: share(xs.map((value) => isTail(value, 0.05))),
    tail10: share(xs.map((value) => isTail(value, 0.1))),
    tail15: share(xs.map((value) => isTail(value, 0.15))),
    tail20: share(xs.map((value) => isTail(value, 0.2))),
    rawTail20: xs.filter((value) => isTail(value, 0.2)).length / n,
  }
}

function linkPoint(rows, xKey, yKey) {
  const pairs = usablePairs(rows, xKey, yKey)
  const xs = pairs.map((row) => row[xKey])
  const ys = pairs.map((row) => row[yKey])
  return {
    n: pairs.length,
    conclusion: conclusion(pairs.length),
    spearman: round4(rawSpearman(xs, ys)),
    rawSpearman: rawSpearman(xs, ys),
    pearson: round4(rawPearson(xs, ys)),
  }
}

function tickerEqual(rows, xKey, yKey) {
  const groups = new Map()
  for (const row of usablePairs(rows, xKey, yKey)) {
    const group = groups.get(row.ticker) ?? []
    group.push(row)
    groups.set(row.ticker, group)
  }
  const xs = []
  const ys = []
  for (const group of groups.values()) {
    xs.push(mean(group.map((row) => row[xKey])))
    ys.push(mean(group.map((row) => row[yKey])))
  }
  return { tickers: xs.length, spearman: round4(rawSpearman(xs, ys)), rawSpearman: rawSpearman(xs, ys) }
}

function medianSides(rows, key) {
  const ready = rows.filter((row) => finite(row[key]) && finite(row.window))
  const cut = median(ready.map((row) => row[key]))
  return {
    cut,
    low: ready.filter((row) => row[key] <= cut),
    high: ready.filter((row) => row[key] > cut),
  }
}

function solveModelSet(train, test) {
  const out = {}
  for (const id of MODEL_ORDER) out[id] = fitLinear(train, test, MODELS[id])
  return out
}

function publicFit(fit) {
  if (!fit?.identified) return { identified: false, trainN: fit?.trainN ?? null, testN: fit?.testN ?? null }
  const trim = (score) => score ? ({
    n: score.n,
    r2: score.r2,
    adjustedR2: score.adjustedR2,
    spearman: score.spearman,
    mae: score.mae,
  }) : null
  return { identified: true, train: trim(fit.train), test: trim(fit.test) }
}

export function judgeHoldConviction(input) {
  if (input.lookAheadViolations !== 0) throw new Error("look-ahead violation blocks the hold-conviction judgment")
  const full = input.cards.filter((card) => card.returnClear && card.tailClear)
  const returns = input.cards.filter((card) => card.returnClear)
  const modelsFail = input.models.every((model) => model.nonPositiveSplits >= 2)
  let label = "보유 확신 신호 부족"
  if (full.length >= 2) label = "강한 보유 확신 신호"
  else if (full.length === 1 || returns.length >= 1) label = "부분적인 보유 확신 신호"
  else if (modelsFail) label = "반대 증거"
  return {
    label,
    full: full.length,
    returns: returns.length,
    anchoredSplit: HEADLINE_SPLIT,
    primary: ["window return", "T+20 return", "window -20% tail"],
  }
}

export function auditHoldLookAhead(events, seriesBySymbol) {
  let checked = 0
  for (const event of events) {
    const frame = predictorFrame(event)
    for (const key of FORBIDDEN) if (key in frame) throw new Error(`future field entered the predictor frame ${key}`)
    for (const id of MODEL_ORDER) {
      for (const key of MODELS[id]) if (FORBIDDEN.includes(key)) throw new Error(`model uses a future field ${id} ${key}`)
    }
    const poisonedEvent = { ...event, forward: { window: 9, t20: 9, t10: 9, t40: 9 }, futureLow: -1, days5: 1 }
    const again = predictorFrame(poisonedEvent)
    for (const key of Object.keys(frame)) {
      if (frame[key] !== again[key]) throw new Error(`future outcome changed a predictor ${event.eventId} ${key}`)
    }
    const series = seriesBySymbol.get(event.ticker)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    if (t0Idx < 0) throw new Error(`look-ahead date missing ${event.eventId}`)
    const poisoned = series.closes.slice()
    const future = t0Idx + 6
    if (future < poisoned.length) poisoned[future] = poisoned[t0Idx] * 0.25
    else poisoned.push(poisoned[t0Idx] * 0.25)
    const state = priceStateBlock(series.closes, t0Idx)
    const poisonedCloses = series.closes.slice()
    if (future < poisonedCloses.length) poisonedCloses[future] = poisonedCloses[t0Idx] * 0.25
    else poisonedCloses.push(poisonedCloses[t0Idx] * 0.25)
    const stateAgain = priceStateBlock(poisonedCloses, t0Idx)
    if (state.ret20 !== stateAgain.ret20 || state.distMa20 !== stateAgain.distMa20 || state.distMa50 !== stateAgain.distMa50) {
      throw new Error(`future bar changed pre-entry trend ${event.eventId}`)
    }
    if (frame.ret20 !== state.ret20 || frame.distMa20 !== state.distMa20 || frame.distMa50Prior !== state.distMa50) {
      throw new Error(`pre-entry trend drifted from the v7 block ${event.eventId}`)
    }
    const stored = recoveryPoint(measureCheckpoint(series.closes, t0Idx, 5))
    const next = recoveryPoint(measureCheckpoint(poisoned, t0Idx, 5))
    const storedState = recoveryState(recoveryPoint(measureCheckpoint(series.closes, t0Idx, 3)), stored)
    const nextState = recoveryState(recoveryPoint(measureCheckpoint(poisoned, t0Idx, 3)), next)
    if (storedState !== event.early.stateT5 || nextState !== event.early.stateT5) throw new Error(`future bar changed T+5 state ${event.eventId}`)
    for (const field of ["return", "mae", "depth", "fromMae"]) {
      if (!finite(stored?.[field]) || Math.abs(stored[field] - next[field]) > 1e-10 || Math.abs(stored[field] - event.early.t5[field]) > 1e-8) {
        throw new Error(`future bar changed T+5 ${field} ${event.eventId}`)
      }
    }
    checked += 1
  }
  return { ok: true, checked, violations: 0, predictorLastBar: "T+5 close", outcomes: "recovery time and future tails stay out of the models" }
}

function assertIdentities(rows) {
  let checked = 0
  let maxAbsError = 0
  for (const row of rows) {
    if (finite(row.window) && finite(row.forwardWindow)) {
      maxAbsError = Math.max(maxAbsError, Math.abs(row.window - row.forwardWindow))
      checked += 1
    }
    if (finite(row.t20) && finite(row.forwardT20)) {
      maxAbsError = Math.max(maxAbsError, Math.abs(row.t20 - row.forwardT20))
      checked += 1
    }
    if (row.miss5 != null && row.days5 != null && row.miss5 !== 0) throw new Error(`recovered day marked missing ${row.eventId}`)
    if (row.miss5 === 1 && row.days5 != null) throw new Error(`missing recovery has a day count ${row.eventId}`)
  }
  for (const key of Object.keys(MODELS)) {
    if (MODELS[key].some((field) => FORBIDDEN.includes(field))) throw new Error(`forbidden model field ${key}`)
  }
  return { ok: maxAbsError <= TOLERANCE, checked, maxAbsError }
}

export function study(events, seriesBySymbol, options = {}) {
  if ([V23_SELECTED_STRATEGY, V27_SELECTED_STRATEGY, V28_SELECTED_STRATEGY, V29_SELECTED_STRATEGY, V30_SELECTED_STRATEGY, V31_SELECTED_STRATEGY, SELECTED_STRATEGY].some((value) => value !== null)) {
    throw new Error("selectedStrategy must stay null")
  }
  if (!seriesBySymbol) throw new Error("hold study needs price series")
  assertBaseline(events)
  assertV18Split(events)
  assertEventList(events)
  const stateCounts = {
    RECOVERING: events.filter((event) => event.early.stateT5 === "RECOVERING").length,
    STABILIZING: events.filter((event) => event.early.stateT5 === "STABILIZING").length,
    STILL_FALLING: events.filter((event) => event.early.stateT5 === "STILL_FALLING").length,
  }
  if (stateCounts.RECOVERING !== 53 || stateCounts.STABILIZING !== 4 || stateCounts.STILL_FALLING !== 46) throw new Error("T+5 state counts drifted")
  const maxEvents = Math.max(...events.reduce((map, event) => map.set(event.ticker, (map.get(event.ticker) ?? 0) + 1), new Map()).values())
  if (maxEvents > 9) throw new Error("within-stock event count drifted")
  const priced = withPreEntryTrend(events, seriesBySymbol)
  const decisionAudit = auditDecisionLookAhead(priced, seriesBySymbol)
  const holdAudit = auditHoldLookAhead(priced, seriesBySymbol)
  const lookAheadViolations = (options.lookAheadViolations ?? 0) + decisionAudit.violations + holdAudit.violations
  if (lookAheadViolations !== 0) throw new Error("look-ahead audit failed")
  const rows = buildRows(priced, seriesBySymbol)
  const identities = assertIdentities(rows)
  if (!identities.ok) throw new Error("hold identities failed")
  const trials = options.bootstrap ?? BOOTSTRAP
  const fullBoot = trials >= BOOTSTRAP
  const windowRows = rows.filter((row) => finite(row.window))
  let cursor = 0
  const nextSeed = () => {
    const seed = SEED + cursor
    cursor += 1
    return seed
  }
  const univariate = {}
  for (const key of CONTINUOUS) {
    const windowLink = fullBoot ? bootstrapSpearman(usablePairs(windowRows, key, "window"), key, "window", trials, nextSeed()) : null
    const t20Link = fullBoot ? bootstrapSpearman(usablePairs(rows, key, "t20"), key, "t20", trials, nextSeed()) : null
    const t40Point = linkPoint(rows, key, "t40")
    const tail20Link = fullBoot ? bootstrapSpearman(usablePairs(windowRows, key, "window").map((row) => ({ ...row, tail20: isTail(row.window, 0.2) ? 1 : 0 })), key, "tail20", trials, nextSeed()) : null
    const tail10Point = linkPoint(windowRows.map((row) => ({ ...row, tail10: isTail(row.window, 0.1) ? 1 : 0 })), key, "tail10")
    const daysPoint = linkPoint(windowRows.filter((row) => row.days5 != null), key, "days5")
    const equal = tickerEqual(windowRows, key, "window")
    const sides = medianSides(windowRows, key)
    const gap = fullBoot ? bootstrapMeanGap(sides.high.map((row) => row.window), sides.low.map((row) => row.window), trials, nextSeed()) : null
    const highTail = sides.high.map((row) => (isTail(row.window, 0.2) ? 1 : 0))
    const lowTail = sides.low.map((row) => (isTail(row.window, 0.2) ? 1 : 0))
    const tailGap = fullBoot ? bootstrapMeanGap(lowTail, highTail, trials, nextSeed()) : null
    const higher = (gap?.rawDiff ?? 0) >= 0 ? sides.high : sides.low
    const lower = higher === sides.high ? sides.low : sides.high
    const favorable = fullBoot ? bootstrapMeanGap(
      lower.map((row) => (isTail(row.window, 0.2) ? 1 : 0)),
      higher.map((row) => (isTail(row.window, 0.2) ? 1 : 0)),
      trials,
      nextSeed(),
    ) : null
    univariate[key] = {
      window: windowLink,
      t20: t20Link,
      t40: t40Point,
      tail10: tail10Point,
      tail20: tail20Link,
      days5: daysPoint,
      tickerEqual: { tickers: equal.tickers, spearman: equal.spearman, rawSpearman: equal.rawSpearman },
      buckets: {
        low: { ...level(sides.low, "window"), side: "at or below median" },
        high: { ...level(sides.high, "window"), side: "above median" },
      },
      returnGap: gap ? { meanDiff: gap.meanDiff, ci95: gap.ci95, permutationTail: gap.permutationTail } : null,
      tailGap: tailGap ? { meanDiff: tailGap.meanDiff, ci95: tailGap.ci95, permutationTail: tailGap.permutationTail } : null,
      favorableTail: favorable ? { meanDiff: favorable.meanDiff, ci95: favorable.ci95, rawCiLow: favorable.rawCi[0], permutationTail: favorable.permutationTail } : null,
    }
  }
  const stateGapRows = {
    high: windowRows.filter((row) => row.state === "RECOVERING"),
    low: windowRows.filter((row) => row.state === "STILL_FALLING"),
  }
  const stateReturn = fullBoot ? bootstrapMeanGap(stateGapRows.high.map((row) => row.window), stateGapRows.low.map((row) => row.window), trials, nextSeed()) : null
  const stateHigher = (stateReturn?.rawDiff ?? 0) >= 0 ? stateGapRows.high : stateGapRows.low
  const stateLower = stateHigher === stateGapRows.high ? stateGapRows.low : stateGapRows.high
  const stateTail = fullBoot ? bootstrapMeanGap(
    stateLower.map((row) => (isTail(row.window, 0.2) ? 1 : 0)),
    stateHigher.map((row) => (isTail(row.window, 0.2) ? 1 : 0)),
    trials,
    nextSeed(),
  ) : null
  const byState = {}
  for (const state of ["RECOVERING", "STILL_FALLING", "STABILIZING"]) {
    const subset = rows.filter((row) => row.state === state)
    byState[state] = {
      n: subset.length,
      conclusion: conclusion(subset.length),
      window: level(subset, "window"),
      t20: level(subset, "t20"),
      t40: level(subset, "t40"),
      t10: level(subset, "t10"),
    }
  }
  const falling = windowRows.filter((row) => row.state === "STILL_FALLING")
  const stillFalling = {}
  for (const key of ["eventAtr", "withinAtr", "leadership", "returnT5", "fromMae", "maeT5", "correctionSpeed", "t0", "ret20"]) {
    const sides = medianSides(falling, key)
    stillFalling[key] = {
      low: { n: sides.low.length, conclusion: conclusion(sides.low.length), window: level(sides.low, "window"), t20: level(sides.low, "t20") },
      high: { n: sides.high.length, conclusion: conclusion(sides.high.length), window: level(sides.high, "window"), t20: level(sides.high, "t20") },
    }
  }
  const quartiles = {}
  for (const key of QUARTILE_KEYS) {
    const ready = windowRows.filter((row) => finite(row[key]))
    const values = ready.map((row) => row[key]).sort((a, b) => a - b)
    const at = (p) => values[Math.min(values.length - 1, Math.max(0, Math.round((values.length - 1) * p)))]
    const q25 = at(0.25)
    const q75 = at(0.75)
    const bins = {
      low: ready.filter((row) => row[key] < q25),
      mid: ready.filter((row) => row[key] >= q25 && row[key] <= q75),
      high: ready.filter((row) => row[key] > q75),
    }
    quartiles[key] = {
      q25,
      q75,
      low: level(bins.low, "window"),
      mid: level(bins.mid, "window"),
      high: level(bins.high, "window"),
    }
  }
  const inSample = {}
  for (const id of MODEL_ORDER) inSample[id] = fitLinear(windowRows, windowRows, MODELS[id], true)
  const oos = {}
  const modelCards = []
  for (const [name, fraction] of SPLIT_FRACTIONS) {
    const split = chronologicalSplit(events, fraction)
    const trainIds = new Set(split.train.map((event) => event.eventId))
    const testIds = new Set(split.test.map((event) => event.eventId))
    const dates = new Set(split.train.map((event) => event.t0Date))
    if (split.test.some((event) => dates.has(event.t0Date))) throw new Error(`same-date events crossed the split ${name}`)
    const train = windowRows.filter((row) => trainIds.has(row.eventId))
    const test = windowRows.filter((row) => testIds.has(row.eventId))
    const fitted = solveModelSet(train, test)
    oos[name] = { train: split.train.length, test: split.test.length, models: {} }
    for (const id of MODEL_ORDER) oos[name].models[id] = publicFit(fitted[id])
  }
  for (const id of MODEL_ORDER) {
    let nonPositive = 0
    for (const name of Object.keys(oos)) {
      const test = oos[name].models[id].test
      if (test && finite(test.r2) && test.r2 <= 0) nonPositive += 1
    }
    modelCards.push({ id, nonPositiveSplits: nonPositive })
  }
  const loo = {}
  for (const key of CONTINUOUS) {
    const result = leaveOneCorrelation(priced, (event) => predictorFrame(event)[key], (event) => {
      const match = windowRows.find((row) => row.eventId === event.eventId)
      return match ? match.window : null
    })
    loo[key] = {
      baseline: result.baseline.rho,
      min: result.min,
      max: result.max,
      signFlips: result.signFlips.length,
      withinStock: "결론 금지",
    }
  }
  const atr = {}
  for (const label of ["LOW", "MID", "HIGH"]) {
    const subset = windowRows.filter((row) => row.atrBand === label)
    atr[label] = { n: subset.length, conclusion: conclusion(subset.length), window: level(subset, "window"), t20: level(subset, "t20") }
  }
  const leadership = {}
  for (const label of ["HIGH", "MID", "LOW"]) {
    const subset = windowRows.filter((row) => row.leadershipGroup === label)
    leadership[label] = { n: subset.length, conclusion: conclusion(subset.length), window: level(subset, "window"), t20: level(subset, "t20") }
  }
  const cards = CONTINUOUS.map((key) => {
    const link = univariate[key]
    const raw = link.window?.rawRho
    const ci = link.window?.rawCi
    const t20 = link.t20?.rawRho
    let oosSame = 0
    for (const name of Object.keys(oos)) {
      const testEvents = chronologicalSplit(events, SPLIT_FRACTIONS.find((item) => item[0] === name)[1]).test
      const ids = new Set(testEvents.map((event) => event.eventId))
      const sample = windowRows.filter((row) => ids.has(row.eventId))
      const rho = linkPoint(sample, key, "window").rawSpearman
      if (sample.length >= 10 && finite(raw) && finite(rho) && Math.sign(rho) === Math.sign(raw) && rho !== 0) oosSame += 1
    }
    const looRow = loo[key]
    const looFlip = looRow ? looRow.signFlips > 0 : false
    const equalSign = finite(link.tickerEqual.rawSpearman) && finite(raw) && Math.sign(link.tickerEqual.rawSpearman) === Math.sign(raw) && link.tickerEqual.rawSpearman !== 0
    const returnClear = fullBoot
      && finite(raw)
      && ci
      && ci[0] * ci[1] > 0
      && link.window.permutationTail < 0.05
      && finite(t20)
      && Math.sign(t20) === Math.sign(raw)
      && oosSame >= 2
      && !looFlip
      && equalSign
    const tailClear = returnClear
      && link.buckets.low.n >= 10
      && link.buckets.high.n >= 10
      && link.favorableTail
      && link.favorableTail.rawCiLow > 0
    return { id: key, returnClear: Boolean(returnClear), tailClear: Boolean(tailClear), oosSame }
  })
  const judgment = judgeHoldConviction({ lookAheadViolations, cards, models: modelCards })
  const failure = {
    entry: { failed: windowRows.filter((row) => row.missEntry === 1).length, n: windowRows.length, rate: round2((windowRows.filter((row) => row.missEntry === 1).length / windowRows.length) * 100) },
    plus5: { failed: windowRows.filter((row) => row.miss5 === 1).length, n: windowRows.length, rate: round2((windowRows.filter((row) => row.miss5 === 1).length / windowRows.length) * 100) },
    plus10: { failed: windowRows.filter((row) => row.miss10 === 1).length, n: windowRows.length, rate: round2((windowRows.filter((row) => row.miss10 === 1).length / windowRows.length) * 100) },
    conclusion: conclusion(windowRows.length),
  }
  return {
    selectedStrategy: SELECTED_STRATEGY,
    note: "T+5 observables are scored against later buy-and-hold results. They are not a sell rule and the loss limits are not inputs.",
    rules: {
      noRefit: true,
      noThresholdSearch: true,
      headlineSplit: HEADLINE_SPLIT,
      recoveryIsOutcome: true,
      tailIsOutcome: true,
      stabilizing: "결론 금지",
    },
    states: stateCounts,
    identities,
    lookAhead: { decision: decisionAudit, hold: holdAudit, violations: lookAheadViolations },
    levels: {
      window: level(windowRows, "window"),
      t20: level(rows, "t20"),
      t40: level(rows, "t40"),
      t10: level(rows, "t10"),
    },
    failure,
    univariate,
    byState,
    stateContrast: {
      returnGap: stateReturn ? { meanDiff: stateReturn.meanDiff, ci95: stateReturn.ci95, permutationTail: stateReturn.permutationTail } : null,
      tailGap: stateTail ? { meanDiff: stateTail.meanDiff, ci95: stateTail.ci95, permutationTail: stateTail.permutationTail } : null,
    },
    stillFalling,
    quartiles,
    inSample: Object.fromEntries(MODEL_ORDER.map((id) => [id, publicFit({ ...inSample[id], test: inSample[id].train, identified: inSample[id].identified })])),
    oos,
    loo,
    atr,
    leadership,
    cards,
    models: Object.fromEntries(MODEL_ORDER.map((id) => [id, publicFit(inSample[id])])),
    judgment,
    maxEvents,
  }
}
