#!/usr/bin/env node
/**
 * US single-stock entry-state study v7 (research only).
 *
 *   node scripts/equity-sell-backtest-v7.mjs
 *
 * Does not select a sell rule and does not modify v1–v6.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { mean } from "./lib/equity-sell-backtest-v2.mjs"
import {
  SELECTED_STRATEGY,
  attachStudy,
  compareModels,
  correlatePredictors,
  fitModel,
  leaveOneCorrelation,
  loadOhlcv,
  modelRows,
  predictorTable,
  rankCandidates,
  selectMildEvents,
  stockWeightedPredictors,
} from "./lib/equity-sell-backtest-v7.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v7-result.json")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty cache ${symbol}`)
  return loadOhlcv(bars)
}

function strategyOf(doc) {
  return doc.selectedStrategy === undefined ? doc.metadata?.selectedStrategy : doc.selectedStrategy
}

function withinFit(events) {
  const keys = ["t0", "leadership", "volumeRatio20", "atrPct", "correctionSpeed"]
  const rows = modelRows(events).filter((row) => Number.isFinite(row.y) && keys.every((key) => Number.isFinite(row[key])))
  const byTicker = new Map()
  for (const row of rows) {
    if (!byTicker.has(row.ticker)) byTicker.set(row.ticker, [])
    byTicker.get(row.ticker).push(row)
  }
  const demeaned = []
  let tickers = 0
  for (const mine of byTicker.values()) {
    if (mine.length < 2) continue
    tickers += 1
    const center = Object.fromEntries(["y", ...keys].map((key) => [key, mean(mine.map((row) => row[key]))]))
    for (const row of mine) {
      demeaned.push(Object.fromEntries(["y", ...keys].map((key) => [key, row[key] - center[key]])))
    }
  }
  return { events: demeaned.length, tickers, fit: fitModel(demeaned, keys) }
}

function main() {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
  if (symbols.length !== 31 || symbols.includes("FNTN")) throw new Error("research universe changed")
  const v6 = JSON.parse(fs.readFileSync(V6_JSON, "utf8"))
  if (strategyOf(v6) !== null) throw new Error("v6 selectedStrategy changed")
  const selected = selectMildEvents(v6.events)
  const needed = [...new Set(selected.map((event) => event.ticker))]
  const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
  const events = attachStudy(selected, series)
  const table = predictorTable(events)
  const correlations = correlatePredictors(events)
  const candidates = rankCandidates(table, correlations)
  const models = compareModels(events)
  const within = withinFit(events)
  const stock = stockWeightedPredictors(events)
  const leadershipLeave = leaveOneCorrelation(events, (event) => event.leadershipScore, (event) => event.outcomes.window)
  const top = candidates[0]
  const topLeave = top
    ? leaveOneCorrelation(events, (event) => event.predictors[top.id], (event) => event.outcomes.window)
    : null
  const doc = {
    metadata: {
      researchOnly: true,
      selectedStrategy: SELECTED_STRATEGY,
      productionApplied: false,
      question: "Among the fixed 103 mild T0 events, which entry-time states are associated with the later rebound, without using anything after the correction close as a predictor?",
      eventCount: events.length,
      omitted: "A7 cumulative correction volume is omitted because a raw share total is not comparable across stocks and no ratio was pre-specified.",
      modelVariables: "Volume is the 20-day volume ratio, volatility is ATR(14) divided by the correction close, and speed is the peak-to-entry drawdown per session. These three were fixed before reading the correlations.",
      postEntry: "Volume after the correction close is descriptive only and is excluded from correlations and regressions.",
    },
    consistency: {
      events: events.length,
      groups: {
        HIGH: events.filter((event) => event.leadershipGroup === "HIGH").length,
        MID: events.filter((event) => event.leadershipGroup === "MID").length,
        LOW: events.filter((event) => event.leadershipGroup === "LOW").length,
      },
    },
    predictors: table,
    correlations,
    candidates,
    models,
    withinTicker: within,
    stockWeighted: stock,
    leaveOneTickerOut: { leadership: leadershipLeave, topCandidate: topLeave },
    descriptiveVolume: {
      t1to3: groupLevel(events, (event) => event.descriptive.t1to3),
      t1to5: groupLevel(events, (event) => event.descriptive.t1to5),
      rebound5: groupLevel(events, (event) => event.descriptive.rebound5),
      rebound10: groupLevel(events, (event) => event.descriptive.rebound10),
    },
    events: events.map((event) => ({
      eventId: event.eventId,
      ticker: event.ticker,
      t0Date: event.t0Date,
      t0: event.t0,
      leadershipScore: event.leadershipScore,
      leadershipGroup: event.leadershipGroup,
    })),
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("Equity entry-state study v7 — research only, selectedStrategy null")
  console.log(`events ${events.length} candidates ${candidates.map((row) => row.id).join(",")}`)
  for (const row of table) {
    const link = correlations.find((item) => item.id === row.id)
    console.log(row.id, `H ${row.HIGH.avg} L ${row.LOW.avg} d ${row.highMinusLow} miss ${row.missing}`, `W ${link.window.rho} n ${link.window.n}`, `Lds ${link.leadership.rho}`)
  }
  for (const row of models.shared) console.log(`model ${row.id}`, row.r2, row.adjustedR2, row.n)
  console.log("within", JSON.stringify(within))
  console.log("loo leadership", JSON.stringify({ base: leadershipLeave.baseline, min: leadershipLeave.min, max: leadershipLeave.max, flips: leadershipLeave.signFlips }))
  console.log("loo top", top?.id, topLeave && JSON.stringify({ base: topLeave.baseline, min: topLeave.min, max: topLeave.max, flips: topLeave.signFlips }))
  console.log("descriptive", JSON.stringify(doc.descriptiveVolume))
}

function groupLevel(events, read) {
  const level = (rows) => {
    const values = rows.map(read).filter((value) => Number.isFinite(value))
    return { n: values.length, avg: values.length ? Math.round(mean(values) * 10000) / 10000 : null }
  }
  const high = level(events.filter((event) => event.leadershipGroup === "HIGH"))
  const low = level(events.filter((event) => event.leadershipGroup === "LOW"))
  return { HIGH: high, LOW: low, highMinusLow: high.avg == null || low.avg == null ? null : Math.round((high.avg - low.avg) * 10000) / 10000 }
}

main()
