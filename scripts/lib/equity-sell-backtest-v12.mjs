/**
 * US single-stock entry-state profile study v12 (research only).
 *
 * Groups the same 103 correction events by information known at the correction
 * close. Outcomes after that close are not predictors. No sell rule is selected.
 */

import { mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { describeRebound } from "./equity-sell-backtest-v6.mjs"
import { predictorBlock } from "./equity-sell-backtest-v7.mjs"
import { leaveOneCorrelation } from "./equity-sell-backtest-v7.mjs"
import { fitInferred } from "./equity-sell-backtest-v9.mjs"
import { attachSpeed, hitSummary, loadOhlcv, selectMildEvents } from "./equity-sell-backtest-v11.mjs"

export { loadOhlcv, selectMildEvents, leaveOneCorrelation, hitSummary }

export const SELECTED_STRATEGY = null
export const LOCKED_EVENTS = 103
export const LOCKED_GROUPS = { HIGH: 15, MID: 53, LOW: 35 }
export const DUPLICATE_RHO = 0.7
export const PREDICTORS = [
  ["t0", "T0"],
  ["leadership", "leadership"],
  ["atrPct", "ATR14/price"],
  ["vol20", "20d realized volatility"],
  ["correctionSpeed", "correction speed"],
  ["correctionDuration", "correction duration"],
  ["volumeRatio20", "20d volume ratio"],
  ["distMa50", "50d MA distance"],
  ["pos60", "60d range position"],
  ["pos120", "120d range position"],
]

const MODEL_STEPS = [
  ["M0", "T0", ["t0"]],
  ["M1", "T0 + leadership", ["t0", "leadership"]],
  ["M2", "T0 + leadership + ATR", ["t0", "leadership", "atrPct"]],
  ["M3", "M2 + correction speed", ["t0", "leadership", "atrPct", "correctionSpeed"]],
  ["M4", "M3 + 20d realized volatility", ["t0", "leadership", "atrPct", "correctionSpeed", "vol20"]],
  ["M5", "M3 + volume ratio + 50d MA distance", ["t0", "leadership", "atrPct", "correctionSpeed", "volumeRatio20", "distMa50"]],
]
const ADD_ONS = ["vol20", "volumeRatio20", "distMa50", "pos60", "pos120"]

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

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

function statusOf(n) {
  if (n < 5) return "insufficient"
  if (n < 10) return "numbers_only"
  return "limited"
}

export function entryLocation(closes, t0) {
  const distance = (length) => {
    if (t0 < length) return null
    const slice = closes.slice(t0 - length, t0)
    const average = mean(slice)
    return average > 0 ? closes[t0] / average - 1 : null
  }
  const position = (length) => {
    if (t0 < length) return null
    const slice = closes.slice(t0 - length, t0)
    const low = Math.min(...slice)
    const high = Math.max(...slice)
    if (!(high > low)) return null
    return (closes[t0] - low) / (high - low)
  }
  return { distMa50: distance(50), pos60: position(60), pos120: position(120) }
}

export function speedSide(speed, cut) {
  if (!finite(speed) || !finite(cut)) return null
  return speed <= cut ? "FAST" : "SLOW"
}

function intervalReturn(closes, t0, endIdx, from, to) {
  const left = t0 + from
  const right = t0 + to
  if (left > endIdx || right > endIdx || !(closes[left] > 0)) return null
  return closes[right] / closes[left] - 1
}

export function attachProfile(events, seriesBySymbol) {
  const base = attachSpeed(events, seriesBySymbol)
  const tagged = base.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    const entryIdx = dateIndex(series.dates, event.episodeStart)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    const block = predictorBlock(series, entryIdx, t0Idx)
    if (!block.matched) throw new Error(`correction path does not match ${event.eventId}`)
    if (Math.abs(block.atrPct - event.atrPct) > 1e-10) throw new Error(`ATR differs ${event.eventId}`)
    const described = describeRebound(series.closes, entryIdx, t0Idx, series.closes[entryIdx])
    const endIdx = entryIdx + 60
    const location = entryLocation(series.closes, t0Idx)
    return {
      ...event,
      predictors: {
        t0: event.t0,
        leadership: event.leadershipScore,
        atrPct: block.atrPct,
        vol20: block.vol20,
        correctionSpeed: block.correctionSpeed,
        correctionDuration: block.correctionDuration,
        volumeRatio20: block.volumeRatio20,
        distMa50: location.distMa50,
        pos60: location.pos60,
        pos120: location.pos120,
      },
      entryPath: {
        t5: described.fromEntry.t5,
        t10: described.fromEntry.t10,
        t20: described.fromEntry.t20,
        t40: described.fromEntry.t40,
        window: described.fromEntry.windowEnd,
      },
      entrySegments: {
        to5: described.fromEntry.t5,
        t5to10: intervalReturn(series.closes, t0Idx, endIdx, 5, 10),
        t10to20: intervalReturn(series.closes, t0Idx, endIdx, 10, 20),
        t20to40: intervalReturn(series.closes, t0Idx, endIdx, 20, 40),
      },
    }
  })
  const speeds = tagged.map((event) => event.predictors.correctionSpeed).filter(finite)
  const cut = median(speeds)
  const out = tagged.map((event) => ({ ...event, speedSide: speedSide(event.predictors.correctionSpeed, cut) }))
  out.bandCounts = base.bandCounts
  out.speedCut = cut
  out.speedCount = speeds.length
  return out
}

function level(rows, read, scale = 100) {
  const values = rows.map(read).filter(finite)
  const avg = mean(values)
  const mid = median(values)
  return {
    n: values.length,
    avg: round2(avg == null ? null : avg * scale),
    median: round2(mid == null ? null : mid * scale),
  }
}

function packCell(rows) {
  const hits = hitSummary(rows)
  return {
    n: rows.length,
    status: statusOf(rows.length),
    t5: level(rows, (event) => event.entryPath.t5),
    t10: level(rows, (event) => event.entryPath.t10),
    t20: level(rows, (event) => event.entryPath.t20),
    t40: level(rows, (event) => event.entryPath.t40),
    window: level(rows, (event) => event.entryPath.window),
    lowT10: level(rows, (event) => event.fromLow.t10),
    lowT20: level(rows, (event) => event.fromLow.t20),
    lowWindow: level(rows, (event) => event.lowToWindow),
    segments: {
      to5: level(rows, (event) => event.entrySegments.to5),
      t5to10: level(rows, (event) => event.entrySegments.t5to10),
      t10to20: level(rows, (event) => event.entrySegments.t10to20),
      t20to40: level(rows, (event) => event.entrySegments.t20to40),
    },
    hit5: hits["5"],
    hit10: hits["10"],
    hit15: hits["15"],
    hit20: hits["20"],
  }
}

export function presentCell(cell) {
  if (cell.n < 5) return { n: cell.n, status: "insufficient" }
  return { ...cell, status: cell.n < 10 ? "numbers_only" : "limited" }
}

export function leadershipAtrGrid(events) {
  const cells = []
  for (const leadership of ["HIGH", "LOW"]) {
    for (const atr of ["HIGH", "LOW"]) {
      const rows = events.filter((event) => event.leadershipGroup === leadership && event.atrBand === atr)
      const full = packCell(rows)
      cells.push({ leadership, atr, ...full, view: presentCell(full) })
    }
  }
  return cells
}

export function conditionalContrasts(cells) {
  const byKey = Object.fromEntries(cells.map((cell) => [`${cell.leadership}|${cell.atr}`, cell]))
  const questions = [
    ["Q1", "Inside leadership HIGH, ATR HIGH versus ATR LOW", "HIGH|HIGH", "HIGH|LOW"],
    ["Q2", "Inside leadership LOW, ATR HIGH versus ATR LOW", "LOW|HIGH", "LOW|LOW"],
    ["Q3", "Inside ATR HIGH, leadership HIGH versus LOW", "HIGH|HIGH", "LOW|HIGH"],
    ["Q4", "Inside ATR LOW, leadership HIGH versus LOW", "HIGH|LOW", "LOW|LOW"],
  ]
  return questions.map(([id, label, leftKey, rightKey]) => {
    const left = byKey[leftKey]
    const right = byKey[rightKey]
    const judgment = left.n < 10 || right.n < 10 ? "표본 부족" : "limited"
    return { id, label, leftN: left.n, rightN: right.n, judgment }
  })
}

export function speedGrid(events) {
  const cells = []
  for (const leadership of ["HIGH", "LOW"]) {
    for (const atr of ["HIGH", "LOW"]) {
      for (const speed of ["FAST", "SLOW"]) {
        const rows = events.filter((event) => event.leadershipGroup === leadership && event.atrBand === atr && event.speedSide === speed)
        const full = packCell(rows)
        cells.push({ leadership, atr, speed, ...full, view: presentCell(full) })
      }
    }
  }
  return cells
}

export function predictorCorrelations(events) {
  const matrix = {}
  const flagged = []
  for (const [left] of PREDICTORS) {
    matrix[left] = {}
    for (const [right] of PREDICTORS) {
      const stat = spearman(
        events
          .map((event) => ({ x: event.predictors[left], y: event.predictors[right] }))
          .filter((pair) => finite(pair.x) && finite(pair.y)),
      )
      matrix[left][right] = stat
      if (left < right && finite(stat.rho) && Math.abs(stat.rho) >= DUPLICATE_RHO) {
        flagged.push({ left, right, rho: stat.rho, n: stat.n, note: "duplicate information is possible" })
      }
    }
  }
  return { matrix, flagged, threshold: DUPLICATE_RHO }
}

export function t0Links(events) {
  const links = {}
  for (const [key] of PREDICTORS) {
    if (key === "t0") continue
    links[key] = spearman(events.map((event) => ({ x: event.predictors.t0, y: event.predictors[key] })).filter((pair) => finite(pair.x) && finite(pair.y)))
  }
  links.entryWindow = spearman(events.map((event) => ({ x: event.predictors.t0, y: event.entryPath.window })).filter((pair) => finite(pair.x) && finite(pair.y)))
  links.lowWindow = spearman(events.map((event) => ({ x: event.predictors.t0, y: event.lowToWindow })).filter((pair) => finite(pair.x) && finite(pair.y)))
  return links
}

function designRow(event, yKey) {
  const y = yKey === "lowToWindow" ? event.lowToWindow : event.entryPath[yKey]
  const scale = (value) => (finite(value) ? value * 100 : null)
  return {
    y: scale(y),
    t0: scale(event.predictors.t0),
    leadership: event.predictors.leadership,
    atrPct: scale(event.predictors.atrPct),
    correctionSpeed: scale(event.predictors.correctionSpeed),
    vol20: scale(event.predictors.vol20),
    volumeRatio20: event.predictors.volumeRatio20,
    distMa50: scale(event.predictors.distMa50),
    pos60: event.predictors.pos60,
    pos120: event.predictors.pos120,
  }
}

function sampleSd(values) {
  if (values.length < 2 || values.some((value) => !finite(value))) return null
  const center = mean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1))
}

export function standardizedFit(rows, keys) {
  const usable = rows.filter((row) => finite(row.y) && keys.every((key) => finite(row[key])))
  const columns = {}
  for (const key of ["y", ...keys]) {
    const values = usable.map((row) => row[key])
    const deviation = sampleSd(values)
    if (!(deviation > 0)) return { n: usable.length, r2: null, adjustedR2: null, coefficients: null }
    const center = mean(values)
    columns[key] = values.map((value) => (value - center) / deviation)
  }
  const scaled = usable.map((row, index) => {
    const next = { y: columns.y[index] }
    for (const key of keys) next[key] = columns[key][index]
    return next
  })
  return fitInferred(scaled, keys)
}

function fitPair(rows, keys) {
  const raw = fitInferred(rows, keys)
  const standardized = standardizedFit(rows, keys)
  const std = Object.fromEntries((standardized.coefficients ?? []).map((row) => [row.name, row.coefficient]))
  return {
    n: raw.n,
    r2: raw.r2,
    adjustedR2: raw.adjustedR2,
    coefficients: (raw.coefficients ?? []).map((row) => ({ ...row, standardizedBeta: row.name === "intercept" ? null : std[row.name] ?? null })),
  }
}

export function continuousModels(events) {
  const outcomes = ["t20", "window", "lowToWindow"]
  const result = {}
  for (const outcome of outcomes) {
    const rows = events.map((event) => designRow(event, outcome === "lowToWindow" ? "lowToWindow" : outcome))
    const stepKeys = [...new Set(MODEL_STEPS.flatMap((step) => step[2]))]
    const common = rows.filter((row) => finite(row.y) && stepKeys.every((key) => finite(row[key])))
    const steps = MODEL_STEPS.map(([id, label, keys]) => ({ id, label, ...fitPair(common, keys) }))
    const baseKeys = MODEL_STEPS[3][2]
    const additions = ADD_ONS.map((key) => {
      const sample = rows.filter((row) => finite(row.y) && baseKeys.every((item) => finite(row[item])) && finite(row[key]))
      const base = fitPair(sample, baseKeys)
      const added = fitPair(sample, [...baseKeys, key])
      const adjustedDelta = finite(base.adjustedR2) && finite(added.adjustedR2) ? Math.round((added.adjustedR2 - base.adjustedR2) * 10000) / 10000 : null
      return {
        key,
        n: added.n,
        baseR2: base.r2,
        r2: added.r2,
        baseAdjustedR2: base.adjustedR2,
        adjustedR2: added.adjustedR2,
        adjustedDelta,
        note: adjustedDelta == null ? null : adjustedDelta < 0.01 ? "추가 설명력이 제한적" : "adjusted R2 increases",
      }
    })
    result[outcome] = { steps, additions, commonN: common.length }
  }
  return {
    ...result,
    note: "Event-level OLS. Returns, T0, ATR/price, correction speed, realized volatility, and MA distance are in percent. Leadership is the 0–100 score. Volume ratio and range position stay in their own units. Standardized beta is the coefficient after each variable is scaled by its sample standard deviation. Repeated events from the same ticker are not independent, so a p-value is not a sell-rule threshold.",
  }
}

export function judgeAssociation(n, standardizedBeta) {
  if (!(n >= 10) || !finite(standardizedBeta)) return "표본 부족"
  const magnitude = Math.abs(standardizedBeta)
  if (magnitude < 0.1) return "차이 없음"
  if (magnitude < 0.25) return "약한 차이"
  return "명확한 차이"
}

export function judgeContrasts(contrasts) {
  if (contrasts.every((row) => row.judgment === "표본 부족")) return "표본 부족"
  return "limited"
}
