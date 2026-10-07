#!/usr/bin/env node
/**
 * Read stored v1–v33 equity-sell results and write the final synthesis.
 *
 *   node scripts/equity-sell-backtest-v34.mjs
 *
 * Research only. Does not refit, does not select a sell rule, and does not
 * modify v1–v33.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { SELECTED_STRATEGY, synthesize } from "./lib/equity-sell-backtest-v34.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v34-result.json")

function load(version) {
  return JSON.parse(fs.readFileSync(path.join(CACHE, `equity-sell-backtest-v${version}-result.json`), "utf8"))
}

function main() {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  const docs = {}
  for (const version of [19, 20, 24, 27, 28, 29, 30, 31, 32, 33]) docs[`v${version}`] = load(version)
  const result = synthesize(docs)
  fs.writeFileSync(OUT_JSON, JSON.stringify({ selectedStrategy: SELECTED_STRATEGY, ...result }, null, 2))
  console.log("recommendation", result.judgment.recommendation)
  console.log("sentence", result.judgment.sentence)
  console.log("gates", result.gates)
  console.log("sellEdge", result.judgment.sellEdge, "hold", result.judgment.holdSignal, "risk", result.judgment.riskControl)
  console.log("conflicts", result.baseline.conflicts.length)
  console.log("lookahead", result.lookAhead.map((item) => item.violations).join(","))
}

main()
