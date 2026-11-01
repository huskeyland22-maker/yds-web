#!/usr/bin/env node
/**
 * YDS Daily Bottom Buy — profit/loss structure validation (research only).
 *
 *   node scripts/validate-daily-bottom-buy-profit-loss.mjs
 *
 * Uses the same 144 Test episodes as split-sim (10-ETF historical validation universe).
 * Does not change strategy / thresholds / product universe / UI / API.
 * Writes scripts/.cache/yds-daily-bottom-buy-profit-loss-validation-result.json
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  SPLIT_SIM_STUDY_ETFS,
  analyzeEtfProfitLoss,
  poolProfitLossValidation,
} from "./lib/daily-bottom-profit-loss-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const OUT_JSON = path.join(CACHE, "yds-daily-bottom-buy-profit-loss-validation-result.json")
const SPLIT_CACHE = path.join(CACHE, "yds-daily-bottom-buy-split-sim-result.json")
const ENTRY_CACHE = path.join(CACHE, "yds-daily-bottom-buy-entry-outcome-result.json")

function loadBars(symbol) {
  const cp = path.join(CACHE, `dbb-${symbol.toLowerCase()}-daily-ohlcv.json`)
  if (!fs.existsSync(cp)) throw new Error(`Missing cache ${cp}`)
  return JSON.parse(fs.readFileSync(cp, "utf8")).bars
}

function main() {
  console.log("DBB profit/loss structure validation (historical 10-ETF Test)…")
  console.log("NOTE: validation universe ≠ production 9-ETF product list.")

  const etfs = []
  for (const meta of SPLIT_SIM_STUDY_ETFS) {
    const r = analyzeEtfProfitLoss(meta, loadBars(meta.symbol))
    etfs.push(r)
    console.log(`  ${meta.symbol}: n=${r.episodeCount} →4=${r.reached4Count}`)
  }

  const pooled = poolProfitLossValidation(etfs)

  let priorNotes = []
  if (fs.existsSync(SPLIT_CACHE)) {
    const s = JSON.parse(fs.readFileSync(SPLIT_CACHE, "utf8"))
    priorNotes.push({
      source: "split-sim-result",
      episodeCount: s.totals?.episodeCount ?? null,
      reached4Count: s.totals?.reached4Count ?? null,
      schemeA_d20_median: s.pooled?.A?.d20 ?? null,
      schemeA_mae20_median: s.pooled?.A?.mae20 ?? null,
      note:
        "Split-sim Scheme A uses NAV of 50/50 with mae20 ≤20d from open; this study MAE/MFE scan ≤60d on price, and 50/50 returns at D+20/40/60 with explicit cash half when no 4/4.",
    })
  }
  if (fs.existsSync(ENTRY_CACHE)) {
    const e = JSON.parse(fs.readFileSync(ENTRY_CACHE, "utf8"))
    priorNotes.push({
      source: "entry-outcome-result",
      episodeCount: e.totals?.episodeCount ?? null,
      d20_median_price: e.pooled?.forwards?.d20?.median ?? null,
      mae_median: e.pooled?.mae?.median ?? null,
      maeGe10: e.pooled?.mae?.rates?.ge10 ?? null,
      note: "Entry-outcome used price path from 3/4 only (no 50/50 NAV expectancy). Overlap on MAE/forward price stats expected if same caches.",
    })
  }

  const doc = {
    generatedAt: new Date().toISOString(),
    study: "3/4 → 50/50 profit-loss structure validation (Test chronological)",
    dataDisclaimer: {
      universe: "historical validation 10-ETF set (SMH XLK GRID URA BOTZ CIBR ITA XLF XLY XLV)",
      notProductionUniverse: true,
      productionUniverseNote:
        "Production Daily Bottom Buy product list is a separate 9-ETF set; do not conflate with this validation dataset.",
      episodeSource: "buildSplitBuyEpisodes + FROZEN_THRESHOLDS + TRAIN_RATIO 0.7",
      noNewDataCollected: true,
    },
    etfUniverse: SPLIT_SIM_STUDY_ETFS.map((e) => e.symbol),
    totals: {
      episodeCount: pooled.n,
      reached4Count: pooled.nReached4,
      nFullHorizon60: pooled.nFullHorizon60,
    },
    keyFive: pooled.keyFive,
    sections: {
      "1_levelReach": { up: pooled.upReach, down: pooled.downReach },
      "2_fixedHorizonReturns_from3": pooled.forwards,
      "3_maeMfe": pooled.maeMfe,
      "4_singleEntryExpectancy": pooled.singleExpectancy,
      "5_split5050Returns": pooled.split5050Returns,
      "6_split5050Structure": pooled.split5050Structure,
      "7_crashCases": {
        counts: {
          A_maeGe10: pooled.crash.A_maeGe10.length,
          B_maeGe15: pooled.crash.B_maeGe15.length,
          C_maeGe20: pooled.crash.C_maeGe20.length,
          D_d60LeNeg10: pooled.crash.D_d60LeNeg10.length,
          E_d60LeNeg20: pooled.crash.E_d60LeNeg20.length,
          after4ThenMaeGe10: pooled.after4ThenDeepDrop.length,
        },
        A_maeGe10: pooled.crash.A_maeGe10,
        B_maeGe15: pooled.crash.B_maeGe15,
        C_maeGe20: pooled.crash.C_maeGe20,
        D_d60LeNeg10: pooled.crash.D_d60LeNeg10,
        E_d60LeNeg20: pooled.crash.E_d60LeNeg20,
        after4ThenMaeGe10: pooled.after4ThenDeepDrop,
      },
      "8_etfTable_validationUniverse": pooled.etfTable,
    },
    worstLossesByD60: pooled.worstByD60,
    worstMaeTop5: pooled.worstByMae,
    comparisonToPriorCaches: priorNotes,
    payoffQuestion: {
      prompt: "수익의 크기가 손실의 크기를 충분히 상쇄하는 구조인가?",
      evidence: {
        singleD20: pooled.singleExpectancy.d20,
        singleD40: pooled.singleExpectancy.d40,
        singleD60: pooled.singleExpectancy.d60,
        splitD20: pooled.split5050Structure.d20,
        splitD40: pooled.split5050Structure.d40,
        splitD60: pooled.split5050Structure.d60,
      },
      numericAnswer: {
        singleD20_expectancy: pooled.singleExpectancy.d20?.expectancy,
        singleD20_payoffRatio: pooled.singleExpectancy.d20?.payoffRatio,
        singleD60_expectancy: pooled.singleExpectancy.d60?.expectancy,
        singleD60_payoffRatio: pooled.singleExpectancy.d60?.payoffRatio,
        splitD60_expectancy: pooled.split5050Structure.d60?.expectancy,
        splitD60_payoffRatio: pooled.split5050Structure.d60?.payoffRatio,
      },
    },
  }

  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2), "utf8")
  console.log(`Wrote ${OUT_JSON}`)
  console.log(
    `episodes=${pooled.n} keyFive=`,
    JSON.stringify(pooled.keyFive),
  )
}

main()
