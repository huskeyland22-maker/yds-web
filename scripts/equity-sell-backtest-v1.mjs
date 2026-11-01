#!/usr/bin/env node
/**
 * US single-stock correction-path study v1 (research only).
 *
 *   node scripts/equity-sell-backtest-v1.mjs
 *
 * Does not select a sell rule and does not overwrite ETF v1–v9 results.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { barsFromYahooChartResult } from "../api/_lib/dailyBottomBuyHandler.js"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  CORRECTION_DEPTHS,
  FORWARD_DAYS,
  SELECTED_STRATEGY,
  analyzeEquityPath,
  poolEquityPaths,
  sampleJudgment,
  summarizeCorrections,
  summarizeThemes,
  uniqueEventCount,
} from "./lib/equity-sell-backtest-v1.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v1-result.json")
const ETF_V6_JSON = path.join(CACHE, "etf-sell-backtest-v6-result.json")
const START = "2016-01-01"

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
}

function cachePath(symbol) {
  return path.join(BAR_DIR, `${symbol.replace(/[^A-Za-z0-9.-]/g, "_")}.json`)
}

function barsFromCache(raw) {
  if (Array.isArray(raw)) return raw
  if (Array.isArray(raw?.bars)) return raw.bars
  return []
}

async function fetchQuoteBars(symbol) {
  const period1 = Math.floor(new Date(`${START}T00:00:00Z`).getTime() / 1000)
  const period2 = Math.floor(Date.now() / 1000)
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=history`
  const res = await fetch(url, { headers: YAHOO_HEADERS })
  if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`)
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error(`Yahoo ${symbol} empty chart`)
  return barsFromYahooChartResult(result, period2)
}

async function loadBars(symbol) {
  const cp = cachePath(symbol)
  if (fs.existsSync(cp)) {
    const bars = barsFromCache(JSON.parse(fs.readFileSync(cp, "utf8")))
    if (bars.length) return { bars, source: "cache" }
  }
  const bars = await fetchQuoteBars(symbol)
  fs.mkdirSync(BAR_DIR, { recursive: true })
  fs.writeFileSync(
    cp,
    JSON.stringify({
      symbol,
      source: "Yahoo Finance chart API v8 quote close",
      requestedStart: START,
      fetchedAt: new Date().toISOString(),
      count: bars.length,
      first: bars[0]?.date ?? null,
      last: bars.at(-1)?.date ?? null,
      bars,
    }),
  )
  return { bars, source: "yahoo" }
}

function publishedEtfComparison() {
  const saved = JSON.parse(fs.readFileSync(ETF_V6_JSON, "utf8"))
  const wanted = new Set(["-5", "-7", "-10", "-15", "-20"])
  const recovery = new Map(
    saved.table1
      .filter((row) => row.entry_band === "+10" && wanted.has(row.correction_threshold))
      .map((row) => [row.correction_threshold, row]),
  )
  const paths = new Map(
    saved.table2
      .filter((row) => row.entry_band === "+10" && wanted.has(row.correction_threshold))
      .map((row) => [row.correction_threshold, row]),
  )
  return {
    source: "scripts/.cache/etf-sell-backtest-v6-result.json",
    recomputed: false,
    selectedStrategy: saved.selectedStrategy,
    note: "Copied from the saved ETF v6 result. Event-level standard deviation is not in that file.",
    rows: [...wanted].map((threshold) => {
      const left = recovery.get(threshold)
      const right = paths.get(threshold)
      return {
        correction: threshold,
        n: left?.events ?? null,
        peakRecoveryRate: left?.prior_peak_recovery_rate ?? null,
        entryRecoveryRate: left?.purchase_recovery_rate ?? null,
        avgAdditionalDrawdown: left?.avg_additional_drawdown ?? null,
        medianAdditionalDrawdown: left?.median_additional_drawdown ?? null,
        t20Avg: right?.T20_avg ?? null,
        t20N: right?.T20_n ?? null,
        t20WinRate: right?.T20_win_rate ?? null,
        windowEndAvg: right?.window_end_avg ?? null,
        windowEndN: right?.window_end_n ?? null,
        windowEndWinRate: right?.window_end_win_rate ?? null,
      }
    }),
  }
}

function coverageRow(part, source) {
  return {
    ticker: part.symbol,
    name: part.name,
    themes: part.themes,
    source,
    dataStart: part.dataStart,
    dataEnd: part.dataEnd,
    bars: part.bars,
    episodeStarts: part.episodeStarts,
    fullWindowEpisodes: part.fullWindowEpisodes,
    incompleteEpisodes: part.incompleteEpisodes,
    reached10: part.reached10,
    after10: part.depthCounts,
    d10Judgment: sampleJudgment(part.depthCounts.d10),
  }
}

function symbolTable(parts) {
  return parts.map((part) => {
    const summary = summarizeCorrections(part.corrections.d10)
    return {
      ticker: part.symbol,
      themes: part.themes,
      ...summary,
    }
  })
}

async function main() {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
  if (symbols.length !== 31 || new Set(symbols).size !== 31) throw new Error("research universe is not 31 unique names")
  if (symbols.includes("FNTN")) throw new Error("FNTN is not a research ticker")
  if (EQUITY_SELL_RESEARCH_UNIVERSE.find((row) => row.symbol === "FTNT")?.name !== "Fortinet") {
    throw new Error("FTNT must be Fortinet")
  }

  const parts = []
  const coverage = []
  for (const meta of EQUITY_SELL_RESEARCH_UNIVERSE) {
    const loaded = await loadBars(meta.symbol)
    const part = analyzeEquityPath(meta.symbol, enrichBarsWithIndicators(loaded.bars))
    parts.push(part)
    coverage.push(coverageRow(part, loaded.source))
  }
  if (parts.length !== 31) throw new Error(`analyzed ${parts.length} names`)

  const pooled = poolEquityPaths(parts)
  const themes = summarizeThemes(parts, 0.1)
  const events = parts.flatMap((part) => CORRECTION_DEPTHS.flatMap((depth) => part.corrections[`d${Math.round(depth * 100)}`]))
  const deep = events.filter((row) => row.correctionDepth === 0.1)
  if (uniqueEventCount(deep) !== deep.length) throw new Error("duplicate -10 correction events")
  const themeEventSum = themes.reduce((sum, theme) => sum + theme.n, 0)
  if (themeEventSum < deep.length) throw new Error("a -10 event is missing from every theme")

  const doc = {
    researchOnly: true,
    selectedStrategy: SELECTED_STRATEGY,
    productionApplied: false,
    population: "full-window 3/4 episodes, same definition as ETF v1",
    forwardDays: FORWARD_DAYS,
    profitArm: 0.1,
    horizonNote:
      "T+N is N sessions after T0 and is stored only when that session is inside the entry+60 window. A missing T+20 or T+40 is not replaced by the window-end close.",
    universe: symbols,
    coverage,
    pooled,
    bySymbol: symbolTable(parts),
    themes,
    etfComparison: publishedEtfComparison(),
    events,
  }
  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("Equity correction study v1 — research only, selectedStrategy null")
  console.log(
    coverage
      .map(
        (row) =>
          `${row.ticker} bars ${row.bars} episodes ${row.episodeStarts} full ${row.fullWindowEpisodes} incomplete ${row.incompleteEpisodes} +10 ${row.reached10} -10 ${row.after10.d10} ${row.d10Judgment}`,
      )
      .join("\n"),
  )
  console.log(JSON.stringify(pooled, null, 2))
  console.log(JSON.stringify(themes.map((row) => ({ label: row.label, n: row.n, judgment: row.judgment, t20: row.t20.avgVsEntry, end: row.windowEnd.avgVsEntry, peak: row.peakRecoveryRate, entry: row.entryRecoveryRate })), null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
