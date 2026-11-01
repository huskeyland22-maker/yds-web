/**
 * Research runner. Writes a new result file and does not replace prior results.
 * node scripts/buy-signal-repeat-confirm-v1.mjs
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1 } from "../api/_lib/dailyBottomBuyEngine.js"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { conditionFlags } from "./lib/daily-bottom-buy-validation-core.mjs"
import { FROZEN_THRESHOLDS } from "./lib/daily-bottom-split-buy-sim.mjs"
import {
  SELECTED_STRATEGY,
  buildConfirmWindows,
  compareToFirstSignal,
  groupCounts,
  horizonStats,
  legacyRisingEdgeEntries,
  sameCloseLegacyStats,
  strategyEntries,
  summarizeStrategy,
  thresholdsMatchRequest,
} from "./lib/buy-signal-repeat-confirm-v1.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const cache = join(root, ".cache")

if (!thresholdsMatchRequest(FROZEN_THRESHOLDS)) {
  console.log("frozen thresholds differ from the requested 36 / 15.4 / 0.01 / -4.2")
  console.log(JSON.stringify(FROZEN_THRESHOLDS))
  process.exit(1)
}

const spyBars = JSON.parse(readFileSync(join(cache, "eq-ohlcv", "SPY.json"), "utf8")).bars
const spyDates = spyBars.map((bar) => bar.date)

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

function overlapCount(entries) {
  const bySymbol = new Map()
  for (const row of entries) {
    if (!bySymbol.has(row.symbol)) bySymbol.set(row.symbol, [])
    bySymbol.get(row.symbol).push(row.fill)
  }
  let count = 0
  for (const fills of bySymbol.values()) {
    fills.sort((a, b) => a - b)
    for (let i = 1; i < fills.length; i += 1) if (fills[i] - fills[i - 1] < 120) count += 1
  }
  return count
}

function evaluateGroup(kind, symbols) {
  const windows = []
  const legacyEntries = []
  const coverage = []
  let legacyEpisodes = 0
  let sameCloseEpisodes = 0
  const sameClosePool = { 20: [], 60: [], 120: [] }
  let signalDays = 0
  let missingOpen = 0
  for (const symbol of symbols) {
    const enriched = enrichBarsWithIndicators(loadBars(kind, symbol))
    signalDays += enriched.filter((row) => conditionFlags(row, FROZEN_THRESHOLDS).count >= 3).length
    const found = buildConfirmWindows(enriched)
    for (const item of found) {
      const strategies = strategyEntries(enriched, item)
      for (const id of ["A", "B", "C"]) if (strategies[id].reason === "open_missing") missingOpen += 1
      windows.push({
        symbol,
        date: enriched[item.start].date,
        year: enriched[item.start].date.slice(0, 4),
        regime: regimeOn(enriched[item.start].date),
        hits: item.hits.length,
        strategies,
      })
    }
    const legacy = legacyRisingEdgeEntries(enriched)
    legacyEpisodes += legacy.episodes
    for (const entry of legacy.entries) legacyEntries.push({ symbol, ...entry, year: enriched[entry.signal].date.slice(0, 4), regime: regimeOn(enriched[entry.signal].date) })
    const closed = sameCloseLegacyStats(enriched)
    sameCloseEpisodes += closed.episodes
    for (const horizon of [20, 60, 120]) sameClosePool[horizon].push(closed.horizons[horizon])
    coverage.push({ symbol, bars: enriched.length, from: enriched[0].date, to: enriched.at(-1).date })
  }
  const collected = { A: [], B: [], C: [] }
  for (const item of windows) {
    for (const id of ["A", "B", "C"]) {
      const entry = item.strategies[id]
      if (!entry.entered) continue
      collected[id].push({
        symbol: item.symbol,
        year: item.year,
        regime: item.regime,
        signalDate: item.date,
        waitDays: entry.waitDays,
        fill: entry.fill,
        entryPrice: entry.entryPrice,
        horizons: entry.horizons,
      })
    }
  }
  const strategies = {}
  for (const id of ["A", "B", "C"]) {
    strategies[id] = {
      ...summarizeStrategy(collected[id]),
      overlappingHolds: overlapCount(collected[id]),
      bySymbol: groupCounts(collected[id], (row) => row.symbol),
      byYear: groupCounts(collected[id], (row) => row.year),
      byRegime: groupCounts(collected[id], (row) => row.regime),
    }
  }
  return {
    symbols,
    coverage,
    signalDays,
    windows: windows.length,
    hitCounts: windows.reduce((bag, item) => {
      bag[item.hits] = (bag[item.hits] || 0) + 1
      return bag
    }, {}),
    missingOpen,
    legacyEpisodes,
    legacyNextOpen: summarizeStrategy(legacyEntries),
    sameCloseEpisodes,
    sameClose: Object.fromEntries([20, 60, 120].map((horizon) => {
      const parts = sameClosePool[horizon]
      const n = parts.reduce((sum, part) => sum + part.n, 0)
      const weighted = (field) => {
        const known = parts.filter((part) => part[field] != null && part.n > 0)
        const weight = known.reduce((sum, part) => sum + part.n, 0)
        if (!weight) return null
        return known.reduce((sum, part) => sum + part[field] * part.n, 0) / weight
      }
      return [horizon, { n, mean: weighted("mean"), median: null, note: "median is not pooled across symbols" }]
    })),
    strategies,
    comparison: compareToFirstSignal(windows),
  }
}

const etf = evaluateGroup("etf", DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1.map((row) => row.symbol))
const equity = evaluateGroup("equity", EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol))

let published = null
try {
  const prior = JSON.parse(readFileSync(join(cache, "equity-buy-validation-v38-result.json"), "utf8"))
  published = {
    episodes: prior.integrity.episodes,
    from: prior.integrity.from,
    to: prior.integrity.to,
    performance: Object.fromEntries([20, 60, 120].map((horizon) => [horizon, prior.buy.performance[horizon]])),
    drawdowns: Object.fromEntries([20, 60, 120].map((horizon) => [horizon, prior.buy.drawdowns[horizon]])),
  }
} catch (error) {
  published = { error: error.message }
}

const result = {
  version: "buy-signal-repeat-confirm-v1",
  selectedStrategy: SELECTED_STRATEGY,
  productionChanged: false,
  thresholds: { rsiMax: 36, stochKMax: 15.4, bbPctBMax: 0.01, ma20DevMax: -4.2 },
  rules: {
    windowDays: 5,
    hit: "each trading day with count >= 3",
    windowStart: "rising edge only",
    fill: "next session open",
    fee: "none in primary; 0.20% round trip sensitivity",
    holdOverlap: "later windows are separate trades and may overlap a 120-day hold",
  },
  publishedEquityV38SameClose: published,
  etf,
  equity,
}

writeFileSync(join(cache, "buy-signal-repeat-confirm-v1-result.json"), JSON.stringify(result))
console.log(JSON.stringify({
  etfSymbols: etf.symbols,
  equitySymbols: equity.symbols.length,
  etfWindows: etf.windows,
  equityWindows: equity.windows,
  etfA: etf.strategies.A.entries,
  etfB: etf.strategies.B.entries,
  etfC: etf.strategies.C.entries,
  equityA: equity.strategies.A.entries,
  equityB: equity.strategies.B.entries,
  equityC: equity.strategies.C.entries,
  equityLegacyEpisodes: equity.legacyEpisodes,
  publishedEpisodes: published?.episodes ?? null,
  judgments: {
    etfB: etf.comparison.B.judgment,
    etfC: etf.comparison.C.judgment,
    equityB: equity.comparison.B.judgment,
    equityC: equity.comparison.C.judgment,
  },
}, null, 2))
