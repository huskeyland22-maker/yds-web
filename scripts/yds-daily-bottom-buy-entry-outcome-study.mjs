#!/usr/bin/env node
/**
 * YDS Daily Bottom Buy — 3/4 entry outcome study (Test episodes, research only).
 *
 *   node scripts/yds-daily-bottom-buy-entry-outcome-study.mjs
 *
 * Reuses split-sim episode definition + frozen thresholds.
 * Writes scripts/.cache/yds-daily-bottom-buy-entry-outcome-result.json
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  SPLIT_SIM_STUDY_ETFS,
  analyzeEtfEntryOutcomes,
  buildEtfSummaryTable,
  extractWorstTails,
  poolEntryOutcomeStats,
} from "./lib/daily-bottom-entry-outcome-analysis.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const OUT_JSON = path.join(CACHE, "yds-daily-bottom-buy-entry-outcome-result.json")
const SPLIT_CACHE = path.join(CACHE, "yds-daily-bottom-buy-split-sim-result.json")

function cachePath(symbol) {
  return path.join(CACHE, `dbb-${symbol.toLowerCase()}-daily-ohlcv.json`)
}

function loadBars(symbol) {
  const cp = cachePath(symbol)
  if (!fs.existsSync(cp)) {
    throw new Error(`Missing cache ${cp}`)
  }
  return JSON.parse(fs.readFileSync(cp, "utf8")).bars
}

function main() {
  console.log("3/4 entry outcome analysis (Test)…")
  const etfs = []
  for (const meta of SPLIT_SIM_STUDY_ETFS) {
    const bars = loadBars(meta.symbol)
    const r = analyzeEtfEntryOutcomes(meta, bars)
    etfs.push(r)
    console.log(
      `  ${meta.symbol}: episodes=${r.episodeCount} →4=${r.reached4Count} split=${r.split.splitDate}`,
    )
  }

  const allOutcomes = etfs.flatMap((e) => e.outcomes)
  const pooled = poolEntryOutcomeStats(allOutcomes)
  const tails = extractWorstTails(allOutcomes)
  const etfTable = buildEtfSummaryTable(etfs)

  let splitCacheMeta = null
  if (fs.existsSync(SPLIT_CACHE)) {
    const prev = JSON.parse(fs.readFileSync(SPLIT_CACHE, "utf8"))
    splitCacheMeta = {
      generatedAt: prev.generatedAt,
      episodeCount: prev.totals?.episodeCount ?? null,
      reached4Count: prev.totals?.reached4Count ?? null,
      pooledA_d20: prev.pooled?.A?.d20 ?? null,
      pooledA_mae20: prev.pooled?.A?.mae20 ?? null,
      note: "Prior split-sim used NAV of 50/50 scheme and MAE window ≤20d from open; this study uses price path from 3/4 entry up to 60d.",
    }
  }

  const doc = {
    generatedAt: new Date().toISOString(),
    study: "3/4 entry recovery / MAE / 4/4 tail (Test chronological)",
    episodeSource: "buildSplitBuyEpisodes + FROZEN_THRESHOLDS + TRAIN_RATIO 0.7 (same as split-sim)",
    etfUniverse: SPLIT_SIM_STUDY_ETFS.map((e) => e.symbol),
    totals: {
      episodeCount: allOutcomes.length,
      reached4Count: allOutcomes.filter((o) => o.reached4).length,
      nFullHorizon60: allOutcomes.filter((o) => o.from3?.fullHorizon60).length,
    },
    pooled,
    worstTails: {
      A_topMaeAfter3: tails.A_topMaeAfter3,
      B_noPlus3In60_count: tails.B_noPlus3In60.length,
      B_noPlus3In60: tails.B_noPlus3In60.slice(0, 20),
      C_continuedDropAfter4_count: tails.C_continuedDropAfter4.length,
      C_continuedDropAfter4: tails.C_continuedDropAfter4.slice(0, 20),
      D_after4MaeGe10_count: tails.D_after4MaeGe10.length,
      D_after4MaeGe10: tails.D_after4MaeGe10,
      E_after4LossAtD60_count: tails.E_after4LossAtD60.length,
      E_after4LossAtD60: tails.E_after4LossAtD60,
    },
    etfTable,
    comparisonToSplitSimCache: splitCacheMeta,
    // omit full per-episode dump from console size; keep compact list of ids
    episodeIndex: allOutcomes.map((o) => ({
      symbol: o.symbol,
      openDate: o.openDate,
      reached4: o.reached4,
      fill4Date: o.fill4Date,
    })),
  }

  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2), "utf8")
  console.log(`Wrote ${OUT_JSON}`)
  console.log(
    `TOTAL episodes=${doc.totals.episodeCount} reached4=${doc.totals.reached4Count} full60=${doc.totals.nFullHorizon60}`,
  )
}

main()
