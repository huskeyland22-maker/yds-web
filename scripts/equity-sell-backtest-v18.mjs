#!/usr/bin/env node
/**
 * Do the stored ATR relationships score later correction events?
 *
 *   node scripts/equity-sell-backtest-v18.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v17.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { SELECTED_STRATEGY, assertBaseline, attachRegime, attachSplit, loadOhlcv, selectMildEvents, study } from "./lib/equity-sell-backtest-v18.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v18-result.json")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty cache ${symbol}`)
  return loadOhlcv(bars)
}

function strategyOf(doc) {
  return doc.selectedStrategy === undefined ? doc.metadata?.selectedStrategy : doc.selectedStrategy
}

function packSplit(split) {
  const models = {}
  for (const [id, block] of Object.entries(split.models)) {
    models[id] = {}
    for (const outcome of ["lowWindow", "lowT20", "hitTiming"]) {
      const fit = block[outcome]
      models[id][outcome] = fit ? { train: fit.train, test: fit.test } : null
    }
  }
  return {
    trainN: split.trainN,
    testN: split.testN,
    target: split.target,
    trainTickers: split.trainTickers,
    testTickers: split.testTickers,
    sharedTickers: split.sharedTickers,
    trainStart: split.trainStart,
    trainEnd: split.trainEnd,
    testStart: split.testStart,
    testEnd: split.testEnd,
    testRegime: split.testRegime,
    models,
    classification: split.classification,
    permutation: split.permutation,
    periodB: split.periodB,
  }
}

function line(label, fit) {
  if (!fit) return console.log(label, "unavailable")
  const test = fit.test
  console.log(label, "trainN", fit.train.n, "adj", fit.train.adjustedR2, "dir", fit.train.direction, "oos", test.oosR2, "pearson", test.pearson, "rho", test.spearman, "mae", test.mae, "rmse", test.rmse, "n", test.n)
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
  const spy = loadSeries("SPY")
  const events = attachRegime(attachSplit(selected, series, spy), spy)
  assertBaseline(events)
  const result = study(events)
  const doc = {
    metadata: {
      researchOnly: true,
      selectedStrategy: SELECTED_STRATEGY,
      productionApplied: false,
      question: "Do the ATR, leadership, T0, and SPY-regime associations estimated on earlier correction events score later correction events?",
      split: "Events are ordered by correction date. A whole date stays in one side. The boundary date stays in the later side when adding it would pass the rounded train count. The later half is never used as the training side.",
      scaling: "Interaction products use train means. Column means and standard deviations used for coefficient scaling are estimated on the train rows and applied to the test rows. Test coefficients are not refit.",
      benchmark: "Out-of-sample R² is 1 - SSE(model) / SSE(test mean). A negative value is kept.",
      dependence: "This is event-level out-of-sample validation. It does not treat the events as independent across tickers.",
      notASellRule: "A score on later events is not a buy or sell rule.",
    },
    splits: Object.fromEntries(Object.entries(result.splits).map(([name, split]) => [name, packSplit(split)])),
    judgment: result.judgment,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("ATR out-of-sample v18 — research only, selectedStrategy null")
  console.log("judgment", result.judgment.label, result.judgment.text)
  for (const name of ["70", "60", "50"]) {
    const split = result.splits[name]
    console.log("split", name, split.trainN, split.testN, split.trainStart, split.trainEnd, split.testStart, split.testEnd, "tickers", split.trainTickers, split.testTickers, "shared", split.sharedTickers)
    console.log("regime", JSON.stringify(split.testRegime))
    for (const id of ["M0", "A", "B", "C", "D"]) line(`${name} ${id} window`, split.models[id].lowWindow)
    for (const id of ["A", "B", "C", "D"]) line(`${name} ${id} t20`, split.models[id].lowT20)
    for (const id of ["A", "B", "C", "D"]) line(`${name} ${id} timing`, split.models[id].hitTiming)
    for (const id of ["A", "B", "C", "D", "E"]) {
      const row = split.classification[id]
      console.log(`${name} class ${id}`, row ? JSON.stringify(row.test) : "unavailable", "converged", row?.converged)
    }
    console.log("perm", JSON.stringify(split.permutation))
    console.log("periodB", JSON.stringify(split.periodB))
  }
}

main()
