#!/usr/bin/env node
/**
 * YDS Daily Bottom Buy — diagnostic validation (observation only).
 *
 *   node scripts/validate-daily-bottom-buy-diagnostic.mjs
 *
 * Same 144 Test episodes / FROZEN_THRESHOLDS. No strategy changes.
 * Writes scripts/.cache/yds-daily-bottom-buy-diagnostic-result.json
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  SPLIT_SIM_STUDY_ETFS,
  FROZEN_THRESHOLDS,
  analyzeEtfDiagnostic,
  poolDiagnostic,
} from "./lib/daily-bottom-buy-diagnostic-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const OUT_JSON = path.join(CACHE, "yds-daily-bottom-buy-diagnostic-result.json")

function loadBars(symbol) {
  const cp = path.join(CACHE, `dbb-${symbol.toLowerCase()}-daily-ohlcv.json`)
  if (!fs.existsSync(cp)) throw new Error(`Missing cache ${cp}`)
  return JSON.parse(fs.readFileSync(cp, "utf8")).bars
}

function main() {
  console.log("DBB diagnostic validation (historical 10-ETF Test)…")
  console.log("universe ≠ production 9-ETF; thresholds NOT optimized.")

  const etfs = []
  for (const meta of SPLIT_SIM_STUDY_ETFS) {
    const r = analyzeEtfDiagnostic(meta, loadBars(meta.symbol))
    etfs.push(r)
    console.log(`  ${meta.symbol}: n=${r.episodeCount} →4=${r.reached4Count}`)
  }

  const pooled = poolDiagnostic(etfs)

  const doc = {
    generatedAt: new Date().toISOString(),
    study: "DBB diagnostic — distribution quality / ETF fit / condition associations",
    disclaimer: {
      purpose: "진단 근거 수집. 전략 변경 결과가 아님.",
      validationUniverse: SPLIT_SIM_STUDY_ETFS.map((e) => e.symbol),
      productionUniverseSeparate: true,
      productionNote: "Production product list is a separate 9-ETF set.",
      thresholds: FROZEN_THRESHOLDS,
      thresholdsOptimized: false,
      strategyUnchanged: true,
    },
    totals: {
      episodeCount: pooled.n,
      reached4Count: pooled.nReached4,
      nFullHorizon60: pooled.nFullHorizon60,
      nOpenCount3: pooled.nOpenCount3,
      nOpenCount4: pooled.nOpenCount4,
    },
    distribution: pooled.distribution,
    etfTable: pooled.etfTable,
    conditionStats: pooled.conditionStats,
    combos: pooled.combos,
    strengthBands: pooled.strengthBands,
    furtherReview: pooled.furtherReview,
    refinementObservations: pooled.refinementObservations,
    etfComboNotes: pooled.etfComboNotes,
    overfitGuard: pooled.overfitGuard,
    strategyChangeDecision:
      "현재 데이터만으로 전략 수정이 필요한지 확정하지 않고, 추가 검증이 필요한 항목만 정의했다.",
  }

  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2), "utf8")
  console.log(`Wrote ${OUT_JSON}`)
  console.log(
    `D+60 mean=${pooled.distribution.d60.mean} median=${pooled.distribution.d60.median} ` +
      `fullE=${pooled.distribution.d60.variants.A_full.expectancy} ` +
      `dropTop20E=${pooled.distribution.d60.variants.C_dropTop20pct.expectancy}`,
  )
}

main()
