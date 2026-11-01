#!/usr/bin/env node
/**
 * ETF sell-candidate backtest v2 (research only).
 *
 *   node scripts/etf-sell-backtest-v2.mjs
 *
 * Same quote-close cache and same 3/4 episodes as v1.
 * Does not change the live buy screen, equity screen, Panic Index, or stored trades.
 * Does not select a sell rule. Does not overwrite the v1 result file.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { barsFromYahooChartResult } from "../api/_lib/dailyBottomBuyHandler.js"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import { DAILY_BOTTOM_BUY_ETFS, productionThresholdsMatchFrozen } from "./lib/etf-sell-backtest.mjs"
import {
  FORWARD_DAYS,
  SAME_DAY_ORDER,
  analyzeSymbolV2,
  formatEtfBlocks,
  formatV2Table,
  poolV2,
} from "./lib/etf-sell-backtest-v2.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const V1_JSON = path.join(CACHE, "etf-sell-backtest-result.json")
const OUT_JSON = path.join(CACHE, "etf-sell-backtest-v2-result.json")
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

function eventKey(etf, date, price) {
  return `${etf}|${date}|${price}`
}

function assertSamePopulation(events) {
  if (!fs.existsSync(V1_JSON)) {
    throw new Error("v1 result is missing, so the 428-event population cannot be checked")
  }
  const v1 = JSON.parse(fs.readFileSync(V1_JSON, "utf8"))
  const left = v1.events.map((row) => eventKey(row.etf, row.signal_date, row.entry_price)).sort()
  const right = events.map((row) => eventKey(row.etf, row.signalDate, row.entryPrice)).sort()
  if (left.length !== 428 || right.length !== 428 || left.join("\n") !== right.join("\n")) {
    throw new Error(`v2 population ${right.length} does not match v1 population ${left.length}`)
  }
}

function publicStrategy(row) {
  const { etfs, ...rest } = row
  return {
    ...rest,
    etfSpread: row.etfAvgMax == null || row.etfAvgMin == null ? null : Math.round((row.etfAvgMax - row.etfAvgMin) * 100) / 100,
    etfs,
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
    const part = analyzeSymbolV2(meta.symbol, enrichBarsWithIndicators(loaded.bars))
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

  const pooled = poolV2(parts)
  assertSamePopulation(pooled.events)

  const doc = {
    researchOnly: true,
    selectedStrategy: null,
    sameDayOrder: SAME_DAY_ORDER,
    peak: "max close from entry day through the current day",
    price: "Yahoo chart quote close",
    forwardDays: FORWARD_DAYS,
    population: "v1 full-window 3/4 episodes",
    coverage,
    episodeCount: pooled.episodeCount,
    fullWindowEvents: pooled.events.length,
    incompleteForward: pooled.incomplete,
    firstSignal: pooled.firstSignal,
    lastSignal: pooled.lastSignal,
    baseline: pooled.baseline,
    strategies: pooled.strategies.map(publicStrategy),
  }

  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))

  console.log("ETF sell backtest v2 — comparison only, no rule selected")
  console.log(`Events: ${doc.fullWindowEvents}  incomplete: ${doc.incompleteForward}`)
  console.log(`Signals: ${doc.firstSignal} .. ${doc.lastSignal}`)
  console.log(`Same-day order: ${SAME_DAY_ORDER}`)
  console.log("")
  console.log("V1 baseline (total return includes the day-60 mark)")
  for (const row of pooled.baseline) {
    console.log(
      `${row.label.padEnd(16)} N ${row.events}  done ${row.completed}  avg ${row.avgTotal}  med ${row.medianTotal}  win ${row.winRate}  maxLoss ${row.maxLoss}  miss ${row.avgMissedUpside}`,
    )
  }
  console.log("")
  console.log(formatV2Table(pooled.strategies))
  console.log("")
  console.log(formatEtfBlocks(pooled.strategies))
  console.log("")
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)}`)
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err)
  process.exit(1)
})
