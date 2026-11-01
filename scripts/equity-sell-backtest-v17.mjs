#!/usr/bin/env node
/**
 * Does the ATR association change with the SPY state known on the correction close?
 *
 *   node scripts/equity-sell-backtest-v17.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v16.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { attachRegime, attachSplit, loadOhlcv, selectMildEvents, study, SELECTED_STRATEGY } from "./lib/equity-sell-backtest-v17.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v17-result.json")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty cache ${symbol}`)
  return loadOhlcv(bars)
}

function strategyOf(doc) {
  return doc.selectedStrategy === undefined ? doc.metadata?.selectedStrategy : doc.selectedStrategy
}

function brief(fit) {
  if (!fit) return null
  return {
    n: fit.n,
    r2: fit.r2,
    adjustedR2: fit.adjustedR2,
    standardizedBeta: fit.standardizedBeta,
    rawCoefficient: fit.rawCoefficient,
    vif: fit.vif,
  }
}

function packInteraction(block) {
  return { base: brief(block.base), interaction: brief(block.interaction) }
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
  const events = attachRegime(attachSplit(selected, series, loadSeries("SPY")), loadSeries("SPY"))
  const result = study(events)
  const matrix = {}
  for (const atrKey of ["atrPct", "withinAtr"]) {
    matrix[atrKey] = {}
    for (const marketKey of ["spyRet20", "spyRet60", "spyAtr", "spyVol20"]) matrix[atrKey][marketKey] = packInteraction(result.windowMatrix[atrKey][marketKey])
  }
  const doc = {
    metadata: {
      researchOnly: true,
      selectedStrategy: SELECTED_STRATEGY,
      productionApplied: false,
      question: "Does the observed association between ATR and the later rebound change with the SPY state known on the correction close?",
      market: "SPY return, moving-average distance, ATR/price, and realized volatility use the SPY close on the correction date and earlier SPY bars only. No later bar is used.",
      centering: "ATR and the market variable are centered inside each regression sample before their product is formed. The ATR slope then refers to an average market state.",
      vix: "No daily VIX series is stored with the research bars, so VIX is excluded rather than filled.",
      notASellRule: "This checks whether the observed ATR association differs across market states. It is not a buy or sell signal.",
    },
    groups: result.groups,
    periods: result.periods,
    models: matrix,
    t20: {
      event20: packInteraction(result.t20Matrix.atrPct.spyRet20),
      within20: packInteraction(result.t20Matrix.withinAtr.spyRet20),
      eventVol: packInteraction(result.t20Matrix.atrPct.spyAtr),
      withinVol: packInteraction(result.t20Matrix.withinAtr.spyAtr),
    },
    timing: {
      event20: packInteraction(result.timingMatrix.atrPct.spyRet20),
      within20: packInteraction(result.timingMatrix.withinAtr.spyRet20),
    },
    leave: {
      event: result.leave.atrPct,
      within: result.leave.withinAtr,
    },
    extremes: {
      dropHigh1: result.extremes.dropHigh1.within,
      dropHigh3: result.extremes.dropHigh3.within,
      dropHigh5: result.extremes.dropHigh5.within,
    },
    judgment: result.judgment,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("ATR regime v17 — research only, selectedStrategy null")
  console.log("judgment", result.judgment.label, result.judgment.text, result.judgment.confirmed)
  const line = (label, block) => {
    const fit = block.interaction
    console.log(label, fit.n, fit.adjustedR2, "atr", fit.standardizedBeta.atr, "market", fit.standardizedBeta.market, "x", fit.standardizedBeta.interaction, "vif", JSON.stringify(fit.vif))
  }
  for (const atrKey of ["atrPct", "withinAtr"]) {
    for (const marketKey of ["spyRet20", "spyRet60", "spyAtr", "spyVol20"]) line(`${atrKey} ${marketKey}`, result.windowMatrix[atrKey][marketKey])
  }
  console.log("groups")
  for (const [name, group] of Object.entries(result.groups.groups)) console.log(name, group.n, group.event.rho, group.within.rho, group.conclusion)
  console.log("periods", JSON.stringify(result.periods))
  console.log("t20 event", result.t20Matrix.atrPct.spyRet20.interaction.n, result.t20Matrix.atrPct.spyRet20.interaction.standardizedBeta)
  console.log("t20 within", result.t20Matrix.withinAtr.spyRet20.interaction.standardizedBeta)
  console.log("timing", result.timingMatrix.atrPct.spyRet20.interaction.n, result.timingMatrix.atrPct.spyRet20.interaction.standardizedBeta, result.timingMatrix.withinAtr.spyRet20.interaction.standardizedBeta)
  console.log("leave", result.leave.atrPct.min, result.leave.atrPct.max, result.leave.withinAtr.min, result.leave.withinAtr.max, result.leave.withinAtr.signFlips)
  console.log("extreme", result.extremes.dropHigh1.within.rho, result.extremes.dropHigh3.within.rho, result.extremes.dropHigh5.within.rho)
}

main()
