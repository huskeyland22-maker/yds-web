#!/usr/bin/env node
/**
 * US single-stock recovery-path study v3 (research only).
 *
 *   node scripts/equity-sell-backtest-v3.mjs
 *
 * Does not select a sell rule and does not modify v1 or v2.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { prepareSeries } from "./lib/equity-sell-backtest-v2.mjs"
import {
  LOCKED_DEEP_EVENTS,
  SELECTED_STRATEGY,
  analyzeTrajectories,
  assertSameEvents,
  attachPaths,
  correlateScore,
  summarizeSymbols,
} from "./lib/equity-sell-backtest-v3.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V2_JSON = path.join(CACHE, "equity-sell-backtest-v2-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v3-result.json")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty cache ${symbol}`)
  return prepareSeries(bars)
}

function main() {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
  if (symbols.length !== 31 || new Set(symbols).size !== 31 || symbols.includes("FNTN")) {
    throw new Error("research universe changed")
  }
  const v2 = JSON.parse(fs.readFileSync(V2_JSON, "utf8"))
  if (v2.selectedStrategy !== null) throw new Error("v2 selectedStrategy changed")
  const v2Events = v2.events.filter((event) => event.correctionDepth === 0.1)
  if (v2Events.length !== LOCKED_DEEP_EVENTS) throw new Error(`v2 events ${v2Events.length}`)
  const series = new Map(symbols.map((symbol) => [symbol, loadSeries(symbol)]))
  const events = attachPaths(v2Events, series)
  assertSameEvents(v2Events, events)
  const analysis = analyzeTrajectories(events)
  if (analysis.counts.HIGH + analysis.counts.MID + analysis.counts.LOW !== v2.groups.scored) {
    throw new Error("classified event count changed")
  }
  if (analysis.counts.HIGH !== v2.groups.counts.HIGH || analysis.counts.LOW !== v2.groups.counts.LOW) {
    throw new Error("HIGH/LOW counts changed")
  }
  const highEnd = analysis.eventWeighted.HIGH.horizons.windowEnd.avg
  const lowEnd = analysis.eventWeighted.LOW.horizons.windowEnd.avg
  if (highEnd !== 29.7 || lowEnd !== 8.94) throw new Error(`window path ${highEnd} ${lowEnd}`)
  const doc = {
    researchOnly: true,
    selectedStrategy: SELECTED_STRATEGY,
    productionApplied: false,
    question:
      "After a +10/-10 correction, does the higher later return of high-leadership events come from a smaller further decline or from a faster and stronger rebound?",
    v2EventCount: LOCKED_DEEP_EVENTS,
    v2Match: true,
    counts: analysis.counts,
    unscored: events.filter((event) => event.leadershipGroup == null).length,
    eventWeighted: analysis.eventWeighted,
    stockWeighted: analysis.stockWeighted,
    trajectory: analysis.trajectory,
    trajectoryStock: analysis.trajectoryStock,
    highMinusLow: analysis.highMinusLow,
    highMinusLowStock: analysis.highMinusLowStock,
    correlations: correlateScore(events),
    bySymbol: summarizeSymbols(events),
    events,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  const line = (key) => {
    const row = analysis.highMinusLow[key]
    return `${key} avg ${row.avg} med ${row.median} win ${row.winRate} n ${row.highN}/${row.lowN}`
  }
  console.log("Equity recovery path v3 — research only, selectedStrategy null")
  console.log(["t1", "t3", "t5", "t7", "t10", "t15", "t20", "t30", "t40", "windowEnd"].map(line).join("\n"))
  for (const name of ["HIGH", "MID", "LOW"]) {
    const row = analysis.eventWeighted[name]
    console.log(
      name,
      "recover",
      JSON.stringify(row.recovery),
      "low",
      JSON.stringify(row.low),
      "add",
      row.additionalDrawdown.avg,
      "lowVs",
      row.lowVsEntry.avg,
      "rebLow",
      row.reboundFromLow.avg,
      "rebEntry",
      row.reboundVsEntry.avg,
      "split",
      JSON.stringify(row.split),
    )
  }
  console.log(JSON.stringify(doc.correlations, null, 2))
}

main()
