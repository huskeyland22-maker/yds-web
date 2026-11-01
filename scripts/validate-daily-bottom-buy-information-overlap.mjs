#!/usr/bin/env node
/**
 * Information-overlap diagnostic (research only).
 *   node scripts/validate-daily-bottom-buy-information-overlap.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  analyzeInformation,
  analyzeSymbolInfo,
  assertNoEtfInStudyUniverse,
  msftPlacement,
} from "./lib/daily-bottom-buy-information-overlap-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-information-overlap-result.json")

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
  console.log("Information-overlap diagnostic. 48 names. Same 120d episodes.")
  const bench = { spy: closeMap(loadCached("SPY")), qqq: closeMap(loadCached("QQQ")) }
  const analyzed = []
  for (const meta of EQUITY_CANDIDATES) {
    const bars = loadCached(meta.yahoo)
    if (!bars?.length) {
      console.log(`  ${meta.symbol}: data unavailable`)
      continue
    }
    const row = analyzeSymbolInfo(meta, bars, bench)
    console.log(`  ${meta.symbol}: episodes=${row.episodes.length}`)
    analyzed.push(row)
  }
  const pooled = analyzeInformation(analyzed)
  const { rowsForPercentile, ...rest } = pooled
  const msft = msftPlacement(loadCached("MSFT"), bench, rowsForPercentile)
  const doc = {
    generatedAt: new Date().toISOString(),
    study: "Overlap and incremental information of correction variables",
    disclaimer: {
      strategyUnchanged: true,
      thresholds: FROZEN_THRESHOLDS,
      newBuyRulesAdopted: false,
      bucketsNotOptimized: true,
      episodeDef: "120d rolling high, first -5% close, frozen peak, end at 2% recovery or 252 sessions",
      atrContrast: "low ATR% < 3, high ATR% >= 4",
      infoLevelRule: "A if MAE gap stays >=2 points in one direction on every stage with n>=30 both sides (at least two stages). C if no such gap. Else B. Descriptive only.",
      etfStudyExcluded: true,
    },
    totals: {
      requested: EQUITY_CANDIDATES.length,
      withData: analyzed.length,
      episodes: rest.nEpisodes,
      stageRows: rest.nStageRows,
      atMinus10: rest.nAt10,
    },
    ...rest,
    msft2026: msft,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc), "utf8")
  console.log(`Wrote ${OUT_JSON}`)
  console.log(`episodes=${rest.nEpisodes} at-10=${rest.nAt10}`)
}

main()
