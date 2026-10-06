#!/usr/bin/env node
/**
 * Does the drawdown known by T+1, T+3, or T+5 separate later outcomes?
 *
 *   node scripts/equity-sell-backtest-v22.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v21.
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
  attachSplit,
  loadOhlcv,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v22.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v22-result.json")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty cache ${symbol}`)
  return loadOhlcv(bars)
}

function brief(block) {
  if (!block) return null
  return {
    n: block.n,
    conclusion: block.conclusion,
    t10: block.t10?.mean,
    t20: block.t20?.mean,
    t40: block.t40?.mean,
    window: block.window?.mean,
    windowMedian: block.window?.median,
    windowWin: block.window?.winRate,
    lowToWindow: block.lowToWindow?.mean,
    hit10: block.hit10,
    hit10MedianDays: block.hit10MedianDays,
  }
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
  const events = attachEarly(held, series)
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
  for (const key of ["t1", "t3", "t5"]) {
    const row = doc.checkpoints[key]
    console.log("\n", key, "n", row.n)
    console.log("buckets", JSON.stringify(row.buckets.map(brief)))
    console.log("cut5", JSON.stringify({ SHALLOW: brief(row.cut5.SHALLOW), DEEP: brief(row.cut5.DEEP) }))
    console.log("cut10", JSON.stringify({ SHALLOW: brief(row.cut10.SHALLOW), DEEP: brief(row.cut10.DEEP) }))
    console.log("cells5", JSON.stringify(row.cells5))
    console.log("continuous mae", JSON.stringify(row.continuous.mae))
    console.log("continuous depth", JSON.stringify(row.continuous.depth))
    console.log("models", JSON.stringify(row.models))
    console.log("ticker", JSON.stringify(row.ticker))
    console.log("boot", JSON.stringify(doc.bootstrap[key]))
  }
  console.log("\noos", JSON.stringify(doc.oos))
  console.log("class", JSON.stringify(doc.classification))
  console.log("judgment", doc.judgment.label)
}

main()
