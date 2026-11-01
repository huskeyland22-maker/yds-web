#!/usr/bin/env node
/**
 * ATR second-entry diagnostic after unchanged 3/4 signals (research only).
 *   node scripts/validate-daily-bottom-buy-atr-split-entry.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  TRAIN_RATIO,
  analyzeAtrSplitSymbol,
  assertNoEtfInStudyUniverse,
  msftAtrCase,
  poolAtrSplit,
} from "./lib/daily-bottom-buy-atr-split-entry-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-atr-split-entry-result.json")

function loadCached(yahoo) {
  const cp = path.join(BAR_DIR, `${yahoo.replace(/[^A-Za-z0-9.-]/g, "_")}.json`)
  if (!fs.existsSync(cp)) return null
  const raw = JSON.parse(fs.readFileSync(cp, "utf8"))
  return Array.isArray(raw.bars) ? raw.bars : null
}

function closeMap(bars) {
  const m = new Map()
  if (!bars) return m
  for (const b of bars) m.set(b.date, b.close)
  return m
}

function main() {
  assertNoEtfInStudyUniverse()
  console.log("ATR split-entry diagnostic. 3/4 unchanged. Fixed 50/50.")
  const bench = { spy: closeMap(loadCached("SPY")), qqq: closeMap(loadCached("QQQ")) }
  const analyzed = []
  for (const meta of EQUITY_CANDIDATES) {
    const row = analyzeAtrSplitSymbol(meta, loadCached(meta.yahoo), bench)
    console.log(`  ${meta.symbol}: ${row.status} n=${row.rows.length}`)
    const { bars, ...rest } = row
    void bars
    analyzed.push(rest)
  }
  const pooled = poolAtrSplit(analyzed)
  const doc = {
    generatedAt: new Date().toISOString(),
    study: "Unchanged 3/4 plus a fixed 50/50 second entry on a later close drop, described by ATR",
    disclaimer: {
      researchOnly: true,
      strategyUnchanged: true,
      thresholds: FROZEN_THRESHOLDS,
      trainRatio: TRAIN_RATIO,
      atrBands: "<3, 3–4, >=4. Not refit.",
      weights: "50/50 is a comparison assumption. No weight was chosen.",
      secondEntry: "First later close at or below -10% or -15% of the 3/4 close, inside 60 sessions. Otherwise the second half stays cash.",
      mae: "Path MAE uses the low. The second-entry trigger uses the close. Portfolio MAE marks the unfilled half as cash and does not give the second tranche that day's low.",
    },
    ...pooled,
    msft2026: msftAtrCase(loadCached("MSFT"), bench),
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc), "utf8")
  console.log(`Wrote ${OUT_JSON}`)
  console.log(JSON.stringify(pooled.counts), pooled.judgment.code)
}

main()
