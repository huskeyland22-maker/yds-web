#!/usr/bin/env node
/**
 * MA20-rise risk diagnostic (research only).
 *   node scripts/validate-daily-bottom-buy-ma20-recovery-risk.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  TRAIN_RATIO,
  analyzeMa20RiskSymbol,
  assertNoEtfInStudyUniverse,
  msftMa20Case,
  poolMa20Risk,
} from "./lib/daily-bottom-buy-ma20-recovery-risk-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-ma20-recovery-risk-result.json")

function loadCached(yahoo) {
  const cp = path.join(BAR_DIR, `${yahoo.replace(/[^A-Za-z0-9.-]/g, "_")}.json`)
  if (!fs.existsSync(cp)) return null
  const raw = JSON.parse(fs.readFileSync(cp, "utf8"))
  return Array.isArray(raw.bars) ? raw.bars : null
}

function main() {
  assertNoEtfInStudyUniverse()
  console.log("MA20-rise risk diagnostic. Same 3/4. Same MA20 rule. Not a buy signal.")
  const analyzed = []
  for (const meta of EQUITY_CANDIDATES) {
    const row = analyzeMa20RiskSymbol(meta, loadCached(meta.yahoo))
    console.log(`  ${meta.symbol}: ${row.status} n=${row.rows.length}`)
    analyzed.push(row)
  }
  const pooled = poolMa20Risk(analyzed)
  const doc = {
    generatedAt: new Date().toISOString(),
    study: "Forward risk from day 0 versus from the first MA20 rise on the same 3/4 episode",
    disclaimer: {
      researchOnly: true,
      strategyUnchanged: true,
      thresholds: FROZEN_THRESHOLDS,
      trainRatio: TRAIN_RATIO,
      ma20: "MA20(t) > MA20(t-3), first time on day +1 through day +30. Not edited after results.",
      notABuy: true,
      lowIsEvaluationOnly: true,
      atrBands: "<3, 3–4, >=4 on day 0",
    },
    ...pooled,
    msft2026: msftMa20Case(loadCached("MSFT")),
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc), "utf8")
  console.log(`Wrote ${OUT_JSON}`)
  console.log(JSON.stringify(pooled.counts), "occTest", pooled.test.occ, pooled.judgment.code)
}

main()
