/**
 * US single-stock T0-controlled leadership study v4 (research only).
 *
 * Reuses v3 +10/-10 events, T0 returns, and v2 leadership groups.
 * No sell rule is selected.
 */

import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./equity-sell-research-universe.mjs"
import {
  LOCKED_DEEP_EVENTS,
  comparisonJudgment,
  eventIdentity,
  mean,
  median,
  sampleJudgment,
  spearman,
} from "./equity-sell-backtest-v2.mjs"

export { EQUITY_SELL_RESEARCH_UNIVERSE, LOCKED_DEEP_EVENTS, sampleJudgment, comparisonJudgment }

export const SELECTED_STRATEGY = null
export const T0_BUCKETS = [
  { id: "lt0", label: "T0 < 0%", min: null, max: 0 },
  { id: "b0", label: "0% ≤ T0 < 5%", min: 0, max: 0.05 },
  { id: "b5", label: "5% ≤ T0 < 10%", min: 0.05, max: 0.1 },
  { id: "b10", label: "10% ≤ T0 < 15%", min: 0.1, max: 0.15 },
  { id: "b15", label: "15% ≤ T0 < 20%", min: 0.15, max: 0.2 },
  { id: "ge20", label: "T0 ≥ 20%", min: 0.2, max: null },
]
export const V3_LOCKED = {
  HIGH: { n: 86, t5: 19.82, t20: 22.76, windowEnd: 29.7 },
  MID: { n: 275, t5: 10.52, t20: 14.32, windowEnd: 16.4 },
  LOW: { n: 129, t5: 5.94, t20: 5.38, windowEnd: 8.94 },
  unclassified: 4,
}

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function round4(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 10000) / 10000
}

function pct(fraction) {
  if (fraction == null || !Number.isFinite(fraction)) return null
  return round2(fraction * 100)
}

function share(flags) {
  if (!flags.length) return null
  return (flags.filter(Boolean).length / flags.length) * 100
}

export function t0Bucket(t0) {
  if (!Number.isFinite(t0)) return null
  if (t0 < 0) return "lt0"
  if (t0 < 0.05) return "b0"
  if (t0 < 0.1) return "b5"
  if (t0 < 0.15) return "b10"
  if (t0 < 0.2) return "b15"
  return "ge20"
}

export function eventAuditId(event) {
  return eventIdentity(event).join("|")
}

export function joinV3Events(v2Events, v3Events) {
  if (v2Events.length !== LOCKED_DEEP_EVENTS || v3Events.length !== LOCKED_DEEP_EVENTS) {
    throw new Error(`event count v2 ${v2Events.length} v3 ${v3Events.length}`)
  }
  return v3Events.map((event, index) => {
    const prior = v2Events[index]
    if (eventAuditId(prior) !== eventAuditId(event)) throw new Error(`event id mismatch at ${index}`)
    if (prior.t0Date !== event.t0Date) throw new Error(`correction date mismatch ${event.ticker}`)
    if (prior.leadershipScore !== event.leadershipScore) throw new Error(`score mismatch ${event.ticker} ${event.t0Date}`)
    if (prior.leadershipGroup !== event.leadershipGroup) throw new Error(`group mismatch ${event.ticker} ${event.t0Date}`)
    if (!Number.isFinite(event.t0) || Math.abs(event.t0 - prior.t0Return) > 1e-8) {
      throw new Error(`T0 return mismatch ${event.ticker} ${event.t0Date}`)
    }
    return {
      eventId: eventAuditId(event),
      ticker: event.ticker,
      episodeStart: event.episodeStart,
      plus10Date: event.plus10Date,
      t0Date: event.t0Date,
      t0Close: event.t0Close,
      leadershipScore: event.leadershipScore,
      leadershipGroup: event.leadershipGroup,
      t0: event.t0,
      t1: event.t1,
      t3: event.t3,
      t5: event.t5,
      t10: event.t10,
      t20: event.t20,
      t40: event.t40,
      windowEnd: event.windowEnd,
      recovered: event.recovered === true,
      peakRecovered: prior.peakRecovered === true,
      additionalDrawdown: event.additionalDrawdown,
      reboundFromLow: event.reboundFromLow,
      bucket: t0Bucket(event.t0),
    }
  })
}

function horizon(events, key) {
  const values = events.map((event) => event[key]).filter((value) => Number.isFinite(value))
  return {
    n: values.length,
    avg: pct(mean(values)),
    median: pct(median(values)),
    winRate: round2(share(values.map((value) => value > 0))),
    judgment: sampleJudgment(values.length),
  }
}

function rate(events, key) {
  return {
    n: events.length,
    avg: round2(share(events.map((event) => event[key] === true))),
    judgment: sampleJudgment(events.length),
  }
}

function depth(events, key) {
  const values = events.map((event) => event[key]).filter((value) => Number.isFinite(value))
  return {
    n: values.length,
    avg: pct(mean(values)),
    median: pct(median(values)),
    judgment: sampleJudgment(values.length),
  }
}

export function summarizeSlice(events) {
  const high = events.filter((event) => event.leadershipGroup === "HIGH")
  const mid = events.filter((event) => event.leadershipGroup === "MID")
  const low = events.filter((event) => event.leadershipGroup === "LOW")
  const scores = events.map((event) => event.leadershipScore).filter((value) => Number.isFinite(value))
  return {
    n: events.length,
    high: high.length,
    mid: mid.length,
    low: low.length,
    unclassified: events.length - high.length - mid.length - low.length,
    leadershipScore: {
      n: scores.length,
      avg: round2(mean(scores)),
      median: round2(median(scores)),
    },
    event: {
      all: outcomeBlock(events),
      HIGH: outcomeBlock(high),
      MID: outcomeBlock(mid),
      LOW: outcomeBlock(low),
    },
    stock: {
      all: stockBlock(events),
      HIGH: stockBlock(high),
      MID: stockBlock(mid),
      LOW: stockBlock(low),
    },
    highMinusLow: {
      event: compareBlocks(outcomeBlock(high), outcomeBlock(low)),
      stock: compareBlocks(stockBlock(high), stockBlock(low)),
    },
  }
}

function outcomeBlock(events) {
  return {
    n: events.length,
    judgment: sampleJudgment(events.length),
    t1: horizon(events, "t1"),
    t3: horizon(events, "t3"),
    t5: horizon(events, "t5"),
    t10: horizon(events, "t10"),
    t20: horizon(events, "t20"),
    t40: horizon(events, "t40"),
    windowEnd: horizon(events, "windowEnd"),
    entryRecovery: rate(events, "recovered"),
    peakRecovery: rate(events, "peakRecovered"),
    additionalDrawdown: depth(events, "additionalDrawdown"),
    reboundFromLow: depth(events, "reboundFromLow"),
  }
}

function byTicker(events) {
  const groups = new Map()
  for (const event of events) {
    if (!groups.has(event.ticker)) groups.set(event.ticker, [])
    groups.get(event.ticker).push(event)
  }
  return [...groups.values()]
}

function stockHorizon(events, key) {
  const means = []
  const medians = []
  const wins = []
  for (const rows of byTicker(events)) {
    const values = rows.map((event) => event[key]).filter((value) => Number.isFinite(value))
    if (!values.length) continue
    means.push(mean(values))
    medians.push(median(values))
    wins.push(values.filter((value) => value > 0).length / values.length)
  }
  return {
    n: means.length,
    avg: pct(mean(means)),
    median: pct(median(medians)),
    winRate: round2(mean(wins) == null ? null : mean(wins) * 100),
    judgment: sampleJudgment(means.length),
  }
}

function stockRate(events, key) {
  const rates = []
  for (const rows of byTicker(events)) {
    if (!rows.length) continue
    rates.push(rows.filter((event) => event[key] === true).length / rows.length)
  }
  return {
    n: rates.length,
    avg: round2(mean(rates) == null ? null : mean(rates) * 100),
    median: round2(median(rates) == null ? null : median(rates) * 100),
    judgment: sampleJudgment(rates.length),
  }
}

function stockDepth(events, key) {
  const means = []
  const medians = []
  for (const rows of byTicker(events)) {
    const values = rows.map((event) => event[key]).filter((value) => Number.isFinite(value))
    if (!values.length) continue
    means.push(mean(values))
    medians.push(median(values))
  }
  return {
    n: means.length,
    avg: pct(mean(means)),
    median: pct(median(medians)),
    judgment: sampleJudgment(means.length),
  }
}

function stockBlock(events) {
  return {
    n: new Set(events.map((event) => event.ticker)).size,
    judgment: sampleJudgment(new Set(events.map((event) => event.ticker)).size),
    t1: stockHorizon(events, "t1"),
    t3: stockHorizon(events, "t3"),
    t5: stockHorizon(events, "t5"),
    t10: stockHorizon(events, "t10"),
    t20: stockHorizon(events, "t20"),
    t40: stockHorizon(events, "t40"),
    windowEnd: stockHorizon(events, "windowEnd"),
    entryRecovery: stockRate(events, "recovered"),
    peakRecovery: stockRate(events, "peakRecovered"),
    additionalDrawdown: stockDepth(events, "additionalDrawdown"),
    reboundFromLow: stockDepth(events, "reboundFromLow"),
  }
}

function diff(left, right) {
  if (left == null || right == null || !Number.isFinite(left) || !Number.isFinite(right)) return null
  return round2(left - right)
}

function compareMetric(high, low) {
  return {
    highN: high.n,
    lowN: low.n,
    highAvg: high.avg,
    lowAvg: low.avg,
    diff: diff(high.avg, low.avg),
    judgment: comparisonJudgment(high.n, low.n),
  }
}

function compareBlocks(high, low) {
  const keys = ["t1", "t3", "t5", "t10", "t20", "t40", "windowEnd", "entryRecovery", "peakRecovery", "additionalDrawdown", "reboundFromLow"]
  const out = {}
  for (const key of keys) out[key] = compareMetric(high[key], low[key])
  return out
}

export function analyzeBuckets(events) {
  return T0_BUCKETS.map((bucket) => {
    const rows = events.filter((event) => event.bucket === bucket.id)
    return { id: bucket.id, label: bucket.label, ...summarizeSlice(rows) }
  })
}

export function quartileCuts(values) {
  const xs = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (xs.length < 4) return null
  const at = (p) => xs[Math.min(xs.length - 1, Math.max(0, Math.ceil(p * xs.length) - 1))]
  return { q25: at(0.25), q50: at(0.5), q75: at(0.75), n: xs.length }
}

export function t0Quartile(t0, cuts) {
  if (!cuts || !Number.isFinite(t0)) return null
  if (t0 <= cuts.q25) return "Q1"
  if (t0 <= cuts.q50) return "Q2"
  if (t0 <= cuts.q75) return "Q3"
  return "Q4"
}

export function analyzeQuantiles(events) {
  const cuts = quartileCuts(events.map((event) => event.t0))
  const labels = [
    { id: "Q1", label: "Q1 lowest T0" },
    { id: "Q2", label: "Q2" },
    { id: "Q3", label: "Q3" },
    { id: "Q4", label: "Q4 highest T0" },
  ]
  return {
    cuts: cuts
      ? { q25: pct(cuts.q25), q50: pct(cuts.q50), q75: pct(cuts.q75), n: cuts.n }
      : null,
    buckets: labels.map((label) => {
      const rows = events.filter((event) => t0Quartile(event.t0, cuts) === label.id)
      return { id: label.id, label: label.label, ...summarizeSlice(rows) }
    }),
  }
}

function averageRanks(values) {
  const indexed = values.map((value, index) => ({ value, index }))
  indexed.sort((a, b) => a.value - b.value)
  const ranks = new Array(values.length)
  for (let i = 0; i < indexed.length; ) {
    let j = i
    while (j + 1 < indexed.length && indexed[j + 1].value === indexed[i].value) j += 1
    const rank = (i + 1 + (j + 1)) / 2
    for (let k = i; k <= j; k++) ranks[indexed[k].index] = rank
    i = j + 1
  }
  return ranks
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

function residuals(y, z) {
  const n = y.length
  const my = mean(y)
  const mz = mean(z)
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (z[i] - mz) * (y[i] - my)
    den += (z[i] - mz) ** 2
  }
  if (den === 0) return null
  const slope = num / den
  const intercept = my - slope * mz
  return y.map((value, index) => value - (intercept + slope * z[index]))
}

export function partialSpearman(pairs) {
  const usable = pairs.filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y) && Number.isFinite(pair.z))
  if (usable.length < 4) return { n: usable.length, rho: null, judgment: sampleJudgment(usable.length) }
  const rx = averageRanks(usable.map((pair) => pair.x))
  const ry = averageRanks(usable.map((pair) => pair.y))
  const rz = averageRanks(usable.map((pair) => pair.z))
  const ex = residuals(rx, rz)
  const ey = residuals(ry, rz)
  if (!ex || !ey) return { n: usable.length, rho: null, judgment: sampleJudgment(usable.length) }
  return {
    n: usable.length,
    rho: round4(pearson(ex, ey)),
    judgment: sampleJudgment(usable.length),
  }
}

export function pearsonCorrelation(pairs) {
  const usable = pairs.filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y))
  return {
    n: usable.length,
    rho: round4(pearson(usable.map((pair) => pair.x), usable.map((pair) => pair.y))),
    judgment: sampleJudgment(usable.length),
  }
}

function scoredPairs(events, yOf) {
  return events
    .filter((event) => Number.isFinite(event.leadershipScore) && Number.isFinite(event.t0) && Number.isFinite(yOf(event)))
    .map((event) => ({ x: event.leadershipScore, y: yOf(event), z: event.t0 }))
}

export function associationBlock(events) {
  const specs = [
    ["t20", (event) => event.t20],
    ["windowEnd", (event) => event.windowEnd],
    ["entryRecovery", (event) => (event.recovered ? 1 : 0)],
    ["peakRecovery", (event) => (event.peakRecovered ? 1 : 0)],
    ["additionalDrawdown", (event) => event.additionalDrawdown],
  ]
  const out = {}
  for (const [key, yOf] of specs) {
    const pairs = scoredPairs(events, yOf)
    out[key] = {
      rawSpearman: spearman(pairs.map((pair) => ({ x: pair.x, y: pair.y }))),
      partialSpearman: partialSpearman(pairs),
    }
  }
  return out
}

function logGamma(z) {
  const p = [
    676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905,
    -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7,
  ]
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
  z -= 1
  let x = 0.9999999999998099
  for (let i = 0; i < p.length; i++) x += p[i] / (z + i + 1)
  const t = z + p.length - 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

function betacf(a, b, x) {
  const max = 200
  const eps = 3e-12
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < 1e-30) d = 1e-30
  d = 1 / d
  let h = d
  for (let m = 1; m <= max; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < eps) break
  }
  return h
}

function regularizedBeta(x, a, b) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const lnBt = a * Math.log(x) + b * Math.log(1 - x) - (logGamma(a) + logGamma(b) - logGamma(a + b))
  if (x < (a + 1) / (a + b + 2)) return (Math.exp(lnBt) * betacf(a, b, x)) / a
  return 1 - (Math.exp(lnBt) * betacf(b, a, 1 - x)) / b
}

export function studentTwoTail(t, df) {
  if (!Number.isFinite(t) || !(df > 0)) return null
  if (t === 0) return 1
  const x = df / (df + t * t)
  const p = regularizedBeta(x, df / 2, 0.5)
  if (!Number.isFinite(p)) return null
  return Math.min(1, Math.max(0, p))
}

function solveLinear(matrix, vector) {
  const n = vector.length
  const a = matrix.map((row, i) => [...row, vector[i]])
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

export function olsTwo(rows) {
  const usable = rows.filter((row) => Number.isFinite(row.y) && Number.isFinite(row.leadership) && Number.isFinite(row.t0))
  const n = usable.length
  const k = 3
  if (n <= k) return { n, coefficients: null }
  const xtx = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  const xty = [0, 0, 0]
  for (const row of usable) {
    const x = [1, row.leadership, row.t0]
    for (let i = 0; i < k; i++) {
      xty[i] += x[i] * row.y
      for (let j = 0; j < k; j++) xtx[i][j] += x[i] * x[j]
    }
  }
  const beta = solveLinear(xtx, xty)
  if (!beta) return { n, coefficients: null }
  let sse = 0
  let sst = 0
  const my = mean(usable.map((row) => row.y))
  for (const row of usable) {
    const fitted = beta[0] + beta[1] * row.leadership + beta[2] * row.t0
    sse += (row.y - fitted) ** 2
    sst += (row.y - my) ** 2
  }
  const df = n - k
  const sigma2 = sse / df
  const r2 = sst === 0 ? null : 1 - sse / sst
  const inv = solveLinear(xtx, [1, 0, 0])
    ? [solveLinear(xtx, [1, 0, 0]), solveLinear(xtx, [0, 1, 0]), solveLinear(xtx, [0, 0, 1])]
    : null
  const names = ["intercept", "leadershipScore", "t0Return"]
  const coefficients = names.map((name, index) => {
    const variance = inv && sigma2 >= 0 ? sigma2 * inv[index][index] : null
    const se = variance != null && variance >= 0 ? Math.sqrt(variance) : null
    const t = se != null && se > 1e-12 ? beta[index] / se : null
    return {
      name,
      coefficient: round4(beta[index]),
      standardError: se == null ? null : round4(se),
      t: t == null ? null : round4(t),
      pValue: t == null ? null : round4(studentTwoTail(t, df)),
    }
  })
  return {
    n,
    df,
    r2: r2 == null ? null : round4(r2),
    coefficients,
    note: "Ordinary least squares treats events as independent. Repeated events from the same ticker make these standard errors too small.",
  }
}

export function fitOutcomes(events) {
  const scored = events.filter((event) => Number.isFinite(event.leadershipScore) && Number.isFinite(event.t0))
  const fit = (key) =>
    olsTwo(
      scored
        .filter((event) => Number.isFinite(event[key]))
        .map((event) => ({
          y: event[key] * 100,
          leadership: event.leadershipScore,
          t0: event.t0 * 100,
        })),
    )
  return { t20: fit("t20"), windowEnd: fit("windowEnd") }
}

export function lockedGroupCheck(events) {
  const groups = {
    HIGH: events.filter((event) => event.leadershipGroup === "HIGH"),
    MID: events.filter((event) => event.leadershipGroup === "MID"),
    LOW: events.filter((event) => event.leadershipGroup === "LOW"),
  }
  const unclassified = events.filter((event) => event.leadershipGroup == null).length
  const mismatches = []
  for (const name of ["HIGH", "MID", "LOW"]) {
    const block = outcomeBlock(groups[name])
    const locked = V3_LOCKED[name]
    if (groups[name].length !== locked.n) mismatches.push(`${name} n ${groups[name].length}`)
    if (block.t5.avg !== locked.t5) mismatches.push(`${name} t5 ${block.t5.avg}`)
    if (block.t20.avg !== locked.t20) mismatches.push(`${name} t20 ${block.t20.avg}`)
    if (block.windowEnd.avg !== locked.windowEnd) mismatches.push(`${name} window ${block.windowEnd.avg}`)
  }
  if (unclassified !== V3_LOCKED.unclassified) mismatches.push(`unclassified ${unclassified}`)
  return {
    match: mismatches.length === 0,
    mismatches,
    counts: { HIGH: groups.HIGH.length, MID: groups.MID.length, LOW: groups.LOW.length, unclassified },
  }
}
