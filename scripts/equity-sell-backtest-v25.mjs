#!/usr/bin/env node
/**
 * Can the T+3 recovery stand in for the T+5 recovery?
 *
 *   node scripts/equity-sell-backtest-v25.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v24.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  SELECTED_STRATEGY,
  assertBaseline,
  assertV18Split,
  attachEarly,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  auditLookAhead,
  loadOhlcv,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v25.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v25-result.json")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty cache ${symbol}`)
  return loadOhlcv(bars)
}

function main() {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  if (EQUITY_SELL_RESEARCH_UNIVERSE.length !== 31) throw new Error("research universe changed")
  const v6 = JSON.parse(fs.readFileSync(V6_JSON, "utf8"))
  const selected = selectMildEvents(v6.events)
  const needed = [...new Set(selected.map((event) => event.ticker))]
  const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
  const spy = loadSeries("SPY")
  const held = attachHold(attachRegime(attachSplit(selected, series, spy), spy), series)
  assertBaseline(held)
  const events = attachEarly(attachShape(held, series))
  assertV18Split(events)
  const audit = auditLookAhead(events, series)
  if (!audit.ok) throw new Error("look-ahead audit failed")
  const result = study(events)
  const doc = {
    selectedStrategy: SELECTED_STRATEGY,
    note: result.note,
    baseline: {
      events: events.length,
      lowEvents: events.filter((event) => event.lowDay != null).length,
      groups: {
        HIGH: events.filter((event) => event.leadershipGroup === "HIGH").length,
        MID: events.filter((event) => event.leadershipGroup === "MID").length,
        LOW: events.filter((event) => event.leadershipGroup === "LOW").length,
      },
      bands: events.bandCounts,
    },
    lookAhead: audit,
    ...result,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("baseline", doc.baseline)
  console.log("rules", JSON.stringify(doc.rules))
  console.log("judgment", doc.judgment.label)
  console.log("states", JSON.stringify(doc.states))
  console.log("transitions", JSON.stringify(doc.transitions.primary))
  console.log("within", JSON.stringify(doc.withinDepth))
  console.log("boot", JSON.stringify(doc.bootstrap))
  console.log("ticker", JSON.stringify(doc.ticker))
  console.log("ratio", JSON.stringify(doc.ratioDistribution))
  console.log("overlap", JSON.stringify(doc.overlap))
  console.log("corr", JSON.stringify(doc.correlations))
  console.log("models", JSON.stringify(doc.models.recovery.window))
  console.log("ratio models", JSON.stringify(doc.models.ratio.window))
  console.log("oos", JSON.stringify(doc.oos))
  console.log("class", JSON.stringify(doc.classification))
  console.log("atr", JSON.stringify(doc.atr))
  console.log("lead", JSON.stringify(doc.leadership))
  console.log("path", JSON.stringify(doc.pathCross))
  console.log("lookahead", JSON.stringify(audit))
}

main()
