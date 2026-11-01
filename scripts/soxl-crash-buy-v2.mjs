#!/usr/bin/env node
/**
 * SOXL trend-switch C and selective-order D study (research only).
 *
 *   node scripts/soxl-crash-buy-v2.mjs
 *
 * Reads the v1 SOXL cache and the existing SMH cache. Writes only
 * scripts/.cache/soxl-crash-buy-v2-result.json.
 * Does not modify v1 results, dbb-* caches, or ETF sell v1–v9 results.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { LIMIT_FACTORS } from "./lib/soxl-crash-buy-v1.mjs"
import {
  EVAL_START,
  SELECTED_STRATEGY,
  TRAIN_END,
  alignSoXlSmh,
  buildFixedOrders,
  buildFlags,
  buildResearchOrders,
  freezeThresholds,
  indexOnOrBefore,
  summarizeResearchOrders,
} from "./lib/soxl-crash-buy-v2.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const SOXL_PATH = path.join(CACHE, "soxl-crash-buy-v1-daily-ohlcv.json")
const SMH_PATH = path.join(CACHE, "dbb-smh-daily-ohlcv.json")
const RESULT_PATH = path.join(CACHE, "soxl-crash-buy-v2-result.json")

function assertOwnPath(filePath) {
  const base = path.basename(filePath)
  if (base.startsWith("dbb-") || base.includes("etf-sell-backtest") || base.includes("soxl-crash-buy-v1")) {
    throw new Error(`refusing to write protected cache ${base}`)
  }
}

function readBars(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"))
  if (Array.isArray(parsed)) return parsed
  if (Array.isArray(parsed?.bars)) return parsed.bars
  throw new Error(`no bars in ${path.basename(filePath)}`)
}

function block(rows, orders) {
  const trainLast = indexOnOrBefore(rows, TRAIN_END)
  return {
    train: summarizeResearchOrders(rows, orders, { end: TRAIN_END, lastIndex: trainLast }),
    eval: summarizeResearchOrders(rows, orders, { start: EVAL_START }),
  }
}

function main() {
  assertOwnPath(RESULT_PATH)
  const rows = alignSoXlSmh(readBars(SOXL_PATH), readBars(SMH_PATH))
  const thresholds = freezeThresholds(rows)
  const flags = buildFlags(rows, thresholds)
  const ready = flags.filter((flag) => flag.ready).length
  const result = {
    researchOnly: true,
    selectedStrategy: SELECTED_STRATEGY,
    reproducesDiscretionaryStrategy: false,
    ruleSelection: "Indicator quantiles were frozen on sessions through 2022-09-30. Strategy returns were not used to choose C or D.",
    implemented: ["C", "D"],
    comparison: ["A", "B"],
    notASellRule: true,
    sample: {
      first: rows[0]?.date ?? null,
      last: rows.at(-1)?.date ?? null,
      sessions: rows.length,
      readySessions: ready,
      soxlCache: "soxl-crash-buy-v1-daily-ohlcv.json",
      smhCache: "dbb-smh-daily-ohlcv.json",
    },
    thresholds,
    rules: {
      deterioration:
        "SOXL close < SOXL SMA50, SMH close < SMH SMA50, and SOXL 20-session close drawdown <= the train 25th percentile.",
      anticipation: "SOXL 5-session return <= the train 25th percentile. This flag does not require deterioration.",
      C: "Every ready session orders the next session: -15% when deterioration is true, otherwise -10%.",
      D: "Order the next session only when anticipation is true. If deterioration is also true, cancel the -10% order and submit -15%. Both decisions use the close of T and are valid on T+1.",
    },
    strategies: {
      C: {
        base: block(rows, buildResearchOrders(rows, flags, "C", "base")),
        conservative: block(rows, buildResearchOrders(rows, flags, "C", "conservative")),
      },
      D: {
        base: block(rows, buildResearchOrders(rows, flags, "D", "base")),
        conservative: block(rows, buildResearchOrders(rows, flags, "D", "conservative")),
      },
      A: {
        base: block(rows, buildFixedOrders(rows, flags, LIMIT_FACTORS.A, "base")),
        conservative: block(rows, buildFixedOrders(rows, flags, LIMIT_FACTORS.A, "conservative")),
      },
      B: {
        base: block(rows, buildFixedOrders(rows, flags, LIMIT_FACTORS.B, "base")),
        conservative: block(rows, buildFixedOrders(rows, flags, LIMIT_FACTORS.B, "conservative")),
      },
    },
  }
  fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2))
  console.log(
    JSON.stringify({
      sessions: rows.length,
      first: result.sample.first,
      last: result.sample.last,
      drawdownMax: thresholds.drawdownMax,
      return5Max: thresholds.return5Max,
      trainN: thresholds.trainDrawdownN,
      wrote: path.basename(RESULT_PATH),
    }),
  )
}

main()
