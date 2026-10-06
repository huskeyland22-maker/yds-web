#!/usr/bin/env node
/**
 * Does the larger ATR rebound still justify holding after the extra decline?
 *
 *   node scripts/equity-sell-backtest-v21.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v20.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  SELECTED_STRATEGY,
  assertBaseline,
  attachHold,
  attachRegime,
  attachRisk,
  attachSplit,
  loadOhlcv,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v21.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v21-result.json")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty cache ${symbol}`)
  return loadOhlcv(bars)
}

function main() {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
  if (symbols.length !== 31) throw new Error("research universe changed")
  const v6 = JSON.parse(fs.readFileSync(V6_JSON, "utf8"))
  const selected = selectMildEvents(v6.events)
  const needed = [...new Set(selected.map((event) => event.ticker))]
  const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
  const spy = loadSeries("SPY")
  const held = attachHold(attachRegime(attachSplit(selected, series, spy), spy), series)
  assertBaseline(held)
  const events = attachRisk(held, series)
  const result = study(events)
  const doc = {
    selectedStrategy: SELECTED_STRATEGY,
    note: "Research only. Not a sell rule. MAE and Low depth are the same lowest entry-relative return inside the window.",
    baseline: {
      events: events.length,
      lowEvents: events.filter((event) => event.lowDay != null).length,
      maeEvents: events.filter((event) => Number.isFinite(event.risk.mae)).length,
      groups: {
        HIGH: events.filter((event) => event.leadershipGroup === "HIGH").length,
        MID: events.filter((event) => event.leadershipGroup === "MID").length,
        LOW: events.filter((event) => event.leadershipGroup === "LOW").length,
      },
      bands: events.bandCounts,
    },
    ...result,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("baseline", doc.baseline)
  for (const band of ["LOW", "MID", "HIGH"]) {
    const row = doc.bands[band]
    console.log("\n", band, "window", JSON.stringify(row.window))
    console.log("mae", JSON.stringify(row.mae))
    console.log("mfe", JSON.stringify(row.mfe))
    console.log("low", JSON.stringify(row.lowDepth), JSON.stringify(row.lowToWindow))
    console.log("ratio", JSON.stringify(row.ratio), "eff", JSON.stringify(row.efficiency), "rebound", JSON.stringify(row.reboundPerDepth))
    console.log("winners", JSON.stringify(row.positiveWindowAdverse))
    for (const key of ["t1", "t3", "t5", "t10", "t20", "t40", "window"]) console.log(key, JSON.stringify(row.horizons[key]))
  }
  console.log("\nhighLow", JSON.stringify(doc.highLow))
  console.log("buckets", JSON.stringify(doc.buckets))
  console.log("atrMae", JSON.stringify(doc.atrMae))
  console.log("bucketLinks", JSON.stringify(doc.bucketLinks))
  console.log("recovery", JSON.stringify(doc.recovery))
  console.log("leadership", JSON.stringify(doc.leadership))
  console.log("regression", JSON.stringify(doc.regression))
  console.log("continuous", JSON.stringify(doc.continuous))
  console.log("robust", JSON.stringify(doc.robust))
  console.log("bootstrap", JSON.stringify(doc.bootstrap))
  console.log("v20", JSON.stringify(doc.v20Link))
  console.log("judgment", doc.judgment.label)
}

main()
