#!/usr/bin/env node
/**
 * ETF correction-path study v7 (research only).
 *
 *   node scripts/etf-sell-backtest-v7.mjs
 *
 * Does not select a sell rule and does not overwrite v1–v6 results.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { barsFromYahooChartResult } from "../api/_lib/dailyBottomBuyHandler.js"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import { DAILY_BOTTOM_BUY_ETFS, productionThresholdsMatchFrozen } from "./lib/etf-sell-backtest.mjs"
import { analyzeSymbolV6 } from "./lib/etf-sell-backtest-v6.mjs"
import { PATH_CLASS_RULE, buildV7, finishV7 } from "./lib/etf-sell-backtest-v7.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const V1_JSON = path.join(CACHE, "etf-sell-backtest-result.json")
const V6_JSON = path.join(CACHE, "etf-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "etf-sell-backtest-v7-result.json")
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

function assertPopulation(events) {
  const v1 = JSON.parse(fs.readFileSync(V1_JSON, "utf8"))
  const left = v1.events.map((row) => eventKey(row.etf, row.signal_date, row.entry_price)).sort()
  const right = events.map((row) => eventKey(row.etf, row.signalDate, row.entryPrice)).sort()
  if (left.length !== 428 || right.length !== 428 || left.join("\n") !== right.join("\n")) {
    throw new Error(`v7 population ${right.length} does not match v1/v6 population ${left.length}`)
  }
}

function assertV6(study, pooled) {
  const v6 = JSON.parse(fs.readFileSync(V6_JSON, "utf8"))
  const mismatches = []
  if (v6.fullWindowEvents !== 428 || pooled.events.length !== 428) mismatches.push("events")
  if (v6.incompleteForward !== 12 || pooled.incomplete !== 12) mismatches.push("incomplete")
  if (v6.firstSignal !== pooled.firstSignal || v6.lastSignal !== pooled.lastSignal) mismatches.push("dates")
  const expected = { "p10-d5": study.depth[0].events, "p10-d7": study.depth[1].events, "p10-d10": study.depth[2].events }
  for (const [id, count] of Object.entries(expected)) {
    const threshold = id === "p10-d5" ? "-5" : id === "p10-d7" ? "-7" : "-10"
    const row = v6.table1.find((item) => item.entry_band === "+10" && item.correction_threshold === threshold)
    if (!row || row.events !== count) mismatches.push(`${id} events v6=${row?.events} v7=${count}`)
  }
  const speed = v6.speed.find((row) => row.id === "p10-d10")
  if (!speed || speed.cuts.fastMax !== study.deepCuts.fastMax || speed.cuts.slowMin !== study.deepCuts.slowMin) {
    mismatches.push("p10-d10 speed cuts")
  }
  for (const name of ["FAST", "NORMAL", "SLOW"]) {
    const prior = speed?.speeds?.[name]?.n
    const next = study.tableA.find((row) => row.speed === name)?.n60
    if (prior !== next) mismatches.push(`${name} n v6=${prior} v7=${next}`)
  }
  const partitionSum = study.partition.reduce((sum, row) => sum + row.n60, 0)
  if (partitionSum !== study.deepEvents) mismatches.push(`partition ${partitionSum} != ${study.deepEvents}`)
  if (mismatches.length) throw new Error(`v7 stopped on v6 mismatch:\n${mismatches.join("\n")}`)
}

function line(row) {
  return [
    row.speed ?? row.depth ?? "",
    row.rebound ?? row.threshold ?? "",
    `n60=${row.n60}`,
    `n20=${row.n20}`,
    `class=${row.path_class ?? "unlabeled"}`,
    `peak=${row.peak_recovery_rate}`,
    `entry=${row.entry_recovery_rate}`,
    `add=${row.avg_additional_drawdown}/${row.median_additional_drawdown}`,
    `t20=${row.T20_avg} win=${row.T20_win_rate}`,
    `end=${row.window_end_avg} win=${row.window_end_win_rate}`,
    row.sample_small ? "sample_small" : "",
    row.no_conclusion ? "no_conclusion" : "",
  ]
    .filter((part) => part !== "")
    .join(" ")
}

async function main() {
  if (!productionThresholdsMatchFrozen()) {
    throw new Error("Product ETF thresholds and FROZEN_THRESHOLDS differ. Backtest stopped.")
  }
  const parts = []
  for (const meta of DAILY_BOTTOM_BUY_ETFS) {
    const loaded = await loadBars(meta.symbol)
    parts.push(analyzeSymbolV6(meta.symbol, enrichBarsWithIndicators(loaded.bars)))
  }
  const events = parts.flatMap((part) => part.events)
  const dates = events.map((event) => event.signalDate).filter(Boolean).sort()
  const pooled = {
    events,
    incomplete: parts.reduce((sum, part) => sum + part.incomplete, 0),
    episodeCount: parts.reduce((sum, part) => sum + part.episodeCount, 0),
    firstSignal: dates[0] ?? null,
    lastSignal: dates[dates.length - 1] ?? null,
  }
  assertPopulation(events)
  const study = finishV7(buildV7(parts))
  if (study.selectedStrategy !== null) throw new Error("selectedStrategy must stay null")
  assertV6(study, pooled)
  const doc = {
    researchOnly: true,
    selectedStrategy: null,
    classRule: PATH_CLASS_RULE,
    lookahead:
      "Groups use depth, speed, and a running-low rebound that has already printed. T+10 and T+20 are outcomes only. A rebound signal on the outcome bar is not yet known.",
    forwardDays: 60,
    episodeStarts: pooled.episodeCount,
    fullWindowEvents: pooled.events.length,
    incompleteForward: pooled.incomplete,
    firstSignal: pooled.firstSignal,
    lastSignal: pooled.lastSignal,
    reached10: events.filter((row) => row.hit10).length,
    depth: study.depth,
    tableA: study.tableA,
    tableB: study.tableB,
    tableC: study.tableC,
    partition: study.partition,
    deepCuts: study.deepCuts,
    plus15: study.plus15,
    hypotheses: study.hypotheses,
  }
  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("ETF correction study v7 — research only, selectedStrategy null")
  console.log(`Events ${doc.fullWindowEvents}  incomplete ${doc.incompleteForward}  episodes ${doc.episodeStarts}`)
  console.log("DEPTH")
  for (const row of doc.depth) console.log(line(row))
  console.log("TABLE A +10/-10 x SPEED")
  for (const row of doc.tableA) console.log(line(row))
  console.log("TABLE B +10/-10/SLOW x REBOUND")
  for (const row of doc.tableB) console.log(line(row))
  console.log("TABLE C +10/-10 x SPEED x REBOUND")
  for (const row of doc.tableC) console.log(line(row))
  console.log("H", JSON.stringify(doc.hypotheses))
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)}`)
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err)
  process.exit(1)
})
