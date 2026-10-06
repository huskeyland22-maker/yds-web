#!/usr/bin/env node
/**
 * Was holding after the correction close better than selling there?
 *
 *   node scripts/equity-sell-backtest-v20.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v19.
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
  attachSplit,
  loadOhlcv,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v20.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v20-result.json")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty cache ${symbol}`)
  return loadOhlcv(bars)
}

function line(label, row) {
  if (!row) return console.log(label, "unavailable")
  console.log(label, "n", row.n, "mean", row.mean, "med", row.median, "win", row.winRate, "loss", row.lossRate, "w5", row.worse5, "w10", row.worse10, "h5", row.hit5, "h10", row.hit10, "h20", row.hit20)
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
  const events = attachHold(attachRegime(attachSplit(selected, series, spy), spy), series)
  assertBaseline(events)
  const result = study(events)
  const doc = {
    selectedStrategy: SELECTED_STRATEGY,
    note: "Research only. Not a sell rule.",
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
    ...result,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("baseline", doc.baseline)
  for (const band of ["LOW", "MID", "HIGH"]) {
    console.log("\n", band, "storedT0", JSON.stringify(doc.bands[band].t0Stored))
    for (const key of ["t0", "t1", "t3", "t5", "t10", "t20", "t40", "window"]) line(key, doc.bands[band][key])
    console.log("min", JSON.stringify(doc.bands[band].minimum))
    console.log("lowTo", JSON.stringify(doc.bands[band].lowTo))
    console.log("recovery", JSON.stringify(doc.bands[band].recovery))
    console.log("first", JSON.stringify(doc.bands[band].firstPositive))
  }
  console.log("\nhighLow", JSON.stringify(doc.highLow))
  console.log("leadership", JSON.stringify(doc.leadership))
  console.log("t0", JSON.stringify(doc.t0Means), JSON.stringify(doc.t0ControlledGap), JSON.stringify(doc.t0Buckets))
  console.log("continuous", JSON.stringify(doc.continuous))
  console.log("robust", JSON.stringify(doc.robust))
  console.log("bootstrap", JSON.stringify(doc.bootstrap))
  console.log("v19", JSON.stringify(doc.v19Direction))
  console.log("judgment", doc.judgment.label)
}

main()
