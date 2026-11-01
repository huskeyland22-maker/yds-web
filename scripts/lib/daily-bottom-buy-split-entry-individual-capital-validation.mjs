/**
 * Portfolio return on a fixed 100% planned budget (research only).
 * Cash that never fills earns 0%. The fill is the first close through the
 * Day0 line, never an intraday low and never a later trough.
 */

import { summarizeNumeric } from "./daily-bottom-buy-validation-core.mjs"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  HORIZON,
  TRAIN_RATIO,
  analyzeSplitEntrySymbol,
  assertNoEtfInStudyUniverse,
  simulateEpisode,
} from "./daily-bottom-buy-split-entry-individual-validation.mjs"

export {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  HORIZON,
  TRAIN_RATIO,
  analyzeSplitEntrySymbol,
  assertNoEtfInStudyUniverse,
  simulateEpisode,
}

const FULL_EPS = 1e-9

/**
 * A/B/C add the rest in one print. D adds 25% at -5% and 25% at -10% of Day0.
 * The second D line is Day0 * 0.90, which is two 5% steps from Day0.
 */
export const CAPITAL_SCHEMES = [
  {
    id: "BASE",
    label: "50% at Day0, remaining 50% stays cash",
    weights: [0.5],
    rule: { kind: "drop", step: 100 },
  },
  {
    id: "A",
    label: "50% at Day0, 50% at the first -5% close",
    weights: [0.5, 0.5],
    rule: { kind: "drop", step: 5 },
  },
  {
    id: "B",
    label: "50% at Day0, 50% at the first -7.5% close",
    weights: [0.5, 0.5],
    rule: { kind: "drop", step: 7.5 },
  },
  {
    id: "C",
    label: "50% at Day0, 50% at the first -10% close",
    weights: [0.5, 0.5],
    rule: { kind: "drop", step: 10 },
  },
  {
    id: "D",
    label: "50% at Day0, 25% at the first -5% close, 25% at the first -10% close",
    weights: [0.5, 0.25, 0.25],
    rule: { kind: "drop", step: 5 },
  },
]

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function rate(n, d) {
  if (!d) return null
  return round2((n / d) * 100)
}

export function deployedFraction(weights, fills) {
  let deployed = 0
  for (let t = 0; t < weights.length; t++) {
    if (fills[t] != null) deployed += weights[t]
  }
  return deployed
}

function pair(values) {
  const s = summarizeNumeric(values)
  return { n: s.n, mean: s.mean, median: s.median }
}

export function packCapital(rows) {
  const deployed = rows.map((r) => r.deployedPct)
  const cash = rows.map((r) => r.cashPct)
  return {
    n: rows.length,
    portfolio: {
      d20: pair(rows.map((r) => r.d20)),
      d40: pair(rows.map((r) => r.d40)),
      d60: pair(rows.map((r) => r.d60)),
    },
    mae: pair(rows.map((r) => r.mae)),
    maxDrop: pair(rows.map((r) => r.maxDrop)),
    hit5Pct: rate(rows.filter((r) => r.hit5).length, rows.length),
    hit10Pct: rate(rows.filter((r) => r.hit10).length, rows.length),
    hit15Pct: rate(rows.filter((r) => r.hit15).length, rows.length),
    deployedPct: pair(deployed),
    fullPct: rate(rows.filter((r) => r.full).length, rows.length),
    daysToFull: pair(rows.map((r) => r.daysToFull)),
    cashPct: pair(cash),
  }
}

function sliceCapital(rows) {
  return {
    all: packCapital(rows),
    atr: {
      lt3: packCapital(rows.filter((r) => r.atrBand === "lt3")),
      b3_4: packCapital(rows.filter((r) => r.atrBand === "b3_4")),
      ge4: packCapital(rows.filter((r) => r.atrBand === "ge4")),
    },
  }
}

export function capitalRows(bars, episodes, scheme) {
  const rows = []
  for (const ep of episodes) {
    const sim = simulateEpisode(bars, ep.openIdx, scheme.weights, scheme.rule)
    if (!sim) continue
    const deployed = deployedFraction(scheme.weights, sim.fills)
    rows.push({
      split: ep.split,
      atrBand: ep.atrBand,
      d20: sim.d20,
      d40: sim.d40,
      d60: sim.d60,
      mae: sim.mae,
      maxDrop: sim.maxDrop,
      hit5: sim.hit5,
      hit10: sim.hit10,
      hit15: sim.hit15,
      deployedPct: round2(deployed * 100),
      cashPct: round2((1 - deployed) * 100),
      full: deployed + FULL_EPS >= 1,
      daysToFull: sim.daysToFull,
    })
  }
  return rows
}

export function poolCapital(blocks) {
  const ready = blocks.filter((b) => b.status === "ok")
  const episodes = ready.flatMap((b) => b.episodes)
  const strategies = {}
  for (const scheme of CAPITAL_SCHEMES) {
    const rows = []
    for (const block of ready) {
      if (!block.bars) continue
      rows.push(...capitalRows(block.bars, block.episodes, scheme))
    }
    strategies[scheme.id] = {
      label: scheme.label,
      weights: scheme.weights,
      rule: scheme.rule,
      train: sliceCapital(rows.filter((r) => r.split === "train")),
      test: sliceCapital(rows.filter((r) => r.split === "test")),
    }
  }
  return {
    coverage: {
      symbols: EQUITY_CANDIDATES.length,
      withData: ready.length,
      episodesBuilt: ready.reduce((s, b) => s + b.built, 0),
      shortHorizonExcluded: ready.reduce((s, b) => s + b.shortHorizon, 0),
      sample: episodes.length,
      train: episodes.filter((e) => e.split === "train").length,
      test: episodes.filter((e) => e.split === "test").length,
      trainAtr: {
        lt3: episodes.filter((e) => e.split === "train" && e.atrBand === "lt3").length,
        b3_4: episodes.filter((e) => e.split === "train" && e.atrBand === "b3_4").length,
        ge4: episodes.filter((e) => e.split === "train" && e.atrBand === "ge4").length,
      },
      testAtr: {
        lt3: episodes.filter((e) => e.split === "test" && e.atrBand === "lt3").length,
        b3_4: episodes.filter((e) => e.split === "test" && e.atrBand === "b3_4").length,
        ge4: episodes.filter((e) => e.split === "test" && e.atrBand === "ge4").length,
      },
      dataStart: ready.map((b) => b.split?.dataStart).filter(Boolean).sort()[0] ?? null,
      dataEnd: ready.map((b) => b.split?.dataEnd).filter(Boolean).sort().at(-1) ?? null,
      splitDateMin: ready.map((b) => b.split?.splitDate).filter(Boolean).sort()[0] ?? null,
      splitDateMax: ready.map((b) => b.split?.splitDate).filter(Boolean).sort().at(-1) ?? null,
    },
    strategies,
  }
}
