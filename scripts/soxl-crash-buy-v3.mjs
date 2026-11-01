#!/usr/bin/env node
/**
 * SOXL fill and capital sensitivity study (research only).
 *
 *   node scripts/soxl-crash-buy-v3.mjs
 *
 * Reads v1/v2 caches and the v2 result. Writes only
 * scripts/.cache/soxl-crash-buy-v3-result.json.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { SELECTED_STRATEGY } from "./lib/soxl-crash-buy-v1.mjs"
import { alignSoXlSmh, buildFlags, freezeThresholds } from "./lib/soxl-crash-buy-v2.mjs"
import {
  ACCOUNTING_HORIZON,
  FILL_SCENARIOS,
  INITIAL_CASH,
  MAX_POSITIONS,
  MIN_COMPARISON_N,
  PERIODS,
  applyScenario,
  holdingAccount,
  horizonAccount,
  regressionMismatches,
  strategyOrders,
  summarizePeriod,
} from "./lib/soxl-crash-buy-v3.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const RESULT_PATH = path.join(CACHE, "soxl-crash-buy-v3-result.json")

function assertOwnPath(filePath) {
  const base = path.basename(filePath)
  if (
    base.startsWith("dbb-") ||
    base.includes("etf-sell-backtest") ||
    base.includes("soxl-crash-buy-v1") ||
    base.includes("soxl-crash-buy-v2")
  ) {
    throw new Error(`refusing to write protected cache ${base}`)
  }
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(CACHE, name), "utf8"))
}

function main() {
  assertOwnPath(RESULT_PATH)
  const soxl = readJson("soxl-crash-buy-v1-daily-ohlcv.json").bars
  const smh = readJson("dbb-smh-daily-ohlcv.json").bars
  const v2 = readJson("soxl-crash-buy-v2-result.json")
  const rows = alignSoXlSmh(soxl, smh)
  const thresholds = freezeThresholds(rows)
  if (thresholds.drawdownMax !== v2.thresholds.drawdownMax || thresholds.return5Max !== v2.thresholds.return5Max) {
    throw new Error("v2 thresholds changed")
  }
  const flags = buildFlags(rows, thresholds)
  const classified = strategyOrders(rows, flags)
  const regression = {}
  for (const strategy of ["C", "D", "A", "B"]) {
    const base = summarizePeriod(rows, applyScenario(rows, classified[strategy], FILL_SCENARIOS[0]), PERIODS[0])
    const conservative = summarizePeriod(rows, applyScenario(rows, classified[strategy], FILL_SCENARIOS[3]), PERIODS[0])
    const misses = [
      ...regressionMismatches(base, v2.strategies[strategy].base.eval),
      ...regressionMismatches(conservative, v2.strategies[strategy].conservative.eval),
    ]
    if (misses.length) throw new Error(`v2 regression failed for ${strategy}`)
    regression[strategy] = { matched: true }
  }

  const sensitivity = {}
  const capital = {}
  for (const strategy of ["C", "D", "A", "B"]) {
    sensitivity[strategy] = {}
    capital[strategy] = {}
    for (const scenario of FILL_SCENARIOS) {
      const orders = applyScenario(rows, classified[strategy], scenario)
      sensitivity[strategy][scenario.id] = {}
      capital[strategy][scenario.id] = {}
      for (const period of PERIODS) {
        sensitivity[strategy][scenario.id][period.id] = summarizePeriod(rows, orders, period)
        capital[strategy][scenario.id][period.id] = {
          holdingMark: holdingAccount(rows, orders, period),
          horizonAccounting: horizonAccount(rows, orders, period, ACCOUNTING_HORIZON),
        }
      }
    }
  }

  const result = {
    researchOnly: true,
    selectedStrategy: SELECTED_STRATEGY,
    selectedByReturn: false,
    reproducesDiscretionaryStrategy: false,
    rulesRetuned: false,
    v2Regression: regression,
    assumptions: {
      thresholds: "Reused v2 freeze. Not recomputed from 2022-10-01 onward.",
      fillScenarios:
        "base, close-through, gap-only-open, and conservative are sensitivity cases. They are not estimates of the probability that a limit touch would have filled.",
      orders: "Day orders decided at close T and valid only on T+1. An unfilled order expires that session. D's -10% to -15% replacement is the single v2 order for T+1.",
      capital: `Initial cash ${INITIAL_CASH} and max concurrent positions ${MAX_POSITIONS} for A, B, C, and D. A fill spends all free cash. No order is accepted when cash is zero or a position is open.`,
      noSell:
        "No sell rule is added. holdingMark keeps the first fill to the window end and has no realized profit. horizonAccounting reassigns cash at the horizon close so another order can be funded. That reassignment is not a sale and not a tradable path.",
      periods:
        "y2022_2024 and y2025_2026 censor a horizon return when the horizon bar is after the window. The full eval window matches v2 and is not censored at 2024-12-31.",
      smallSample: `A horizon with n < ${MIN_COMPARISON_N} has comparisonDeferred true. No strategy is selected.`,
    },
    thresholds,
    periods: PERIODS,
    fillScenarios: FILL_SCENARIOS,
    sensitivity,
    capital,
  }
  fs.writeFileSync(RESULT_PATH, JSON.stringify(result))
  console.log(JSON.stringify({ wrote: path.basename(RESULT_PATH), regression }))
}

main()
