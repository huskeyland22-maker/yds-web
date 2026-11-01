/**
 * US single-stock ATR regime study v17 (research only).
 *
 * Asks whether the association between correction-day ATR and the later
 * rebound changes with the SPY state known on that same close. No sell rule
 * is selected.
 */

import { mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { sampleStdev, volatilityBlock } from "./equity-sell-backtest-v7.mjs"
import { fitInferred } from "./equity-sell-backtest-v9.mjs"
import { standardizedFit } from "./equity-sell-backtest-v12.mjs"
import { loadOhlcv, selectMildEvents } from "./equity-sell-backtest-v12.mjs"
import { periodOf } from "./equity-sell-backtest-v14.mjs"
import { attachSplit, baselineLinks, extremeWithin, leaveSplit } from "./equity-sell-backtest-v16.mjs"

export { loadOhlcv, selectMildEvents, attachSplit, periodOf }

export const SELECTED_STRATEGY = null
export const MARKET_DROP = -0.05
export const INTERACTION_FLOOR = 0.15
export const SPLIT_GAP = 0.15
export const BASELINE = {
  events: 103,
  lowEvents: 102,
  groups: { HIGH: 15, MID: 53, LOW: 35 },
  bands: { LOW: 34, MID: 34, HIGH: 35 },
  lowWindow: 0.4107,
  lowT10: 0.3494,
  lowT20: 0.4541,
  hit10: -0.3421,
  withinWindow: 0.1765,
  withinPeriods: { A: 0.3489, B: -0.0305, C: 0.0312 },
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

export function spyFeatures(series, date) {
  const index = dateIndex(series.dates, date)
  if (index < 0) return null
  const closes = series.closes
  const block = volatilityBlock(series.highs, series.lows, closes, index)
  const ret = (days) => (index >= days && closes[index - days] > 0 ? closes[index] / closes[index - days] - 1 : null)
  const distance = (days) => {
    if (index < days - 1) return null
    const average = mean(closes.slice(index - days + 1, index + 1))
    return average > 0 ? closes[index] / average - 1 : null
  }
  const realized = (days) => {
    if (index < days) return null
    const returns = []
    for (let cursor = index - days + 1; cursor <= index; cursor += 1) returns.push(closes[cursor] / closes[cursor - 1] - 1)
    const deviation = sampleStdev(returns)
    return deviation == null ? null : deviation * Math.sqrt(252)
  }
  return {
    spyRet20: ret(20),
    spyRet60: ret(60),
    spyRet120: ret(120),
    spyDist50: distance(50),
    spyDist200: distance(200),
    spyAtr: block.atrPct,
    spyVol20: block.vol20,
    spyVol60: realized(60),
  }
}

export function attachRegime(events, spy) {
  const out = events.map((event) => {
    const features = spyFeatures(spy, event.t0Date)
    if (features && finite(event.predictors.spyAtr) && Math.abs(features.spyAtr - event.predictors.spyAtr) > 1e-10) {
      throw new Error(`SPY ATR differs ${event.eventId}`)
    }
    return { ...event, predictors: { ...event.predictors, ...(features ?? {}) } }
  })
  out.bandCounts = events.bandCounts
  return out
}

function pair(events, xRead, yRead) {
  return spearman(events.map((event) => ({ x: xRead(event), y: yRead(event) })).filter((row) => finite(row.x) && finite(row.y)))
}

const lowWindow = (event) => event.lowToWindow
const lowT20 = (event) => event.fromLow.t20
const hitTime = (event) => event.hits["10"].days

export function assertBaseline(events) {
  const links = baselineLinks(events)
  const within = pair(events, (event) => event.predictors.withinAtr, lowWindow)
  const groups = {
    HIGH: events.filter((event) => event.leadershipGroup === "HIGH").length,
    MID: events.filter((event) => event.leadershipGroup === "MID").length,
    LOW: events.filter((event) => event.leadershipGroup === "LOW").length,
  }
  const periods = { A: [], B: [], C: [] }
  for (const event of events) {
    const name = periodOf(event.t0Date)
    if (periods[name]) periods[name].push(event)
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
    [within.rho, BASELINE.withinWindow, "within window"],
  ]
  for (const name of ["A", "B", "C"]) {
    checks.push([pair(periods[name], (event) => event.predictors.withinAtr, lowWindow).rho, BASELINE.withinPeriods[name], `within ${name}`])
  }
  const failed = checks.filter((row) => row[0] !== row[1]).map((row) => `${row[2]} ${row[0]} !== ${row[1]}`)
  if (failed.length) throw new Error(`baseline changed:\n${failed.join("\n")}`)
  return { links, within }
}

function designRows(events, yRead, atrKey, marketKey) {
  const raw = []
  for (const event of events) {
    const row = {
      y: yRead(event),
      t0: event.predictors.t0,
      leadership: event.predictors.leadership,
      atr: event.predictors[atrKey],
      market: marketKey ? event.predictors[marketKey] : 0,
    }
    if ([row.y, row.t0, row.leadership, row.atr].every(finite) && (!marketKey || finite(row.market))) raw.push(row)
  }
  const atrMean = mean(raw.map((row) => row.atr))
  const marketMean = marketKey ? mean(raw.map((row) => row.market)) : 0
  return raw.map((row) => ({
    y: row.y,
    t0: row.t0,
    leadership: row.leadership,
    atr: row.atr - atrMean,
    market: marketKey ? row.market - marketMean : null,
    interaction: marketKey ? (row.atr - atrMean) * (row.market - marketMean) : null,
  }))
}

function vifOf(rows, keys) {
  return keys.map((key) => {
    const others = keys.filter((item) => item !== key)
    const fit = fitInferred(rows.map((row) => ({ ...row, y: row[key] })), others)
    const vif = finite(fit.r2) && fit.r2 < 1 ? 1 / (1 - fit.r2) : null
    return { key, vif: finite(vif) ? Math.round(vif * 100) / 100 : null, high: finite(vif) && vif >= 5 }
  })
}

function fitted(rows, keys) {
  const raw = fitInferred(rows, keys)
  const standardized = standardizedFit(rows, keys)
  const std = Object.fromEntries((standardized.coefficients ?? []).map((row) => [row.name, row.coefficient]))
  const coef = Object.fromEntries((raw.coefficients ?? []).map((row) => [row.name, row.coefficient]))
  return {
    n: raw.n,
    r2: raw.r2,
    adjustedR2: raw.adjustedR2,
    standardizedBeta: Object.fromEntries(keys.map((key) => [key, std[key] ?? null])),
    rawCoefficient: Object.fromEntries(keys.map((key) => [key, coef[key] ?? null])),
    vif: raw.coefficients ? vifOf(rows, keys) : [],
  }
}

export function interactionFit(events, yRead, atrKey, marketKey) {
  const rows = designRows(events, yRead, atrKey, marketKey)
  const baseKeys = marketKey ? ["t0", "leadership", "atr", "market"] : ["t0", "leadership", "atr"]
  return {
    base: fitted(rows, baseKeys),
    interaction: marketKey ? fitted(rows, [...baseKeys, "interaction"]) : null,
  }
}

const MARKET = [
  ["spyRet20", "SPY 20d return"],
  ["spyRet60", "SPY 60d return"],
  ["spyAtr", "SPY ATR/price"],
  ["spyVol20", "SPY 20d realized volatility"],
]
const ATR = [
  ["atrPct", "Event ATR"],
  ["withinAtr", "Within ATR"],
]

export function interactionMatrix(events, yRead) {
  const out = {}
  for (const [atrKey] of ATR) {
    out[atrKey] = {}
    for (const [marketKey] of MARKET) out[atrKey][marketKey] = interactionFit(events, yRead, atrKey, marketKey)
  }
  return out
}

function level(values) {
  const rows = values.filter(finite)
  return {
    n: rows.length,
    avg: rows.length ? Math.round(mean(rows) * 10000) / 100 : null,
    median: rows.length ? Math.round(median(rows) * 10000) / 100 : null,
  }
}

function sideSummary(rows) {
  const eligible = rows.filter((event) => event.lowDay != null)
  const reached = eligible.filter((event) => event.hits["10"].reached)
  return {
    n: rows.length,
    event: pair(rows, (event) => event.predictors.atrPct, lowWindow),
    within: pair(rows, (event) => event.predictors.withinAtr, lowWindow),
    eventT20: pair(rows, (event) => event.predictors.atrPct, lowT20),
    withinT20: pair(rows, (event) => event.predictors.withinAtr, lowT20),
    hitRate: eligible.length ? Math.round((reached.length / eligible.length) * 10000) / 100 : null,
    hitTiming: pair(rows, (event) => event.predictors.atrPct, hitTime),
    lowWindow: level(rows.map(lowWindow)),
    conclusion: rows.length >= 10 ? "제한적" : "결론 금지",
  }
}

export function regimeGroups(events) {
  const volCut = median(events.map((event) => event.predictors.spyAtr).filter(finite))
  const named = [
    ["spy20Up", (event) => event.predictors.spyRet20 > 0],
    ["spy20Down", (event) => finite(event.predictors.spyRet20) && event.predictors.spyRet20 <= 0],
    ["spy60Up", (event) => event.predictors.spyRet60 > 0],
    ["spy60Down", (event) => finite(event.predictors.spyRet60) && event.predictors.spyRet60 <= 0],
    ["volHigh", (event) => event.predictors.spyAtr > volCut],
    ["volLow", (event) => finite(event.predictors.spyAtr) && event.predictors.spyAtr <= volCut],
    ["above200", (event) => event.predictors.spyDist200 > 0],
    ["below200", (event) => finite(event.predictors.spyDist200) && event.predictors.spyDist200 <= 0],
    ["marketDrop", (event) => finite(event.predictors.spyRet20) && event.predictors.spyRet20 <= MARKET_DROP],
    ["notMarketDrop", (event) => finite(event.predictors.spyRet20) && event.predictors.spyRet20 > MARKET_DROP],
  ]
  return {
    volCut,
    groups: Object.fromEntries(named.map(([name, test]) => [name, sideSummary(events.filter(test))])),
  }
}

export function periodProfile(events) {
  const buckets = { A: [], B: [], C: [] }
  for (const event of events) {
    const name = periodOf(event.t0Date)
    if (buckets[name]) buckets[name].push(event)
  }
  const out = {}
  for (const name of ["A", "B", "C"]) {
    const rows = buckets[name]
    const fit = (marketKey) => interactionFit(rows, lowWindow, "withinAtr", marketKey).base
    out[name] = {
      n: rows.length,
      spyRet20: level(rows.map((event) => event.predictors.spyRet20)),
      spyAtr: level(rows.map((event) => event.predictors.spyAtr)),
      eventAtr: level(rows.map((event) => event.predictors.atrPct)),
      withinAtr: level(rows.map((event) => event.predictors.withinAtr)),
      withinRho: pair(rows, (event) => event.predictors.withinAtr, lowWindow),
      withinBeta: fit(null).standardizedBeta?.atr ?? null,
      withinBetaAfterReturn: fit("spyRet20").standardizedBeta?.atr ?? null,
      withinBetaAfterVol: fit("spyAtr").standardizedBeta?.atr ?? null,
      modelN: fit(null).n,
    }
  }
  return out
}

function beta(fit, key) {
  return fit?.interaction?.standardizedBeta?.[key] ?? null
}

export function judgeRegime(input) {
  if (!(input.n >= 10)) return { label: "D", text: "표본 부족" }
  const aligned = (interaction, t20, highRho, lowRho) => {
    if (!finite(interaction) || Math.abs(interaction) < INTERACTION_FLOOR) return false
    if (input.t20n >= 10 && finite(t20) && Math.sign(t20) !== Math.sign(interaction)) return false
    if (!finite(highRho) || !finite(lowRho)) return false
    const gap = highRho - lowRho
    return Math.abs(gap) >= SPLIT_GAP && Math.sign(gap) === Math.sign(interaction)
  }
  const confirmed = [
    aligned(input.event20, input.event20T20, input.bullEvent, input.bearEvent),
    aligned(input.within20, input.within20T20, input.bullWithin, input.bearWithin),
    aligned(input.eventVol, input.eventVolT20, input.volHighEvent, input.volLowEvent),
    aligned(input.withinVol, input.withinVolT20, input.volHighWithin, input.volLowWithin),
  ].filter(Boolean).length
  if (confirmed >= 1) return { label: "A", text: "Regime dependence 확인", confirmed }
  const volExplains = finite(input.eventAfterVol) && finite(input.withinAfterVol) && Math.abs(input.eventAfterVol) < 0.1 && Math.abs(input.withinAfterVol) < 0.1
  if (volExplains) return { label: "C", text: "시장 변동성이 대부분 설명", confirmed }
  return { label: "B", text: "Regime dependence 약함", confirmed }
}

export function study(events) {
  assertBaseline(events)
  const windowMatrix = interactionMatrix(events, lowWindow)
  const t20Matrix = interactionMatrix(events, lowT20)
  const timingMatrix = {
    atrPct: { spyRet20: interactionFit(events, hitTime, "atrPct", "spyRet20") },
    withinAtr: { spyRet20: interactionFit(events, hitTime, "withinAtr", "spyRet20") },
  }
  const groups = regimeGroups(events)
  const periods = periodProfile(events)
  const g = groups.groups
  const judgment = judgeRegime({
    n: windowMatrix.atrPct.spyRet20.interaction.n,
    t20n: t20Matrix.atrPct.spyRet20.interaction.n,
    event20: beta(windowMatrix.atrPct.spyRet20, "interaction"),
    within20: beta(windowMatrix.withinAtr.spyRet20, "interaction"),
    eventVol: beta(windowMatrix.atrPct.spyAtr, "interaction"),
    withinVol: beta(windowMatrix.withinAtr.spyAtr, "interaction"),
    event20T20: beta(t20Matrix.atrPct.spyRet20, "interaction"),
    within20T20: beta(t20Matrix.withinAtr.spyRet20, "interaction"),
    eventVolT20: beta(t20Matrix.atrPct.spyAtr, "interaction"),
    withinVolT20: beta(t20Matrix.withinAtr.spyAtr, "interaction"),
    bullEvent: g.spy20Up.event.rho,
    bearEvent: g.spy20Down.event.rho,
    bullWithin: g.spy20Up.within.rho,
    bearWithin: g.spy20Down.within.rho,
    volHighEvent: g.volHigh.event.rho,
    volLowEvent: g.volLow.event.rho,
    volHighWithin: g.volHigh.within.rho,
    volLowWithin: g.volLow.within.rho,
    eventAfterVol: windowMatrix.atrPct.spyAtr.base.standardizedBeta.atr,
    withinAfterVol: windowMatrix.withinAtr.spyAtr.base.standardizedBeta.atr,
  })
  const leave = leaveSplit(events)
  const extremes = extremeWithin(events)
  return { windowMatrix, t20Matrix, timingMatrix, groups, periods, judgment, leave, extremes }
}
