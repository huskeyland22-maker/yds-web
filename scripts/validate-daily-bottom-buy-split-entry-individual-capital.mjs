#!/usr/bin/env node
/**
 * 100% planned-capital split comparison (research only).
 *   node scripts/validate-daily-bottom-buy-split-entry-individual-capital.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  CAPITAL_SCHEMES,
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  HORIZON,
  TRAIN_RATIO,
  analyzeSplitEntrySymbol,
  assertNoEtfInStudyUniverse,
  poolCapital,
} from "./lib/daily-bottom-buy-split-entry-individual-capital-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-split-entry-individual-capital-result.json")

function loadCached(yahoo) {
  const cp = path.join(BAR_DIR, `${yahoo.replace(/[^A-Za-z0-9.-]/g, "_")}.json`)
  if (!fs.existsSync(cp)) return null
  const raw = JSON.parse(fs.readFileSync(cp, "utf8"))
  return Array.isArray(raw.bars) ? raw.bars : null
}

function main() {
  assertNoEtfInStudyUniverse()
  console.log("Capital-weighted split comparison. 48 names. Cash earns 0%.")
  const blocks = []
  for (const meta of EQUITY_CANDIDATES) {
    const row = analyzeSplitEntrySymbol(meta, loadCached(meta.yahoo))
    console.log(`  ${meta.symbol}: ${row.status} n=${row.episodes.length}`)
    blocks.push(row)
  }
  const pooled = poolCapital(blocks)
  const doc = {
    generatedAt: new Date().toISOString(),
    study: "Individual-stock split entry marked on 100% of planned capital",
    method: {
      universe: "Existing 48 single names. Same rising-edge 3/4 episodes, including a day that already opens at 4/4.",
      horizon: HORIZON,
      trainRatio: TRAIN_RATIO,
      thresholds: FROZEN_THRESHOLDS,
      schemes: CAPITAL_SCHEMES.map((s) => ({ id: s.id, label: s.label, weights: s.weights, rule: s.rule })),
      returnBasis: "Starting NAV is 1.00 of the planned budget. Each filled tranche earns close-to-close from its own fill close. Weight that is still cash earns 0. A 50% position and a +20% stock move is a +10% portfolio return.",
      fill: "The first later close at or below the Day0 line. An intraday low does not fill. A later lower close is not substituted once an earlier close has already crossed.",
      sameDay: "If one close is already through both -5% and -10%, D fills both 25% tranches at that close.",
      completion: "100% means the scheduled weights sum to the full budget inside 60 sessions. Days-to-full mean and median are among completed episodes only. The baseline never completes.",
      deployed: "Deployed percent is the weight filled by day 60. Cash percent is 100 minus that weight.",
      atr: "Bands stay <3, 3–4, >=4. They are not refit.",
      selection: "Test is reported beside Train and is not used to choose a line or a weight.",
    },
    disclaimer: {
      researchOnly: true,
      productionUnchanged: true,
      etfExcluded: true,
    },
    coverage: pooled.coverage,
    strategies: pooled.strategies,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc))
  console.log(`Wrote ${OUT_JSON}`)
  console.log(JSON.stringify(pooled.coverage))
}

main()
