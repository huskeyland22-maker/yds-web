#!/usr/bin/env node
/**
 * Test whether T0, Event ATR, and SPY ATR still add hold information
 * after the other two are held fixed.
 *
 *   node scripts/equity-sell-backtest-v33.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v32.
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
} from "./lib/equity-sell-backtest-v33.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v33-result.json")

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
  const result = study(events, series, { lookAheadViolations: audit.violations, spy })
  const doc = {
    selectedStrategy: SELECTED_STRATEGY,
    note: result.note,
    baseline: {
      events: events.length,
      states: result.states,
    },
    ...result,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("judgment", doc.judgment)
  for (const id of ["M0", "M1", "M2", "M3", "M4"]) {
    const model = doc.models[id]
    console.log(id, "in", model.inSample?.r2, "50", model.splits["50"].test?.r2, "60", model.splits["60"].test?.r2, "70", model.splits["70"].test?.r2)
  }
  for (const [id, step] of Object.entries(doc.steps)) {
    console.log(id, "ind", step.independent, "hurts", step.hurts, "r2", step.r2ImproveSplits, "rho", step.spearmanPositiveSplits, "mae", step.meanDeltaMae, "above", step.intervalAbove, "loo", step.looHeld, "pool", step.pooled?.deltaR2, step.pooled?.deltaR2Ci)
  }
  console.log("lookahead", doc.lookAhead.violations, "identities", doc.identities.checked, doc.identities.maxAbsError)
}

main()
