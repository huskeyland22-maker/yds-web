#!/usr/bin/env node
/**
 * Where the correction-day ATR(14)/price sits in that stock's own history.
 *
 *   node scripts/equity-sell-backtest-v8.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v7.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { leaveOneCorrelation } from "./lib/equity-sell-backtest-v7.mjs"
import {
  SELECTED_STRATEGY,
  attachAtrHistory,
  correlateHistory,
  loadOhlcv,
  selectMildEvents,
  summarizeHistory,
} from "./lib/equity-sell-backtest-v8.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v8-result.json")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty cache ${symbol}`)
  return loadOhlcv(bars)
}

function main() {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
  if (symbols.length !== 31 || symbols.includes("FNTN")) throw new Error("research universe changed")
  const v6 = JSON.parse(fs.readFileSync(V6_JSON, "utf8"))
  if ((v6.selectedStrategy ?? v6.metadata?.selectedStrategy) !== null) throw new Error("v6 selectedStrategy changed")
  const selected = selectMildEvents(v6.events)
  const needed = [...new Set(selected.map((event) => event.ticker))]
  const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
  const events = attachAtrHistory(selected, series)
  const summary = summarizeHistory(events)
  const correlations = correlateHistory(events)
  const leave = {}
  for (const length of [60, 120]) {
    leave[length] = leaveOneCorrelation(events, (event) => event.history[length].percentile, (event) => event.windowRebound)
  }
  const doc = {
    metadata: {
      researchOnly: true,
      selectedStrategy: SELECTED_STRATEGY,
      productionApplied: false,
      question: "Is the correction-day ATR(14)/price high because that stock is usually volatile, or because the reading is high inside that stock's own prior 60- and 120-session distribution?",
      reference: "The reference window is the 60 or 120 sessions strictly before the correction close. The correction day is compared with that window and is not one of its observations.",
      percentile: "Percentile is the share of the stock's own prior ATR(14)/price readings below the correction-day value, with ties counted halfway. 100 means the current reading is above every prior reading in the window.",
      decile: "Decile 1 is the bottom tenth of that stock's own history. Decile 10 is the top tenth.",
    },
    consistency: { events: events.length },
    summary,
    correlations,
    leaveOneTickerOut: leave,
    events: events.map((event) => ({
      eventId: event.eventId,
      ticker: event.ticker,
      t0Date: event.t0Date,
      leadershipGroup: event.leadershipGroup,
      atrPct: event.atrPct,
      percentile60: event.history[60].percentile,
      decile60: event.history[60].decile,
      usual60: event.history[60].usualMedian,
      percentile120: event.history[120].percentile,
      decile120: event.history[120].decile,
      usual120: event.history[120].usualMedian,
    })),
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("ATR history percentile v8 — research only, selectedStrategy null")
  for (const row of summary) {
    console.log(
      `window ${row.length}`,
      `pct H ${row.percentile.HIGH.avg}/${row.percentile.HIGH.median} M ${row.percentile.MID.avg} L ${row.percentile.LOW.avg}/${row.percentile.LOW.median} d ${row.percentile.highMinusLow}`,
      `usual H ${row.usualMedian.HIGH.avg} L ${row.usualMedian.LOW.avg} d ${row.usualMedian.highMinusLow}`,
      `now H ${row.current.HIGH.avg} L ${row.current.LOW.avg}`,
      `above50 H ${row.aboveUsual.HIGH.rate} L ${row.aboveUsual.LOW.rate}`,
      `missing ${row.missing}`,
    )
  }
  console.log(JSON.stringify(correlations, null, 2))
  for (const length of [60, 120]) {
    const held = leave[length]
    console.log(`loo ${length}`, held.baseline.rho, held.min, held.max, held.signFlips.join(",") || "none")
  }
}

main()
