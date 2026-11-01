#!/usr/bin/env node
/**
 * Is the ATR rebound association a deeper low, or a larger rebound after the low?
 *
 *   node scripts/equity-sell-backtest-v10.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v9.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  SELECTED_STRATEGY,
  attachDepth,
  atrBandDepth,
  atrDepthGrid,
  depthBuckets,
  depthCorrelations,
  depthModels,
  depthPartials,
  leadershipDepth,
  leaveOneCorrelation,
  loadOhlcv,
  pathSummary,
  selectMildEvents,
} from "./lib/equity-sell-backtest-v10.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const V9_JSON = path.join(CACHE, "equity-sell-backtest-v9-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v10-result.json")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty cache ${symbol}`)
  return loadOhlcv(bars)
}

function strategyOf(doc) {
  return doc.selectedStrategy === undefined ? doc.metadata?.selectedStrategy : doc.selectedStrategy
}

function closeEnough(left, right) {
  if (left == null && right == null) return true
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 1e-10
}

function main() {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
  if (symbols.length !== 31 || symbols.includes("FNTN")) throw new Error("research universe changed")
  const v6 = JSON.parse(fs.readFileSync(V6_JSON, "utf8"))
  const v9 = JSON.parse(fs.readFileSync(V9_JSON, "utf8"))
  if (strategyOf(v6) !== null || strategyOf(v9) !== null) throw new Error("prior selectedStrategy changed")
  const selected = selectMildEvents(v6.events)
  if (selected.length !== v9.events.length) throw new Error("v9 event count differs")
  const needed = [...new Set(selected.map((event) => event.ticker))]
  const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
  const events = attachDepth(selected, series)
  for (let index = 0; index < events.length; index++) {
    const prior = v9.events[index]
    const event = events[index]
    if (event.eventId !== prior.eventId || event.leadershipGroup !== prior.leadershipGroup) throw new Error(`v9 identity differs ${event.eventId}`)
    if (event.atrBand !== prior.atrBand) throw new Error(`ATR band differs ${event.eventId}`)
    if (!closeEnough(event.atrPct, prior.atrPct)) throw new Error(`ATR differs ${event.eventId}`)
    if (!closeEnough(event.entryToWindow, prior.entry.window)) throw new Error(`entry window differs ${event.eventId}`)
    if (!closeEnough(event.lowToWindow, prior.low.window)) throw new Error(`low window differs ${event.eventId}`)
  }
  const correlations = depthCorrelations(events)
  if (correlations.lowToWindow.rho !== v9.correlations.atrPct.lowWindow.rho) throw new Error("v9 low-window rho changed")
  if (correlations.entryToWindow.rho !== v9.correlations.atrPct.window.rho) throw new Error("v9 entry-window rho changed")
  const partials = depthPartials(events)
  const models = depthModels(events)
  const bands = atrBandDepth(events)
  const buckets = depthBuckets(events)
  const grid = atrDepthGrid(events)
  const leadership = leadershipDepth(events)
  const path = pathSummary(events, partials)
  const leave = {
    drawdown: summarizeLeave(leaveOneCorrelation(events, (event) => event.atrPct, (event) => event.drawdown)),
    lowToWindow: summarizeLeave(leaveOneCorrelation(events, (event) => event.atrPct, (event) => event.lowToWindow)),
  }
  const doc = {
    metadata: {
      researchOnly: true,
      selectedStrategy: SELECTED_STRATEGY,
      productionApplied: false,
      question: "When correction-day ATR(14)/price is higher, is the larger low-to-window rebound a deeper low, a stronger rebound after that low, or both?",
      identity: "Window/entry equals (window/low) times (low/entry). The entry-based rebound plus the low return equals the entry-to-window return.",
      predictors: "ATR, T0, leadership, correction speed, and 20-day volatility use only information through the correction close. Drawdown to the later low is an outcome and is used only as a control.",
      atrBands: "The same absolute ATR tertiles as v9: 34, 34, and 35.",
      dependence: "The same ticker can contribute more than one event. p-values assume independent events and are not a sell-rule threshold.",
    },
    consistency: {
      events: events.length,
      groups: {
        HIGH: events.filter((event) => event.leadershipGroup === "HIGH").length,
        MID: events.filter((event) => event.leadershipGroup === "MID").length,
        LOW: events.filter((event) => event.leadershipGroup === "LOW").length,
      },
      withLow: events.filter((event) => Number.isFinite(event.drawdown)).length,
      atrBands: events.bandCounts,
      depthBands: events.depthCounts,
      identityFailures: 0,
    },
    correlations,
    partials,
    models,
    atrBands: bands,
    depthBuckets: buckets,
    atrDepth: grid,
    leadership,
    leaveOneTickerOut: leave,
    path,
    events: events.map((event) => ({
      eventId: event.eventId,
      ticker: event.ticker,
      t0Date: event.t0Date,
      leadershipGroup: event.leadershipGroup,
      atrBand: event.atrBand,
      depthBand: event.depthBand,
      depthBucket: event.depthBucket,
      atrPct: event.atrPct,
      t0: event.t0,
      lowDay: event.lowDay,
      lowReturn: event.lowReturn,
      drawdown: event.drawdown,
      lowToT10: event.lowToT10,
      lowToT20: event.lowToT20,
      lowToWindow: event.lowToWindow,
      entryToWindow: event.entryToWindow,
    })),
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("ATR depth vs rebound v10 — research only, selectedStrategy null")
  console.log("events", doc.consistency.events, doc.consistency.groups, "withLow", doc.consistency.withLow)
  for (const row of path.rows) console.log(row.path, row.rho, row.n)
  console.log("path", path.label)
  for (const row of partials) console.log(row.id, row.rawRho, row.partialRho, row.n, row.controls.join("+"))
  for (const outcome of ["lowToWindow", "entryToWindow"]) {
    for (const row of models[outcome].shared) {
      console.log(outcome, row.id, "n", row.n, "r2", row.r2, "adj", row.adjustedR2, "atr", row.atrPct?.coefficient, "dd", row.drawdown?.coefficient)
    }
    console.log(outcome, "M2-M3 atr coef drop", models[outcome].atrCoefficientChange)
  }
  console.log("band gaps", JSON.stringify(bands.highMinusLow))
  for (const row of buckets) console.log("bucket", row.id, row.n, row.status, "rho", row.spearman.rho)
  for (const cell of grid) console.log("cell", cell.atr, cell.depth, cell.view.status, cell.n, cell.lowToWindow.avg, cell.entryToWindow.avg)
  for (const row of leadership) console.log("lead", row.group, row.n, "atr", row.atr.avg, "dd", row.drawdown.avg, "reb", row.lowToWindow.avg, "rho dd", row.atrDrawdown.rho, "rho reb", row.atrRebound.rho)
  for (const key of ["drawdown", "lowToWindow"]) {
    const held = leave[key]
    console.log("loo", key, held.baseline, held.min, held.max, held.median, held.signFlips.join(",") || "none")
  }
}

function summarizeLeave(held) {
  return { baseline: held.baseline.rho, n: held.baseline.n, min: held.min, max: held.max, median: held.median, signFlips: held.signFlips }
}

main()
