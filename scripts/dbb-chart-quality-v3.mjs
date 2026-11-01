/**
 * Generate DBB chart quality v3 component-validity JSON.
 * node scripts/dbb-chart-quality-v3.mjs
 * Reads v1 JSON and OHLCV caches. Does not modify v1/v2 files.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { MARKET_BENCHMARK, SECTOR_BENCHMARK } from "./lib/dbb-chart-quality-v1.mjs"
import { analyzeComponentValidity } from "./lib/dbb-chart-quality-v3.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const eqDir = join(root, "scripts", ".cache", "eq-ohlcv")
const v1Path = join(root, "vite-project", "public", "data", "dbb-chart-quality-v1.json")
const outPath = join(root, "vite-project", "public", "data", "dbb-chart-quality-v3.json")

function loadBars(symbol, paths) {
  for (const path of paths) {
    if (!existsSync(path)) continue
    const raw = JSON.parse(readFileSync(path, "utf8"))
    const bars = Array.isArray(raw?.bars) ? raw.bars : Array.isArray(raw) ? raw : null
    if (bars?.length) return bars
  }
  return null
}

const v1 = JSON.parse(readFileSync(v1Path, "utf8"))
const seriesBySymbol = {}
for (const row of EQUITY_SELL_RESEARCH_UNIVERSE) {
  const bars = loadBars(row.symbol, [join(eqDir, `${row.symbol}.json`)])
  if (bars) seriesBySymbol[row.symbol] = bars
}

const benchmarkSeries = {}
const needed = new Set([MARKET_BENCHMARK, ...Object.values(SECTOR_BENCHMARK).filter(Boolean)])
for (const symbol of needed) {
  const lower = symbol.toLowerCase()
  const bars = loadBars(symbol, [
    join(root, "scripts", ".cache", `dbb-${lower}-daily-ohlcv.json`),
    join(eqDir, `${symbol}.json`),
  ])
  if (bars) benchmarkSeries[symbol] = bars
  else console.warn(`[chart-quality-v3] missing benchmark ${symbol}`)
}

const report = analyzeComponentValidity(v1, seriesBySymbol, benchmarkSeries)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(report)}\n`, "utf8")
console.log(
  JSON.stringify(
    {
      outPath,
      asOf: report.asOf,
      verification: report.verification,
      counts: report.counts,
      tableA: report.tableA,
      tableB: report.tableB,
      tableC: report.tableC,
    },
    null,
    2,
  ),
)
