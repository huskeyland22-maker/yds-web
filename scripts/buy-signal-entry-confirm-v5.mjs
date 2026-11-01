/**
 * Research runner. Writes a new v5 result and does not replace v1–v4.
 * node scripts/buy-signal-entry-confirm-v5.mjs
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1 } from "../api/_lib/dailyBottomBuyEngine.js"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import { FROZEN_THRESHOLDS } from "./lib/daily-bottom-split-buy-sim.mjs"
import { buildConfirmWindows } from "./lib/buy-signal-repeat-confirm-v1.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { summarizeValues, thresholdsMatchRequest } from "./lib/buy-signal-price-path-v3.mjs"
import {
  clusterMedianInterval,
  entryPlans,
  pairView,
  passesOperatingBar,
  strategySummary,
} from "./lib/buy-signal-entry-confirm-v5.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const cache = join(root, ".cache")
const prior = JSON.parse(readFileSync(join(cache, "buy-signal-repeat-confirm-v1-result.json"), "utf8"))
const spyBars = JSON.parse(readFileSync(join(cache, "eq-ohlcv", "SPY.json"), "utf8")).bars
const spyDates = spyBars.map((bar) => bar.date)
const IDS = ["A", "B", "C", "D"]

if (!thresholdsMatchRequest(FROZEN_THRESHOLDS)) {
  console.log("frozen thresholds differ from 36 / 15.4 / 0.01 / -4.2")
  process.exit(1)
}

function loadBars(kind, symbol) {
  const path = kind === "etf"
    ? join(cache, `dbb-${symbol.toLowerCase()}-daily-ohlcv.json`)
    : join(cache, "eq-ohlcv", `${symbol}.json`)
  return JSON.parse(readFileSync(path, "utf8")).bars
}

function spyIndex(date) {
  let lo = 0
  let hi = spyDates.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (spyDates[mid] <= date) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}

function regimeOn(date) {
  const index = spyIndex(date)
  if (index < 60) return "결측"
  const change = spyBars[index].close / spyBars[index - 60].close - 1
  if (change >= 0.05) return "강세"
  if (change <= -0.05) return "약세"
  return "중립"
}

function collect(kind, symbols) {
  const events = []
  for (const symbol of symbols) {
    const rows = enrichBarsWithIndicators(loadBars(kind, symbol))
    const windows = buildConfirmWindows(rows)
    windows.forEach((window, order) => {
      const plans = entryPlans(rows, window.start)
      const next = windows[order + 1]
      events.push({
        symbol,
        start: window.start,
        date: rows[window.start].date,
        regime: regimeOn(rows[window.start].date),
        plans,
        pair: pairView(rows, plans),
        nextStartsBeforeFill: Object.fromEntries(IDS.map((id) => {
          const fill = plans[id].fill
          return [id, Boolean(next && fill != null && next.start < fill)]
        })),
      })
    })
  }
  return events
}

function outcomeOf(events, id, predicate) {
  return strategySummary(events.filter(predicate).map((event) => event.plans[id]))
}

function gapRows(events, id, horizon, field) {
  return events
    .filter((event) => event.pair[id]?.horizons?.[horizon]?.[field] != null)
    .map((event) => ({ symbol: event.symbol, gap: event.pair[id].horizons[horizon][field] }))
}

function summarizeGaps(events, id) {
  const horizons = {}
  for (const horizon of [20, 60, 120]) {
    const rows = events.filter((event) => event.pair[id]?.horizons?.[horizon])
    const field = (name) => summarizeValues(rows.map((event) => event.pair[id].horizons[horizon][name]))
    horizons[horizon] = {
      n: rows.filter((event) => event.pair[id].horizons[horizon].sameHoldGap != null).length,
      sameHoldGap: field("sameHoldGap"),
      sameExitAsA: field("sameExitAsA"),
      sameExitAsOther: field("sameExitAsOther"),
    }
  }
  return {
    entryGap: summarizeValues(events.filter((event) => event.pair[id]).map((event) => event.pair[id].entryGap)),
    waitGap: summarizeValues(events.filter((event) => event.pair[id]).map((event) => event.pair[id].waitGap)),
    horizons,
  }
}

function byKey(events, id, key) {
  const groups = new Map()
  for (const event of events) {
    if (event.plans[id].status !== "entered") continue
    const name = event[key]
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(event.plans[id])
  }
  return [...groups.entries()]
    .map(([name, plans]) => ({ key: name, ...strategySummary(plans) }))
    .sort((left, right) => right.entered - left.entered || String(left.key).localeCompare(String(right.key)))
}

function overlapCount(events, id) {
  const bySymbol = new Map()
  for (const event of events) {
    const plan = event.plans[id]
    if (plan.status !== "entered") continue
    if (!bySymbol.has(event.symbol)) bySymbol.set(event.symbol, [])
    bySymbol.get(event.symbol).push(plan.fill)
  }
  let count = 0
  for (const fills of bySymbol.values()) {
    fills.sort((left, right) => left - right)
    for (let index = 1; index < fills.length; index += 1) if (fills[index] - fills[index - 1] < 120) count += 1
  }
  return count
}

function groupReport(events) {
  const strategies = {}
  const comparison = {}
  for (const id of IDS) {
    strategies[id] = {
      ...strategySummary(events.map((event) => event.plans[id])),
      overlapWithin120: overlapCount(events, id),
      nextWindowBeforeFill: events.filter((event) => event.nextStartsBeforeFill[id]).length,
      bySymbol: byKey(events, id, "symbol").map((row) => ({
        key: row.key,
        entered: row.entered,
        t60: row.horizons[60],
      })),
      byRegime: byKey(events, id, "regime").map((row) => ({
        key: row.key,
        entered: row.entered,
        t60: row.horizons[60],
      })),
    }
  }
  for (const id of ["B", "C", "D"]) {
    const pairedEvents = events.filter((event) => event.pair[id])
    const excludedEvents = events.filter((event) => event.plans.A.status === "entered" && event.plans[id].status !== "entered")
    const paired = summarizeGaps(events, id)
    const excluded = outcomeOf(excludedEvents, "A", () => true)
    const pairedA = outcomeOf(pairedEvents, "A", () => true)
    const bootstrap = {
      sameHold: clusterMedianInterval(gapRows(events, id, 60, "sameHoldGap")),
      sameExitAsA: clusterMedianInterval(gapRows(events, id, 60, "sameExitAsA")),
    }
    comparison[id] = {
      paired,
      pairedA: pairedA.horizons,
      excluded: excluded.horizons,
      excludedReasons: strategies[id].reasons,
      bootstrap,
      passes: passesOperatingBar({
        paired: paired.horizons,
        excluded: excluded.horizons,
        pairedA: pairedA.horizons,
        bootstrap,
      }),
    }
  }
  return { windows: events.length, strategies, comparison }
}

function expectCount(label, actual, expected) {
  if (actual !== expected) {
    console.log(`v1 window mismatch ${label}: ${actual} vs ${expected}`)
    process.exit(1)
  }
}

const etfSymbols = DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1.map((row) => row.symbol)
const equitySymbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
const etf = groupReport(collect("etf", etfSymbols))
const equity = groupReport(collect("equity", equitySymbols))
expectCount("etf", etf.windows, prior.etf.windows)
expectCount("equity", equity.windows, prior.equity.windows)

const result = {
  version: "buy-signal-entry-confirm-v5",
  selectedStrategy: null,
  productionChanged: false,
  priorStudiesUnchanged: true,
  universes: { etf: etfSymbols, equity: equitySymbols },
  rules: {
    sample: "v1 rising-edge 3/4 windows",
    A: "signal close confirms, next session open fills",
    B: "next five lows stay at or above the signal low; fill is the open after that fifth session",
    C: "first later close above that session's SMA20 within five sessions; fill is the next open",
    D: "B and C both hold; fill is still the open after the fifth session, not the SMA day",
    equalLow: "a low equal to the signal low is not a break",
    sma: "close must be strictly above SMA20",
    missing: "a window that ends before five sessions without a break or reclaim is incomplete",
    fee: "primary returns have no cost; net median subtracts the v1 0.20% round trip",
    bar: "T+60 same-exit median gap above 0, paired n>=30, excluded A median not above paired A, ticker-cluster bootstrap 2.5% above 0",
  },
  etf,
  equity,
}

writeFileSync(join(cache, "buy-signal-entry-confirm-v5-result.json"), JSON.stringify(result))

function brief(group) {
  const out = {}
  for (const id of IDS) {
    const row = group.strategies[id]
    out[id] = {
      entered: row.entered,
      reasons: row.reasons,
      wait: row.wait.median,
      t20: row.horizons[20].median,
      t60: row.horizons[60].median,
      t120: row.horizons[120].median,
    }
  }
  out.passes = Object.fromEntries(["B", "C", "D"].map((id) => [id, group.comparison[id].passes]))
  return out
}
console.log(JSON.stringify({ etf: brief(etf), equity: brief(equity) }, null, 2))
