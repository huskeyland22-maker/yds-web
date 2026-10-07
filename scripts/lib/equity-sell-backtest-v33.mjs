/**
 * US single-stock hold-signal independence study v33 (research only).
 *
 * v32 found that T0, Event ATR, and SPY ATR keep the same rank direction
 * as later window buy-and-hold returns. This study asks whether each still
 * adds information after the others are held fixed. The model ladder is
 * fixed: M0 T0, M1 T0+Event ATR, M2 T0+SPY ATR, M3 all three, M4 adds
 * Leadership only as a bridge back to v32. M4 cannot add or drop a core
 * variable. No threshold is searched. Utility scores are descriptive.
 * State splits, ticker-equal weight, and Leadership do not enter the label.
 * selectedStrategy stays null. This is not a sell rule.
 *
 * Event ATR is independent only on the M3−M2 step (added after T0 and SPY
 * ATR). SPY ATR is independent only on the M3−M1 step (added after T0 and
 * Event ATR). The two steps that add a variable to T0 alone are reported
 * and do not count as a second variable. Increments use the same rows.
 * Split membership is the v18 date split of all 103 events. Metrics use
 * the finite-window rows inside that split. Negative test R² stays negative.
 *
 * A judged step clears only when test R² rises on at least two splits, the
 * larger model's test Spearman stays positive on at least two splits, the
 * average of the three point MAE changes is not positive, the bootstrap
 * interval for the average test-R² change sits entirely above 0, and the
 * partial correlation with window return does not flip sign when one ticker
 * is removed. An interval that sits entirely below 0 marks that step as
 * hurting test fit. It is not a pass.
 *
 * Strong support needs look-ahead violations of 0, both judged steps
 * clearing, and a stable -20% direction on each: the univariate median
 * split and the residual median split, after the other two predictors,
 * both have n>=10 and the bootstrap interval for the lower-return side's
 * tail rate minus the higher-return side's tail rate sits above 0. Partial
 * support, when that fails, needs one judged step clearing. Evidence
 * against needs both judged steps hurting. Otherwise the independent
 * information is not supported. Rank correlation is not treated as a
 * forecast of the return level, and neither is a sell rule.
 */

import { mean, median } from "./equity-sell-backtest-v2.mjs"
import { chronologicalSplit, SPLIT_FRACTIONS } from "./equity-sell-backtest-v18.mjs"
import { sampleStdev, leaveOneCorrelation } from "./equity-sell-backtest-v7.mjs"
import { atrPctAt } from "./equity-sell-backtest-v8.mjs"
import { marketAt } from "./equity-sell-backtest-v14.mjs"
import { SELECTED_STRATEGY as V23_SELECTED_STRATEGY } from "./equity-sell-backtest-v23.mjs"
import { SELECTED_STRATEGY as V27_SELECTED_STRATEGY } from "./equity-sell-backtest-v27.mjs"
import { SELECTED_STRATEGY as V28_SELECTED_STRATEGY } from "./equity-sell-backtest-v28.mjs"
import { SELECTED_STRATEGY as V29_SELECTED_STRATEGY } from "./equity-sell-backtest-v29.mjs"
import { SELECTED_STRATEGY as V30_SELECTED_STRATEGY } from "./equity-sell-backtest-v30.mjs"
import { SELECTED_STRATEGY as V31_SELECTED_STRATEGY } from "./equity-sell-backtest-v31.mjs"
import {
  SELECTED_STRATEGY as V32_SELECTED_STRATEGY,
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
  predictorFrame as v32Frame,
  selectMildEvents,
} from "./equity-sell-backtest-v32.mjs"

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
  selectMildEvents,
}

export const SELECTED_STRATEGY = null
export const BOOTSTRAP = 10000
const SEED = 20261030
const TOLERANCE = 1e-10
const MODEL_ORDER = ["M0", "M1", "M2", "M3", "M4"]
const MODELS = {
  M0: ["t0"],
  M1: ["t0", "eventAtr"],
  M2: ["t0", "spyAtr"],
  M3: ["t0", "eventAtr", "spyAtr"],
  M4: ["t0", "eventAtr", "spyAtr", "leadership"],
}
const STEPS = [
  { id: "eventAtr|t0", added: "eventAtr", base: "M0", full: "M1", judged: false },
  { id: "spyAtr|t0", added: "spyAtr", base: "M0", full: "M2", judged: false },
  { id: "spyAtr|t0+eventAtr", added: "spyAtr", base: "M1", full: "M3", judged: true },
  { id: "eventAtr|t0+spyAtr", added: "eventAtr", base: "M2", full: "M3", judged: true },
  { id: "leadership|m3", added: "leadership", base: "M3", full: "M4", judged: false, auxiliary: true },
]
const PARTIALS = [
  { id: "eventAtr|t0", x: "eventAtr", controls: ["t0"] },
  { id: "spyAtr|t0", x: "spyAtr", controls: ["t0"] },
  { id: "eventAtr|t0+spyAtr", x: "eventAtr", controls: ["t0", "spyAtr"] },
  { id: "spyAtr|t0+eventAtr", x: "spyAtr", controls: ["t0", "eventAtr"] },
]
const CORE = ["t0", "eventAtr", "spyAtr"]
const LAMBDAS = [0, 0.5, 1, 2, 3]
const FORBIDDEN = ["window", "t10", "t20", "t40", "tail20", "tail10", "futureLow", "days5"]

function finite(value) {
  return Number.isFinite(value)
}

function round4(value) {
  return finite(value) ? Math.round(value * 10000) / 10000 : null
}

function round2(value) {
  return finite(value) ? Math.round(value * 100) / 100 : null
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

function signOf(value) {
  if (!finite(value) || Math.abs(value) <= 1e-12) return 0
  return value > 0 ? 1 : -1
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

function residualVector(y, controls) {
  const n = y.length
  const p = controls.length + 1
  if (n <= p) return null
  const xtx = Array.from({ length: p }, () => Array(p).fill(0))
  const xty = Array(p).fill(0)
  for (let i = 0; i < n; i += 1) {
    const x = [1]
    for (const column of controls) x.push(column[i])
    for (let a = 0; a < p; a += 1) {
      xty[a] += x[a] * y[i]
      for (let b = 0; b < p; b += 1) xtx[a][b] += x[a] * x[b]
    }
  }
  const beta = solveLinear(xtx, xty)
  if (!beta) return null
  return y.map((value, index) => {
    let fitted = beta[0]
    for (let k = 0; k < controls.length; k += 1) fitted += beta[k + 1] * controls[k][index]
    return value - fitted
  })
}

export function partialRankCorrelation(x, y, controls) {
  if (x.length !== y.length || x.length < 4) return null
  if (controls.some((column) => column.length !== x.length)) return null
  const rx = ranksOf(x)
  const ry = ranksOf(y)
  const rc = controls.map((column) => ranksOf(column))
  const ex = residualVector(rx, rc)
  const ey = residualVector(ry, rc)
  if (!ex || !ey) return null
  return rawPearson(ex, ey)
}

function r2Of(y, yhat) {
  if (y.length < 2 || y.length !== yhat.length) return null
  const center = mean(y)
  let sse = 0
  let sst = 0
  for (let i = 0; i < y.length; i += 1) {
    sse += (y[i] - yhat[i]) ** 2
    sst += (y[i] - center) ** 2
  }
  if (sst === 0) return null
  return 1 - sse / sst
}

function maeOf(y, yhat) {
  let abs = 0
  for (let i = 0; i < y.length; i += 1) abs += Math.abs(y[i] - yhat[i])
  return (abs / y.length) * 100
}

function completeRows(rows, keys) {
  return rows.filter((row) => finite(row.window) && keys.every((key) => finite(row[key])))
}

function fitLinear(train, test, keys, allowOverlap = false) {
  const tr = completeRows(train, keys)
  const te = completeRows(test, keys)
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
    const rawR2 = r2Of(y, yhat)
    const adjusted = rawR2 == null || rows.length <= p ? null : 1 - ((1 - rawR2) * (rows.length - 1)) / (rows.length - p)
    return {
      n: rows.length,
      r2: round4(rawR2),
      rawR2,
      adjustedR2: round4(adjusted),
      spearman: round4(rawSpearman(yhat, y)),
      rawSpearman: rawSpearman(yhat, y),
      mae: round4(maeOf(y, yhat)),
      rawMae: maeOf(y, yhat),
      y,
      yhat,
    }
  }
  const ids = new Set(tr.map((row) => row.eventId))
  if (!allowOverlap && te.some((row) => ids.has(row.eventId))) throw new Error("train and test events overlap")
  const coefficients = {}
  keys.forEach((key, index) => {
    coefficients[key] = round4(beta[index + 1])
  })
  return {
    identified: true,
    coefficients,
    train: score(tr),
    test: te.length >= 2 ? score(te) : null,
    keys,
  }
}

function fitPair(train, test, smallKeys, largeKeys) {
  const need = largeKeys
  const tr = completeRows(train, need)
  const te = completeRows(test, need)
  const small = fitLinear(tr, te, smallKeys, true)
  const large = fitLinear(tr, te, largeKeys, true)
  return { train: tr, test: te, small, large }
}

function predictTestR2(train, test, keys) {
  const fit = fitLinear(train, test, keys, true)
  return fit.identified && fit.test ? fit.test.rawR2 : null
}

function ciOf(values) {
  if (!values.length) return null
  const sorted = values.slice().sort((a, b) => a - b)
  return [sorted[Math.floor(0.025 * sorted.length)], sorted[Math.ceil(0.975 * sorted.length) - 1]]
}

function bootstrapDelta(parts, trials, seed) {
  const random = mulberry32(seed)
  const point = parts.map((part) => ({
    r2: part.large.rawR2 - part.small.rawR2,
    spearman: part.large.rawSpearman - part.small.rawSpearman,
    mae: part.large.rawMae - part.small.rawMae,
    level: part.large.rawSpearman,
  }))
  const bags = parts.map(() => ({ r2: [], spearman: [], mae: [] }))
  const pooled = { r2: [], spearman: [], mae: [] }
  for (let trial = 0; trial < trials; trial += 1) {
    const draw = []
    for (let s = 0; s < parts.length; s += 1) {
      const n = parts[s].y.length
      const ys = Array(n)
      const a = Array(n)
      const b = Array(n)
      for (let i = 0; i < n; i += 1) {
        const pick = Math.floor(random() * n)
        ys[i] = parts[s].y[pick]
        a[i] = parts[s].small.yhat[pick]
        b[i] = parts[s].large.yhat[pick]
      }
      const r2 = r2Of(ys, b) - r2Of(ys, a)
      const rho = rawSpearman(b, ys) - rawSpearman(a, ys)
      const mae = maeOf(ys, b) - maeOf(ys, a)
      if (finite(r2)) bags[s].r2.push(r2)
      if (finite(rho)) bags[s].spearman.push(rho)
      if (finite(mae)) bags[s].mae.push(mae)
      draw.push({ r2, rho, mae })
    }
    if (draw.every((item) => finite(item.r2) && finite(item.rho) && finite(item.mae))) {
      pooled.r2.push(mean(draw.map((item) => item.r2)))
      pooled.spearman.push(mean(draw.map((item) => item.rho)))
      pooled.mae.push(mean(draw.map((item) => item.mae)))
    }
  }
  const pack = (actual, values) => {
    const ci = ciOf(values)
    return {
      estimate: round4(actual),
      ci95: ci ? [round4(ci[0]), round4(ci[1])] : null,
      rawCiLow: ci ? ci[0] : null,
      rawCiHigh: ci ? ci[1] : null,
    }
  }
  return {
    splits: point.map((item, index) => ({
      r2: pack(item.r2, bags[index].r2),
      spearman: pack(item.spearman, bags[index].spearman),
      mae: pack(item.mae, bags[index].mae),
      testSpearman: round4(item.level),
    })),
    pooled: {
      r2: pack(mean(point.map((item) => item.r2)), pooled.r2),
      spearman: pack(mean(point.map((item) => item.spearman)), pooled.spearman),
      mae: pack(mean(point.map((item) => item.mae)), pooled.mae),
    },
  }
}

function permutationDelta(trainParts, testParts, added, smallKeys, largeKeys, trials, seed) {
  const random = mulberry32(seed)
  const actual = testParts.map((part) => part.large.rawR2 - part.small.rawR2)
  const actualPool = mean(actual)
  const extreme = Array(actual.length).fill(0)
  let extremePool = 0
  let used = 0
  const originals = trainParts.map((rows) => rows.map((row) => row[added]))
  for (let trial = 0; trial < trials; trial += 1) {
    const deltas = []
    for (let s = 0; s < trainParts.length; s += 1) {
      const values = originals[s].slice()
      for (let i = values.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1))
        const swap = values[i]
        values[i] = values[j]
        values[j] = swap
      }
      for (let i = 0; i < values.length; i += 1) trainParts[s][i][added] = values[i]
      const next = predictTestR2(trainParts[s], testParts[s].rows, largeKeys)
      const base = testParts[s].small.rawR2
      deltas.push(finite(next) && finite(base) ? next - base : null)
      for (let i = 0; i < originals[s].length; i += 1) trainParts[s][i][added] = originals[s][i]
    }
    if (deltas.every(finite)) {
      used += 1
      const pool = mean(deltas)
      if (Math.abs(pool) >= Math.abs(actualPool) - 1e-15) extremePool += 1
      for (let s = 0; s < deltas.length; s += 1) {
        if (Math.abs(deltas[s]) >= Math.abs(actual[s]) - 1e-15) extreme[s] += 1
      }
    }
  }
  const denom = used || 1
  return {
    used,
    splits: extreme.map((count) => round4(count / denom)),
    pooled: round4(extremePool / denom),
  }
}

function bootstrapSpearman(xs, ys, trials, seed) {
  const n = xs.length
  const actual = rawSpearman(xs, ys)
  if (!finite(actual)) return null
  const random = mulberry32(seed)
  const boots = []
  for (let trial = 0; trial < trials; trial += 1) {
    const sx = Array(n)
    const sy = Array(n)
    for (let i = 0; i < n; i += 1) {
      const draw = Math.floor(random() * n)
      sx[i] = xs[draw]
      sy[i] = ys[draw]
    }
    const rho = rawSpearman(sx, sy)
    if (finite(rho)) boots.push(rho)
  }
  const ci = ciOf(boots)
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
    pearson: round4(rawPearson(xs, ys)),
    ci95: ci ? [round4(ci[0]), round4(ci[1])] : null,
    rawCiLow: ci ? ci[0] : null,
    permutationTail: round4(extreme / trials),
  }
}

function bootstrapPartial(rows, xKey, controls, trials, seed) {
  const ready = rows.filter((row) => finite(row[xKey]) && finite(row.window) && controls.every((key) => finite(row[key])))
  const x = ready.map((row) => row[xKey])
  const y = ready.map((row) => row.window)
  const z = controls.map((key) => ready.map((row) => row[key]))
  const actual = partialRankCorrelation(x, y, z)
  if (!finite(actual)) return { n: ready.length, rho: null }
  const random = mulberry32(seed)
  const boots = []
  for (let trial = 0; trial < trials; trial += 1) {
    const sx = Array(ready.length)
    const sy = Array(ready.length)
    const sz = z.map(() => Array(ready.length))
    for (let i = 0; i < ready.length; i += 1) {
      const draw = Math.floor(random() * ready.length)
      sx[i] = x[draw]
      sy[i] = y[draw]
      for (let c = 0; c < z.length; c += 1) sz[c][i] = z[c][draw]
    }
    const rho = partialRankCorrelation(sx, sy, sz)
    if (finite(rho)) boots.push(rho)
  }
  const ci = ciOf(boots)
  let extreme = 0
  const shuffled = y.slice()
  for (let trial = 0; trial < trials; trial += 1) {
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1))
      const swap = shuffled[i]
      shuffled[i] = shuffled[j]
      shuffled[j] = swap
    }
    const rho = partialRankCorrelation(x, shuffled, z)
    if (finite(rho) && Math.abs(rho) >= Math.abs(actual) - 1e-15) extreme += 1
  }
  return {
    n: ready.length,
    rho: round4(actual),
    rawRho: actual,
    ci95: ci ? [round4(ci[0]), round4(ci[1])] : null,
    rawCiLow: ci ? ci[0] : null,
    rawCiHigh: ci ? ci[1] : null,
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
  const ci = ciOf(boots)
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
    ci95: ci ? [pct(ci[0]), pct(ci[1])] : null,
    rawCiLow: ci ? ci[0] : null,
    permutationTail: round4(extreme / trials),
  }
}

function vifOf(rows, keys) {
  const ready = completeRows(rows, keys)
  return keys.map((key) => {
    const others = keys.filter((item) => item !== key)
    const y = ready.map((row) => row[key])
    const controls = others.map((item) => ready.map((row) => row[item]))
    const residual = residualVector(y, controls)
    if (!residual) return { key, vif: null, high: false, n: ready.length }
    const fitted = y.map((value, index) => value - residual[index])
    const r2 = r2Of(y, fitted)
    const vif = finite(r2) && r2 < 1 ? 1 / (1 - r2) : null
    return { key, vif: round2(vif), high: finite(vif) && vif >= 5, n: ready.length }
  })
}

function level(rows) {
  const xs = rows.map((row) => row.window).filter(finite)
  const n = xs.length
  const base = { n, conclusion: conclusion(n), tail20Count: xs.filter((value) => isTail(value, 0.2)).length }
  if (n < 5) return { ...base, mean: null, median: null, win: null, tail10: null, tail20: null }
  return {
    ...base,
    mean: pct(mean(xs)),
    median: pct(median(xs)),
    win: share(xs.map((value) => value > 0)),
    tail10: share(xs.map((value) => isTail(value, 0.1))),
    tail20: share(xs.map((value) => isTail(value, 0.2))),
  }
}

function medianSides(rows, key) {
  const ready = rows.filter((row) => finite(row[key]) && finite(row.window))
  const cut = median(ready.map((row) => row[key]))
  return {
    cut: round4(cut),
    low: ready.filter((row) => row[key] <= cut),
    high: ready.filter((row) => row[key] > cut),
  }
}

function favorableTail(low, high, trials, seed) {
  const lowMean = mean(low.map((row) => row.window))
  const highMean = mean(high.map((row) => row.window))
  const lower = lowMean <= highMean ? low : high
  const higher = lower === low ? high : low
  return bootstrapMeanGap(
    lower.map((row) => (isTail(row.window, 0.2) ? 1 : 0)),
    higher.map((row) => (isTail(row.window, 0.2) ? 1 : 0)),
    trials,
    seed,
  )
}

function residualColumn(rows, key, controls) {
  const y = rows.map((row) => row[key])
  const z = controls.map((item) => rows.map((row) => row[item]))
  const residual = residualVector(y, z)
  if (!residual) return null
  return rows.map((row, index) => ({ ...row, residual: residual[index] }))
}

function tickerEqual(rows, xKey) {
  const groups = new Map()
  for (const row of rows) {
    if (!finite(row[xKey]) || !finite(row.window)) continue
    const group = groups.get(row.ticker) ?? []
    group.push(row)
    groups.set(row.ticker, group)
  }
  const xs = []
  const ys = []
  for (const group of groups.values()) {
    xs.push(mean(group.map((row) => row[xKey])))
    ys.push(mean(group.map((row) => row.window)))
  }
  return { tickers: xs.length, spearman: round4(rawSpearman(xs, ys)), rawSpearman: rawSpearman(xs, ys) }
}

function looSummary(events, xRead, yRead) {
  const block = leaveOneCorrelation(events, xRead, yRead)
  return {
    baseline: block.baseline.rho,
    min: block.min,
    max: block.max,
    signFlips: block.signFlips.length,
  }
}

function partialLoo(rows, xKey, controls) {
  const ready = rows.filter((row) => finite(row[xKey]) && finite(row.window) && controls.every((key) => finite(row[key])))
  const rhoOf = (sample) => partialRankCorrelation(
    sample.map((row) => row[xKey]),
    sample.map((row) => row.window),
    controls.map((key) => sample.map((row) => row[key])),
  )
  const baseline = rhoOf(ready)
  const tickers = [...new Set(ready.map((row) => row.ticker))]
  const values = []
  let flips = 0
  for (const ticker of tickers) {
    const next = rhoOf(ready.filter((row) => row.ticker !== ticker))
    if (!finite(next)) continue
    values.push(next)
    if (finite(baseline) && signOf(next) !== signOf(baseline) && signOf(next) !== 0 && signOf(baseline) !== 0) flips += 1
  }
  return {
    baseline: round4(baseline),
    rawBaseline: baseline,
    min: values.length ? round4(Math.min(...values)) : null,
    max: values.length ? round4(Math.max(...values)) : null,
    signFlips: flips,
  }
}

function utility(value, lambda) {
  if (!finite(value)) return null
  return value - lambda * Math.max(0, -value)
}

function coreFrame(event) {
  const prior = v32Frame(event)
  return {
    t0: prior.t0,
    eventAtr: prior.eventAtr,
    spyAtr: prior.spyAtr,
    leadership: prior.leadership,
  }
}

function buildRows(events, seriesBySymbol) {
  return events.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`hold series missing ${event.eventId}`)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    const t5Idx = t0Idx + 5
    const t5Close = series.closes[t5Idx]
    const windowIdx = event.hold?.windowIdx
    if (t0Idx < 0 || !(t5Close > 0)) throw new Error(`hold path missing ${event.eventId}`)
    const bh = (idx) => (finite(idx) && idx >= t5Idx && idx < series.closes.length && series.closes[idx] > 0 ? series.closes[idx] / t5Close - 1 : null)
    return {
      eventId: event.eventId,
      ticker: event.ticker,
      t0Date: event.t0Date,
      state: event.early.stateT5,
      ...coreFrame(event),
      t20: bh(t0Idx + 20),
      t40: bh(t0Idx + 40),
      window: bh(windowIdx),
      forwardWindow: event.forward?.window ?? null,
      forwardT20: event.forward?.t20 ?? null,
    }
  })
}

function publicScore(score) {
  if (!score) return null
  return { n: score.n, r2: score.r2, adjustedR2: score.adjustedR2, spearman: score.spearman, mae: score.mae }
}

function riskStable(gap) {
  return Boolean(gap && finite(gap.rawCiLow) && gap.rawCiLow > 0)
}

export function judgeIndependence(input) {
  if (input.lookAheadViolations !== 0) throw new Error("look-ahead violation blocks the independence judgment")
  const variables = input.variables
  const cleared = variables.filter((item) => item.independent)
  const strong = cleared.length >= 2 && cleared.every((item) => item.riskStable)
  const hurts = variables.length >= 2 && variables.every((item) => item.hurts)
  let label = "독립 정보 증거 부족"
  if (strong) label = "독립적인 보유 신호 확인"
  else if (cleared.length >= 1) label = "부분적인 독립 보유 신호"
  else if (hurts) label = "반대 증거"
  return {
    label,
    cleared: cleared.length,
    core: ["M0", "M1", "M2", "M3"],
    auxiliary: "M4",
  }
}

export function auditCoreLookAhead(events, seriesBySymbol, spy) {
  let checked = 0
  for (const event of events) {
    const frame = coreFrame(event)
    const again = coreFrame({ ...event, forward: { window: 9, t20: 9, t40: 9 }, futureLow: -1, days5: 1 })
    for (const key of Object.keys(frame)) {
      if (frame[key] !== again[key]) throw new Error(`future outcome changed a predictor ${event.eventId}`)
    }
    for (const key of FORBIDDEN) if (key in frame) throw new Error(`future field entered the core frame ${key}`)
    for (const id of MODEL_ORDER) {
      for (const key of MODELS[id]) if (FORBIDDEN.includes(key)) throw new Error(`model uses a future field ${id}`)
    }
    const prior = v32Frame(event)
    if (frame.t0 !== prior.t0 || frame.eventAtr !== prior.eventAtr || frame.spyAtr !== prior.spyAtr || frame.leadership !== prior.leadership) {
      throw new Error(`core frame drifted from v32 ${event.eventId}`)
    }
    const series = seriesBySymbol.get(event.ticker)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    if (t0Idx < 0) throw new Error(`look-ahead date missing ${event.eventId}`)
    const baseAtr = atrPctAt(series.highs, series.lows, series.closes, t0Idx)
    if (t0Idx + 6 < series.closes.length) {
      const poisonedCloses = series.closes.slice()
      poisonedCloses[t0Idx + 6] = poisonedCloses[t0Idx] * 0.25
      const nextAtr = atrPctAt(series.highs, series.lows, poisonedCloses, t0Idx)
      if (baseAtr !== nextAtr) throw new Error(`future bar changed Event ATR ${event.eventId}`)
    }
    if (!finite(baseAtr) || Math.abs(baseAtr - event.predictors.atrPct) > 1e-8) {
      throw new Error(`Event ATR drifted from the stored v32 value ${event.eventId}`)
    }
    if (spy) {
      const idx = dateIndex(spy.dates, event.t0Date)
      if (idx < 0) throw new Error(`SPY date missing ${event.eventId}`)
      const base = marketAt(spy, event.t0Date)
      if (idx + 6 < spy.closes.length) {
        const poisoned = { ...spy, closes: spy.closes.slice(), highs: spy.highs.slice(), lows: spy.lows.slice() }
        poisoned.closes[idx + 6] = poisoned.closes[idx] * 0.25
        const next = marketAt(poisoned, event.t0Date)
        if (!base || base.spyAtr !== next.spyAtr) throw new Error(`future bar changed SPY ATR ${event.eventId}`)
      }
      if (!base || Math.abs(base.spyAtr - event.predictors.spyAtr) > 1e-8) {
        throw new Error(`SPY ATR drifted from the stored v32 value ${event.eventId}`)
      }
    }
    checked += 1
  }
  return { ok: true, checked, violations: 0 }
}

function assertHold(rows) {
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
  }
  return { ok: maxAbsError <= TOLERANCE, checked, maxAbsError }
}

function stepClear(delta, loo) {
  const improve = delta.splits.filter((item) => finite(item.r2.rawEstimate) && item.r2.rawEstimate > 0).length
  const signs = delta.splits.filter((item) => finite(item.level) && item.level > 0).length
  const mae = mean(delta.splits.map((item) => item.mae.rawEstimate))
  const above = finite(delta.pooled.r2.rawCiLow) && delta.pooled.r2.rawCiLow > 0
  const held = Boolean(loo && loo.signFlips === 0 && finite(loo.rawBaseline) && loo.rawBaseline !== 0)
  return {
    r2ImproveSplits: improve,
    spearmanPositiveSplits: signs,
    meanDeltaMae: round4(mae),
    intervalAbove: above,
    looHeld: held,
    independent: improve >= 2 && signs >= 2 && finite(mae) && mae <= 0 && above && held,
    hurts: delta.splits.filter((item) => finite(item.r2.rawEstimate) && item.r2.rawEstimate < 0).length >= 2
      && finite(delta.pooled.r2.rawCiHigh) && delta.pooled.r2.rawCiHigh < 0,
  }
}

function weightedFit(train, test, keys) {
  const count = (rows) => {
    const map = new Map()
    for (const row of rows) map.set(row.ticker, (map.get(row.ticker) ?? 0) + 1)
    return map
  }
  const trainCount = count(train)
  const testCount = count(test)
  const weight = (row, map) => 1 / map.get(row.ticker)
  const tr = completeRows(train, keys)
  const te = completeRows(test, keys)
  const p = keys.length + 1
  if (tr.length <= p || te.length < 2) return null
  const moments = (key) => {
    let w = 0
    let sum = 0
    for (const row of tr) {
      const ww = weight(row, trainCount)
      w += ww
      sum += ww * row[key]
    }
    const center = sum / w
    let varSum = 0
    for (const row of tr) varSum += weight(row, trainCount) * (row[key] - center) ** 2
    return { mean: center, sd: Math.sqrt(varSum / w) }
  }
  const stats = {}
  for (const key of keys) {
    stats[key] = moments(key)
    if (!(stats[key].sd > 0)) return null
  }
  const scaled = (row) => keys.map((key) => (row[key] - stats[key].mean) / stats[key].sd)
  const xtx = Array.from({ length: p }, () => Array(p).fill(0))
  const xty = Array(p).fill(0)
  for (const row of tr) {
    const x = [1, ...scaled(row)]
    const ww = weight(row, trainCount)
    for (let i = 0; i < p; i += 1) {
      xty[i] += ww * x[i] * row.window
      for (let j = 0; j < p; j += 1) xtx[i][j] += ww * x[i] * x[j]
    }
  }
  const beta = solveLinear(xtx, xty)
  if (!beta) return null
  const predict = (row) => {
    const x = scaled(row)
    let value = beta[0]
    for (let i = 0; i < keys.length; i += 1) value += beta[i + 1] * x[i]
    return value
  }
  const y = te.map((row) => row.window)
  const yhat = te.map(predict)
  const ww = te.map((row) => weight(row, testCount))
  const wsum = ww.reduce((sum, value) => sum + value, 0)
  const center = ww.reduce((sum, value, index) => sum + value * y[index], 0) / wsum
  let sse = 0
  let sst = 0
  for (let i = 0; i < y.length; i += 1) {
    sse += ww[i] * (y[i] - yhat[i]) ** 2
    sst += ww[i] * (y[i] - center) ** 2
  }
  const groups = new Map()
  for (let i = 0; i < te.length; i += 1) {
    const group = groups.get(te[i].ticker) ?? { y: [], yhat: [] }
    group.y.push(y[i])
    group.yhat.push(yhat[i])
    groups.set(te[i].ticker, group)
  }
  const xs = []
  const ys = []
  for (const group of groups.values()) {
    xs.push(mean(group.yhat))
    ys.push(mean(group.y))
  }
  return {
    r2: round4(sst === 0 ? null : 1 - sse / sst),
    rawR2: sst === 0 ? null : 1 - sse / sst,
    spearman: round4(rawSpearman(xs, ys)),
    rawSpearman: rawSpearman(xs, ys),
  }
}

export function study(events, seriesBySymbol, options = {}) {
  const strategies = [
    V23_SELECTED_STRATEGY, V27_SELECTED_STRATEGY, V28_SELECTED_STRATEGY,
    V29_SELECTED_STRATEGY, V30_SELECTED_STRATEGY, V31_SELECTED_STRATEGY,
    V32_SELECTED_STRATEGY, SELECTED_STRATEGY,
  ]
  if (strategies.some((value) => value !== null)) throw new Error("selectedStrategy must stay null")
  if (!seriesBySymbol) throw new Error("independence study needs price series")
  assertBaseline(events)
  assertV18Split(events)
  assertEventList(events)
  const stateCounts = {
    RECOVERING: events.filter((event) => event.early.stateT5 === "RECOVERING").length,
    STABILIZING: events.filter((event) => event.early.stateT5 === "STABILIZING").length,
    STILL_FALLING: events.filter((event) => event.early.stateT5 === "STILL_FALLING").length,
  }
  if (stateCounts.RECOVERING !== 53 || stateCounts.STABILIZING !== 4 || stateCounts.STILL_FALLING !== 46) {
    throw new Error("T+5 state counts drifted")
  }
  const maxEvents = Math.max(...events.reduce((map, event) => map.set(event.ticker, (map.get(event.ticker) ?? 0) + 1), new Map()).values())
  if (maxEvents > 9) throw new Error("within-stock event count drifted")
  const audit = auditCoreLookAhead(events, seriesBySymbol, options.spy ?? null)
  const decision = auditDecisionLookAhead(events, seriesBySymbol)
  const lookAheadViolations = (options.lookAheadViolations ?? 0) + audit.violations + decision.violations
  if (lookAheadViolations !== 0) throw new Error("look-ahead audit failed")
  const rows = buildRows(events, seriesBySymbol)
  const identities = assertHold(rows)
  if (!identities.ok) throw new Error("hold identities failed")
  const trials = options.bootstrap ?? BOOTSTRAP
  const windowRows = rows.filter((row) => finite(row.window))
  const dates = new Map()
  for (const [name, fraction] of SPLIT_FRACTIONS) {
    const split = chronologicalSplit(events, fraction)
    const trainIds = new Set(split.train.map((event) => event.eventId))
    const testIds = new Set(split.test.map((event) => event.eventId))
    if ([...trainIds].some((id) => testIds.has(id))) throw new Error(`split overlap ${name}`)
    const trainDates = new Set(split.train.map((event) => event.t0Date))
    if (split.test.some((event) => trainDates.has(event.t0Date))) throw new Error(`same-date split broken ${name}`)
    dates.set(name, {
      train: windowRows.filter((row) => trainIds.has(row.eventId)),
      test: windowRows.filter((row) => testIds.has(row.eventId)),
    })
  }
  const models = {}
  for (const id of MODEL_ORDER) {
    const inSample = fitLinear(windowRows, windowRows, MODELS[id], true)
    const splits = {}
    for (const [name, part] of dates) {
      const fit = fitLinear(part.train, part.test, MODELS[id])
      splits[name] = {
        train: publicScore(fit.train),
        test: publicScore(fit.test),
        coefficients: fit.coefficients ?? null,
      }
    }
    models[id] = { inSample: publicScore(inSample.train), splits }
  }
  const signs = {}
  for (const key of [...CORE, "leadership"]) {
    signs[key] = {}
    for (const id of MODEL_ORDER) {
      if (!MODELS[id].includes(key)) continue
      const across = {}
      for (const [name] of SPLIT_FRACTIONS) across[name] = signOf(models[id].splits[name].coefficients?.[key])
      const values = Object.values(across)
      signs[key][id] = { ...across, stable: values.every((value) => value === values[0] && value !== 0) }
    }
  }
  const partials = {}
  PARTIALS.forEach((spec, index) => {
    partials[spec.id] = {
      x: spec.x,
      controls: spec.controls,
      link: bootstrapPartial(windowRows, spec.x, spec.controls, trials, SEED + 10 + index),
      loo: partialLoo(windowRows, spec.x, spec.controls),
    }
  })
  const steps = {}
  const judged = []
  STEPS.forEach((spec, index) => {
    const largeKeys = MODELS[spec.full]
    const smallKeys = MODELS[spec.base]
    const paired = SPLIT_FRACTIONS.map(([name]) => fitPair(dates.get(name).train, dates.get(name).test, smallKeys, largeKeys))
    const ready = paired.every((item) => item.small.identified && item.large.identified && item.small.test && item.large.test)
    let delta = null
    let perm = null
    if (ready) {
      delta = bootstrapDelta(paired.map((item) => ({
        y: item.large.test.y,
        small: item.small.test,
        large: item.large.test,
      })), trials, SEED + 100 + index)
      delta.splits = delta.splits.map((item, splitIndex) => ({
        ...item,
        r2: { ...item.r2, rawEstimate: item.r2.estimate == null ? null : paired[splitIndex].large.test.rawR2 - paired[splitIndex].small.test.rawR2 },
        mae: { ...item.mae, rawEstimate: paired[splitIndex].large.test.rawMae - paired[splitIndex].small.test.rawMae },
        level: paired[splitIndex].large.test.rawSpearman,
      }))
      perm = permutationDelta(
        paired.map((item) => item.train),
        paired.map((item) => ({ rows: item.test, small: item.small.test, large: item.large.test })),
        spec.added,
        smallKeys,
        largeKeys,
        trials,
        SEED + 200 + index,
      )
    }
    const loo = partials[spec.id]?.loo ?? null
    const flag = delta ? stepClear(delta, loo) : {
      r2ImproveSplits: 0, spearmanPositiveSplits: 0, meanDeltaMae: null, intervalAbove: false, looHeld: false, independent: false, hurts: false,
    }
    const equal = {}
    for (const [name, splitIndex] of SPLIT_FRACTIONS.map((item, index) => [item[0], index])) {
      const base = weightedFit(paired[splitIndex].train, paired[splitIndex].test, smallKeys)
      const full = weightedFit(paired[splitIndex].train, paired[splitIndex].test, largeKeys)
      equal[name] = base && full ? {
        deltaR2: round4(full.rawR2 - base.rawR2),
        deltaSpearman: round4(full.rawSpearman - base.rawSpearman),
        testSpearman: full.spearman,
      } : null
    }
    steps[spec.id] = {
      added: spec.added,
      base: spec.base,
      full: spec.full,
      judged: spec.judged,
      auxiliary: Boolean(spec.auxiliary),
      splits: Object.fromEntries(SPLIT_FRACTIONS.map(([name], splitIndex) => [name, delta ? {
        deltaR2: delta.splits[splitIndex].r2.estimate,
        deltaSpearman: delta.splits[splitIndex].spearman.estimate,
        deltaMae: delta.splits[splitIndex].mae.estimate,
        testSpearman: round4(delta.splits[splitIndex].level),
        r2Ci: delta.splits[splitIndex].r2.ci95,
        permutationTail: perm.splits[splitIndex],
        n: paired[splitIndex].test.length,
      } : null])),
      pooled: delta ? {
        deltaR2: delta.pooled.r2.estimate,
        deltaR2Ci: delta.pooled.r2.ci95,
        rawCiLow: delta.pooled.r2.rawCiLow,
        rawCiHigh: delta.pooled.r2.rawCiHigh,
        deltaSpearman: delta.pooled.spearman.estimate,
        deltaMae: delta.pooled.mae.estimate,
        permutationTail: perm.pooled,
      } : null,
      equalWeight: equal,
      ...flag,
    }
    if (spec.judged) judged.push(steps[spec.id])
  })
  const links = {}
  CORE.forEach((key, index) => {
    const xs = windowRows.map((row) => row[key])
    const ys = windowRows.map((row) => row.window)
    links[key] = {
      window: bootstrapSpearman(xs, ys, trials, SEED + 300 + index),
      t20: round4(rawSpearman(rows.map((row) => row[key]).filter((_, i) => finite(rows[i][key]) && finite(rows[i].t20)), rows.filter((row) => finite(row[key]) && finite(row.t20)).map((row) => row.t20))),
      t40: round4(rawSpearman(rows.filter((row) => finite(row[key]) && finite(row.t40)).map((row) => row[key]), rows.filter((row) => finite(row[key]) && finite(row.t40)).map((row) => row.t40))),
      tickerEqual: tickerEqual(windowRows, key),
      loo: looSummary(windowRows, (row) => row[key], (row) => row.window),
    }
  })
  for (const left of CORE) {
    links[left].peers = {}
    for (const right of CORE) {
      if (left === right) continue
      const pairs = windowRows.filter((row) => finite(row[left]) && finite(row[right]))
      links[left].peers[right] = {
        pearson: round4(rawPearson(pairs.map((row) => row[left]), pairs.map((row) => row[right]))),
        spearman: round4(rawSpearman(pairs.map((row) => row[left]), pairs.map((row) => row[right]))),
      }
    }
  }
  const redundancy = { vif: vifOf(windowRows, CORE) }
  const risk = {}
  CORE.forEach((key, index) => {
    const sides = medianSides(windowRows, key)
    const gap = bootstrapMeanGap(sides.high.map((row) => row.window), sides.low.map((row) => row.window), trials, SEED + 400 + index)
    const tail = favorableTail(sides.low, sides.high, trials, SEED + 410 + index)
    const utilityMeans = {}
    for (const lambda of LAMBDAS) {
      const value = (group) => pct(mean(group.map((row) => utility(row.window, lambda))))
      utilityMeans[String(lambda)] = { low: value(sides.low), high: value(sides.high) }
    }
    risk[key] = {
      low: level(sides.low),
      high: level(sides.high),
      windowGap: gap ? { meanDiff: gap.meanDiff, ci95: gap.ci95, permutationTail: gap.permutationTail } : null,
      favorableTail: tail ? { meanDiff: tail.meanDiff, ci95: tail.ci95, rawCiLow: tail.rawCiLow, permutationTail: tail.permutationTail } : null,
      utility: utilityMeans,
    }
  })
  const controlled = [
    { id: "eventAtr|t0+spyAtr", key: "eventAtr", controls: ["t0", "spyAtr"] },
    { id: "spyAtr|t0+eventAtr", key: "spyAtr", controls: ["t0", "eventAtr"] },
  ]
  controlled.forEach((spec, index) => {
    const residualRows = residualColumn(windowRows.filter((row) => finite(row[spec.key]) && spec.controls.every((key) => finite(row[key]))), spec.key, spec.controls)
    const sides = medianSides(residualRows, "residual")
    const tail = favorableTail(sides.low, sides.high, trials, SEED + 420 + index)
    risk[spec.id] = {
      low: level(sides.low),
      high: level(sides.high),
      favorableTail: tail ? { meanDiff: tail.meanDiff, ci95: tail.ci95, rawCiLow: tail.rawCiLow } : null,
    }
  })
  const utilities = {}
  for (const key of CORE) {
    utilities[key] = {}
    for (const lambda of LAMBDAS) {
      const pairs = windowRows.filter((row) => finite(row[key]))
      utilities[key][String(lambda)] = round4(rawSpearman(pairs.map((row) => row[key]), pairs.map((row) => utility(row.window, lambda))))
    }
  }
  const byState = {}
  for (const state of ["RECOVERING", "STILL_FALLING", "STABILIZING"]) {
    const subset = windowRows.filter((row) => row.state === state)
    const block = { n: subset.length, conclusion: conclusion(subset.length), models: {}, links: {} }
    if (subset.length < 5) {
      byState[state] = block
      continue
    }
    for (const id of ["M0", "M1", "M2", "M3"]) {
      const fit = fitLinear(subset, subset, MODELS[id], true)
      block.models[id] = fit.identified ? { n: fit.train.n, spearman: fit.train.spearman, r2: fit.train.r2, conclusion: conclusion(fit.train.n) } : { identified: false, conclusion: conclusion(subset.length) }
    }
    for (const key of CORE) {
      const xs = subset.filter((row) => finite(row[key]))
      block.links[key] = { n: xs.length, spearman: round4(rawSpearman(xs.map((row) => row[key]), xs.map((row) => row.window))), conclusion: conclusion(xs.length) }
    }
    byState[state] = block
  }
  const variables = judged.map((step) => ({
    id: step.id,
    independent: step.independent,
    hurts: step.hurts,
    riskStable: riskStable(risk[step.added]) && riskStable(risk[step.id]),
  }))
  const judgment = judgeIndependence({ lookAheadViolations, variables })
  return {
    selectedStrategy: SELECTED_STRATEGY,
    note: "T0, Event ATR, and SPY ATR independence study. Not a sell rule.",
    rules: {
      noThresholdSearch: true,
      noRefit: true,
      noModelPick: true,
      pairedSample: true,
      negativeR2Preserved: true,
      utilityIsDescriptive: true,
      stateDoesNotJudge: true,
      equalWeightDoesNotJudge: true,
      leadershipDoesNotJudge: true,
    },
    states: stateCounts,
    maxEvents,
    levels: { window: level(windowRows), t20: { n: rows.filter((row) => finite(row.t20)).length } },
    models,
    signs,
    steps,
    partials: Object.fromEntries(Object.entries(partials).map(([id, value]) => [id, {
      x: value.x,
      controls: value.controls,
      n: value.link.n,
      rho: value.link.rho,
      ci95: value.link.ci95,
      permutationTail: value.link.permutationTail,
      loo: { baseline: value.loo.baseline, min: value.loo.min, max: value.loo.max, signFlips: value.loo.signFlips },
    }])),
    links,
    redundancy,
    risk,
    utilities,
    byState,
    judgment,
    identities,
    lookAhead: { violations: lookAheadViolations, core: audit, decision: { violations: decision.violations, checked: decision.checked } },
  }
}
