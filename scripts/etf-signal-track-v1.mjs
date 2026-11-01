#!/usr/bin/env node
/**
 * Build the ETF signal-track research file from cached daily bars.
 *   node scripts/etf-signal-track-v1.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { DAILY_BOTTOM_BUY_WATCHLIST } from "../api/_lib/dailyBottomBuyEngine.js"
import { barsFromYahooChartResult } from "../api/_lib/dailyBottomBuyHandler.js"
import { buildTrackReport } from "./lib/etf-signal-track-v1.mjs"

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cacheDir = path.join(root, "scripts", ".cache")
const outPath = path.join(root, "vite-project", "public", "data", "etf-signal-track-v1.json")

function readCache(file) {
  if (!fs.existsSync(file)) return null
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
  return Array.isArray(parsed?.bars) && parsed.bars.length ? parsed.bars : null
}

function attachAdjClose(bars, chartResult) {
  const timestamps = chartResult?.timestamp ?? []
  const adjusted = chartResult?.indicators?.adjclose?.[0]?.adjclose ?? []
  const byDate = new Map()
  for (let i = 0; i < timestamps.length; i++) {
    const value = Number(adjusted[i])
    if (!Number.isFinite(value) || !(value > 0)) continue
    const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10)
    byDate.set(date, value)
  }
  if (!byDate.size) return { bars, totalReturnAvailable: false }
  return {
    bars: bars.map((bar) => (byDate.has(bar.date) ? { ...bar, adjClose: byDate.get(bar.date) } : bar)),
    totalReturnAvailable: bars.some((bar) => byDate.has(bar.date)),
  }
}

async function loadSymbol(symbol) {
  const file = path.join(cacheDir, `dbb-${symbol.toLowerCase()}-daily-ohlcv.json`)
  const cached = readCache(file)
  const period2 = Math.floor(Date.now() / 1000)
  const period1 = Math.floor(new Date("2016-01-01T00:00:00Z").getTime() / 1000)
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`
  try {
    const res = await fetch(url, { headers: YAHOO_HEADERS })
    if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`)
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) throw new Error(`Yahoo ${symbol} empty_chart`)
    const bars = barsFromYahooChartResult(result, period2)
    if (!bars.length) throw new Error(`Yahoo ${symbol} no_bars`)
    const withAdj = attachAdjClose(bars, result)
    fs.mkdirSync(cacheDir, { recursive: true })
    fs.writeFileSync(file, JSON.stringify({
      symbol,
      source: "Yahoo Finance chart API v8",
      requestedStart: "2016-01-01",
      fetchedAt: new Date().toISOString(),
      count: withAdj.bars.length,
      first: withAdj.bars[0]?.date ?? null,
      last: withAdj.bars.at(-1)?.date ?? null,
      bars: withAdj.bars,
    }))
    return { bars: withAdj.bars, source: "yahoo", totalReturnAvailable: withAdj.totalReturnAvailable }
  } catch (err) {
    return {
      bars: cached,
      source: cached ? "cache" : "missing",
      error: err?.message || "fetch_failed",
      totalReturnAvailable: Boolean(cached?.some((bar) => Number.isFinite(bar.adjClose))),
    }
  }
}

const barsBySymbol = {}
const loads = []
for (const meta of DAILY_BOTTOM_BUY_WATCHLIST) {
  const loaded = await loadSymbol(meta.symbol)
  loads.push({ symbol: meta.symbol, source: loaded.source, error: loaded.error || null, totalReturnAvailable: loaded.totalReturnAvailable, last: loaded.bars?.at(-1)?.date ?? null })
  if (loaded.bars?.length) barsBySymbol[meta.symbol] = loaded.bars
}

const report = buildTrackReport(DAILY_BOTTOM_BUY_WATCHLIST, barsBySymbol)
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(report))
console.log(JSON.stringify({
  outPath,
  universe: report.universe.length,
  summary: report.summary,
  skipped: report.symbols.filter((row) => !row.ok),
  loads,
}, null, 2))
