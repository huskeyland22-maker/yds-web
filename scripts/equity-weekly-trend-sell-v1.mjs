/**
 * Run the weekly trend sell study. Reads the 31 equity caches only.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { SELECTED_STRATEGY, TICKERS, study } from "./lib/equity-weekly-trend-sell-v1.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const series = TICKERS.map((symbol) => {
  const doc = JSON.parse(readFileSync(join(root, ".cache", "eq-ohlcv", `${symbol}.json`), "utf8"))
  return { symbol, bars: doc.bars }
})
if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
const result = study(series)
const priorTech = JSON.parse(readFileSync(join(root, "data", "equity-technical-sell-v1.json"), "utf8"))
const priorEvent = JSON.parse(readFileSync(join(root, ".cache", "equity-sell-backtest-v34-result.json"), "utf8"))
result.prior = {
  event: priorEvent.recommendation ?? null,
  daily: priorTech.judgment?.sell ?? null,
}
const out = join(root, "data", "equity-weekly-trend-sell-v1.json")
writeFileSync(out, JSON.stringify(result))
const brief = result.strategies.map((row) => ({
  id: row.id,
  cagr: row.meanCagr,
  excess: row.meanExcessCagr,
  mdd: row.mddDiff,
  wins: row.tickerWins,
  trades: row.meanTrades,
  exposure: row.meanTimeInMarket,
  gates: row.gates,
  oos: row.oos.map((item) => item.meanExcessCagr),
}))
console.log(JSON.stringify({
  tickers: result.universe.length,
  lookAhead: result.lookAhead.violations,
  judgment: result.judgment,
  selectedStrategy: result.selectedStrategy,
  brief,
}))
