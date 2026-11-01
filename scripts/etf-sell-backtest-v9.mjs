#!/usr/bin/env node
/**
 * ETF correction-path study v9 (research only).
 *
 *   node scripts/etf-sell-backtest-v9.mjs
 *
 * Does not select a sell rule and does not overwrite v1–v8 results.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { barsFromYahooChartResult } from "../api/_lib/dailyBottomBuyHandler.js"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import { DAILY_BOTTOM_BUY_ETFS, productionThresholdsMatchFrozen } from "./lib/etf-sell-backtest.mjs"
import { analyzeSymbolV6 } from "./lib/etf-sell-backtest-v6.mjs"
import { LOCKED_SPEED, buildV9 } from "./lib/etf-sell-backtest-v9.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const V1_JSON = path.join(CACHE, "etf-sell-backtest-result.json")
const V8_JSON = path.join(CACHE, "etf-sell-backtest-v8-result.json")
const OUT_JSON = path.join(CACHE, "etf-sell-backtest-v9-result.json")
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
  const v8 = JSON.parse(fs.readFileSync(V8_JSON, "utf8"))
  const left = v1.events.map((row) => eventKey(row.etf, row.signal_date, row.entry_price)).sort()
  const right = events.map((row) => eventKey(row.etf, row.signalDate, row.entryPrice)).sort()
  const mismatches = []
  if (left.length !== 428 || right.length !== 428 || left.join("\n") !== right.join("\n")) mismatches.push("population")
  if (events.length !== 428) mismatches.push("events")
  if (v8.fullWindowEvents !== 428 || v8.incompleteForward !== 12 || v8.episodeStarts !== 440) mismatches.push("v8 population")
  if (v8.deepEvents !== 64 || study.events !== 64) mismatches.push("deep")
  if (v8.firstSignal !== "2016-02-02" || v8.lastSignal !== "2026-06-25") mismatches.push("dates")
  for (const name of ["FAST", "NORMAL", "SLOW"]) {
    if (v8.counts[name] !== study.counts[name] || v8.counts[name] !== { FAST: 25, NORMAL: 14, SLOW: 25 }[name]) {
      mismatches.push(`${name} v8=${v8.counts[name]} v9=${study.counts[name]}`)
    }
  }
  if (v8.speedCuts?.fastMax !== LOCKED_SPEED.fastMax || v8.speedCuts?.slowMin !== LOCKED_SPEED.slowMin) mismatches.push("speed cuts")
  if (study.withT5 + study.missingT5 !== 64) mismatches.push("t5 coverage")
  if (mismatches.length) throw new Error(`v9 stopped on mismatch:\n${mismatches.join("\n")}`)
}

function cell(row) {
  return `${row.speed ?? ""} ${row.label} n=${row.n} t10=${row.t10.avg}/${row.t10.n} t20=${row.t20.avg}/${row.t20.n} win20=${row.t20.win_rate} t40=${row.t40.avg}/${row.t40.n} end=${row.window_end.avg}/${row.window_end.n} winEnd=${row.window_end.win_rate} entry=${row.entry_recovery_rate} peak=${row.peak_recovery_rate} further=${row.avg_further_drop} ${row.sample_small ? "sample_small" : ""} ${row.no_conclusion ? "no_conclusion" : ""}`.trim()
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
  const incomplete = parts.reduce((sum, part) => sum + part.incomplete, 0)
  const episodeStarts = parts.reduce((sum, part) => sum + part.episodeCount, 0)
  if (incomplete !== 12 || episodeStarts !== 440) {
    throw new Error(`v9 population episodes ${episodeStarts} incomplete ${incomplete}`)
  }
  const study = buildV9(parts, closesBySymbol)
  if (study.selectedStrategy !== null) throw new Error("selectedStrategy must stay null")
  assertPriors(events, study)
  const doc = {
    researchOnly: true,
    selectedStrategy: null,
    lookahead:
      "The T+5 group uses the lowest close from T+1 through T+5 only. Later closes are outcomes and do not fill a missing T+20 or T+40.",
    furtherDropDefinition:
      "Further drop is how much deeper the post-T+5 low is versus T0 than the low already seen by T+5, in percentage points of the T0 close.",
    episodeStarts,
    fullWindowEvents: events.length,
    incompleteForward: incomplete,
    firstSignal: dates[0] ?? null,
    lastSignal: dates.at(-1) ?? null,
    deepEvents: study.events,
    withT5: study.withT5,
    missingT5: study.missingT5,
    counts: study.counts,
    speedCuts: LOCKED_SPEED,
    table1: study.table1,
    table2: study.table2,
    table3: study.table3,
    table4: study.table4,
    questions: study.questions,
  }
  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("ETF correction study v9 — research only, selectedStrategy null")
  console.log(`Events ${doc.fullWindowEvents} incomplete ${doc.incompleteForward} episodes ${doc.episodeStarts} deep ${doc.deepEvents} T5 ${doc.withT5} missing ${doc.missingT5} ${JSON.stringify(doc.counts)}`)
  console.log("TABLE 1")
  for (const row of doc.table1) console.log(cell(row), JSON.stringify(row.speedMix))
  console.log("TABLE 2")
  for (const row of doc.table2) console.log(cell(row))
  console.log("TABLE 3")
  for (const row of doc.table3) console.log(cell(row))
  console.log("TABLE 4")
  for (const row of doc.table4) console.log(row.threshold, cell(row.hit))
  console.log("Q", JSON.stringify(doc.questions))
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)}`)
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err)
  process.exit(1)
})
