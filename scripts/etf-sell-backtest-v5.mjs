#!/usr/bin/env node
/**
 * ETF sell-candidate backtest v5 (research only).
 *
 *   node scripts/etf-sell-backtest-v5.mjs
 *
 * Compares an immediate sale at the first pullback with holding later closes.
 * Does not select a sell rule and does not overwrite v1–v4 results.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { barsFromYahooChartResult } from "../api/_lib/dailyBottomBuyHandler.js"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import { DAILY_BOTTOM_BUY_ETFS, productionThresholdsMatchFrozen } from "./lib/etf-sell-backtest.mjs"
import {
  FORWARD_DAYS,
  analyzeSymbolV5,
  formatDecisionTable,
  formatEdgeTable,
  poolV5,
} from "./lib/etf-sell-backtest-v5.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const V1_JSON = path.join(CACHE, "etf-sell-backtest-result.json")
const V4_JSON = path.join(CACHE, "etf-sell-backtest-v4-result.json")
const OUT_JSON = path.join(CACHE, "etf-sell-backtest-v5-result.json")
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
  const v1 = JSON.parse(fs.readFileSync(V1_JSON, "utf8"))
  const left = v1.events.map((row) => eventKey(row.etf, row.signal_date, row.entry_price)).sort()
  const right = events.map((row) => eventKey(row.etf, row.signalDate, row.entryPrice)).sort()
  if (left.length !== 428 || right.length !== 428 || left.join("\n") !== right.join("\n")) {
    throw new Error(`v5 population ${right.length} does not match v1 population ${left.length}`)
  }
}

function assertV4Events(profit) {
  const v4 = JSON.parse(fs.readFileSync(V4_JSON, "utf8"))
  const mismatches = []
  for (const row of profit) {
    const prior = v4.arms.find((item) => item.id === row.id)
    if (!prior) {
      mismatches.push(`${row.id} missing in v4`)
      continue
    }
    if (prior.pullbacks !== row.n) mismatches.push(`${row.id} n v4=${prior.pullbacks} v5=${row.n}`)
    if (prior.aRate !== row.reclaimRate) mismatches.push(`${row.id} reclaim v4=${prior.aRate} v5=${row.reclaimRate}`)
    if (prior.eligible20 !== row.reclaimEligible) {
      mismatches.push(`${row.id} eligible v4=${prior.eligible20} v5=${row.reclaimEligible}`)
    }
    if (prior.aAvgRecoveryDays !== row.reclaimDays) {
      mismatches.push(`${row.id} days v4=${prior.aAvgRecoveryDays} v5=${row.reclaimDays}`)
    }
  }
  if (mismatches.length) throw new Error(`v5 T0 events do not match v4:\n${mismatches.join("\n")}`)
}

async function main() {
  if (!productionThresholdsMatchFrozen()) {
    throw new Error("Product ETF thresholds and FROZEN_THRESHOLDS differ. Backtest stopped.")
  }

  const parts = []
  const coverage = []
  for (const meta of DAILY_BOTTOM_BUY_ETFS) {
    const loaded = await loadBars(meta.symbol)
    const part = analyzeSymbolV5(meta.symbol, enrichBarsWithIndicators(loaded.bars))
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
      missed10: part.missed,
    })
  }

  const pooled = poolV5(parts)
  assertSamePopulation(pooled.events)
  if (pooled.incomplete !== 12) throw new Error(`incomplete forward count changed: ${pooled.incomplete}`)
  if (pooled.missed !== 183) throw new Error(`+10 miss count changed: ${pooled.missed}`)
  assertV4Events(pooled.profit)

  const doc = {
    researchOnly: true,
    selectedStrategy: null,
    question: "At the first pullback, was selling the close better than holding the later closes that exist?",
    population: "v1 full-window 3/4 episodes",
    peak: "max close from entry day through the current day",
    t0: "first close after the profit arm that is the stated percent below that peak",
    hold: "T+N is included only when that session is inside the 60-day window. It is not replaced by the day-60 close.",
    advantage: "T+20 hold average minus the immediate-sale average on the same episodes. Median edge is the difference of medians. Beat rate is the share whose later close is above the T0 close.",
    price: "Yahoo chart quote close",
    costs: "none",
    forwardDays: FORWARD_DAYS,
    coverage,
    episodeCount: pooled.episodeCount,
    fullWindowEvents: pooled.events.length,
    incompleteForward: pooled.incomplete,
    missed10: pooled.missed,
    firstSignal: pooled.firstSignal,
    lastSignal: pooled.lastSignal,
    profit: pooled.profit,
    losses: pooled.losses,
  }
  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))

  console.log("ETF sell backtest v5 — research only, no rule selected")
  console.log(`Events: ${doc.fullWindowEvents}  incomplete: ${doc.incompleteForward}  miss10: ${doc.missed10}`)
  console.log(`Signals: ${doc.firstSignal} .. ${doc.lastSignal}`)
  console.log("")
  console.log(formatDecisionTable(pooled.profit))
  console.log("")
  console.log(formatEdgeTable(pooled.profit))
  console.log("")
  console.log(formatDecisionTable(pooled.losses))
  console.log("")
  console.log(formatEdgeTable(pooled.losses))
  console.log("")
  for (const row of pooled.profit.filter((item) => ["p10-d5", "p15-d5", "p20-d5", "p10-d10", "p15-d10"].includes(item.id))) {
    console.log(row.label)
    for (const etf of row.etfs) {
      console.log(
        `  ${etf.etf} n=${etf.n} sell=${etf.sellAvg} t20=${etf.t20Avg} n20=${etf.t20n} win=${etf.t20Win} reclaim=${etf.reclaimRate} ${etf.sampleNote ?? ""} ${etf.reclaimNote ?? ""}`.trim(),
      )
    }
  }
  console.log("")
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)}`)
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err)
  process.exit(1)
})
