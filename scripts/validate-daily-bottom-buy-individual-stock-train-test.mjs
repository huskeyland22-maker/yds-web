#!/usr/bin/env node
/**
 * Individual-stock DBB train/test diagnostic (research only).
 *   node scripts/validate-daily-bottom-buy-individual-stock-train-test.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  TRAIN_RATIO,
  analyzeSymbolTrainTest,
  assertNoEtfInStudyUniverse,
  msftCase,
  poolTrainTest,
  summarizeLate,
} from "./lib/daily-bottom-buy-individual-stock-train-test-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-individual-stock-train-test-result.json")

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
  console.log("Individual-stock train/test. Frozen 3/4 vs first trailing -10% cross.")
  const bench = { spy: closeMap(loadCached("SPY")), qqq: closeMap(loadCached("QQQ")) }
  const analyzed = []
  for (const meta of EQUITY_CANDIDATES) {
    const bars = loadCached(meta.yahoo)
    const row = analyzeSymbolTrainTest(meta, bars, bench)
    console.log(`  ${meta.symbol}: ${row.status} baseline=${row.baseline.length} depth10=${row.depth10.length}`)
    analyzed.push(row)
  }
  const pooled = poolTrainTest(analyzed)
  const late = summarizeLate(analyzed)
  const msft = msftCase(loadCached("MSFT"), bench)
  const doc = {
    generatedAt: new Date().toISOString(),
    study: "Individual-stock baseline 3/4 versus depth/ATR/RS axes, chronological 70/30",
    disclaimer: {
      researchOnly: true,
      strategyUnchanged: true,
      thresholds: FROZEN_THRESHOLDS,
      trainRatio: TRAIN_RATIO,
      split: "Per symbol, first 70% of bars are train. Entry index decides the side. Not a random split. Thresholds are not refit.",
      modelA: "First rising-edge count>=3 inside the existing episode window.",
      modelB: "First day trailing 120-session high drawdown is -10% or deeper. ATR bands describe that day. ATR is not a buy signal.",
      modelC: "The same -10% entries split by SPY 120-day relative strength. QQQ is not used.",
      deeperBands: "Later -15/-20/-25/-30 touches are a late-entry description, not a searched entry.",
      regime: "UP/DOWN/NEUTRAL is recorded only. DOWN requires MA200 slope < 0.",
      judgment: "A/B/C/D compares the full -10% book with the 3/4 book. It does not pick the ATR cell with the smallest MAE.",
    },
    ...pooled,
    lateEntry: late,
    msft2026: msft,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc), "utf8")
  console.log(`Wrote ${OUT_JSON}`)
  console.log(JSON.stringify(pooled.counts))
  console.log("judgment", pooled.judgment.code)
}

main()
