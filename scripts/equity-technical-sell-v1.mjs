/**
 * Run the fixed-rule technical sell study. Reads the 31 equity caches only.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { SELECTED_STRATEGY, TICKERS, study } from "./lib/equity-technical-sell-v1.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const series = TICKERS.map((symbol) => {
  const doc = JSON.parse(readFileSync(join(root, ".cache", "eq-ohlcv", `${symbol}.json`), "utf8"))
  return { symbol, bars: doc.bars }
})
if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
const result = study(series)
const out = join(root, "data", "equity-technical-sell-v1.json")
writeFileSync(out, JSON.stringify(result))
const top = result.strategies
  .map((row) => ({ id: row.id, excess: row.meanExcessCagr, wins: row.tickerWins, mdd: row.mddImprovement, exposure: row.meanTimeInMarket }))
  .sort((a, b) => (b.excess ?? -999) - (a.excess ?? -999))[0]
console.log(JSON.stringify({
  tickers: result.universe.length,
  lookAhead: result.lookAhead.violations,
  stages: result.stages,
  judgment: result.judgment,
  selectedStrategy: result.selectedStrategy,
  bestExcess: top,
}))
