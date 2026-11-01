#!/usr/bin/env node
/**
 * Why a higher correction-day ATR(14)/price lines up with the later rebound.
 *
 *   node scripts/equity-sell-backtest-v9.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v8.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { leaveOneCorrelation } from "./lib/equity-sell-backtest-v7.mjs"
import {
  SELECTED_STRATEGY,
  attachDecomposition,
  atrBandTable,
  correlationMatrix,
  decompositionTable,
  fitDecomposition,
  judgeHypotheses,
  leadershipAtrGrid,
  loadOhlcv,
  partialBlock,
  selectMildEvents,
} from "./lib/equity-sell-backtest-v9.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const V8_JSON = path.join(CACHE, "equity-sell-backtest-v8-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v9-result.json")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty cache ${symbol}`)
  return loadOhlcv(bars)
}

function strategyOf(doc) {
  return doc.selectedStrategy === undefined ? doc.metadata?.selectedStrategy : doc.selectedStrategy
}

function main() {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
  if (symbols.length !== 31 || symbols.includes("FNTN")) throw new Error("research universe changed")
  const v6 = JSON.parse(fs.readFileSync(V6_JSON, "utf8"))
  const v8 = JSON.parse(fs.readFileSync(V8_JSON, "utf8"))
  if (strategyOf(v6) !== null || strategyOf(v8) !== null) throw new Error("prior selectedStrategy changed")
  const selected = selectMildEvents(v6.events)
  if (selected.length !== v8.events.length) throw new Error("v8 event count differs")
  for (let index = 0; index < selected.length; index++) {
    if (selected[index].eventId !== v8.events[index].eventId) throw new Error(`v8 identity differs at ${index}`)
    if (selected[index].leadershipGroup !== v8.events[index].leadershipGroup) throw new Error(`v8 group differs ${selected[index].eventId}`)
  }
  const needed = [...new Set(selected.map((event) => event.ticker))]
  const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
  const events = attachDecomposition(selected, series)
  for (let index = 0; index < events.length; index++) {
    const stored = v8.events[index].atrPct
    const current = events[index].factors.atrPct
    if (!Number.isFinite(stored) || Math.abs(current - stored) > 1e-10) throw new Error(`ATR differs from v8 ${events[index].eventId}`)
  }
  const matrix = correlationMatrix(events)
  const partials = partialBlock(events)
  const models = fitDecomposition(events)
  const bands = atrBandTable(events)
  const grid = leadershipAtrGrid(events)
  const decomposition = decompositionTable(events)
  const hypotheses = judgeHypotheses(events, matrix, grid)
  const leave = {
    atrPct: leaveOneCorrelation(events, (event) => event.factors.atrPct, (event) => event.entry.window),
    correctionSpeed: leaveOneCorrelation(events, (event) => event.factors.correctionSpeed, (event) => event.entry.window),
    leadership: leaveOneCorrelation(events, (event) => event.leadershipScore, (event) => event.entry.window),
  }
  const doc = {
    metadata: {
      researchOnly: true,
      selectedStrategy: SELECTED_STRATEGY,
      productionApplied: false,
      question: "Why does a higher correction-day ATR(14)/price line up with the later rebound?",
      predictors: "ATR, realized volatility, correction speed, correction duration, and T0 use only prices through the correction close. Leadership is the stored v2 score. The log of ATR/price has the same rank as ATR/price, so its Spearman correlations match ATR/price.",
      atrBands: "Absolute ATR(14)/price tertiles on these 103 events. Lowest third, middle third, and the remaining top third. This is separate from the v8 within-stock percentile.",
      dependence: "Several events can come from the same ticker. p-values assume independent events and are not a sell-rule threshold.",
    },
    consistency: {
      events: events.length,
      groups: {
        HIGH: events.filter((event) => event.leadershipGroup === "HIGH").length,
        MID: events.filter((event) => event.leadershipGroup === "MID").length,
        LOW: events.filter((event) => event.leadershipGroup === "LOW").length,
      },
      atrBands: bands.counts,
    },
    correlations: matrix,
    partials,
    models,
    atrBands: bands,
    leadershipAtr: grid,
    decomposition,
    leaveOneTickerOut: {
      atrPct: summarizeLeave(leave.atrPct),
      correctionSpeed: summarizeLeave(leave.correctionSpeed),
      leadership: summarizeLeave(leave.leadership),
    },
    hypotheses,
    events: events.map((event) => ({
      eventId: event.eventId,
      ticker: event.ticker,
      t0Date: event.t0Date,
      leadershipGroup: event.leadershipGroup,
      leadershipScore: event.leadershipScore,
      t0: event.t0,
      atrBand: event.atrBand,
      atrPct: event.factors.atrPct,
      atrLog: event.factors.atrLog,
      correctionSpeed: event.factors.correctionSpeed,
      correctionDuration: event.factors.correctionDuration,
      vol20: event.factors.vol20,
      atrOverVol: event.factors.atrOverVol,
      entry: event.entry,
      low: event.low,
    })),
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  const atr = matrix.atrPct
  console.log("ATR decomposition v9 — research only, selectedStrategy null")
  console.log("events", doc.consistency.events, doc.consistency.groups, "bands", bands.counts)
  console.log("ATR rho", ["t5", "t10", "t20", "t40", "window"].map((key) => `${key} ${atr[key].rho} n${atr[key].n}`).join(" | "))
  for (const outcome of ["window", "t20", "lowWindow", "lowT20"]) {
    for (const row of partials[outcome]) console.log(row.id, outcome, row.rawRho, row.partialRho, row.n)
  }
  for (const row of models.window.shared) console.log("window", row.id, "n", row.n, "r2", row.r2, "adj", row.adjustedR2)
  for (const band of bands.bands) console.log("band", band.band, "n", band.n, "t10", band.t10.avg, "t20", band.t20.avg, "window", band.window.avg, "lowWindow", band.lowWindow.avg)
  for (const cell of grid) console.log("cell", cell.leadership, cell.atr, cell.view.status, cell.n, cell.view.values?.window?.avg ?? "")
  for (const key of ["atrPct", "correctionSpeed", "leadership"]) {
    const held = doc.leaveOneTickerOut[key]
    console.log("loo", key, held.baseline, held.min, held.max, held.median, held.signFlips.join(",") || "none")
  }
  console.log("hypotheses", hypotheses.fade.label, hypotheses.speed.label, hypotheses.combination.label)
}

function summarizeLeave(held) {
  return {
    baseline: held.baseline.rho,
    n: held.baseline.n,
    min: held.min,
    max: held.max,
    median: held.median,
    signFlips: held.signFlips,
  }
}

main()
