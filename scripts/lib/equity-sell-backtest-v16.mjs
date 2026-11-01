/**
 * US single-stock between/within ATR study v16 (research only).
 *
 * Separates a stock's own prior ATR level from the gap between the
 * correction-day ATR and that prior level. The prior window ends the session
 * before the correction close. No sell rule is selected.
 */

import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./equity-sell-research-universe.mjs"
import { mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { studentTwoTail } from "./equity-sell-backtest-v4.mjs"
import { leaveOneCorrelation } from "./equity-sell-backtest-v7.mjs"
import { atrHistory, atrPctAt, percentileAgainstPast } from "./equity-sell-backtest-v8.mjs"
import { standardizedFit } from "./equity-sell-backtest-v12.mjs"
import { attachProfile, loadOhlcv, selectMildEvents } from "./equity-sell-backtest-v12.mjs"
import { marketAt, periodOf } from "./equity-sell-backtest-v14.mjs"

export { EQUITY_SELL_RESEARCH_UNIVERSE, loadOhlcv, selectMildEvents, periodOf, percentileAgainstPast }

export const SELECTED_STRATEGY = null
export const PRIMARY_WINDOW = 60
export const BASELINE = {
  events: 103,
  lowEvents: 102,
  groups: { HIGH: 15, MID: 53, LOW: 35 },
  bands: { LOW: 34, MID: 34, HIGH: 35 },
  lowWindow: 0.4107,
  lowT10: 0.3494,
  lowT20: 0.4541,
  hit10: -0.3421,
}
const WITHIN_FLOOR = 0.15
const NEAR_ZERO = 0.1

function finite(value) {
  return Number.isFinite(value)
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

function solveLinear(matrix, vector) {
  const n = vector.length
  const a = matrix.map((row, index) => [...row, vector[index]])
  for (let col = 0; col < n; col += 1) {
    let pivot = col
    for (let row = col + 1; row < n; row += 1) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row
    if (Math.abs(a[pivot][col]) < 1e-10) return null
    const hold = a[col]
    a[col] = a[pivot]
    a[pivot] = hold
    const div = a[col][col]
    for (let j = col; j <= n; j += 1) a[col][j] /= div
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue
      const factor = a[row][col]
      for (let j = col; j <= n; j += 1) a[row][j] -= factor * a[col][j]
    }
  }
  return a.map((row) => row[n])
}

export function priorAtr(highs, lows, closes, t0, length) {
  const history = atrHistory(highs, lows, closes, t0, length)
  if (!history.n) return { n: 0, median: null, mean: null, ratio: null, percentile: null, gap: null }
  const past = []
  for (let index = t0 - length; index < t0; index += 1) past.push(atrPctAt(highs, lows, closes, index))
  return {
    n: history.n,
    median: history.usualMedian,
    mean: mean(past),
    ratio: history.ratio,
    percentile: history.percentile,
    gap: history.current - history.usualMedian,
  }
}

export function attachSplit(events, seriesBySymbol, spy) {
  const base = attachProfile(events, seriesBySymbol)
  const out = base.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    const t0 = dateIndex(series.dates, event.t0Date)
    const d60 = priorAtr(series.highs, series.lows, series.closes, t0, 60)
    const d120 = priorAtr(series.highs, series.lows, series.closes, t0, 120)
    const d252 = priorAtr(series.highs, series.lows, series.closes, t0, 252)
    const market = marketAt(spy, event.t0Date)
    const eventAtr = event.predictors.atrPct
    if (finite(d60.gap) && Math.abs(eventAtr - (d60.median + d60.gap)) > 1e-10) throw new Error(`ATR split differs ${event.eventId}`)
    return {
      ...event,
      predictors: {
        ...event.predictors,
        betweenAtr: d60.median,
        withinAtr: d60.gap,
        withinRatio: d60.ratio,
        withinPercentile: d60.percentile,
        priorMean60: d60.mean,
        between120: d120.median,
        within120: d120.gap,
        withinRatio120: d120.ratio,
        priorMean120: d120.mean,
        between252: d252.median,
        within252: d252.gap,
        spyAtr: market?.spyAtr ?? null,
        spyVol: market?.spyVol ?? null,
      },
    }
  })
  out.bandCounts = base.bandCounts
  return out
}

function pair(events, xRead, yRead) {
  return spearman(events.map((event) => ({ x: xRead(event), y: yRead(event) })).filter((row) => finite(row.x) && finite(row.y)))
}

function pearson(xs, ys) {
  const centerX = mean(xs)
  const centerY = mean(ys)
  let num = 0
  let dx = 0
  let dy = 0
  for (let index = 0; index < xs.length; index += 1) {
    const a = xs[index] - centerX
    const b = ys[index] - centerY
    num += a * b
    dx += a * a
    dy += b * b
  }
  if (!(dx > 0) || !(dy > 0)) return null
  return num / Math.sqrt(dx * dy)
}

const lowWindow = (event) => event.lowToWindow
const lowT10 = (event) => event.fromLow.t10
const lowT20 = (event) => event.fromLow.t20
const hitTime = (event) => event.hits["10"].days
const OUTCOMES = [["lowWindow", lowWindow], ["lowT10", lowT10], ["lowT20", lowT20], ["hit10", hitTime]]

function outcomeLinks(events, xRead) {
  return Object.fromEntries(OUTCOMES.map(([key, read]) => [key, pair(events, xRead, read)]))
}

export function baselineLinks(events) {
  const links = outcomeLinks(events, (event) => event.predictors.atrPct)
  return { lowWindow: links.lowWindow, lowT10: links.lowT10, lowT20: links.lowT20, hit10: links.hit10 }
}

export function assertBaseline(events, links) {
  const groups = {
    HIGH: events.filter((event) => event.leadershipGroup === "HIGH").length,
    MID: events.filter((event) => event.leadershipGroup === "MID").length,
    LOW: events.filter((event) => event.leadershipGroup === "LOW").length,
  }
  const checks = [
    [events.length, BASELINE.events, "events"],
    [events.filter((event) => event.lowDay != null).length, BASELINE.lowEvents, "low events"],
    [groups.HIGH, BASELINE.groups.HIGH, "HIGH"],
    [groups.MID, BASELINE.groups.MID, "MID"],
    [groups.LOW, BASELINE.groups.LOW, "LOW"],
    [events.bandCounts.LOW, BASELINE.bands.LOW, "ATR LOW"],
    [events.bandCounts.MID, BASELINE.bands.MID, "ATR MID"],
    [events.bandCounts.HIGH, BASELINE.bands.HIGH, "ATR HIGH"],
    [links.lowWindow.rho, BASELINE.lowWindow, "low window"],
    [links.lowT10.rho, BASELINE.lowT10, "low T+10"],
    [links.lowT20.rho, BASELINE.lowT20, "low T+20"],
    [links.hit10.rho, BASELINE.hit10, "+10% timing"],
  ]
  const failed = checks.filter((row) => row[0] !== row[1]).map((row) => `${row[2]} ${row[0]} !== ${row[1]}`)
  if (failed.length) throw new Error(`baseline changed:\n${failed.join("\n")}`)
}

function scaleRow(event, yRead) {
  const scale = (value) => (finite(value) ? value * 100 : null)
  return {
    y: scale(yRead(event)),
    t0: scale(event.predictors.t0),
    leadership: event.predictors.leadership,
    atrPct: scale(event.predictors.atrPct),
    betweenAtr: scale(event.predictors.betweenAtr),
    withinAtr: scale(event.predictors.withinAtr),
    spyAtr: scale(event.predictors.spyAtr),
    spyVol: scale(event.predictors.spyVol),
    ticker: event.ticker,
  }
}

function ols(rows, keys) {
  const usable = rows.filter((row) => finite(row.y) && keys.every((key) => finite(row[key])))
  const n = usable.length
  const p = keys.length + 1
  if (n <= p) return null
  const xtx = Array.from({ length: p }, () => Array(p).fill(0))
  const xty = Array(p).fill(0)
  for (const row of usable) {
    const x = [1, ...keys.map((key) => row[key])]
    for (let i = 0; i < p; i += 1) {
      xty[i] += x[i] * row.y
      for (let j = 0; j < p; j += 1) xtx[i][j] += x[i] * x[j]
    }
  }
  const beta = solveLinear(xtx, xty)
  if (!beta) return null
  const center = mean(usable.map((row) => row.y))
  let sse = 0
  let sst = 0
  const residuals = []
  for (const row of usable) {
    const fitted = beta[0] + keys.reduce((sum, key, index) => sum + beta[index + 1] * row[key], 0)
    residuals.push(row.y - fitted)
    sse += (row.y - fitted) ** 2
    sst += (row.y - center) ** 2
  }
  const r2 = sst === 0 ? null : 1 - sse / sst
  const names = ["intercept", ...keys]
  const inverse = names.map((_, index) => {
    const unit = Array(p).fill(0)
    unit[index] = 1
    return solveLinear(xtx, unit)
  })
  if (inverse.some((row) => !row)) return null
  const df = n - p
  const sigma2 = df > 0 ? sse / df : null
  const coefficients = names.map((name, index) => {
    const variance = sigma2 == null ? null : sigma2 * inverse[index][index]
    const se = variance != null && variance >= 0 ? Math.sqrt(variance) : null
    const t = se != null && se > 1e-12 ? beta[index] / se : null
    return { name, coefficient: beta[index], standardError: se, t, pValue: t == null ? null : studentTwoTail(t, df) }
  })
  return { n, p, r2, adjustedR2: r2 == null ? null : 1 - ((1 - r2) * (n - 1)) / (n - p), coefficients, residuals, usable, keys, inverse, beta }
}

function clustered(fit, clusterKey) {
  if (!fit) return null
  const groups = new Map()
  fit.usable.forEach((row, index) => {
    const id = row[clusterKey]
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id).push(index)
  })
  const p = fit.p
  const meat = Array.from({ length: p }, () => Array(p).fill(0))
  for (const indexes of groups.values()) {
    const score = Array(p).fill(0)
    for (const index of indexes) {
      const row = fit.usable[index]
      const x = [1, ...fit.keys.map((key) => row[key])]
      for (let col = 0; col < p; col += 1) score[col] += x[col] * fit.residuals[index]
    }
    for (let a = 0; a < p; a += 1) for (let b = 0; b < p; b += 1) meat[a][b] += score[a] * score[b]
  }
  const g = groups.size
  const scale = g > 1 ? (g / (g - 1)) * ((fit.n - 1) / (fit.n - fit.p)) : null
  if (!finite(scale)) return null
  const sandwich = Array.from({ length: p }, () => Array(p).fill(0))
  for (let a = 0; a < p; a += 1) {
    for (let b = 0; b < p; b += 1) {
      let sum = 0
      for (let i = 0; i < p; i += 1) for (let j = 0; j < p; j += 1) sum += fit.inverse[a][i] * meat[i][j] * fit.inverse[j][b]
      sandwich[a][b] = sum * scale
    }
  }
  return { clusters: g, se: fit.coefficients.map((_, index) => (sandwich[index][index] >= 0 ? Math.sqrt(sandwich[index][index]) : null)) }
}

function round4(value) {
  return finite(value) ? Math.round(value * 10000) / 10000 : null
}

function publish(fit, cluster) {
  if (!fit) return { n: 0, r2: null, adjustedR2: null, coefficients: null, status: "singular" }
  const clusteredSe = cluster ? clustered(fit, "ticker") : null
  return {
    n: fit.n,
    r2: round4(fit.r2),
    adjustedR2: round4(fit.adjustedR2),
    status: "estimated",
    coefficients: fit.coefficients.map((row, index) => ({
      name: row.name,
      coefficient: round4(row.coefficient),
      standardError: round4(row.standardError),
      t: round4(row.t),
      pValue: round4(row.pValue),
      clusteredStandardError: clusteredSe ? round4(clusteredSe.se[index]) : null,
    })),
    clusters: clusteredSe?.clusters ?? null,
  }
}

function vifOf(rows, keys) {
  return keys.map((key) => {
    const others = keys.filter((item) => item !== key)
    const fit = ols(rows.map((row) => ({ ...row, y: row[key] })), others)
    const r2 = fit?.r2
    const vif = finite(r2) && r2 < 1 ? 1 / (1 - r2) : null
    return { key, vif: round4(vif), high: finite(vif) && vif >= 5 }
  })
}

function model(events, keys, yRead = lowWindow) {
  const rows = events.map((event) => scaleRow(event, yRead)).filter((row) => finite(row.y) && keys.every((key) => finite(row[key])))
  const fit = ols(rows, keys)
  const standardized = standardizedFit(rows, keys)
  const std = Object.fromEntries((standardized.coefficients ?? []).map((row) => [row.name, row.coefficient]))
  const published = publish(fit, true)
  return {
    ...published,
    standardizedBeta: Object.fromEntries(keys.map((key) => [key, std[key] ?? null])),
    vif: fit ? vifOf(rows, keys) : [],
  }
}

const STEPS = [
  ["M0", ["t0"]],
  ["M1", ["t0", "leadership"]],
  ["M2", ["t0", "leadership", "atrPct"]],
  ["M3", ["t0", "leadership", "betweenAtr"]],
  ["M4", ["t0", "leadership", "withinAtr"]],
  ["M5", ["t0", "leadership", "betweenAtr", "withinAtr"]],
  ["M6", ["t0", "leadership", "betweenAtr", "withinAtr", "spyAtr"]],
  ["M7", ["t0", "leadership", "betweenAtr", "withinAtr", "spyVol"]],
]

export function splitModels(events) {
  const keys = [...new Set(STEPS.flatMap((step) => step[1]))]
  const ready = events.filter((event) => finite(event.lowToWindow) && keys.every((key) => finite(event.predictors[key])))
  return { n: ready.length, models: Object.fromEntries(STEPS.map(([name, modelKeys]) => [name, model(ready, modelKeys)])) }
}

function withinR2(rows, keys, fit) {
  const groups = new Map()
  rows.forEach((row, index) => {
    if (!groups.has(row.ticker)) groups.set(row.ticker, [])
    groups.get(row.ticker).push(index)
  })
  let sst = 0
  let sse = 0
  for (const indexes of groups.values()) {
    const center = mean(indexes.map((index) => rows[index].y))
    for (const index of indexes) {
      const row = rows[index]
      const fitted = fit.beta[0] + keys.reduce((sum, key, keyIndex) => sum + fit.beta[keyIndex + 1] * row[key], 0)
      sst += (row.y - center) ** 2
      sse += (row.y - fitted) ** 2
    }
  }
  return sst === 0 ? null : 1 - sse / sst
}

export function fixedEffects(events) {
  const ready = events.filter((event) => finite(event.lowToWindow) && finite(event.predictors.withinAtr) && finite(event.predictors.t0) && finite(event.predictors.leadership))
  const tickers = [...new Set(ready.map((event) => event.ticker))].sort()
  const reference = tickers[0]
  const dummies = tickers.slice(1).map((ticker) => `fe_${ticker}`)
  const rows = ready.map((event) => {
    const row = scaleRow(event, lowWindow)
    for (const ticker of tickers.slice(1)) row[`fe_${ticker}`] = event.ticker === ticker ? 1 : 0
    return row
  })
  const specs = [
    ["FE1", ["withinAtr", ...dummies]],
    ["FE2", ["t0", "withinAtr", ...dummies]],
    ["FE3", ["t0", "leadership", "withinAtr", ...dummies]],
  ]
  const models = {}
  for (const [name, keys] of specs) {
    const fit = ols(rows, keys)
    if (!fit) {
      models[name] = { status: "singular", n: rows.length, reason: "The ticker indicators and the added variables do not leave a separate slope." }
      continue
    }
    const demeaned = []
    const groups = new Map()
    for (const row of rows) {
      if (!groups.has(row.ticker)) groups.set(row.ticker, [])
      groups.get(row.ticker).push(row)
    }
    for (const group of groups.values()) {
      const center = { y: mean(group.map((row) => row.y)), withinAtr: mean(group.map((row) => row.withinAtr)), t0: mean(group.map((row) => row.t0)), leadership: mean(group.map((row) => row.leadership)) }
      for (const row of group) {
        demeaned.push({
          y: row.y - center.y,
          withinAtr: row.withinAtr - center.withinAtr,
          t0: row.t0 - center.t0,
          leadership: row.leadership - center.leadership,
          ticker: row.ticker,
        })
      }
    }
    const slopeKeys = keys.filter((key) => !key.startsWith("fe_"))
    const standardized = standardizedFit(demeaned, slopeKeys)
    const std = Object.fromEntries((standardized.coefficients ?? []).map((row) => [row.name, row.coefficient]))
    const published = publish(fit, true)
    published.coefficients = published.coefficients.filter((row) => !row.name.startsWith("fe_"))
    models[name] = {
      ...published,
      withinR2: round4(withinR2(rows, keys, fit)),
      standardizedBeta: Object.fromEntries(slopeKeys.map((key) => [key, std[key] ?? null])),
      reference,
      tickers: tickers.length,
    }
  }
  return models
}

function pct(value) {
  return finite(value) ? Math.round(value * 10000) / 100 : null
}

export function tickerTable(events) {
  const grouped = new Map(EQUITY_SELL_RESEARCH_UNIVERSE.map((item) => [item.symbol, []]))
  for (const event of events) grouped.get(event.ticker).push(event)
  return [...grouped.entries()].map(([ticker, rows]) => {
    const withLow = rows.filter((event) => finite(event.lowToWindow))
    return {
      ticker,
      events: rows.length,
      meanEventAtr: pct(mean(rows.map((event) => event.predictors.atrPct))),
      meanPriorAtr: pct(mean(rows.map((event) => event.predictors.betweenAtr).filter(finite))),
      meanWithinAtr: pct(mean(rows.map((event) => event.predictors.withinAtr).filter(finite))),
      meanLowWindow: pct(mean(withLow.map((event) => event.lowToWindow))),
    }
  })
}

export function tickerCorrelations(events) {
  const grouped = new Map()
  for (const event of events) {
    if (!grouped.has(event.ticker)) grouped.set(event.ticker, [])
    grouped.get(event.ticker).push(event)
  }
  const rows = []
  for (const [ticker, group] of grouped) {
    const link = pair(group, (event) => event.predictors.withinAtr, lowWindow)
    rows.push({
      ticker,
      n: link.n,
      rho: link.rho,
      conclusion: link.n >= 10 ? "제한적" : link.n >= 5 ? "숫자만" : "결론 금지",
    })
  }
  const calculable = rows.filter((row) => finite(row.rho))
  const enough = calculable.filter((row) => row.n >= 5)
  return {
    rows,
    calculable: calculable.length,
    positive: calculable.filter((row) => row.rho > 0).length,
    negative: calculable.filter((row) => row.rho < 0).length,
    median: round4(median(calculable.map((row) => row.rho))),
    medianAtLeast5: round4(median(enough.map((row) => row.rho))),
  }
}

export function demeanedLinks(events) {
  const ready = events.filter((event) => finite(event.predictors.withinAtr) && finite(event.lowToWindow) && finite(event.predictors.atrPct))
  const groups = new Map()
  for (const event of ready) {
    if (!groups.has(event.ticker)) groups.set(event.ticker, [])
    groups.get(event.ticker).push(event)
  }
  const points = []
  for (const group of groups.values()) {
    const atrCenter = mean(group.map((event) => event.predictors.atrPct))
    const yCenter = mean(group.map((event) => event.lowToWindow))
    for (const event of group) points.push({ x: event.predictors.atrPct - atrCenter, y: event.lowToWindow - yCenter, multi: group.length >= 2 })
  }
  const use = (rows) => ({
    n: rows.length,
    spearman: round4(spearman(rows).rho),
    pearson: round4(pearson(rows.map((row) => row.x), rows.map((row) => row.y))),
  })
  return { allEvents: use(points), multiEventTickers: use(points.filter((row) => row.multi)) }
}

function edgeSample(events, which) {
  const groups = new Map()
  for (const event of events) {
    if (!groups.has(event.ticker)) groups.set(event.ticker, [])
    groups.get(event.ticker).push(event)
  }
  for (const rows of groups.values()) rows.sort((a, b) => a.t0Date.localeCompare(b.t0Date) || a.eventId.localeCompare(b.eventId))
  return [...groups.values()].map((rows) => (which === "first" ? rows[0] : rows[rows.length - 1]))
}

export function edgeLinks(events) {
  const pack = (rows) => ({
    n: rows.length,
    event: outcomeLinks(rows, (event) => event.predictors.atrPct),
    between: outcomeLinks(rows, (event) => event.predictors.betweenAtr),
    within: outcomeLinks(rows, (event) => event.predictors.withinAtr),
  })
  return { first: pack(edgeSample(events, "first")), last: pack(edgeSample(events, "last")) }
}

export function leaveSplit(events) {
  const out = {}
  for (const key of ["atrPct", "betweenAtr", "withinAtr"]) {
    const block = leaveOneCorrelation(events, (event) => event.predictors[key], lowWindow)
    out[key] = { baseline: block.baseline, min: block.min, max: block.max, median: block.median, signFlips: block.signFlips }
  }
  return out
}

export function extremeWithin(events) {
  const ordered = [...events].filter((event) => finite(event.predictors.withinAtr)).sort((a, b) => b.predictors.withinAtr - a.predictors.withinAtr || a.eventId.localeCompare(b.eventId))
  const ascending = [...ordered].reverse()
  const drop = (source, count) => {
    const gone = new Set(source.slice(0, count).map((event) => event.eventId))
    return events.filter((event) => !gone.has(event.eventId))
  }
  const pack = (rows) => ({
    n: rows.length,
    event: pair(rows, (event) => event.predictors.atrPct, lowWindow),
    between: pair(rows, (event) => event.predictors.betweenAtr, lowWindow),
    within: pair(rows, (event) => event.predictors.withinAtr, lowWindow),
  })
  const result = { all: pack(events) }
  for (const count of [1, 3, 5]) {
    result[`dropHigh${count}`] = pack(drop(ordered, count))
    result[`dropLow${count}`] = pack(drop(ascending, count))
  }
  return result
}

export function tickerEqualBetween(events) {
  const groups = new Map()
  for (const event of events) {
    if (!finite(event.predictors.betweenAtr) || !finite(event.lowToWindow)) continue
    if (!groups.has(event.ticker)) groups.set(event.ticker, { x: [], y: [] })
    groups.get(event.ticker).x.push(event.predictors.betweenAtr)
    groups.get(event.ticker).y.push(event.lowToWindow)
  }
  const points = [...groups.values()].map((group) => ({ x: mean(group.x), y: mean(group.y) }))
  return { ...spearman(points), tickers: points.length }
}

function cellSummary(rows) {
  const windowValues = rows.map(lowWindow).filter(finite)
  const t20Values = rows.map(lowT20).filter(finite)
  const eligible = rows.filter((event) => event.lowDay != null)
  const reached = eligible.filter((event) => event.hits["10"].reached).length
  return {
    n: rows.length,
    lowWindowN: windowValues.length,
    lowWindow: pct(mean(windowValues)),
    lowT20N: t20Values.length,
    lowT20: pct(mean(t20Values)),
    hit10Rate: eligible.length ? Math.round((reached / eligible.length) * 10000) / 100 : null,
    conclusion: rows.length >= 10 ? "제한적" : "결론 금지",
  }
}

function medianGrid(events, leftKey, rightKey) {
  const leftCut = median(events.map((event) => event.predictors[leftKey]).filter(finite))
  const rightCut = median(events.map((event) => event.predictors[rightKey]).filter(finite))
  const cells = {}
  for (const left of ["high", "low"]) {
    for (const right of ["high", "low"]) {
      const rows = events.filter((event) => {
        if (!finite(event.predictors[leftKey]) || !finite(event.predictors[rightKey])) return false
        const leftHigh = event.predictors[leftKey] > leftCut
        const rightHigh = event.predictors[rightKey] > rightCut
        return (left === "high") === leftHigh && (right === "high") === rightHigh
      })
      cells[`${left}-${right}`] = cellSummary(rows)
    }
  }
  return { leftKey, rightKey, leftCut, rightCut, cells }
}

function periodRho(events, key) {
  const buckets = { A: [], B: [], C: [] }
  for (const event of events) {
    const name = periodOf(event.t0Date)
    if (buckets[name]) buckets[name].push(event)
  }
  return Object.fromEntries(["A", "B", "C"].map((name) => [name, { n: buckets[name].length, lowWindow: pair(buckets[name], (event) => event.predictors[key], lowWindow) }]))
}

export function judgeSplit(input) {
  const { withinRho, betweenRho, eventRho, feCoef, first, last, flips, periods, n } = input
  if (!(n >= 10)) return { label: "D", text: "표본 부족" }
  const periodRows = periods.filter((row) => row.n >= 10 && finite(row.rho))
  const edgesHold = [first, last].every((row) => !(row.n >= 10) || (row.rho > 0 && Math.abs(row.rho) >= 0.5 * Math.abs(withinRho)))
  const direction = withinRho >= WITHIN_FLOOR && input.lowT20 > 0 && input.hit10 < 0
  const strong = direction && feCoef > 0 && edgesHold && flips.length === 0 && periodRows.length > 0 && periodRows.every((row) => row.rho > 0)
  if (strong) return { label: "A", text: "Within-stock effect가 확인됨" }
  const withinWeak = Math.abs(withinRho) < NEAR_ZERO || !(feCoef > 0)
  if (eventRho >= 0.2 && withinWeak) return { label: "B", text: "Between-stock effect가 대부분 설명" }
  if (withinRho > 0 && betweenRho > 0) return { label: "C", text: "Between과 Within 모두 일부" }
  return { label: "D", text: "효과가 불안정하거나 표본이 부족" }
}

export function study(events) {
  const baseline = baselineLinks(events)
  assertBaseline(events, baseline)
  const read = (key) => (event) => event.predictors[key]
  const links = {
    event: outcomeLinks(events, read("atrPct")),
    between: outcomeLinks(events, read("betweenAtr")),
    within: outcomeLinks(events, read("withinAtr")),
    withinRatio: outcomeLinks(events, read("withinRatio")),
    withinPercentile: outcomeLinks(events, read("withinPercentile")),
    between120: outcomeLinks(events, read("between120")),
    within120: outcomeLinks(events, read("within120")),
    between252: outcomeLinks(events, read("between252")),
    within252: outcomeLinks(events, read("within252")),
    priorMean60: outcomeLinks(events, read("priorMean60")),
    priorMean120: outcomeLinks(events, read("priorMean120")),
  }
  const with120 = events.filter((event) => finite(event.predictors.within120))
  const event120 = pair(with120, read("atrPct"), lowWindow)
  const models = splitModels(events)
  const effects = fixedEffects(events)
  const edges = edgeLinks(events)
  const leave = leaveSplit(events)
  const extremes = extremeWithin(events)
  const periods = { event: periodRho(events, "atrPct"), between: periodRho(events, "betweenAtr"), within: periodRho(events, "withinAtr") }
  const fe2 = effects.FE2
  const feCoef = fe2?.coefficients?.find((row) => row.name === "withinAtr")?.coefficient
  const judgment = judgeSplit({
    n: links.within.lowWindow.n,
    withinRho: links.within.lowWindow.rho,
    betweenRho: links.between.lowWindow.rho,
    eventRho: links.event.lowWindow.rho,
    lowT20: links.within.lowT20.rho,
    hit10: links.within.hit10.rho,
    feCoef,
    first: { n: edges.first.within.lowWindow.n, rho: edges.first.within.lowWindow.rho },
    last: { n: edges.last.within.lowWindow.n, rho: edges.last.within.lowWindow.rho },
    flips: leave.withinAtr.signFlips,
    periods: ["A", "B", "C"].map((name) => ({ n: periods.within[name].lowWindow.n, rho: periods.within[name].lowWindow.rho })),
  })
  const cell = (link) => ({ rho: link?.rho ?? null, n: link?.n ?? 0 })
  const matrix = [
    ["all", links.event.lowWindow, links.between.lowWindow, links.within.lowWindow],
    ["baseline60", links.event.lowWindow, links.between.lowWindow, links.within.lowWindow],
    ["baseline120", event120, links.between120.lowWindow, links.within120.lowWindow],
    ["first", edges.first.event.lowWindow, edges.first.between.lowWindow, edges.first.within.lowWindow],
    ["last", edges.last.event.lowWindow, edges.last.between.lowWindow, edges.last.within.lowWindow],
    ["dropHigh1", extremes.dropHigh1.event, extremes.dropHigh1.between, extremes.dropHigh1.within],
    ["dropHigh3", extremes.dropHigh3.event, extremes.dropHigh3.between, extremes.dropHigh3.within],
    ["dropHigh5", extremes.dropHigh5.event, extremes.dropHigh5.between, extremes.dropHigh5.within],
    ["leaveMin", { rho: leave.atrPct.min, n: leave.atrPct.baseline.n }, { rho: leave.betweenAtr.min, n: leave.betweenAtr.baseline.n }, { rho: leave.withinAtr.min, n: leave.withinAtr.baseline.n }],
    ["leaveMax", { rho: leave.atrPct.max, n: leave.atrPct.baseline.n }, { rho: leave.betweenAtr.max, n: leave.betweenAtr.baseline.n }, { rho: leave.withinAtr.max, n: leave.withinAtr.baseline.n }],
    ["periodA", periods.event.A.lowWindow, periods.between.A.lowWindow, periods.within.A.lowWindow],
    ["periodB", periods.event.B.lowWindow, periods.between.B.lowWindow, periods.within.B.lowWindow],
    ["periodC", periods.event.C.lowWindow, periods.between.C.lowWindow, periods.within.C.lowWindow],
  ].map(([id, event, between, within]) => ({ id, event: cell(event), between: cell(between), within: cell(within) }))
  return {
    baseline,
    links,
    models,
    effects,
    tickers: tickerTable(events),
    tickerCorrelations: tickerCorrelations(events),
    demeaned: demeanedLinks(events),
    edges,
    leave,
    extremes,
    periods,
    betweenEqual: tickerEqualBetween(events),
    eventWithinGrid: medianGrid(events, "atrPct", "withinAtr"),
    betweenWithinGrid: medianGrid(events, "betweenAtr", "withinAtr"),
    spyWithin: pair(events, read("withinAtr"), read("spyAtr")),
    matrix,
    judgment,
    identity: "event ATR equals the 60-day prior median plus the within gap. The three are not entered in one regression.",
  }
}
