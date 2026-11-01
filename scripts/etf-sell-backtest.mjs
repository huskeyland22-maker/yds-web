#!/usr/bin/env node
/**
 * ETF sell-candidate backtest (research only).
 *
 *   node scripts/etf-sell-backtest.mjs
 *
 * Reads the existing Yahoo quote-close cache when present.
 * Does not change the live ETF buy screen, equity screen, Panic Index, or stored trades.
 * Does not select a sell rule.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { barsFromYahooChartResult } from "../api/_lib/dailyBottomBuyHandler.js"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import {
  DAILY_BOTTOM_BUY_ETFS,
  FORWARD_DAYS,
  analyzeSymbol,
  formatEtfTable,
  formatStrategyTable,
  poolAnalysis,
  productionThresholdsMatchFrozen,
} from "./lib/etf-sell-backtest.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const OUT_JSON = path.join(CACHE, "etf-sell-backtest-result.json")
const START = "2016-01-01"

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
}

function cachePath(symbol) {
  return path.join(CACHE, `dbb-${symbol.toLowerCase()}-daily-ohlcv.json`)
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
  fs.mkdirSync(CACHE, { recursive: true })
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

function publicEvent(event) {
  const pct = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10000) / 100)
  return {
    etf: event.etf,
    signal_date: event.signalDate,
    entry_price: event.entryPrice,
    three_of_four: event.threeOfFour,
    entry_count: event.entryCount,
    later_four_of_four: event.laterFourOfFour,
    four_date: event.fourDate,
    days_to_four: event.daysToFour,
    d5: pct(event.d5),
    d10: pct(event.d10),
    d20: pct(event.d20),
    d40: pct(event.d40),
    d60: pct(event.d60),
    mfe: pct(event.mfe),
    mae: pct(event.mae),
    hit5: event.hit5,
    hit10: event.hit10,
    hit15: event.hit15,
    hit20: event.hit20,
    hit25: event.hit25,
    days_to_5: event.daysTo5,
    days_to_10: event.daysTo10,
    days_to_15: event.daysTo15,
    days_to_20: event.daysTo20,
    days_to_25: event.daysTo25,
  }
}

async function main() {
  if (!productionThresholdsMatchFrozen()) {
    throw new Error("Product ETF thresholds and FROZEN_THRESHOLDS differ. Backtest stopped.")
  }

  const parts = []
  const coverage = []
  for (const meta of DAILY_BOTTOM_BUY_ETFS) {
    const loaded = await loadBars(meta.symbol)
    const enriched = enrichBarsWithIndicators(loaded.bars)
    const part = analyzeSymbol(meta.symbol, enriched)
    parts.push(part)
    coverage.push({
      symbol: meta.symbol,
      source: loaded.source,
      bars: loaded.bars.length,
      first: loaded.bars[0]?.date ?? null,
      last: loaded.bars.at(-1)?.date ?? null,
      episodes: part.episodeCount,
      fullWindowEvents: part.events.length,
      incomplete: part.incomplete,
    })
  }

  const pooled = poolAnalysis(parts)
  const doc = {
    researchOnly: true,
    selectedStrategy: null,
    universe: DAILY_BOTTOM_BUY_ETFS.map((meta) => meta.symbol),
    eventRule: "rising-edge count>=3 episode, no overlap; later 4/4 only inside EPISODE_DEF",
    price: "Yahoo chart quote close",
    forwardDays: FORWARD_DAYS,
    coverage,
    episodeCount: pooled.episodeCount,
    fullWindowEvents: pooled.events.length,
    incompleteForward: pooled.incomplete,
    firstSignal: pooled.firstSignal,
    lastSignal: pooled.lastSignal,
    strategies: pooled.strategies,
    etfs: pooled.etfs,
    events: pooled.events.map(publicEvent),
  }

  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))

  console.log("ETF sell backtest — comparison only, no rule selected")
  console.log(`Universe: ${doc.universe.join(", ")} (${doc.universe.length})`)
  console.log(`Full 60-session events: ${doc.fullWindowEvents}  incomplete: ${doc.incompleteForward}`)
  console.log(`Signal dates: ${doc.firstSignal} .. ${doc.lastSignal}`)
  console.log("")
  console.log(formatStrategyTable(pooled.strategies))
  console.log("")
  console.log(formatEtfTable(pooled.etfs))
  console.log("")
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)}`)
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err)
  process.exit(1)
})
