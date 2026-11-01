/**
 * Research runner. Writes a new v3 result and does not replace v1 or v2.
 * node scripts/buy-signal-price-path-v3.mjs
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1 } from "../api/_lib/dailyBottomBuyEngine.js"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { buildConfirmWindows } from "./lib/buy-signal-repeat-confirm-v1.mjs"
import { nonOverlappingWindows } from "./lib/buy-signal-repeat-confirm-v2.mjs"
import {
  PATH_RULES,
  SELECTED_STRATEGY,
  chronologicalSplit,
  classifyPath,
  countSignalDays,
  nextOpenOutcome,
  outcomeSummary,
  pathSnapshot,
  predictContinuedDecline,
  predictionScore,
  priorFeatures,
  residualAfterClassWindow,
  signalCloseOutcome,
  summarizeValues,
  thresholdsMatchRequest,
} from "./lib/buy-signal-price-path-v3.mjs"
import { FROZEN_THRESHOLDS } from "./lib/daily-bottom-split-buy-sim.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const cache = join(root, ".cache")
const prior = JSON.parse(readFileSync(join(cache, "buy-signal-repeat-confirm-v1-result.json"), "utf8"))
const TYPES = ["A", "B", "C", "D", "INCOMPLETE"]

if (!thresholdsMatchRequest(FROZEN_THRESHOLDS)) {
  console.log("frozen thresholds differ from 36 / 15.4 / 0.01 / -4.2")
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

function collect(kind, symbols) {
  const events = []
  let signalDays = 0
  for (const symbol of symbols) {
    const rows = enrichBarsWithIndicators(loadBars(kind, symbol))
    signalDays += countSignalDays(rows)
    for (const window of buildConfirmWindows(rows)) {
      const snapshot = pathSnapshot(rows, window.start)
      const features = priorFeatures(rows, window.start)
      events.push({
        symbol,
        start: window.start,
        date: rows[window.start].date,
        regime: regimeOn(rows[window.start].date),
        pathType: classifyPath(snapshot),
        sensitiveType: classifyPath(snapshot, { ...PATH_RULES, rebound: 0.03, dip: -0.03 }),
        snapshot,
        features,
        predictDecline: predictContinuedDecline(features),
        signalClose: signalCloseOutcome(rows, window.start),
        nextOpen: nextOpenOutcome(rows, window.start),
        residual: residualAfterClassWindow(rows, window.start),
      })
    }
  }
  return { signalDays, events }
}

function bucket(events, type) {
  const rows = events.filter((event) => event.pathType === type)
  const early = {}
  for (const day of [1, 3, 5, 10]) {
    early[day] = summarizeValues(rows.map((event) => event.snapshot?.closeReturn?.[day]))
  }
  return {
    n: rows.length,
    share: events.length ? rows.length / events.length : null,
    adverseLow: summarizeValues(rows.map((event) => event.snapshot?.maxAdverseLow)),
    favorableHigh: summarizeValues(rows.map((event) => event.snapshot?.maxFavorableHigh)),
    daysToLow: summarizeValues(rows.map((event) => event.snapshot?.daysToLow)),
    daysToRecover: summarizeValues(rows.map((event) => event.snapshot?.daysToRecover)),
    newLow10Rate: summarizeValues(rows.map((event) => (event.snapshot?.newLow10 == null ? null : event.snapshot.newLow10 ? 1 : 0))).mean,
    volumeChange: summarizeValues(rows.map((event) => event.snapshot?.volumeChange)),
    early,
    signalClose: outcomeSummary(rows, "signalClose"),
    nextOpen: outcomeSummary(rows.filter((event) => event.nextOpen), "nextOpen"),
    residual: Object.fromEntries([20, 60, 120].map((horizon) => [horizon, summarizeValues(rows.map((event) => event.residual?.[horizon]))])),
  }
}

function byKey(events, key) {
  const groups = new Map()
  for (const event of events) {
    const name = event[key]
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(event)
  }
  return [...groups.entries()]
    .map(([name, rows]) => ({
      key: name,
      n: rows.length,
      types: Object.fromEntries(TYPES.map((type) => [type, rows.filter((event) => event.pathType === type).length])),
      nextOpenT60: summarizeValues(rows.filter((event) => event.nextOpen?.[60]?.complete).map((event) => event.nextOpen[60].return)),
    }))
    .sort((left, right) => right.n - left.n || String(left.key).localeCompare(String(right.key)))
}

function predictionBlock(events) {
  const usable = events.filter((event) => event.pathType !== "INCOMPLETE")
  const split = chronologicalSplit(usable)
  const testTrades = split.test.filter((event) => event.nextOpen?.[60]?.complete)
  const kept = testTrades.filter((event) => !event.predictDecline)
  return {
    cutDate: split.cutDate,
    train: predictionScore(split.train),
    test: predictionScore(split.test),
    testNextOpenT60: {
      all: summarizeValues(testTrades.map((event) => event.nextOpen[60].return)),
      notFlagged: summarizeValues(kept.map((event) => event.nextOpen[60].return)),
      flagged: summarizeValues(testTrades.filter((event) => event.predictDecline).map((event) => event.nextOpen[60].return)),
    },
  }
}

function groupReport(bundle) {
  const events = bundle.events
  const classified = events.filter((event) => event.pathType !== "INCOMPLETE")
  return {
    signalDays: bundle.signalDays,
    windows: events.length,
    incomplete: events.length - classified.length,
    nonOverlapping: nonOverlappingWindows(events).length,
    types: Object.fromEntries(TYPES.map((type) => [type, bucket(events, type)])),
    sensitivityShares: Object.fromEntries(["A", "B", "C", "D", "INCOMPLETE"].map((type) => [
      type,
      events.filter((event) => event.sensitiveType === type).length,
    ])),
    bySymbol: byKey(classified, "symbol"),
    byRegime: byKey(classified, "regime"),
    prediction: predictionBlock(events),
  }
}

function expectCount(label, actual, expected) {
  if (actual !== expected) {
    console.log(`v1 window mismatch ${label}: rerun ${actual}, v1 ${expected}`)
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
  version: "buy-signal-price-path-v3",
  selectedStrategy: SELECTED_STRATEGY,
  productionChanged: false,
  v1Unchanged: true,
  universes: { etf: etfSymbols, equity: equitySymbols },
  rules: PATH_RULES,
  typeMeaning: {
    C: "close rises at least 5% within 5 sessions and the 10-session close never falls 5%",
    A: "close falls at least 5% within 5 sessions, then a later close within 10 sessions regains the signal close",
    B: "a later low breaks the signal-day low and no close regains the signal close within 10 sessions",
    D: "none of the three",
    INCOMPLETE: "fewer than 10 sessions remain",
  },
  notes: {
    sample: "one v1 rising-edge window, not every consecutive signal day",
    signalClose: "comparison base, not a fill",
    nextOpen: "v1 fill, next session open",
    residual: "close at T+H divided by the day-10 close, after the type is already known",
    prediction: "prior 5-day return at or below -5% and a low below the prior 5 lows; test period only",
    sensitivity: "same rules with 3% bars, not used as the primary type",
  },
  etf,
  equity,
}

writeFileSync(join(cache, "buy-signal-price-path-v3-result.json"), JSON.stringify(result))
console.log(JSON.stringify({
  etfWindows: etf.windows,
  equityWindows: equity.windows,
  etfTypes: Object.fromEntries(TYPES.map((type) => [type, etf.types[type].n])),
  equityTypes: Object.fromEntries(TYPES.map((type) => [type, equity.types[type].n])),
  etfTest: etf.prediction.test,
  equityTest: equity.prediction.test,
}, null, 2))
