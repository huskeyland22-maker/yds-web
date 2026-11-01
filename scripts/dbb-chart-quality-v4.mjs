/**
 * Generate DBB chart quality v4 C/E risk JSON.
 * node scripts/dbb-chart-quality-v4.mjs
 * Does not modify v1~v3 files.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { MARKET_BENCHMARK, SECTOR_BENCHMARK } from "./lib/dbb-chart-quality-v1.mjs"
import { analyzeRelativeBounceRisk } from "./lib/dbb-chart-quality-v4.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const eqDir = join(root, "scripts", ".cache", "eq-ohlcv")
const v1Path = join(root, "vite-project", "public", "data", "dbb-chart-quality-v1.json")
const outPath = join(root, "vite-project", "public", "data", "dbb-chart-quality-v4.json")

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
for (const symbol of new Set([MARKET_BENCHMARK, ...Object.values(SECTOR_BENCHMARK).filter(Boolean)])) {
  const lower = symbol.toLowerCase()
  const bars = loadBars(symbol, [
    join(root, "scripts", ".cache", `dbb-${lower}-daily-ohlcv.json`),
    join(eqDir, `${symbol}.json`),
  ])
  if (bars) benchmarkSeries[symbol] = bars
}

const report = analyzeRelativeBounceRisk(v1, seriesBySymbol, benchmarkSeries)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(report)}\n`, "utf8")
console.log(
  JSON.stringify(
    {
      outPath,
      asOf: report.asOf,
      verification: report.verification,
      counts: report.counts,
      cCorr: report.c.correlations,
      eCorr: report.e.correlations,
      cSameDay60: report.tableC.c["60"],
      eSameDay60: report.tableC.e["60"],
      tableD: report.tableD,
      ceCorr: report.ceCorrelation,
      jointEnough: report.joint.enough,
      jointCounts: report.joint.counts,
    },
    null,
    2,
  ),
)
