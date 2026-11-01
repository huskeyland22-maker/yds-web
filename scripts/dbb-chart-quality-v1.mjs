/**
 * Generate DBB chart quality v1 research JSON from local OHLCV caches.
 * node scripts/dbb-chart-quality-v1.mjs
 *
 * Does not change buy thresholds, trade records, or ETF signal research files.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { analyzeChartQuality, SECTOR_BENCHMARK, MARKET_BENCHMARK } from "./lib/dbb-chart-quality-v1.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const eqDir = join(root, "scripts", ".cache", "eq-ohlcv")
const outPath = join(root, "vite-project", "public", "data", "dbb-chart-quality-v1.json")

function loadBars(symbol, paths) {
  for (const path of paths) {
    if (!existsSync(path)) continue
    const raw = JSON.parse(readFileSync(path, "utf8"))
    const bars = Array.isArray(raw?.bars) ? raw.bars : Array.isArray(raw) ? raw : null
    if (bars?.length) return bars
  }
  return null
}

function loadEquity(symbol) {
  return loadBars(symbol, [join(eqDir, `${symbol}.json`)])
}

function loadBenchmark(symbol) {
  const lower = symbol.toLowerCase()
  return loadBars(symbol, [
    join(root, "scripts", ".cache", `dbb-${lower}-daily-ohlcv.json`),
    join(eqDir, `${symbol}.json`),
  ])
}

const seriesBySymbol = {}
for (const row of EQUITY_SELL_RESEARCH_UNIVERSE) {
  const bars = loadEquity(row.symbol)
  if (bars) seriesBySymbol[row.symbol] = bars
}

const benchmarkSeries = {}
const needed = new Set([MARKET_BENCHMARK, ...Object.values(SECTOR_BENCHMARK).filter(Boolean)])
for (const symbol of needed) {
  const bars = loadBenchmark(symbol)
  if (bars) benchmarkSeries[symbol] = bars
  else console.warn(`[chart-quality] missing benchmark ${symbol}`)
}

const report = analyzeChartQuality(seriesBySymbol, benchmarkSeries)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(report)}\n`, "utf8")
console.log(
  JSON.stringify(
    {
      outPath,
      asOf: report.asOf,
      signals: report.counts.signals,
      symbolsWithSignals: report.counts.symbolsWithSignals,
      scored: report.counts.scored,
      unavailableScore: report.counts.unavailableScore,
      train: report.split.trainCount,
      validation: report.split.validationCount,
      overall60: report.overall,
      missingData: report.missingData,
      benchmarks: [...needed].map((symbol) => ({ symbol, bars: benchmarkSeries[symbol]?.length || 0 })),
    },
    null,
    2,
  ),
)
