/**
 * Research runner for the v2 price-base and missed-window checks.
 * Does not rewrite the v1 result.
 * node scripts/buy-signal-repeat-confirm-v2.mjs
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1 } from "../api/_lib/dailyBottomBuyEngine.js"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { buildConfirmWindows, strategyEntries } from "./lib/buy-signal-repeat-confirm-v1.mjs"
import {
  SELECTED_STRATEGY,
  counterfactualStats,
  differenceOfStats,
  entryDecomposition,
  exclusionSets,
  nonOverlappingWindows,
  pairExitSplit,
  summarizeDecompositions,
  summarizeNumbers,
  summarizePairSplit,
} from "./lib/buy-signal-repeat-confirm-v2.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const cache = join(root, ".cache")
const prior = JSON.parse(readFileSync(join(cache, "buy-signal-repeat-confirm-v1-result.json"), "utf8"))

function loadBars(kind, symbol) {
  const path = kind === "etf"
    ? join(cache, `dbb-${symbol.toLowerCase()}-daily-ohlcv.json`)
    : join(cache, "eq-ohlcv", `${symbol}.json`)
  return JSON.parse(readFileSync(path, "utf8")).bars
}

function collect(kind, symbols) {
  const windows = []
  for (const symbol of symbols) {
    const rows = enrichBarsWithIndicators(loadBars(kind, symbol))
    for (const item of buildConfirmWindows(rows)) {
      const strategies = strategyEntries(rows, item)
      windows.push({
        symbol,
        start: item.start,
        date: rows[item.start].date,
        strategies,
        decompositions: {
          A: entryDecomposition(rows, item, strategies.A),
          B: entryDecomposition(rows, item, strategies.B),
          C: entryDecomposition(rows, item, strategies.C),
        },
        split: pairExitSplit(rows, { start: item.start, strategies }),
      })
    }
  }
  return windows
}

function strategyBlock(windows, id) {
  const decompositions = windows.map((window) => window.decompositions[id]).filter(Boolean)
  const exclusion = exclusionSets(windows, id)
  const keptA = counterfactualStats(exclusion.kept)
  const missedA = counterfactualStats(exclusion.excluded)
  const preEntry = summarizeNumbers(decompositions.map((row) => row.preEntry))
  return {
    entries: decompositions.length,
    preEntry,
    performance: summarizeDecompositions(decompositions),
    exclusion: id === "A" ? null : {
      reasons: exclusion.reasons,
      excludedWindows: exclusion.excluded.length,
      keptWindows: exclusion.kept.length,
      strategyWithoutA: exclusion.strategyWithoutA,
      counterfactualA: missedA,
      keptA,
      keptMinusExcluded: differenceOfStats(keptA, missedA),
      note: "counterfactualA is strategy A on windows this strategy skipped. It is not this strategy's filled return.",
    },
  }
}

function groupReport(windows) {
  const sparse = nonOverlappingWindows(windows)
  const pair = (source, id) => summarizePairSplit(source.map((window) => window.split[id]).filter(Boolean))
  return {
    windows: windows.length,
    nonOverlappingWindows: sparse.length,
    strategies: {
      A: strategyBlock(windows, "A"),
      B: strategyBlock(windows, "B"),
      C: strategyBlock(windows, "C"),
    },
    paired: { B: pair(windows, "B"), C: pair(windows, "C") },
    nonOverlapping: {
      strategies: {
        A: strategyBlock(sparse, "A"),
        B: strategyBlock(sparse, "B"),
        C: strategyBlock(sparse, "C"),
      },
      paired: { B: pair(sparse, "B"), C: pair(sparse, "C") },
    },
  }
}

function expectCount(label, actual, expected) {
  if (actual !== expected) {
    console.log(`v1 count mismatch ${label}: rerun ${actual}, v1 ${expected}`)
    process.exit(1)
  }
}

const etfSymbols = DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1.map((row) => row.symbol)
const equitySymbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
const etf = groupReport(collect("etf", etfSymbols))
const equity = groupReport(collect("equity", equitySymbols))

expectCount("etf windows", etf.windows, prior.etf.windows)
expectCount("equity windows", equity.windows, prior.equity.windows)
expectCount("etf A", etf.strategies.A.entries, prior.etf.strategies.A.entries)
expectCount("etf B", etf.strategies.B.entries, prior.etf.strategies.B.entries)
expectCount("etf C", etf.strategies.C.entries, prior.etf.strategies.C.entries)
expectCount("equity A", equity.strategies.A.entries, prior.equity.strategies.A.entries)
expectCount("equity B", equity.strategies.B.entries, prior.equity.strategies.B.entries)
expectCount("equity C", equity.strategies.C.entries, prior.equity.strategies.C.entries)
expectCount("etf B missed", etf.strategies.B.exclusion.excludedWindows, prior.etf.comparison.B.missedEntries)
expectCount("equity B missed", equity.strategies.B.exclusion.excludedWindows, prior.equity.comparison.B.missedEntries)
expectCount("etf C missed", etf.strategies.C.exclusion.excludedWindows, prior.etf.comparison.C.missedEntries)
expectCount("equity C missed", equity.strategies.C.exclusion.excludedWindows, prior.equity.comparison.C.missedEntries)

const result = {
  version: "buy-signal-repeat-confirm-v2",
  selectedStrategy: SELECTED_STRATEGY,
  productionChanged: false,
  v1Unchanged: true,
  v1Version: prior.version,
  universes: { etf: etfSymbols, equity: equitySymbols },
  definitions: {
    preEntry: "entry open / first 3/4 close - 1",
    fromEntry: "same holding period as v1, close at fill+horizon / entry open - 1",
    fromSignalClose: "comparison only, same exit bar / first signal close - 1",
    sameHoldGap: "later strategy own T+H return minus A own T+H return",
    sameExitAsA: "both marked to A's exit; gap is the entry-price difference",
    sameExitAsOther: "both marked to the later strategy exit; gap is the entry-price difference",
    laterWindowOnly: "A's return to the later exit minus A's own T+H return",
    overlap: "non-overlapping subset keeps one window per symbol until 120 trading days after its start",
    excluded: "A's result on windows B or C did not enter. Not a filled B or C return.",
  },
  etf,
  equity,
}

writeFileSync(join(cache, "buy-signal-repeat-confirm-v2-result.json"), JSON.stringify(result))
console.log(JSON.stringify({
  etfWindows: etf.windows,
  equityWindows: equity.windows,
  etfSparse: etf.nonOverlappingWindows,
  equitySparse: equity.nonOverlappingWindows,
  etfPre: {
    A: etf.strategies.A.preEntry,
    B: etf.strategies.B.preEntry,
    C: etf.strategies.C.preEntry,
  },
  equityPre: {
    A: equity.strategies.A.preEntry,
    B: equity.strategies.B.preEntry,
    C: equity.strategies.C.preEntry,
  },
}, null, 2))
