#!/usr/bin/env node
/**
 * What does a high correction-day ATR line up with in the later rebound?
 *
 *   node scripts/equity-sell-backtest-v14.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v13.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  SELECTED_STRATEGY,
  attachMeaning,
  loadOhlcv,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v14.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v14-result.json")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty cache ${symbol}`)
  return loadOhlcv(bars)
}

function strategyOf(doc) {
  return doc.selectedStrategy === undefined ? doc.metadata?.selectedStrategy : doc.selectedStrategy
}

function slimLeave(block) {
  return { baseline: block.baseline, min: block.min, max: block.max, median: block.median, signFlips: block.signFlips }
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
  const events = attachMeaning(selected, series, loadSeries("SPY"))
  const result = study(events)
  const matched = events.filter((event) => Number.isFinite(event.predictors.spyAtr)).length
  const doc = {
    metadata: {
      researchOnly: true,
      selectedStrategy: SELECTED_STRATEGY,
      productionApplied: false,
      question: "What does a high correction-day ATR line up with, and which part of that lines up with the later rebound?",
      returns: "5, 10, 20, 60, and 120 session returns, and the 20 and 50 session average distances, end at the close before the correction bar. They reuse the v7 pre-entry definition. The correction day's own move stays in T0.",
      position: "60 and 120 session range position is the v12 value: the correction close against the high and low closes of the sessions strictly before it.",
      market: "Market volatility is SPY ATR(14)/price and SPY 20-day realized volatility on the same correction date. A missing SPY date is left unmatched. No daily VIX series is stored with the research bars, so VIX is not filled.",
      relative: "Relative ATR is stock ATR/price divided by SPY ATR/price. The difference is stored only as a secondary description.",
      judgment: "H1 is supported when the ATR beta stays at least half of its prior beta and at least 0.10 after both the 20-day and 60-day return. H4 is supported when that same bar is cleared after SPY ATR. H5 is supported when relative ATR keeps the same sign, its low-to-window rho is at least 0.20, its adjusted R-squared exceeds the SPY ATR model, and its joint beta stays at least 0.10. These labels are associations, not causes.",
      notASellRule: "This is not evidence for a sell rule.",
    },
    vix: { status: "data unavailable" },
    marketMatch: { n: matched, events: events.length },
    links: result.links,
    trendLinks: result.trendLinks,
    trend: result.trend,
    positionLinks: result.positionLinks,
    position: result.position,
    market: result.market,
    relative: result.relative,
    context: result.context,
    factors: result.factors,
    grids: result.grids,
    relations: result.relations,
    periods: result.periods,
    leaveOne: { absolute: slimLeave(result.leaveOne.absolute), relative: slimLeave(result.leaveOne.relative) },
    extremes: result.extremes,
    hypotheses: result.hypotheses,
    structure: result.structure,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("ATR meaning v14 — research only, selectedStrategy null")
  console.log("baseline", result.links.lowWindow.rho, result.links.lowT10.rho, result.links.lowT20.rho, result.links.hit10.rho)
  console.log("market match", matched, "vix unavailable")
  console.log("H1", result.hypotheses.h1, "H4", result.hypotheses.h4, "H5", result.hypotheses.h5, "structure", result.structure.label)
  const show = (name, block) => {
    for (const [model, fit] of Object.entries(block.models)) {
      console.log(name, model, "n", fit.n, "r2", fit.r2, "adj", fit.adjustedR2, "atr", fit.beta.atrPct, "extra", JSON.stringify(fit.beta))
    }
  }
  show("ret20", result.trend.ret20)
  show("ret60", result.trend.ret60)
  show("ret120", result.trend.ret120)
  show("pos60", result.position.pos60)
  show("pos120", result.position.pos120)
  show("spyAtr", result.market.spyAtr)
  show("spyVol", result.market.spyVol)
  show("relative", result.relative)
  show("context", result.context)
  console.log("factors", JSON.stringify(result.factors))
  console.log("relations", JSON.stringify(result.relations))
  console.log("leave", JSON.stringify(doc.leaveOne))
  for (const key of ["all", "dropHigh1", "dropHigh3", "dropHigh5"]) {
    const row = result.extremes[key]
    console.log("extreme", key, row.absolute.lowWindow.rho, row.relative.lowWindow.rho, row.relative.hit10.rho)
  }
}

main()
