#!/usr/bin/env node
/**
 * ETF sell-candidate backtest v4 (research only).
 *
 *   node scripts/etf-sell-backtest-v4.mjs
 *
 * Same 428 quote-close episodes as v1. Reuses the v3 pullback definition.
 * Does not select a sell rule and does not overwrite v1, v2, or v3 results.
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
  SMALL_SAMPLE,
  analyzeSymbolV4,
  formatArmTable,
  formatEtfTable,
  formatMachineTable,
  formatPathTable,
  poolV4,
} from "./lib/etf-sell-backtest-v4.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const V1_JSON = path.join(CACHE, "etf-sell-backtest-result.json")
const V3_JSON = path.join(CACHE, "etf-sell-backtest-v3-result.json")
const OUT_JSON = path.join(CACHE, "etf-sell-backtest-v4-result.json")
const START = "2016-01-01"

const CROSS_IDS = [
  "p10-d3",
  "p10-d5",
  "p10-d7",
  "p10-d10",
  "p15-d3",
  "p15-d5",
  "p15-d7",
  "p15-d10",
  "p20-d3",
  "p20-d5",
  "p20-d7",
  "p20-d10",
]
const CROSS_FIELDS = [
  "reached",
  "pullbacks",
  "pullbackRate",
  "eligible20",
  "censored20",
  "aRate",
  "bRate",
  "aCount",
  "bCount",
  "aAvgRecoveryDays",
  "aAvgExtraUp",
  "bAvgExtraDown",
]

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
    throw new Error(`v4 population ${right.length} does not match v1 population ${left.length}`)
  }
}

function assertV3Pullbacks(arms) {
  if (!fs.existsSync(V3_JSON)) throw new Error("v3 result is missing, so the pullback cross-check cannot run")
  const v3 = JSON.parse(fs.readFileSync(V3_JSON, "utf8"))
  const mismatches = []
  for (const id of CROSS_IDS) {
    const left = v3.pullbacks.find((row) => row.id === id)
    const right = arms.find((row) => row.id === id)
    if (!left || !right) {
      mismatches.push(`${id} missing`)
      continue
    }
    for (const field of CROSS_FIELDS) {
      if (left[field] !== right[field]) mismatches.push(`${id}.${field} v3=${left[field]} v4=${right[field]}`)
    }
  }
  if (mismatches.length) {
    throw new Error(`v4 pullbacks do not match v3:\n${mismatches.join("\n")}`)
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
    const part = analyzeSymbolV4(meta.symbol, enrichBarsWithIndicators(loaded.bars))
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

  const pooled = poolV4(parts)
  assertSamePopulation(pooled.events)
  if (pooled.incomplete !== 12) throw new Error(`incomplete forward count changed: ${pooled.incomplete}`)
  assertV3Pullbacks(pooled.arms)

  const doc = {
    researchOnly: true,
    selectedStrategy: null,
    population: "v1 full-window 3/4 episodes",
    peak: "max close from entry day through the current day",
    sameDayOrder: SAME_DAY_ORDER,
    recoveryWindow: 20,
    recoveryNote: "A/B uses only pullbacks with 20 later sessions still inside the 60-day window",
    stateNote: "Profit state only rises. Exit uses the current state's drawdown from the running peak, not a return from the entry price.",
    smallSample: SMALL_SAMPLE,
    price: "Yahoo chart quote close",
    costs: "none",
    forwardDays: FORWARD_DAYS,
    coverage,
    episodeCount: pooled.episodeCount,
    fullWindowEvents: pooled.events.length,
    incompleteForward: pooled.incomplete,
    firstSignal: pooled.firstSignal,
    lastSignal: pooled.lastSignal,
    preProfit: pooled.preProfit,
    arms: pooled.arms,
    machines: pooled.machines,
    etfs: pooled.etfs,
  }
  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))

  console.log("ETF sell backtest v4 — research only, no rule selected")
  console.log(`Events: ${doc.fullWindowEvents}  incomplete: ${doc.incompleteForward}`)
  console.log(`Signals: ${doc.firstSignal} .. ${doc.lastSignal}`)
  console.log(
    `Reached +5/+10/+15/+20: ${doc.preProfit.reached5}/${doc.preProfit.reached10}/${doc.preProfit.reached15}/${doc.preProfit.reached20}`,
  )
  console.log("")
  console.log(formatPathTable(pooled.preProfit.groups))
  console.log("")
  console.log(formatArmTable(pooled.arms))
  console.log("")
  console.log(formatMachineTable(pooled.machines))
  console.log("")
  console.log(formatEtfTable(pooled.etfs))
  console.log("")
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)}`)
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err)
  process.exit(1)
})
