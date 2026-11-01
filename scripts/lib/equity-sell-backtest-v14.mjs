/**
 * US single-stock ATR meaning study v14 (research only).
 *
 * Asks what a high correction-day ATR(14)/price lines up with: the prior
 * trend, the range location, market volatility, or volatility relative to
 * the market. No sell rule is selected.
 */

import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./equity-sell-research-universe.mjs"
import { mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { leaveOneCorrelation, priceStateBlock, volatilityBlock } from "./equity-sell-backtest-v7.mjs"
import { standardizedFit } from "./equity-sell-backtest-v12.mjs"
import { attachProfile, loadOhlcv, selectMildEvents } from "./equity-sell-backtest-v12.mjs"
import { periodOf } from "./equity-sell-backtest-v13.mjs"

export { EQUITY_SELL_RESEARCH_UNIVERSE, loadOhlcv, selectMildEvents, attachProfile, periodOf }

export const SELECTED_STRATEGY = null
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
const BETA_FLOOR = 0.1
const RETAIN_SHARE = 0.5
const RELATIVE_RHO_FLOOR = 0.2

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

export function extendedReturns(closes, t0) {
  const prior = t0 - 1
  const ret = (days) => (prior >= days && closes[prior - days] > 0 ? closes[prior] / closes[prior - days] - 1 : null)
  return { ret60: ret(60), ret120: ret(120) }
}

export function marketAt(series, date) {
  const index = dateIndex(series.dates, date)
  if (index < 0) return null
  const block = volatilityBlock(series.highs, series.lows, series.closes, index)
  return { spyAtr: block.atrPct, spyVol: block.vol20 }
}

export function attachMeaning(events, seriesBySymbol, spy) {
  const base = attachProfile(events, seriesBySymbol)
  const out = base.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    const t0 = dateIndex(series.dates, event.t0Date)
    const state = priceStateBlock(series.closes, t0)
    const longer = extendedReturns(series.closes, t0)
    const market = marketAt(spy, event.t0Date)
    const atr = event.predictors.atrPct
    return {
      ...event,
      predictors: {
        ...event.predictors,
        ret5: state.ret5,
        ret10: state.ret10,
        ret20: state.ret20,
        ret60: longer.ret60,
        ret120: longer.ret120,
        distMa20: state.distMa20,
        distMa50Prior: state.distMa50,
        spyAtr: market?.spyAtr ?? null,
        spyVol: market?.spyVol ?? null,
        relativeAtr: market && market.spyAtr > 0 ? atr / market.spyAtr : null,
        atrGap: market && finite(market.spyAtr) ? atr - market.spyAtr : null,
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
const hitTime = (event) => event.hits["10"].days

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

function beta(fit, name) {
  return (fit.coefficients ?? []).find((row) => row.name === name)?.coefficient ?? null
}

function fitKeys(events, yRead, keys) {
  const rows = []
  for (const event of events) {
    const y = yRead(event)
    const row = { y }
    let ok = finite(y)
    for (const key of keys) {
      row[key] = event.predictors[key]
      if (!finite(row[key])) ok = false
    }
    if (ok) rows.push(row)
  }
  const fit = standardizedFit(rows, keys)
  return {
    n: fit.n,
    r2: fit.r2,
    adjustedR2: fit.adjustedR2,
    beta: Object.fromEntries(keys.map((key) => [key, beta(fit, key)])),
  }
}

function nested(events, yRead, steps) {
  const keys = [...new Set(steps.flatMap((step) => step[1]))]
  const ready = events.filter((event) => finite(yRead(event)) && keys.every((key) => finite(event.predictors[key])))
  return {
    n: ready.length,
    models: Object.fromEntries(steps.map(([name, modelKeys]) => [name, fitKeys(ready, yRead, modelKeys)])),
  }
}

const TREND_KEYS = ["t0", "ret5", "ret10", "ret20", "ret60", "ret120", "distMa20", "distMa50Prior", "pos60", "pos120", "leadership"]

export function trendLinks(events) {
  const atr = {}
  const rebound = {}
  for (const key of TREND_KEYS) {
    atr[key] = pair(events, (event) => event.predictors.atrPct, (event) => event.predictors[key])
    rebound[key] = pair(events, (event) => event.predictors[key], lowWindow)
  }
  return { atr, rebound }
}

const BASE_STEPS = [
  ["M0", ["t0"]],
  ["M1", ["t0", "leadership"]],
  ["M2", ["t0", "leadership", "atrPct"]],
]

export function trendModels(events) {
  return {
    ret20: nested(events, lowWindow, [...BASE_STEPS, ["M3", ["t0", "leadership", "atrPct", "ret20"]]]),
    ret60: nested(events, lowWindow, [...BASE_STEPS, ["M4", ["t0", "leadership", "atrPct", "ret60"]]]),
    ret120: nested(events, lowWindow, [...BASE_STEPS, ["M4", ["t0", "leadership", "atrPct", "ret120"]]]),
  }
}

export function positionModels(events) {
  return {
    pos60: nested(events, lowWindow, [...BASE_STEPS, ["M3", ["t0", "leadership", "atrPct", "pos60"]]]),
    pos120: nested(events, lowWindow, [...BASE_STEPS, ["M4", ["t0", "leadership", "atrPct", "pos120"]]]),
  }
}

export function marketModels(events) {
  return {
    spyAtr: nested(events, lowWindow, [...BASE_STEPS, ["M3", ["t0", "leadership", "atrPct", "spyAtr"]]]),
    spyVol: nested(events, lowWindow, [...BASE_STEPS, ["M4", ["t0", "leadership", "atrPct", "spyVol"]]]),
  }
}

export function relativeModels(events) {
  return nested(events, lowWindow, [
    ...BASE_STEPS,
    ["M3", ["t0", "leadership", "relativeAtr"]],
    ["M4", ["t0", "leadership", "atrPct", "relativeAtr"]],
  ])
}

export function contextModels(events) {
  return nested(events, lowWindow, [
    ...BASE_STEPS,
    ["M3", ["t0", "leadership", "atrPct", "spyAtr"]],
    ["M4", ["t0", "leadership", "atrPct", "relativeAtr"]],
  ])
}

function outcomeLinks(events, xRead) {
  return {
    lowWindow: pair(events, xRead, lowWindow),
    lowT10: pair(events, xRead, lowT10),
    lowT20: pair(events, xRead, lowT20),
    hit10: pair(events, xRead, hitTime),
  }
}

export function factorLinks(events) {
  return {
    absolute: outcomeLinks(events, (event) => event.predictors.atrPct),
    relative: outcomeLinks(events, (event) => event.predictors.relativeAtr),
    gap: outcomeLinks(events, (event) => event.predictors.atrGap),
    market: outcomeLinks(events, (event) => event.predictors.spyAtr),
    marketVol: outcomeLinks(events, (event) => event.predictors.spyVol),
    between: {
      absoluteRelative: pair(events, (event) => event.predictors.atrPct, (event) => event.predictors.relativeAtr),
      absoluteMarket: pair(events, (event) => event.predictors.atrPct, (event) => event.predictors.spyAtr),
      relativeMarket: pair(events, (event) => event.predictors.relativeAtr, (event) => event.predictors.spyAtr),
    },
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

export function trendGrid(events, retKey) {
  const cut = median(events.map((event) => event.predictors.atrPct))
  const cells = {}
  for (const trend of ["up", "down"]) {
    for (const atr of ["high", "low"]) {
      const rows = events.filter((event) => {
        const ret = event.predictors[retKey]
        if (!finite(ret) || !finite(event.predictors.atrPct)) return false
        const trendUp = ret > 0
        const atrHigh = event.predictors.atrPct > cut
        return (trend === "up") === trendUp && (atr === "high") === atrHigh
      })
      cells[`${trend}-${atr}`] = cellSummary(rows)
    }
  }
  const counts = Object.fromEntries(Object.entries(cells).map(([key, cell]) => [key, cell.n]))
  const comparable = Object.values(counts).every((count) => count >= 10)
  return { retKey, atrCut: cut, comparable, cells: comparable || retKey === "ret20" ? cells : null, counts }
}

function periodBlock(events, xRead) {
  const buckets = { A: [], B: [], C: [] }
  for (const event of events) {
    const key = periodOf(event.t0Date)
    if (buckets[key]) buckets[key].push(event)
  }
  return Object.fromEntries(["A", "B", "C"].map((key) => [key, { n: buckets[key].length, ...outcomeLinks(buckets[key], xRead) }]))
}

export function periodFactors(events) {
  return {
    absolute: periodBlock(events, (event) => event.predictors.atrPct),
    relative: periodBlock(events, (event) => event.predictors.relativeAtr),
    market: periodBlock(events, (event) => event.predictors.spyAtr),
  }
}

export function leaveOne(events) {
  const windowRead = lowWindow
  return {
    absolute: leaveOneCorrelation(events, (event) => event.predictors.atrPct, windowRead),
    relative: leaveOneCorrelation(
      events.filter((event) => finite(event.predictors.relativeAtr)),
      (event) => event.predictors.relativeAtr,
      windowRead,
    ),
  }
}

export function extremeFactors(events) {
  const ordered = [...events].sort((a, b) => b.predictors.atrPct - a.predictors.atrPct || a.eventId.localeCompare(b.eventId))
  const out = {}
  for (const count of [0, 1, 3, 5]) {
    const gone = new Set(ordered.slice(0, count).map((event) => event.eventId))
    const kept = events.filter((event) => !gone.has(event.eventId))
    out[count === 0 ? "all" : `dropHigh${count}`] = {
      n: kept.length,
      absolute: outcomeLinks(kept, (event) => event.predictors.atrPct),
      relative: outcomeLinks(kept, (event) => event.predictors.relativeAtr),
    }
  }
  return out
}

export function betaHeld(before, after) {
  if (!finite(before) || !finite(after)) return false
  if (Math.sign(after) !== Math.sign(before) || after === 0) return false
  return Math.abs(after) >= RETAIN_SHARE * Math.abs(before) && Math.abs(after) >= BETA_FLOOR
}

export function judgeHypotheses(parts) {
  const ret20 = parts.trend.ret20.models
  const ret60 = parts.trend.ret60.models
  const h1Held = betaHeld(ret20.M2.beta.atrPct, ret20.M3.beta.atrPct) && betaHeld(ret60.M2.beta.atrPct, ret60.M4.beta.atrPct)
  const market = parts.market.spyAtr.models
  const h4Held = betaHeld(market.M2.beta.atrPct, market.M3.beta.atrPct)
  const relative = parts.relative.models
  const relRho = parts.factors.relative.lowWindow.rho
  const absRho = parts.factors.absolute.lowWindow.rho
  const relBeta = relative.M4.beta.relativeAtr
  const marketFit = fitKeys(
    parts.events.filter((event) => finite(event.predictors.relativeAtr)),
    lowWindow,
    ["t0", "leadership", "spyAtr"],
  )
  const h5 =
    finite(relRho) &&
    finite(absRho) &&
    Math.sign(relRho) === Math.sign(absRho) &&
    Math.abs(relRho) >= RELATIVE_RHO_FLOOR &&
    finite(relative.M3.adjustedR2) &&
    finite(marketFit.adjustedR2) &&
    relative.M3.adjustedR2 > marketFit.adjustedR2 &&
    finite(relBeta) &&
    Math.sign(relBeta) === Math.sign(absRho) &&
    Math.abs(relBeta) >= BETA_FLOOR
  return {
    h1: h1Held ? "지지" : "약화",
    h4: h4Held ? "지지" : "반대",
    h5: h5 ? "지지" : "약화",
    marketAdjustedR2: marketFit.adjustedR2,
    marketN: marketFit.n,
  }
}

export function judgeStructure(hypotheses) {
  if (!(hypotheses.marketN >= 10)) return { label: "D", text: "표본 부족 또는 데이터 제약으로 판정 불가" }
  if (hypotheses.h1 !== "지지" || hypotheses.h4 !== "지지") return { label: "C", text: "ATR 효과가 시장/추세 변수로 대부분 설명됨" }
  if (hypotheses.h5 === "지지") return { label: "A", text: "ATR 효과의 구조적 설명이 상당히 명확함" }
  return { label: "B", text: "ATR 효과의 일부 구조는 설명되지만 핵심 원인은 여전히 불명확" }
}

export function study(events) {
  const links = baselineLinks(events)
  assertBaseline(events, links)
  const parts = {
    events,
    links,
    trendLinks: trendLinks(events),
    trend: trendModels(events),
    positionLinks: {
      atrPos60: pair(events, (event) => event.predictors.atrPct, (event) => event.predictors.pos60),
      atrPos120: pair(events, (event) => event.predictors.atrPct, (event) => event.predictors.pos120),
      pos60Window: pair(events, (event) => event.predictors.pos60, lowWindow),
      pos120Window: pair(events, (event) => event.predictors.pos120, lowWindow),
    },
    position: positionModels(events),
    market: marketModels(events),
    relative: relativeModels(events),
    context: contextModels(events),
    factors: factorLinks(events),
    grids: {
      ret20: trendGrid(events, "ret20"),
      ret60: trendGrid(events, "ret60"),
      ret120: trendGrid(events, "ret120"),
    },
    relations: {
      atrT0: pair(events, (event) => event.predictors.atrPct, (event) => event.predictors.t0),
      atrLeadership: pair(events, (event) => event.predictors.atrPct, (event) => event.predictors.leadership),
      t0Window: pair(events, (event) => event.predictors.t0, lowWindow),
      leadershipWindow: pair(events, (event) => event.predictors.leadership, lowWindow),
    },
    periods: periodFactors(events),
    leaveOne: leaveOne(events),
    extremes: extremeFactors(events),
  }
  const hypotheses = judgeHypotheses(parts)
  return { ...parts, hypotheses, structure: judgeStructure(hypotheses), events: undefined }
}
