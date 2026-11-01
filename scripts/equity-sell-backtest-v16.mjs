#!/usr/bin/env node
/**
 * Is the ATR association a difference between stocks, or a higher-than-usual
 * ATR inside the same stock?
 *
 *   node scripts/equity-sell-backtest-v16.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v15.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { SELECTED_STRATEGY, attachSplit, loadOhlcv, selectMildEvents, study } from "./lib/equity-sell-backtest-v16.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v16-result.json")

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
  const events = attachSplit(selected, series, loadSeries("SPY"))
  const result = study(events)
  const doc = {
    metadata: {
      researchOnly: true,
      selectedStrategy: SELECTED_STRATEGY,
      productionApplied: false,
      question: "Does the ATR association come from stocks that usually have high ATR, or from correction days when ATR is high relative to that stock's own prior level?",
      priorWindow: "The 60, 120, and 252 session medians use ATR/price strictly before the correction close. The correction day is outside that window. The primary split is the 60-session median.",
      identity: result.identity,
      inference: "Ticker-clustered standard errors allow repeated events of one stock to move together. With about 30 stocks they are not a confirmation, and a p-value is not a sell rule.",
      notASellRule: "This records an association between ATR and the later rebound. It is not evidence for a sell rule.",
    },
    baseline: result.baseline,
    links: result.links,
    models: result.models,
    effects: result.effects,
    tickers: result.tickers,
    tickerCorrelations: result.tickerCorrelations,
    demeaned: result.demeaned,
    edges: result.edges,
    leave: result.leave,
    extremes: result.extremes,
    periods: result.periods,
    betweenEqual: result.betweenEqual,
    eventWithinGrid: result.eventWithinGrid,
    betweenWithinGrid: result.betweenWithinGrid,
    spyWithin: result.spyWithin,
    matrix: result.matrix,
    judgment: result.judgment,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("between/within ATR v16 — research only, selectedStrategy null")
  console.log("baseline", result.baseline.lowWindow.rho, result.baseline.lowT10.rho, result.baseline.lowT20.rho, result.baseline.hit10.rho)
  console.log("judgment", result.judgment.label, result.judgment.text)
  for (const key of ["event", "between", "within", "withinRatio", "withinPercentile", "within120", "within252"]) {
    const row = result.links[key]
    console.log(key, row.lowWindow.rho, row.lowWindow.n, row.lowT10.rho, row.lowT10.n, row.lowT20.rho, row.lowT20.n, row.hit10.rho, row.hit10.n)
  }
  for (const [name, fit] of Object.entries(result.models.models)) {
    console.log(name, fit.n, fit.adjustedR2, JSON.stringify(fit.standardizedBeta), "vif", JSON.stringify(fit.vif))
  }
  for (const name of ["FE1", "FE2", "FE3"]) {
    const fit = result.effects[name]
    console.log(name, fit.status, fit.n, fit.r2, fit.withinR2, fit.adjustedR2, JSON.stringify(fit.standardizedBeta), JSON.stringify(fit.coefficients))
  }
  console.log("demeaned", JSON.stringify(result.demeaned))
  console.log("equal", JSON.stringify(result.betweenEqual))
  console.log("spyWithin", JSON.stringify(result.spyWithin))
  console.log("leave", JSON.stringify(result.leave))
  console.log("ticker corr", result.tickerCorrelations.calculable, result.tickerCorrelations.positive, result.tickerCorrelations.negative, result.tickerCorrelations.median, result.tickerCorrelations.medianAtLeast5)
  console.log("periods within", JSON.stringify(result.periods.within))
  console.log("periods between", JSON.stringify(result.periods.between))
}

main()
