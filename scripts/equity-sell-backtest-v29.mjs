#!/usr/bin/env node
/**
 * Split a T+5 sale into avoided loss and missed gain.
 *
 *   node scripts/equity-sell-backtest-v29.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v28.
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
} from "./lib/equity-sell-backtest-v29.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v29-result.json")

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
  const result = study(events, { lookAheadViolations: audit.violations })
  const doc = {
    selectedStrategy: SELECTED_STRATEGY,
    note: result.note,
    baseline: {
      events: events.length,
      lowEvents: events.filter((event) => event.lowDay != null).length,
      groups: {
        HIGH: events.filter((event) => event.leadershipGroup === "HIGH").length,
        MID: events.filter((event) => event.leadershipGroup === "MID").length,
        LOW: events.filter((event) => event.leadershipGroup === "LOW").length,
      },
      bands: events.bandCounts,
      states: result.states,
    },
    lookAhead: audit,
    ...result,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("baseline", doc.baseline)
  console.log("judgment", doc.judgment.label)
  console.log("counts", JSON.stringify(doc.counts))
  console.log("path", JSON.stringify(doc.path))
  console.log("states", JSON.stringify(doc.byState))
  console.log("policies", JSON.stringify(doc.policies))
  console.log("boot", JSON.stringify(doc.policyBootstrap))
  console.log("lookahead", JSON.stringify(audit))
}

main()
