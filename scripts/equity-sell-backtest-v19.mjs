#!/usr/bin/env node
/**
 * Does Event ATR still explain the later rebound after recent volatility?
 *
 *   node scripts/equity-sell-backtest-v19.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v18.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  SELECTED_STRATEGY,
  assertBaseline,
  attachRegime,
  attachSplit,
  attachStockVol,
  loadOhlcv,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v19.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v19-result.json")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty cache ${symbol}`)
  return loadOhlcv(bars)
}

function strategyOf(doc) {
  return doc.selectedStrategy === undefined ? doc.metadata?.selectedStrategy : doc.selectedStrategy
}

function fmt(row) {
  if (!row?.test) return "unavailable"
  const test = row.test
  const beta = row.train.standardizedBeta?.eventAtr
  return `n ${test.n} oos ${test.oosR2} pearson ${test.pearson} rho ${test.spearman} mae ${test.mae} rmse ${test.rmse} atrBeta ${beta ?? "-"} dir ${row.train.direction}`
}

function fmtDelta(row) {
  if (!row) return "unavailable"
  return `dR2 ${row.deltaR2} dRho ${row.deltaSpearman} dP ${row.deltaPearson} dMAE ${row.deltaMae} dRMSE ${row.deltaRmse}`
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
  series.set("SPY", loadSeries("SPY"))
  const spy = series.get("SPY")
  const events = attachStockVol(attachRegime(attachSplit(selected, series, spy), spy), series)
  assertBaseline(events)
  const result = study(events)
  const doc = {
    selectedStrategy: SELECTED_STRATEGY,
    note: "Research only. Not a sell rule.",
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
  console.log("events", doc.baseline.events, "low", doc.baseline.lowEvents, "groups", doc.baseline.groups, "bands", doc.baseline.bands)
  for (const name of ["70", "60", "50"]) {
    console.log(`\n[${name}]`, doc.splits[name].trainStart, doc.splits[name].trainEnd, "->", doc.splits[name].testStart, doc.splits[name].testEnd, "n", doc.splits[name].trainN, doc.splits[name].testN)
    for (const id of ["M0", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9"]) {
      console.log(id, fmt(doc.splits[name].models[id].lowWindow))
    }
    for (const [id, row] of Object.entries(doc.splits[name].compare)) console.log(id, fmtDelta(row))
    console.log("perm M2", doc.splits[name].permutation.M2, "M4", doc.splits[name].permutation.M4)
  }
  console.log("\ncorrelation", JSON.stringify(doc.correlation.matrix))
  console.log("vif M4", JSON.stringify(doc.vif.M4))
  console.log("vif M5", JSON.stringify(doc.vif.M5))
  console.log("vif M7", JSON.stringify(doc.vif.M7))
  console.log("robust", JSON.stringify(doc.robustness))
  console.log("periods", JSON.stringify(doc.periods))
  console.log("judgment", doc.judgment.label)
  console.log("selectedStrategy", doc.selectedStrategy)
}

main()
