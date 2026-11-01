#!/usr/bin/env node
/**
 * ETF correction-path study v8 (research only).
 *
 *   node scripts/etf-sell-backtest-v8.mjs
 *
 * Does not select a sell rule and does not overwrite v1–v7 results.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { barsFromYahooChartResult } from "../api/_lib/dailyBottomBuyHandler.js"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import { DAILY_BOTTOM_BUY_ETFS, productionThresholdsMatchFrozen } from "./lib/etf-sell-backtest.mjs"
import { analyzeSymbolV6 } from "./lib/etf-sell-backtest-v6.mjs"
import { buildV8 } from "./lib/etf-sell-backtest-v8.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const V1_JSON = path.join(CACHE, "etf-sell-backtest-result.json")
const V7_JSON = path.join(CACHE, "etf-sell-backtest-v7-result.json")
const OUT_JSON = path.join(CACHE, "etf-sell-backtest-v8-result.json")
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

function assertPriors(events, study) {
  const v1 = JSON.parse(fs.readFileSync(V1_JSON, "utf8"))
  const v7 = JSON.parse(fs.readFileSync(V7_JSON, "utf8"))
  const left = v1.events.map((row) => eventKey(row.etf, row.signal_date, row.entry_price)).sort()
  const right = events.map((row) => eventKey(row.etf, row.signalDate, row.entryPrice)).sort()
  const mismatches = []
  if (left.length !== 428 || right.length !== 428 || left.join("\n") !== right.join("\n")) mismatches.push("population")
  if (v7.fullWindowEvents !== 428 || v7.incompleteForward !== 12) mismatches.push("v7 population")
  if (v7.episodeStarts !== 440) mismatches.push("episodes")
  if (study.events !== 64) mismatches.push(`deep ${study.events}`)
  if (v7.deepCuts?.fastMax !== study.cuts.fastMax || v7.deepCuts?.slowMin !== study.cuts.slowMin) mismatches.push("speed cuts")
  for (const name of ["FAST", "NORMAL", "SLOW"]) {
    const prior = v7.tableA.find((row) => row.speed === name)?.n60
    if (prior !== study.counts[name]) mismatches.push(`${name} v7=${prior} v8=${study.counts[name]}`)
  }
  if (mismatches.length) throw new Error(`v8 stopped on mismatch:\n${mismatches.join("\n")}`)
}

function brief(row) {
  return `${row.id ?? ""} ${row.label} n=${row.n} t10=${row.t10.avg}/${row.t10.n} t20=${row.t20.avg}/${row.t20.n} t40=${row.t40.avg}/${row.t40.n} end=${row.window_end.avg}/${row.window_end.n} peak=${row.peak_recovery_rate} entry=${row.entry_recovery_rate} laterDd=${row.avg_subsequent_drawdown} ${row.sample_small ? "sample_small" : ""} ${row.no_conclusion ? "no_conclusion" : ""}`.trim()
}

async function main() {
  if (!productionThresholdsMatchFrozen()) {
    throw new Error("Product ETF thresholds and FROZEN_THRESHOLDS differ. Backtest stopped.")
  }
  const parts = []
  const closesBySymbol = new Map()
  for (const meta of DAILY_BOTTOM_BUY_ETFS) {
    const loaded = await loadBars(meta.symbol)
    const rows = enrichBarsWithIndicators(loaded.bars)
    closesBySymbol.set(meta.symbol, rows.map((row) => row.close))
    parts.push(analyzeSymbolV6(meta.symbol, rows))
  }
  const events = parts.flatMap((part) => part.events)
  const dates = events.map((event) => event.signalDate).filter(Boolean).sort()
  const study = buildV8(parts, closesBySymbol)
  if (study.selectedStrategy !== null) throw new Error("selectedStrategy must stay null")
  assertPriors(events, study)
  const doc = {
    researchOnly: true,
    selectedStrategy: null,
    lookahead:
      "Checkpoint flags use closes from the day after T0 through that checkpoint. Outcome bars start strictly after the checkpoint. A missing T+20 is not replaced by the window-end close.",
    episodeStarts: parts.reduce((sum, part) => sum + part.episodeCount, 0),
    fullWindowEvents: events.length,
    incompleteForward: parts.reduce((sum, part) => sum + part.incomplete, 0),
    firstSignal: dates[0] ?? null,
    lastSignal: dates.at(-1) ?? null,
    deepEvents: study.events,
    counts: study.counts,
    speedCuts: study.cuts,
    analysisA: study.analysisA,
    analysisB: study.analysisB,
    analysisC: study.analysisC,
    analysisD: study.analysisD,
    analysisE: study.analysisE,
    interaction: study.interaction,
    questions: study.questions,
  }
  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("ETF correction study v8 — research only, selectedStrategy null")
  console.log(`Events ${doc.fullWindowEvents} incomplete ${doc.incompleteForward} episodes ${doc.episodeStarts} deep ${doc.deepEvents} ${JSON.stringify(doc.counts)}`)
  console.log("A SLOW state")
  for (const row of doc.analysisA) {
    console.log(
      `${row.checkpoint} n=${row.n} dd3=${row.additional_3} dd5=${row.additional_5} dd7=${row.additional_7} dd10=${row.additional_10} below=${row.at_or_below_entry} r3=${row.rebound_3} r5=${row.rebound_5} r7=${row.rebound_7} r10=${row.rebound_10}`,
    )
  }
  console.log("C")
  for (const row of doc.analysisC) console.log(brief(row))
  console.log("D")
  for (const row of doc.analysisD) console.log(brief(row))
  console.log("E")
  for (const row of doc.analysisE) console.log(brief(row))
  console.log("Q", JSON.stringify(doc.questions))
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)}`)
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err)
  process.exit(1)
})
