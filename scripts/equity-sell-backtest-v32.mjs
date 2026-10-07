#!/usr/bin/env node
/**
 * Score T+5 observables against later buy-and-hold results.
 *
 *   node scripts/equity-sell-backtest-v32.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v31.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  SELECTED_STRATEGY,
  assertBaseline,
  assertEventList,
  assertV18Split,
  attachEarly,
  attachForward,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  auditDecisionLookAhead,
  loadOhlcv,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v32.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v32-result.json")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty cache ${symbol}`)
  return loadOhlcv(bars)
}

function main() {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  if (EQUITY_SELL_RESEARCH_UNIVERSE.length !== 31) throw new Error("research universe changed")
  const v6 = JSON.parse(fs.readFileSync(V6_JSON, "utf8"))
  const selected = selectMildEvents(v6.events)
  const needed = [...new Set(selected.map((event) => event.ticker))]
  const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
  const spy = loadSeries("SPY")
  const held = attachHold(attachRegime(attachSplit(selected, series, spy), spy), series)
  assertBaseline(held)
  const early = attachEarly(attachShape(held, series))
  assertEventList(early)
  assertV18Split(early)
  const events = attachForward(early, series)
  const audit = auditDecisionLookAhead(events, series)
  if (!audit.ok || audit.violations !== 0) throw new Error("look-ahead audit failed")
  const result = study(events, series, { lookAheadViolations: audit.violations })
  const doc = {
    selectedStrategy: SELECTED_STRATEGY,
    note: result.note,
    baseline: {
      events: events.length,
      states: result.states,
      bands: events.bandCounts,
      groups: {
        HIGH: events.filter((event) => event.leadershipGroup === "HIGH").length,
        MID: events.filter((event) => event.leadershipGroup === "MID").length,
        LOW: events.filter((event) => event.leadershipGroup === "LOW").length,
      },
    },
    ...result,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("baseline", doc.baseline)
  console.log("judgment", doc.judgment)
  console.log("levels", JSON.stringify(doc.levels))
  console.log("failure", JSON.stringify(doc.failure))
  for (const key of ["t0", "leadership", "eventAtr", "withinAtr", "returnT5", "fromMae", "maeT5", "correctionSpeed", "ret20", "spyRet20"]) {
    const row = doc.univariate[key]
    console.log(key, "W", row.window?.rho, row.window?.ci95, "p", row.window?.permutationTail, "T20", row.t20?.rho, "tail20", row.tail20?.rho, "oos", doc.cards.find((card) => card.id === key))
  }
  console.log("lookahead", doc.lookAhead.violations, "identities", doc.identities.checked, doc.identities.maxAbsError)
}

main()
