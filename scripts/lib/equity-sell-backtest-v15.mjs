/**
 * US single-stock ATR shape study v15 (research only).
 *
 * Separates the correction-day ATR level from the path ATR took between the
 * leading peak and the first -10% close. Full-path summaries are descriptive
 * and are not model inputs. No sell rule is selected.
 */

import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./equity-sell-research-universe.mjs"
import { PROFIT_ARM } from "./equity-sell-backtest-v1.mjs"
import { spearman, mean, median } from "./equity-sell-backtest-v2.mjs"
import { fitInferred } from "./equity-sell-backtest-v9.mjs"
import {
  CORRECTION_DEPTH,
  leaveOneCorrelation,
  sampleStdev,
  volatilityBlock,
} from "./equity-sell-backtest-v7.mjs"
import { FORWARD_DAYS, locateProfitCorrection } from "./etf-sell-backtest-v6.mjs"
import { standardizedFit } from "./equity-sell-backtest-v12.mjs"
import { attachProfile, loadOhlcv, selectMildEvents } from "./equity-sell-backtest-v12.mjs"
import { marketAt, periodOf } from "./equity-sell-backtest-v14.mjs"

export { EQUITY_SELL_RESEARCH_UNIVERSE, loadOhlcv, selectMildEvents, attachProfile, periodOf }

export const SELECTED_STRATEGY = null
export const PRE_ENTRY_SHAPE = ["peakAtr", "preEntryAtr", "atrChange", "atrRatio", "atrSlope"]
export const DESCRIPTIVE_SHAPE = ["maxAtr", "meanAtr", "atrDispersion", "entryPercentile"]
export const MODEL_SHAPE = ["atrChange", "atrRatio", "atrSlope"]
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
const ADJ_DELTA = 0.01
const CLEAR_GAP = 0.1
const SHAPE_RHO_FLOOR = 0.15

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

export function linearSlope(points) {
  if (points.length < 2) return null
  const centerX = mean(points.map((point) => point.x))
  const centerY = mean(points.map((point) => point.y))
  let numerator = 0
  let denominator = 0
  for (const point of points) {
    const dx = point.x - centerX
    numerator += dx * (point.y - centerY)
    denominator += dx * dx
  }
  return denominator > 0 ? numerator / denominator : null
}

export function episodePercentile(values, current) {
  const rows = values.filter(finite)
  if (!rows.length || !finite(current)) return null
  const below = rows.filter((value) => value < current).length
  const equal = rows.filter((value) => value === current).length
  return ((below + 0.5 * equal) / rows.length) * 100
}

export function atrPath(series, peakIdx, t0Idx) {
  const points = []
  for (let index = peakIdx; index <= t0Idx; index += 1) {
    const atr = volatilityBlock(series.highs, series.lows, series.closes, index).atrPct
    if (finite(atr)) points.push({ index, x: index - peakIdx, y: atr })
  }
  return points
}

export function shapeFromPoints(points, peakIdx, t0Idx, preEntryAtr) {
  const at = (index) => points.find((point) => point.index === index)?.y ?? null
  const peak = at(peakIdx)
  const entry = at(t0Idx)
  const values = points.map((point) => point.y)
  return {
    peakAtr: peak,
    preEntryAtr,
    atrChange: finite(entry) && finite(peak) ? entry - peak : null,
    atrRatio: finite(entry) && peak > 0 ? entry / peak : null,
    atrSlope: linearSlope(points),
    maxAtr: values.length ? Math.max(...values) : null,
    meanAtr: finite(mean(values)) ? mean(values) : null,
    atrDispersion: sampleStdev(values),
    entryPercentile: episodePercentile(values, entry),
    pathN: values.length,
  }
}

export function attachShape(events, seriesBySymbol, spy) {
  const base = attachProfile(events, seriesBySymbol)
  const out = base.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    const entryIdx = dateIndex(series.dates, event.episodeStart)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    const located = locateProfitCorrection(series.closes, entryIdx, FORWARD_DAYS, PROFIT_ARM, CORRECTION_DEPTH)
    if (!located.event || located.t0 !== t0Idx) throw new Error(`correction path does not match ${event.eventId}`)
    const points = atrPath(series, located.peakIdx, t0Idx)
    const entryAtr = points.find((point) => point.index === t0Idx)?.y
    if (!finite(entryAtr) || Math.abs(entryAtr - event.predictors.atrPct) > 1e-10) throw new Error(`entry ATR differs ${event.eventId}`)
    const preEntryAtr = volatilityBlock(series.highs, series.lows, series.closes, t0Idx - 1).atrPct
    const shape = shapeFromPoints(points, located.peakIdx, t0Idx, preEntryAtr)
    const market = marketAt(spy, event.t0Date)
    return {
      ...event,
      predictors: {
        ...event.predictors,
        ...shape,
        correctionDuration: t0Idx - located.peakIdx,
        spyAtr: market?.spyAtr ?? null,
      },
    }
  })
  out.bandCounts = base.bandCounts
  return out
}

function pair(events, xRead, yRead) {
  return spearman(events.map((event) => ({ x: xRead(event), y: yRead(event) })).filter((row) => finite(row.x) && finite(row.y)))
}

const lowWindow = (event) => event.lowToWindow
const lowT10 = (event) => event.fromLow.t10
const lowT20 = (event) => event.fromLow.t20
const entryT20 = (event) => event.entryPath.t20
const hitTime = (event) => event.hits["10"].days
const OUTCOMES = [
  ["lowWindow", lowWindow],
  ["lowT10", lowT10],
  ["lowT20", lowT20],
  ["hit10", hitTime],
  ["entryT20", entryT20],
]

export function baselineLinks(events) {
  const x = (event) => event.predictors.atrPct
  return {
    lowWindow: pair(events, x, lowWindow),
    lowT10: pair(events, x, lowT10),
    lowT20: pair(events, x, lowT20),
    hit10: pair(events, x, hitTime),
  }
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

function outcomeLinks(events, xRead) {
  return Object.fromEntries(OUTCOMES.map(([key, read]) => [key, pair(events, xRead, read)]))
}

export function shapeLinks(events) {
  const read = (key) => (event) => event.predictors[key]
  const keys = ["atrPct", "peakAtr", "preEntryAtr", "atrChange", "atrRatio", "atrSlope", "correctionDuration"]
  return Object.fromEntries(keys.map((key) => [key, outcomeLinks(events, read(key))]))
}

export function descriptiveLinks(events) {
  const read = (key) => (event) => event.predictors[key]
  return Object.fromEntries(DESCRIPTIVE_SHAPE.map((key) => [key, { role: "post-entry descriptive only", ...pair(events, read(key), lowWindow) }]))
}

function betaOf(fit, name) {
  return (fit.coefficients ?? []).find((row) => row.name === name)?.coefficient ?? null
}

function completeRows(events, yRead, keys) {
  const rows = []
  for (const event of events) {
    const row = { y: yRead(event) }
    let ok = finite(row.y)
    for (const key of keys) {
      row[key] = event.predictors[key]
      if (!finite(row[key])) ok = false
    }
    if (ok) rows.push(row)
  }
  return rows
}

function fitKeys(events, yRead, keys) {
  const rows = completeRows(events, yRead, keys)
  const fit = standardizedFit(rows, keys)
  return {
    n: fit.n,
    r2: fit.r2,
    adjustedR2: fit.adjustedR2,
    beta: Object.fromEntries(keys.map((key) => [key, betaOf(fit, key)])),
  }
}

function vifOn(rows, keys) {
  return keys.map((key) => {
    const others = keys.filter((item) => item !== key)
    const r2 = others.length ? fitInferred(rows.map((row) => ({ ...row, y: row[key] })), others).r2 : null
    const vif = finite(r2) && r2 < 1 ? 1 / (1 - r2) : null
    return { key, r2, vif, high: finite(vif) && vif >= 5 }
  })
}

function nested(events, yRead, steps) {
  const keys = [...new Set(steps.flatMap((step) => step[1]))]
  const ready = events.filter((event) => finite(yRead(event)) && keys.every((key) => finite(event.predictors[key])))
  const models = Object.fromEntries(steps.map(([name, modelKeys]) => [name, fitKeys(ready, yRead, modelKeys)]))
  const fullest = steps[steps.length - 1][1]
  return { n: ready.length, models, vif: vifOn(completeRows(ready, yRead, fullest), fullest) }
}

const BASE = [
  ["M0", ["t0"]],
  ["M1", ["t0", "leadership"]],
  ["M2", ["t0", "leadership", "atrPct"]],
]

export function levelModels(events, yRead) {
  return {
    change: nested(events, yRead, [...BASE, ["M3", ["t0", "leadership", "atrPct", "atrChange"]]]),
    ratio: nested(events, yRead, [...BASE, ["M4", ["t0", "leadership", "atrPct", "atrRatio"]]]),
    slope: nested(events, yRead, [...BASE, ["M5", ["t0", "leadership", "atrPct", "atrSlope"]]]),
    peak: nested(events, yRead, [
      ["M1", ["t0", "leadership", "peakAtr"]],
      ["M2", ["t0", "leadership", "atrPct"]],
      ["M3", ["t0", "leadership", "peakAtr", "atrChange"]],
    ]),
    duration: Object.fromEntries(MODEL_SHAPE.map((key) => [key, nested(events, yRead, [["M", ["t0", "leadership", "atrPct", "correctionDuration", key]]])])),
    market: Object.fromEntries(MODEL_SHAPE.map((key) => [key, nested(events, yRead, [["M", ["t0", "leadership", "atrPct", "spyAtr", key]]])])),
  }
}

function pct(value) {
  return finite(value) ? Math.round(value * 10000) / 100 : null
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

export function shapeGrid(events) {
  const ratios = events.map((event) => event.predictors.atrRatio).filter(finite)
  const atrs = events.map((event) => event.predictors.atrPct).filter(finite)
  const ratioCut = median(ratios)
  const atrCut = median(atrs)
  const cells = {}
  for (const atrSide of ["high", "low"]) {
    for (const ratioSide of ["high", "low"]) {
      const rows = events.filter((event) => {
        if (!finite(event.predictors.atrPct) || !finite(event.predictors.atrRatio)) return false
        const atrHigh = event.predictors.atrPct > atrCut
        const ratioHigh = event.predictors.atrRatio > ratioCut
        return (atrSide === "high") === atrHigh && (ratioSide === "high") === ratioHigh
      })
      cells[`${atrSide}-${ratioSide}`] = cellSummary(rows)
    }
  }
  return { atrCut, ratioCut, cells }
}

function durationName(duration) {
  if (duration <= 2) return "d1to2"
  if (duration <= 5) return "d3to5"
  return "d6plus"
}

export function durationBins(events) {
  const bins = { d1to2: [], d3to5: [], d6plus: [] }
  for (const event of events) bins[durationName(event.predictors.correctionDuration)].push(event)
  const level = (rows, key) => pct(mean(rows.map((event) => event.predictors[key]).filter(finite)))
  return Object.fromEntries(Object.entries(bins).map(([key, rows]) => [key, {
    n: rows.length,
    entryAtr: level(rows, "atrPct"),
    peakAtr: level(rows, "peakAtr"),
    atrRatio: finite(mean(rows.map((event) => event.predictors.atrRatio).filter(finite))) ? Math.round(mean(rows.map((event) => event.predictors.atrRatio).filter(finite)) * 100) / 100 : null,
    atrSlope: level(rows, "atrSlope"),
    lowWindow: pct(mean(rows.map(lowWindow).filter(finite))),
    conclusion: rows.length >= 10 ? "제한적" : "결론 금지",
  }]))
}

export function betweenLinks(events) {
  const names = ["atrPct", "peakAtr", "atrChange", "atrRatio", "atrSlope", "correctionDuration", "spyAtr", "leadership"]
  const out = {}
  for (let left = 0; left < names.length; left += 1) {
    for (let right = left + 1; right < names.length; right += 1) {
      out[`${names[left]}__${names[right]}`] = pair(events, (event) => event.predictors[names[left]], (event) => event.predictors[names[right]])
    }
  }
  return out
}

export function duplicationVif(events) {
  const keys = ["atrPct", "atrChange", "atrRatio", "atrSlope"]
  const ready = events.filter((event) => keys.every((key) => finite(event.predictors[key])))
  const rows = ready.map((event) => Object.fromEntries(keys.map((key) => [key, event.predictors[key]])))
  return { n: ready.length, vif: vifOn(rows.map((row) => ({ ...row, y: 0 })), keys) }
}

function periodBlock(events, key) {
  const buckets = { A: [], B: [], C: [] }
  for (const event of events) {
    const name = periodOf(event.t0Date)
    if (buckets[name]) buckets[name].push(event)
  }
  return Object.fromEntries(["A", "B", "C"].map((name) => [name, { n: buckets[name].length, lowWindow: pair(buckets[name], (event) => event.predictors[key], lowWindow) }]))
}

export function periodShape(events) {
  return Object.fromEntries(["atrPct", "atrChange", "atrRatio", "atrSlope"].map((key) => [key, periodBlock(events, key)]))
}

export function leaveShape(events) {
  const out = {}
  for (const key of ["atrPct", "atrChange", "atrRatio", "atrSlope"]) {
    const ready = events.filter((event) => finite(event.predictors[key]))
    const block = leaveOneCorrelation(ready, (event) => event.predictors[key], lowWindow)
    out[key] = { baseline: block.baseline, min: block.min, max: block.max, median: block.median, signFlips: block.signFlips }
  }
  return out
}

export function extremeShape(events) {
  const byAtr = [...events].sort((a, b) => b.predictors.atrPct - a.predictors.atrPct || a.eventId.localeCompare(b.eventId))
  const byChange = [...events].filter((event) => finite(event.predictors.atrChange)).sort((a, b) => Math.abs(b.predictors.atrChange) - Math.abs(a.predictors.atrChange) || a.eventId.localeCompare(b.eventId))
  const dropped = (source, count) => {
    const gone = new Set(source.slice(0, count).map((event) => event.eventId))
    return events.filter((event) => !gone.has(event.eventId))
  }
  const pack = (rows) => ({
    n: rows.length,
    entry: pair(rows, (event) => event.predictors.atrPct, lowWindow),
    change: pair(rows, (event) => event.predictors.atrChange, lowWindow),
    ratio: pair(rows, (event) => event.predictors.atrRatio, lowWindow),
    slope: pair(rows, (event) => event.predictors.atrSlope, lowWindow),
  })
  return {
    all: pack(events),
    dropHigh1: pack(dropped(byAtr, 1)),
    dropHigh3: pack(dropped(byAtr, 3)),
    dropHigh5: pack(dropped(byAtr, 5)),
    dropChange5: pack(dropped(byChange, 5)),
  }
}

export function levelHeld(before, after) {
  if (!finite(before) || !finite(after)) return false
  if (Math.sign(after) !== Math.sign(before) || after === 0) return false
  return Math.abs(after) >= 0.5 * Math.abs(before) && Math.abs(after) >= 0.1
}

function sameSign(values) {
  const usable = values.filter(finite)
  if (usable.length !== values.length || !usable.length) return false
  return usable.every((value) => Math.sign(value) === Math.sign(usable[0]) && value !== 0)
}

export function judgeShape(parts) {
  const entryRho = Math.abs(parts.links.atrPct.lowWindow.rho)
  const shapeRho = Math.max(
    Math.abs(parts.links.atrChange.lowWindow.rho ?? 0),
    Math.abs(parts.links.atrRatio.lowWindow.rho ?? 0),
    Math.abs(parts.links.atrSlope.lowWindow.rho ?? 0),
  )
  const windowModels = parts.models.lowWindow
  const baseAdj = windowModels.change.models.M2.adjustedR2
  const deltas = {
    change: windowModels.change.models.M3.adjustedR2 - baseAdj,
    ratio: windowModels.ratio.models.M4.adjustedR2 - windowModels.ratio.models.M2.adjustedR2,
    slope: windowModels.slope.models.M5.adjustedR2 - windowModels.slope.models.M2.adjustedR2,
  }
  const adds = Object.values(deltas).some((delta) => finite(delta) && delta >= ADJ_DELTA)
  const held = ["change", "ratio", "slope"].every((key) => {
    const block = windowModels[key].models
    const after = key === "change" ? block.M3 : key === "ratio" ? block.M4 : block.M5
    return levelHeld(block.M2.beta.atrPct, after.beta.atrPct)
  })
  const stronger = shapeRho > entryRho
  let h1 = "약화"
  if (stronger && adds) h1 = "지지"
  else if (!adds && held) h1 = "약화"
  else h1 = "부분"
  const peakRho = Math.abs(parts.links.peakAtr.lowWindow.rho ?? 0)
  const h2 = entryRho - peakRho >= CLEAR_GAP ? "약화" : "지지"
  const shapeConsistent = (key) => {
    const link = parts.links[key]
    const aligned = sameSign([link.lowWindow.rho, link.lowT10.rho, link.lowT20.rho]) && Math.abs(link.lowWindow.rho) >= SHAPE_RHO_FLOOR
    const periods = ["A", "B", "C"].map((name) => parts.periods[key][name]).filter((row) => row.lowWindow.n >= 10 && finite(row.lowWindow.rho))
    const stable = periods.every((row) => Math.sign(row.lowWindow.rho) === Math.sign(link.lowWindow.rho))
    return aligned && stable
  }
  const h3 = shapeConsistent("atrRatio") && shapeConsistent("atrSlope") ? "지지" : "약화"
  const mainN = windowModels.change.n
  let structure = { label: "C", text: "ATR level과 shape 모두 일부 설명하지만 핵심 원인은 여전히 불명확" }
  if (!(mainN >= 10)) structure = { label: "D", text: "표본 부족" }
  else if (h1 === "지지" && !held) structure = { label: "A", text: "ATR level보다 ATR shape가 더 중요한 설명" }
  else if (h1 === "약화") structure = { label: "B", text: "ATR level이 핵심이고 shape는 추가 설명력이 작음" }
  return { h1, h2, h3, stronger, adds, held, deltas, entryRho, shapeRho, peakRho, structure }
}

export function study(events) {
  const baseline = baselineLinks(events)
  assertBaseline(events, baseline)
  const links = shapeLinks(events)
  const models = {
    lowWindow: levelModels(events, lowWindow),
    lowT20: levelModels(events, lowT20),
    entryT20: levelModels(events, entryT20),
  }
  const periods = periodShape(events)
  const parts = {
    links,
    models,
    periods,
    descriptive: descriptiveLinks(events),
    between: betweenLinks(events),
    duplication: duplicationVif(events),
    grid: shapeGrid(events),
    durations: durationBins(events),
    leaveOne: leaveShape(events),
    extremes: extremeShape(events),
  }
  const judgment = judgeShape(parts)
  return { baseline, ...parts, judgment }
}
