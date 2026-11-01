#!/usr/bin/env node
/**
 * Individual-stock split-entry timing study (research only).
 *   node scripts/validate-daily-bottom-buy-split-entry-individual.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  DROP_STEPS,
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  HORIZON,
  SCHEMES,
  TIME_STEPS,
  TRAIN_RATIO,
  analyzeSplitEntrySymbol,
  assertNoEtfInStudyUniverse,
  poolSplitEntry,
} from "./lib/daily-bottom-buy-split-entry-individual-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-split-entry-individual-result.json")

function loadCached(yahoo) {
  const cp = path.join(BAR_DIR, `${yahoo.replace(/[^A-Za-z0-9.-]/g, "_")}.json`)
  if (!fs.existsSync(cp)) return null
  const raw = JSON.parse(fs.readFileSync(cp, "utf8"))
  return Array.isArray(raw.bars) ? raw.bars : null
}

function main() {
  assertNoEtfInStudyUniverse()
  console.log("Individual split-entry study. 48 names. Frozen 3/4 episodes. No ETF run.")
  const blocks = []
  for (const meta of EQUITY_CANDIDATES) {
    const row = analyzeSplitEntrySymbol(meta, loadCached(meta.yahoo))
    console.log(`  ${meta.symbol}: ${row.status} n=${row.episodes.length}`)
    const { bars, ...rest } = row
    blocks.push({ ...rest, bars })
  }
  const pooled = poolSplitEntry(blocks)
  const doc = {
    generatedAt: new Date().toISOString(),
    study: "Individual-stock split entry after an unchanged 3/4 or 4/4 open",
    method: {
      universe: "Existing 48 single names. ETFs are not in this run.",
      episodes: "Same rising-edge count>=3 episodes as the individual-stock studies, including a day that opens already at 4/4.",
      horizon: HORIZON,
      trainRatio: TRAIN_RATIO,
      thresholds: FROZEN_THRESHOLDS,
      schemes: SCHEMES,
      baseline: "50% at the open close. The other 50% stays cash through the horizon.",
      drop: "Each later tranche k fills on the first close at or below Day0 * (1 - k * step). Steps are 3, 5, 7.5, 10, 15. A single close can fill more than one tranche when it already stands through the deeper lines.",
      time: "Tranche k fills at the close of trading day k * N after Day0. N is 5, 10, 15, 20, 30. The close is used whether it is up or down.",
      timeDrop: "Tranche k fills on the first close that is at least k * N trading days after Day0 and at or below the Day0 drop line for that tranche.",
      price: "Fill price is that session's close. The low is used only for MAE and the max further drop, never as an entry.",
      cash: "Weight that has not filled by a mark date stays cash. Portfolio MAE does not give an add that day's low.",
      completion: "100% means every scheduled tranche has filled inside 60 sessions. Days-to-full statistics are among completed episodes. The baseline never reaches 100%.",
      selection: "No step, weight, or interval is chosen from Test.",
    },
    disclaimer: {
      researchOnly: true,
      productionUnchanged: true,
      etfExcluded: true,
      dropSteps: DROP_STEPS,
      timeSteps: TIME_STEPS,
    },
    coverage: pooled.coverage,
    questions: pooled.questions,
    baseline: pooled.baseline,
    drop: pooled.drop,
    time: pooled.time,
    timeDrop: pooled.timeDrop,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc))
  console.log(`Wrote ${OUT_JSON}`)
  console.log(JSON.stringify(pooled.coverage))
}

main()
