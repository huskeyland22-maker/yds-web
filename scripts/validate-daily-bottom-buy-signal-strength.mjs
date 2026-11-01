#!/usr/bin/env node
/**
 * YDS Daily Bottom Buy — signal strength validation (observation only).
 *
 *   node scripts/validate-daily-bottom-buy-signal-strength.mjs
 *
 * Writes scripts/.cache/yds-daily-bottom-buy-signal-strength-result.json
 * Does not change strategy / thresholds / universe / UI / API.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  SPLIT_SIM_STUDY_ETFS,
  FROZEN_THRESHOLDS,
  analyzeEtfSignalStrength,
  poolSignalStrength,
} from "./lib/daily-bottom-buy-signal-strength-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const OUT_JSON = path.join(CACHE, "yds-daily-bottom-buy-signal-strength-result.json")

function loadBars(symbol) {
  const cp = path.join(CACHE, `dbb-${symbol.toLowerCase()}-daily-ohlcv.json`)
  if (!fs.existsSync(cp)) throw new Error(`Missing cache ${cp}`)
  return JSON.parse(fs.readFileSync(cp, "utf8")).bars
}

function main() {
  console.log("DBB signal-strength validation (historical 10-ETF Test)…")
  console.log("Score is analytical only — NOT a buy signal. No threshold optimization.")

  const etfs = []
  for (const meta of SPLIT_SIM_STUDY_ETFS) {
    const r = analyzeEtfSignalStrength(meta, loadBars(meta.symbol))
    etfs.push(r)
    console.log(`  ${meta.symbol}: n=${r.episodeCount} →4=${r.reached4Count}`)
  }

  const pooled = poolSignalStrength(etfs)

  const doc = {
    generatedAt: new Date().toISOString(),
    study: "Signal strength vs forward return / MAE (observation only)",
    disclaimer: {
      purpose: "강도별 성과 관찰. 전략 변경 결과 아님.",
      validationUniverse: SPLIT_SIM_STUDY_ETFS.map((e) => e.symbol),
      productionUniverseSeparate: true,
      thresholds: FROZEN_THRESHOLDS,
      thresholdsOptimized: false,
      strategyUnchanged: true,
      scoreIsNotBuySignal: true,
    },
    totals: {
      episodeCount: pooled.nAll,
      nExact3: pooled.nExact3,
      reached4Count: pooled.nReached4,
      nFullHorizon60: pooled.nFullHorizon60,
    },
    classificationMethod: pooled.classificationMethod,
    strengthRef: pooled.strengthRef,
    group3: pooled.group3,
    group4: pooled.group4,
    correlations: pooled.correlations,
    scoreBuckets: pooled.scoreBuckets,
    etfByStrength: pooled.etfByStrength,
    focusEtfDetail: pooled.focusEtfDetail,
    failures: {
      counts: {
        A_strong3_maeGe10: pooled.failures.A_strong3_maeGe10.length,
        B_strong3_d60LeNeg10: pooled.failures.B_strong3_d60LeNeg10.length,
        C_strong4_maeGe10: pooled.failures.C_strong4_maeGe10.length,
        D_strong4_d60LeNeg10: pooled.failures.D_strong4_d60LeNeg10.length,
      },
      ...pooled.failures,
    },
    weakWinners: {
      counts: {
        weak3_d60Ge10: pooled.weakWinners.weak3_d60Ge10.length,
        weak3_d60Ge20: pooled.weakWinners.weak3_d60Ge20.length,
      },
      ...pooled.weakWinners,
    },
    questions: pooled.questions,
    futureDiagnosis: pooled.futureDiagnosis,
    overfitGuard: pooled.overfitGuard,
    strategyChangeDecision:
      "이번 작업에서는 전략/threshold를 수정하지 않았다. 관찰된 패턴만 기록한다.",
  }

  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2), "utf8")
  console.log(`Wrote ${OUT_JSON}`)
  console.log("Q:", JSON.stringify(pooled.questions))
  console.log(
    "3/4 groups D+60 med:",
    pooled.group3.Weak?.d60Median,
    pooled.group3.Medium?.d60Median,
    pooled.group3.Strong?.d60Median,
  )
}

main()
