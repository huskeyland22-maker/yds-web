/**
 * Research runner. Writes a new v4 result and does not replace v1–v3.
 * node scripts/buy-signal-downside-risk-v4.mjs
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1 } from "../api/_lib/dailyBottomBuyEngine.js"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import { FROZEN_THRESHOLDS } from "./lib/daily-bottom-split-buy-sim.mjs"
import { buildConfirmWindows } from "./lib/buy-signal-repeat-confirm-v1.mjs"
import { nonOverlappingWindows } from "./lib/buy-signal-repeat-confirm-v2.mjs"
import { countSignalDays, nextOpenOutcome, thresholdsMatchRequest } from "./lib/buy-signal-price-path-v3.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  RULES,
  SELECTED_STRATEGY,
  confusion,
  downsideFeatures,
  downsideLabel,
  featureProfile,
  passesPreRegisteredBar,
  splitEvents,
  splitPerformance,
  tickerGaps,
} from "./lib/buy-signal-downside-risk-v4.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const cache = join(root, ".cache")
const prior = JSON.parse(readFileSync(join(cache, "buy-signal-repeat-confirm-v1-result.json"), "utf8"))

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

function collect(kind, symbols) {
  const events = []
  let signalDays = 0
  let unlabeled = 0
  for (const symbol of symbols) {
    const rows = enrichBarsWithIndicators(loadBars(kind, symbol))
    signalDays += countSignalDays(rows)
    for (const window of buildConfirmWindows(rows)) {
      const downside = downsideLabel(rows, window.start)
      if (downside == null) {
        unlabeled += 1
        continue
      }
      const nextOpen = nextOpenOutcome(rows, window.start)
      events.push({
        symbol,
        start: window.start,
        date: rows[window.start].date,
        downside,
        features: downsideFeatures(rows, window.start),
        nextOpen,
        adverseLow: nextOpen ? undefined : undefined,
      })
      const snapshotLow = rows.slice(window.start + 1, window.start + 11).reduce((min, bar) => Math.min(min, bar.low), Infinity)
      events[events.length - 1].adverseLow = rows[window.start].close > 0 && Number.isFinite(snapshotLow)
        ? snapshotLow / rows[window.start].close - 1
        : null
    }
  }
  return { signalDays, unlabeled, events }
}

function evaluate(events) {
  const split = splitEvents(events)
  const rules = {}
  for (const [name, rule] of RULES) {
    const test = confusion(split.test, rule)
    const performance = splitPerformance(split.test, rule)
    rules[name] = {
      train: confusion(split.train, rule),
      test,
      performance,
      sparse: confusion(nonOverlappingWindows(split.test), rule),
      tickers: tickerGaps(split.test, rule),
      passes: passesPreRegisteredBar(test, performance),
    }
  }
  return {
    labeled: events.length,
    train: split.train.length,
    test: split.test.length,
    cutDate: split.cutDate,
    downsideRate: events.filter((event) => event.downside).length / events.length,
    trainProfile: featureProfile(split.train),
    rules,
  }
}

function expectCount(label, actual, expected) {
  if (actual !== expected) {
    console.log(`v1 window mismatch ${label}: labeled+unlabeled ${actual}, v1 ${expected}`)
    process.exit(1)
  }
}

const etfSymbols = DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1.map((row) => row.symbol)
const equitySymbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
const etfRaw = collect("etf", etfSymbols)
const equityRaw = collect("equity", equitySymbols)
expectCount("etf", etfRaw.events.length + etfRaw.unlabeled, prior.etf.windows)
expectCount("equity", equityRaw.events.length + equityRaw.unlabeled, prior.equity.windows)

const result = {
  version: "buy-signal-downside-risk-v4",
  selectedStrategy: SELECTED_STRATEGY,
  productionChanged: false,
  priorStudiesUnchanged: true,
  universes: { etf: etfSymbols, equity: equitySymbols },
  rules: {
    label: "v3 type B: a later low breaks the signal-day low and no close regains the signal close within 10 sessions",
    prior5: "prior 5-session return <= -5%, fixed before the test read",
    newLow: "signal low is below the prior 5 session lows",
    volExpand: "std of the latest 5 close returns is above the std of the previous 5",
    combo: "prior5 and newLow and volExpand; a missing input stays missing",
    split: "earliest 70% of labeled windows by date are train; the rest are test",
    fill: "T+20 and T+60 use the next session open, the same fill as v1",
    bar: "test n>=30, precision above the base rate, kept median above all at T+20 and T+60, and excluded T+60 median below kept",
  },
  etf: { signalDays: etfRaw.signalDays, unlabeled: etfRaw.unlabeled, ...evaluate(etfRaw.events) },
  equity: { signalDays: equityRaw.signalDays, unlabeled: equityRaw.unlabeled, ...evaluate(equityRaw.events) },
}

writeFileSync(join(cache, "buy-signal-downside-risk-v4-result.json"), JSON.stringify(result))

function brief(group) {
  const out = {}
  for (const [name, row] of Object.entries(group.rules)) {
    out[name] = {
      test: row.test,
      passes: row.passes,
      kept60: row.performance.kept.t60.median,
      all60: row.performance.all.t60.median,
      excluded60: row.performance.excluded.t60.median,
      kept20: row.performance.kept.t20.median,
      all20: row.performance.all.t20.median,
      excluded20: row.performance.excluded.t20.median,
      tickers: row.tickers,
    }
  }
  return out
}
console.log(JSON.stringify({
  etf: { labeled: result.etf.labeled, unlabeled: result.etf.unlabeled, cut: result.etf.cutDate, rules: brief(result.etf) },
  equity: { labeled: result.equity.labeled, unlabeled: result.equity.unlabeled, cut: result.equity.cutDate, rules: brief(result.equity) },
}, null, 2))
