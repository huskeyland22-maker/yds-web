#!/usr/bin/env node
/**
 * Second-tranche drop by ATR (research only).
 *   node scripts/yds-daily-bottom-buy-atr-tranche-research.mjs
 *
 * Does not change production code, UI, or the frozen 3/4 rule.
 * The account starts at 100% of planned capital. Unfilled weight earns 0%.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { summarizeNumeric } from "./lib/daily-bottom-buy-validation-core.mjs"
import { deployedFraction } from "./lib/daily-bottom-buy-split-entry-individual-capital-validation.mjs"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  HORIZON,
  TRAIN_RATIO,
  analyzeSplitEntrySymbol,
  assertNoEtfInStudyUniverse,
  simulateEpisode,
} from "./lib/daily-bottom-buy-split-entry-individual-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-atr-tranche-result.json")

const BANDS = ["lt3", "b3_4", "ge4"]

/** Fixed second-tranche lines. A and B pick one line from the Day0 ATR band. */
const SCHEMES = [
  { id: "BASE", label: "50% at Day0, second 50% stays cash" },
  { id: "A", label: "ATR <3 → -5%, 3–4 → -7.5%, >=4 → -10%" },
  { id: "B", label: "ATR <3 → -5%, 3–4 → -10%, >=4 → -15%" },
  { id: "C", label: "All names, second 50% at -5%" },
  { id: "D", label: "All names, second 50% at -7.5%" },
  { id: "E", label: "All names, second 50% at -10%" },
  { id: "F", label: "All names, second 50% at -15%" },
]

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function rate(n, d) {
  if (!d) return null
  return round2((n / d) * 100)
}

export function secondStep(schemeId, atrBand) {
  if (schemeId === "BASE") return null
  if (schemeId === "C") return 5
  if (schemeId === "D") return 7.5
  if (schemeId === "E") return 10
  if (schemeId === "F") return 15
  if (schemeId === "A") {
    if (atrBand === "lt3") return 5
    if (atrBand === "b3_4") return 7.5
    if (atrBand === "ge4") return 10
  }
  if (schemeId === "B") {
    if (atrBand === "lt3") return 5
    if (atrBand === "b3_4") return 10
    if (atrBand === "ge4") return 15
  }
  return null
}

function loadCached(yahoo) {
  const cp = path.join(BAR_DIR, `${yahoo.replace(/[^A-Za-z0-9.-]/g, "_")}.json`)
  if (!fs.existsSync(cp)) return null
  const raw = JSON.parse(fs.readFileSync(cp, "utf8"))
  return Array.isArray(raw.bars) ? raw.bars : null
}

function episodeRow(bars, ep, schemeId) {
  const step = secondStep(schemeId, ep.atrBand)
  const weights = schemeId === "BASE" ? [0.5] : [0.5, 0.5]
  const sim = simulateEpisode(bars, ep.openIdx, weights, { kind: "drop", step: step ?? 100 })
  if (!sim) return null
  const deployed = deployedFraction(weights, sim.fills)
  const filled = schemeId !== "BASE" && sim.fills[1] != null
  return {
    split: ep.split,
    atrBand: ep.atrBand,
    d20: sim.d20,
    d40: sim.d40,
    d60: sim.d60,
    mae: sim.mae,
    maxDrop: sim.maxDrop,
    hit5: sim.hit5,
    hit10: sim.hit10,
    filled,
    days: filled ? sim.daysToNext : null,
    deployedPct: round2(deployed * 100),
    cashPct: round2((1 - deployed) * 100),
  }
}

function pack(rows) {
  const num = (pick) => summarizeNumeric(rows.map(pick))
  const days = num((r) => r.days)
  return {
    n: rows.length,
    d20Median: num((r) => r.d20).median,
    d40Median: num((r) => r.d40).median,
    d60Median: num((r) => r.d60).median,
    maeMedian: num((r) => r.mae).median,
    maeMean: num((r) => r.mae).mean,
    hit5Pct: rate(rows.filter((r) => r.hit5).length, rows.length),
    hit10Pct: rate(rows.filter((r) => r.hit10).length, rows.length),
    portfolioDrop10Pct: rate(rows.filter((r) => r.mae != null && r.mae >= 10).length, rows.length),
    portfolioDrop20Pct: rate(rows.filter((r) => r.mae != null && r.mae >= 20).length, rows.length),
    pathDrop10Pct: rate(rows.filter((r) => r.maxDrop != null && r.maxDrop >= 10).length, rows.length),
    pathDrop20Pct: rate(rows.filter((r) => r.maxDrop != null && r.maxDrop >= 20).length, rows.length),
    secondFillPct: rate(rows.filter((r) => r.filled).length, rows.length),
    daysToSecondMedian: days.median,
    daysToSecondN: days.n,
    deployedMean: num((r) => r.deployedPct).mean,
    cashMean: num((r) => r.cashPct).mean,
    unfilledPct: rate(rows.filter((r) => !r.filled).length, rows.length),
  }
}

function slicePack(rows) {
  const out = { all: pack(rows) }
  for (const band of BANDS) out[band] = pack(rows.filter((r) => r.atrBand === band))
  return out
}

function gap(a, b) {
  if (a == null || b == null) return null
  return round2(a - b)
}

function sameDirection(trainGap, testGap) {
  if (trainGap == null || testGap == null) return null
  if (trainGap === 0 || testGap === 0) return trainGap === testGap
  return Math.sign(trainGap) === Math.sign(testGap)
}

function buildConsistency(strategies) {
  const ids = SCHEMES.map((s) => s.id).filter((id) => id !== "BASE")
  const versusBaseline = {}
  for (const id of ids) {
    const row = {}
    for (const side of ["train", "test"]) {
      const s = strategies[id][side].all
      const b = strategies.BASE[side].all
      row[side] = {
        d60MedianGap: gap(s.d60Median, b.d60Median),
        maeMedianGap: gap(s.maeMedian, b.maeMedian),
        maeMeanGap: gap(s.maeMean, b.maeMean),
        deployedMeanGap: gap(s.deployedMean, b.deployedMean),
        portfolioDrop10Gap: gap(s.portfolioDrop10Pct, b.portfolioDrop10Pct),
      }
    }
    versusBaseline[id] = {
      ...row,
      d60SameDirection: sameDirection(row.train.d60MedianGap, row.test.d60MedianGap),
      maeMedianSameDirection: sameDirection(row.train.maeMedianGap, row.test.maeMedianGap),
      maeMeanSameDirection: sameDirection(row.train.maeMeanGap, row.test.maeMeanGap),
    }
  }
  const pairs = [
    ["A", "C", "lt3"],
    ["A", "D", "b3_4"],
    ["A", "E", "ge4"],
    ["B", "C", "lt3"],
    ["B", "E", "b3_4"],
    ["B", "F", "ge4"],
  ]
  const withinBand = {}
  for (const [left, right, band] of pairs) {
    for (const side of ["train", "test"]) {
      const a = strategies[left][side][band]
      const b = strategies[right][side][band]
      const key = `${left} vs ${right} ${band} ${side}`
      withinBand[key] = a.d60Median === b.d60Median && a.secondFillPct === b.secondFillPct && a.maeMedian === b.maeMedian
    }
  }
  return { versusBaseline, withinBand }
}

function assertRouting() {
  if (secondStep("A", "lt3") !== 5 || secondStep("A", "b3_4") !== 7.5 || secondStep("A", "ge4") !== 10) {
    throw new Error("A routing")
  }
  if (secondStep("B", "lt3") !== 5 || secondStep("B", "b3_4") !== 10 || secondStep("B", "ge4") !== 15) {
    throw new Error("B routing")
  }
  if (secondStep("C", "ge4") !== 5 || secondStep("F", "lt3") !== 15 || secondStep("BASE", "lt3") !== null) {
    throw new Error("uniform routing")
  }
}

function main() {
  assertNoEtfInStudyUniverse()
  assertRouting()
  console.log("ATR second-tranche study. 48 names. Cash earns 0%.")
  const blocks = []
  for (const meta of EQUITY_CANDIDATES) {
    const row = analyzeSplitEntrySymbol(meta, loadCached(meta.yahoo))
    console.log(`  ${meta.symbol}: ${row.status} n=${row.episodes.length}`)
    blocks.push(row)
  }
  const ready = blocks.filter((b) => b.status === "ok")
  const episodes = ready.flatMap((b) => b.episodes)
  const strategies = {}
  for (const scheme of SCHEMES) {
    const rows = []
    let skipped = 0
    for (const block of ready) {
      for (const ep of block.episodes) {
        if (scheme.id !== "BASE" && secondStep(scheme.id, ep.atrBand) == null) {
          skipped += 1
          continue
        }
        const row = episodeRow(block.bars, ep, scheme.id)
        if (row) rows.push(row)
      }
    }
    strategies[scheme.id] = {
      label: scheme.label,
      skippedNoAtr: skipped,
      train: slicePack(rows.filter((r) => r.split === "train")),
      test: slicePack(rows.filter((r) => r.split === "test")),
    }
  }
  const consistency = buildConsistency(strategies)
  if (Object.values(consistency.withinBand).some((ok) => !ok)) {
    throw new Error("ATR rule does not match the fixed line inside a band")
  }
  const coverage = {
    symbols: EQUITY_CANDIDATES.length,
    withData: ready.length,
    sample: episodes.length,
    train: episodes.filter((e) => e.split === "train").length,
    test: episodes.filter((e) => e.split === "test").length,
    trainAtr: Object.fromEntries(BANDS.map((band) => [band, episodes.filter((e) => e.split === "train" && e.atrBand === band).length])),
    testAtr: Object.fromEntries(BANDS.map((band) => [band, episodes.filter((e) => e.split === "test" && e.atrBand === band).length])),
    dataStart: ready.map((b) => b.split?.dataStart).filter(Boolean).sort()[0] ?? null,
    dataEnd: ready.map((b) => b.split?.dataEnd).filter(Boolean).sort().at(-1) ?? null,
    splitDateMin: ready.map((b) => b.split?.splitDate).filter(Boolean).sort()[0] ?? null,
    splitDateMax: ready.map((b) => b.split?.splitDate).filter(Boolean).sort().at(-1) ?? null,
  }
  const doc = {
    generatedAt: new Date().toISOString(),
    study: "Second 50% tranche at a Day0 close drop, with two ATR-banded alternatives",
    method: {
      universe: "Existing 48 single names and the existing rising-edge 3/4 episodes, including a day that opens at 4/4.",
      horizon: HORIZON,
      trainRatio: TRAIN_RATIO,
      thresholds: FROZEN_THRESHOLDS,
      capital: "NAV starts at 1.00. The Day0 close takes 50%. The second 50% fills at the first later close through the line, or stays cash at a 0% return.",
      portfolioDrop: "portfolioDrop10Pct and portfolioDrop20Pct are the share of episodes whose capital-weighted MAE reaches 10% or 20%. pathDrop10Pct is the share whose low, versus the Day0 close, reaches that depth. The path rate does not depend on the tranche.",
      daysToSecond: "Median trading days from Day0 to the second fill, among episodes that fill inside 60 sessions.",
      schemes: SCHEMES,
      selection: "No line is chosen from Test.",
    },
    disclaimer: {
      researchOnly: true,
      productionUnchanged: true,
      notARanking: true,
    },
    coverage,
    strategies,
    consistency,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc))
  console.log(`Wrote ${OUT_JSON}`)
  console.log(JSON.stringify(coverage))
}

main()
