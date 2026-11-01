#!/usr/bin/env node
/**
 * Recovery-signal diagnostic after unchanged 3/4 days (research only).
 *   node scripts/validate-daily-bottom-buy-recovery-signals.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  TRAIN_RATIO,
  analyzeRecoverySymbol,
  assertNoEtfInStudyUniverse,
  msftRecoveryCase,
  poolRecovery,
} from "./lib/daily-bottom-buy-recovery-signals-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-recovery-signals-result.json")

function loadCached(yahoo) {
  const cp = path.join(BAR_DIR, `${yahoo.replace(/[^A-Za-z0-9.-]/g, "_")}.json`)
  if (!fs.existsSync(cp)) return null
  const raw = JSON.parse(fs.readFileSync(cp, "utf8"))
  return Array.isArray(raw.bars) ? raw.bars : null
}

function main() {
  assertNoEtfInStudyUniverse()
  console.log("Recovery-signal diagnostic. 3/4 unchanged. No composite score.")
  const analyzed = []
  for (const meta of EQUITY_CANDIDATES) {
    const row = analyzeRecoverySymbol(meta, loadCached(meta.yahoo))
    console.log(`  ${meta.symbol}: ${row.status} n=${row.rows.length}`)
    analyzed.push(row)
  }
  const pooled = poolRecovery(analyzed)
  const doc = {
    generatedAt: new Date().toISOString(),
    study: "First causal recovery flag in the 30 sessions after an unchanged 3/4 day",
    disclaimer: {
      researchOnly: true,
      strategyUnchanged: true,
      thresholds: FROZEN_THRESHOLDS,
      trainRatio: TRAIN_RATIO,
      window: "Day +1 through day +30. Day 0 is not a signal. One first print per signal per episode.",
      evaluation: "Forward path starts on the signal day. Missed episodes are evaluated from day 0. The later low is not an input.",
      atr: "Day-0 ATR band is a label only. Bands remain <3, 3–4, >=4.",
      noComposite: true,
    },
    ...pooled,
    msft2026: msftRecoveryCase(loadCached("MSFT")),
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc), "utf8")
  console.log(`Wrote ${OUT_JSON}`)
  console.log(JSON.stringify(pooled.counts), pooled.judgment.code)
}

main()
