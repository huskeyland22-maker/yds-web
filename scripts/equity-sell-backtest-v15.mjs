#!/usr/bin/env node
/**
 * Does the path of ATR during the correction line up with the later rebound?
 *
 *   node scripts/equity-sell-backtest-v15.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v14.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { DESCRIPTIVE_SHAPE, SELECTED_STRATEGY, attachShape, loadOhlcv, selectMildEvents, study } from "./lib/equity-sell-backtest-v15.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v15-result.json")

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
  if (strategyOf(v6) !== null) throw new Error("v6 selectedStrategy changed")
  const selected = selectMildEvents(v6.events)
  const needed = [...new Set(selected.map((event) => event.ticker))]
  const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
  const events = attachShape(selected, series, loadSeries("SPY"))
  const result = study(events)
  const doc = {
    metadata: {
      researchOnly: true,
      selectedStrategy: SELECTED_STRATEGY,
      productionApplied: false,
      question: "Does the path ATR took from the leading peak to the correction close line up with the later rebound beyond the correction-day ATR level?",
      preEntry: "Peak ATR, the prior session ATR, entry ATR, and the peak-to-entry change, ratio, and per-session slope use only bars through the correction close.",
      descriptive: "Maximum ATR, mean ATR, ATR dispersion, and the entry percentile inside the correction path are post-entry descriptive only. They are not regression inputs, thresholds, or strategy variables.",
      excludedFromModels: DESCRIPTIVE_SHAPE,
      slope: "Slope is the ordinary least-squares change in ATR/price per session from the peak through the correction close. A one-session gap is that change divided by one session.",
      notASellRule: "This is not evidence for a sell rule. A high ATR lines up with a larger later rebound in these events. That is an association, not a cause.",
    },
    baseline: result.baseline,
    links: result.links,
    models: result.models,
    between: result.between,
    duplication: result.duplication,
    grid: result.grid,
    durations: result.durations,
    periods: result.periods,
    leaveOne: result.leaveOne,
    extremes: result.extremes,
    descriptive: result.descriptive,
    judgment: result.judgment,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  const j = result.judgment
  console.log("ATR shape v15 — research only, selectedStrategy null")
  console.log("baseline", result.baseline.lowWindow.rho, result.baseline.lowT10.rho, result.baseline.lowT20.rho, result.baseline.hit10.rho)
  console.log("H1", j.h1, "H2", j.h2, "H3", j.h3, "structure", j.structure.label, "adds", j.adds, "held", j.held, "deltas", JSON.stringify(j.deltas))
  for (const key of ["atrPct", "peakAtr", "atrChange", "atrRatio", "atrSlope", "correctionDuration"]) {
    const row = result.links[key]
    console.log(key, row.lowWindow.rho, row.lowWindow.n, row.lowT10.rho, row.lowT10.n, row.lowT20.rho, row.lowT20.n, row.hit10.rho, row.hit10.n)
  }
  const window = result.models.lowWindow
  for (const key of ["change", "ratio", "slope"]) {
    const block = window[key]
    console.log("model", key, "n", block.n, "vif", JSON.stringify(block.vif.map((row) => [row.key, row.vif == null ? null : Math.round(row.vif * 100) / 100])))
    for (const [name, fit] of Object.entries(block.models)) console.log(" ", name, fit.n, fit.r2, fit.adjustedR2, JSON.stringify(fit.beta))
  }
  console.log("peak", JSON.stringify(window.peak.models))
  console.log("duration bins", JSON.stringify(result.durations))
  console.log("grid", JSON.stringify(result.grid.cells))
  console.log("descriptive", JSON.stringify(result.descriptive))
  console.log("leave", JSON.stringify(result.leaveOne))
  console.log("extreme", JSON.stringify(result.extremes))
  console.log("periods", JSON.stringify(result.periods))
  console.log("dup", JSON.stringify(result.duplication))
}

main()
