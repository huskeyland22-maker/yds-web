#!/usr/bin/env node
/**
 * Does the speed and persistence of an early decline add to its depth?
 *
 *   node scripts/equity-sell-backtest-v23.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v22.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  SELECTED_STRATEGY,
  assertBaseline,
  assertV18Split,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  loadOhlcv,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v23.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v23-result.json")

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
  const events = attachShape(held, series)
  assertV18Split(events)
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
    ...result,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("baseline", doc.baseline)
  console.log("rules", JSON.stringify(doc.rules))
  console.log("judgment", doc.judgment.label)
  console.log("path", JSON.stringify(doc.pathTypes))
  console.log("within", JSON.stringify(doc.withinDeep))
  console.log("boot", JSON.stringify(doc.bootstrap))
  console.log("ticker", JSON.stringify(doc.ticker))
  for (const key of ["t1", "t3", "t5"]) {
    console.log("\n", key, "overlap", JSON.stringify(doc.overlap[key]))
    console.log(key, "window models", JSON.stringify(doc.models[key].window))
    console.log(key, "window corr", JSON.stringify(Object.fromEntries(Object.entries(doc.correlations[key]).map(([name, targets]) => [name, targets.window]))))
  }
  console.log("\noos window", JSON.stringify(Object.fromEntries(["70", "60", "50"].map((split) => [split, doc.oos[split].window]))))
  console.log("\noos t20", JSON.stringify(Object.fromEntries(["70", "60", "50"].map((split) => [split, doc.oos[split].t20]))))
  console.log("\nclass", JSON.stringify(doc.classification))
  console.log("\natr", JSON.stringify(doc.atrPath))
  console.log("\nlead", JSON.stringify(doc.leadershipPath))
}

main()
