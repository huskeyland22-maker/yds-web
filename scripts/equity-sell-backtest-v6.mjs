#!/usr/bin/env node
/**
 * US single-stock low-and-rebound study v6 (research only).
 *
 *   node scripts/equity-sell-backtest-v6.mjs
 *
 * Does not select a sell rule and does not modify v1–v5.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { prepareSeries } from "./lib/equity-sell-backtest-v2.mjs"
import {
  SELECTED_STRATEGY,
  attachRebound,
  coreTables,
  correlateOutcomes,
  leaveOneTickerOut,
  selectMildEvents,
  stockWeighted,
  summarizeGroups,
} from "./lib/equity-sell-backtest-v6.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V3_JSON = path.join(CACHE, "equity-sell-backtest-v3-result.json")
const V5_JSON = path.join(CACHE, "equity-sell-backtest-v5-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty cache ${symbol}`)
  return prepareSeries(bars)
}

function strategyOf(doc) {
  return doc.selectedStrategy === undefined ? doc.metadata?.selectedStrategy : doc.selectedStrategy
}

function main() {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
  if (symbols.length !== 31 || symbols.includes("FNTN")) throw new Error("research universe changed")
  const v3 = JSON.parse(fs.readFileSync(V3_JSON, "utf8"))
  const v5 = JSON.parse(fs.readFileSync(V5_JSON, "utf8"))
  if (strategyOf(v3) !== null || strategyOf(v5) !== null) throw new Error("prior selectedStrategy changed")
  const selected = selectMildEvents(v5.events, v3.events.filter((event) => event.correctionDepth === 0.1))
  const needed = [...new Set(selected.map((event) => event.ticker))]
  const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
  const events = attachRebound(selected, series)
  const summary = summarizeGroups(events)
  const tables = coreTables(summary)
  const stock = stockWeighted(events)
  const held = leaveOneTickerOut(events)
  const association = correlateOutcomes(events)
  const doc = {
    metadata: {
      researchOnly: true,
      selectedStrategy: SELECTED_STRATEGY,
      productionApplied: false,
      question: "Inside the fixed 103 events with -5% <= T0 < 0%, does the high-leadership window gap come from an earlier low, a larger rebound after that low, or both?",
      eventCount: events.length,
      lowDefinition: "The low is the first minimum close after T0 inside the original entry+60 window. It is the same low stored by v3.",
      reboundDefinition: "A calendar rebound uses only events whose low is already formed by that session. Events still waiting for the low are left out of that session. Milestone days start at the low and stay empty when the target is not reached by the window end.",
      repeatedEvents: "Event-weighted results give every event one vote. Stock-weighted results average inside each ticker first.",
    },
    consistency: {
      events: events.length,
      groups: {
        HIGH: events.filter((event) => event.leadershipGroup === "HIGH").length,
        MID: events.filter((event) => event.leadershipGroup === "MID").length,
        LOW: events.filter((event) => event.leadershipGroup === "LOW").length,
      },
      leaveOneOutRemovedSum: held.rows.reduce((sum, row) => sum + row.removed, 0),
      v5Match: true,
    },
    groups: summary.blocks,
    highMinusLow: summary.highLow,
    coreTables: tables,
    stockWeighted: stock,
    leaveOneTickerOut: held,
    correlations: association,
    events: events.map((event) => ({
      eventId: event.eventId,
      ticker: event.ticker,
      episodeStart: event.episodeStart,
      t0Date: event.t0Date,
      t0: event.t0,
      leadershipScore: event.leadershipScore,
      leadershipGroup: event.leadershipGroup,
      lowDay: event.lowDay,
      lowReturnFromEntry: event.lowReturnFromEntry,
      lowToWindowReturn: event.lowToWindowReturn,
    })),
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("Equity mild-T0 rebound study v6 — research only, selectedStrategy null")
  console.log(`events ${events.length}`)
  for (const row of tables.rebound) console.log(row.label, JSON.stringify(row))
  for (const row of tables.entry) console.log(row.label, JSON.stringify(row))
  console.log("stock", JSON.stringify(stock))
  console.log("loo", JSON.stringify({ window: held.windowRebound, t20: held.t20Rebound, lowDay: held.lowDay, base: held.baseline }))
  console.log("corr", JSON.stringify(association.leadership))
  console.log("t0", JSON.stringify(association.t0))
  const h = summary.blocks.HIGH
  const l = summary.blocks.LOW
  console.log("milestones days", JSON.stringify({
    high5: h.milestones["5"],
    low5: l.milestones["5"],
    high10: h.milestones["10"],
    low10: l.milestones["10"],
    high20: h.milestones["20"],
    low20: l.milestones["20"],
  }))
  console.log("entry clock", JSON.stringify({ high: h.entryClock, low: l.entryClock }))
  console.log("low bins high", JSON.stringify(h.lowTiming.bins), "cum", JSON.stringify(h.lowTiming.cumulative))
  console.log("low bins low", JSON.stringify(l.lowTiming.bins), "cum", JSON.stringify(l.lowTiming.cumulative))
}

main()
