#!/usr/bin/env node
/**
 * ETF correction-path study v6 (research only).
 *
 *   node scripts/etf-sell-backtest-v6.mjs
 *
 * Does not select a sell rule and does not overwrite v1–v5 results.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { barsFromYahooChartResult } from "../api/_lib/dailyBottomBuyHandler.js"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import { DAILY_BOTTOM_BUY_ETFS, productionThresholdsMatchFrozen } from "./lib/etf-sell-backtest.mjs"
import {
  CLASS_RULE,
  FOCUS_ETFS,
  FORWARD_DAYS,
  analyzeSymbolV6,
  formatTable,
  poolV6,
} from "./lib/etf-sell-backtest-v6.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const V1_JSON = path.join(CACHE, "etf-sell-backtest-result.json")
const V5_JSON = path.join(CACHE, "etf-sell-backtest-v5-result.json")
const OUT_JSON = path.join(CACHE, "etf-sell-backtest-v6-result.json")
const START = "2016-01-01"
const V5_IDS = ["p10-d5", "p10-d7", "p10-d10", "p15-d5", "p15-d7", "p15-d10", "p20-d5", "p20-d7", "p20-d10"]

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
    throw new Error(`v6 population ${right.length} does not match v1 population ${left.length}`)
  }
}

function assertV5(pooled) {
  const v5 = JSON.parse(fs.readFileSync(V5_JSON, "utf8"))
  if (pooled.missed !== v5.missed10) throw new Error(`miss10 ${pooled.missed} != v5 ${v5.missed10}`)
  const mismatches = []
  for (const id of V5_IDS) {
    const prior = v5.profit.find((row) => row.id === id)
    const next = pooled.tables.find((row) => row.id === id)
    if (!prior || !next) {
      mismatches.push(`${id} missing`)
      continue
    }
    if (prior.n !== next.events) mismatches.push(`${id} n v5=${prior.n} v6=${next.events}`)
    if (prior.reclaimEligible !== next.reclaim20_eligible) {
      mismatches.push(`${id} eligible v5=${prior.reclaimEligible} v6=${next.reclaim20_eligible}`)
    }
    if (prior.reclaimRate !== next.reclaim20_rate) {
      mismatches.push(`${id} reclaim20 v5=${prior.reclaimRate} v6=${next.reclaim20_rate}`)
    }
  }
  if (mismatches.length) throw new Error(`v6 corrections do not match v5:\n${mismatches.join("\n")}`)
}

async function main() {
  if (!productionThresholdsMatchFrozen()) {
    throw new Error("Product ETF thresholds and FROZEN_THRESHOLDS differ. Backtest stopped.")
  }
  const parts = []
  const coverage = []
  for (const meta of DAILY_BOTTOM_BUY_ETFS) {
    const loaded = await loadBars(meta.symbol)
    const part = analyzeSymbolV6(meta.symbol, enrichBarsWithIndicators(loaded.bars))
    parts.push(part)
    coverage.push({
      symbol: meta.symbol,
      source: loaded.source,
      bars: loaded.bars.length,
      episodes: part.episodeCount,
      fullWindowEvents: part.events.length,
      incomplete: part.incomplete,
      missed10: part.missed,
    })
  }
  const pooled = poolV6(parts)
  assertSamePopulation(pooled.events)
  if (pooled.incomplete !== 12) throw new Error(`incomplete ${pooled.incomplete}`)
  if (pooled.events.length !== 428) throw new Error(`events ${pooled.events.length}`)
  assertV5(pooled)

  const doc = {
    researchOnly: true,
    selectedStrategy: null,
    classRule: CLASS_RULE,
    population: "v1 full-window 3/4 episodes",
    forwardDays: FORWARD_DAYS,
    horizonNote:
      "T+N is N sessions after the correction and is included only inside the original 60-session window. window_end is the entry+60 close and is not used to fill a missing T+N.",
    coverage,
    episodeCount: pooled.episodeCount,
    fullWindowEvents: pooled.events.length,
    incompleteForward: pooled.incomplete,
    reached10: pooled.reached10,
    reached15: pooled.reached15,
    reached20: pooled.reached20,
    missed10: pooled.missed,
    firstSignal: pooled.firstSignal,
    lastSignal: pooled.lastSignal,
    table1: pooled.tables.map((row) => ({
      entry_band: row.entry_band,
      correction_threshold: row.correction_threshold,
      events: row.events,
      sample_small: row.sample_small,
      purchase_recovery_rate: row.purchase_recovery_rate,
      prior_peak_recovery_rate: row.prior_peak_recovery_rate,
      new_low_rate: row.new_low_rate,
      avg_additional_drawdown: row.avg_additional_drawdown,
      median_additional_drawdown: row.median_additional_drawdown,
      avg_rebound_from_low: row.avg_rebound_from_low,
      median_rebound_from_low: row.median_rebound_from_low,
    })),
    table2: pooled.tables.map((row) => ({
      entry_band: row.entry_band,
      correction_threshold: row.correction_threshold,
      T5_avg: row.T5_avg,
      T5_n: row.T5_n,
      T10_avg: row.T10_avg,
      T10_n: row.T10_n,
      T20_avg: row.T20_avg,
      T20_n: row.T20_n,
      T40_avg: row.T40_avg,
      T40_n: row.T40_n,
      T60_avg: row.T60_avg,
      T60_n: row.T60_n,
      T60_note: row.T60_note,
      window_end_avg: row.window_end_avg,
      window_end_n: row.window_end_n,
      T20_win_rate: row.T20_win_rate,
      T60_win_rate: row.T60_win_rate,
      window_end_win_rate: row.window_end_win_rate,
    })),
    table3: pooled.tables.map((row) => ({
      entry_band: row.entry_band,
      correction_threshold: row.correction_threshold,
      recovered_to_entry_rate: row.recovered_to_entry_rate,
      avg_days_to_entry_recovery: row.avg_days_to_entry_recovery,
      median_days_to_entry_recovery: row.median_days_to_entry_recovery,
      recovered_to_peak_rate: row.recovered_to_peak_rate,
      avg_days_to_peak_recovery: row.avg_days_to_peak_recovery,
      median_days_to_peak_recovery: row.median_days_to_peak_recovery,
      reclaim20_rate: row.reclaim20_rate,
      reclaim20_eligible: row.reclaim20_eligible,
    })),
    table4: pooled.tables
      .filter((row) => ["-10", "-15", "-20"].includes(row.correction_threshold))
      .map((row) => ({
        entry_band: row.entry_band,
        threshold: row.correction_threshold,
        events: row.events,
        sample_small: row.sample_small,
        additional_5_rate: row.additional_5_rate,
        additional_10_rate: row.additional_10_rate,
        additional_15_rate: row.additional_15_rate,
        new_low_rate: row.new_low_rate,
        avg_max_drawdown: row.avg_max_drawdown,
        median_max_drawdown: row.median_max_drawdown,
        avg_rebound_from_low: row.avg_rebound_from_low,
      })),
    table5: pooled.missedTables.map((row) => ({
      first_drawdown_threshold: row.correction_threshold,
      events: row.events,
      sample_small: row.sample_small,
      purchase_recovery_rate: row.purchase_recovery_rate,
      T5_avg: row.T5_avg,
      T10_avg: row.T10_avg,
      T20_avg: row.T20_avg,
      T20_n: row.T20_n,
      T40_avg: row.T40_avg,
      T60_avg: row.T60_avg,
      T60_n: row.T60_n,
      window_end_avg: row.window_end_avg,
      additional_10_rate: row.additional_10_rate,
      additional_20_rate: row.additional_20_rate,
      new_low_rate: row.new_low_rate,
    })),
    speed: pooled.tables.map((row) => ({
      id: row.id,
      cuts: row.speed_cuts,
      speeds: row.speeds,
    })),
    rebound: pooled.tables.map((row) => ({ id: row.id, rebound: row.rebound })),
    classes: pooled.tables.map((row) => ({ id: row.id, classes: row.classes })),
    focusEtfs: FOCUS_ETFS,
    etfs: pooled.focus,
    missedDetail: pooled.missedTables,
    details: pooled.tables,
  }
  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("ETF correction study v6 — research only, no sell rule selected")
  console.log(
    `Events ${doc.fullWindowEvents}  incomplete ${doc.incompleteForward}  episodes ${doc.episodeCount}  +10/${doc.reached10} +15/${doc.reached15} +20/${doc.reached20} miss ${doc.missed10}`,
  )
  console.log(formatTable(pooled.tables))
  console.log("")
  console.log(formatTable(pooled.missedTables))
  console.log("")
  for (const row of pooled.tables.filter((item) => ["p10-d5", "p10-d7", "p10-d10", "p15-d5", "p15-d10"].includes(item.id))) {
    const cuts = row.speed_cuts
    console.log(
      row.id,
      "speed",
      cuts ? `fast<=${cuts.fastMax} slow>=${cuts.slowMin}` : "n/a",
      "FAST",
      row.speeds.FAST.n,
      row.speeds.FAST.priorPeakRecoveryRate,
      row.speeds.FAST.t20Avg,
      "NORMAL",
      row.speeds.NORMAL.n,
      row.speeds.NORMAL.priorPeakRecoveryRate,
      row.speeds.NORMAL.t20Avg,
      "SLOW",
      row.speeds.SLOW.n,
      row.speeds.SLOW.priorPeakRecoveryRate,
      row.speeds.SLOW.t20Avg,
    )
    console.log(
      "  rebound5",
      row.rebound.p5.n,
      "peakAfter",
      row.rebound.p5.peakAfterRate,
      "newLowAfter",
      row.rebound.p5.newLowAfterRate,
      "missPeak",
      row.rebound.p5.missPeakRate,
    )
    console.log(
      "  class",
      "N",
      row.classes.NORMAL_CORRECTION.n,
      "D",
      row.classes.DANGEROUS_CORRECTION.n,
      "B",
      row.classes.TREND_BREAK.n,
    )
  }
  console.log("")
  for (const etf of FOCUS_ETFS) {
    console.log(etf)
    for (const row of pooled.tables.filter((item) =>
      ["p10-d5", "p10-d7", "p10-d10", "p15-d5", "p15-d7", "p15-d10"].includes(item.id),
    )) {
      const mine = row.etfs.find((item) => item.etf === etf)
      console.log(
        `  ${row.id} n=${mine.events} peak=${mine.prior_peak_recovery_rate} r20=${mine.reclaim20_rate}/${mine.reclaim20_eligible} add=${mine.avg_additional_drawdown} reb=${mine.avg_rebound_from_low} t20=${mine.T20_avg} n20=${mine.T20_n} ${mine.sample_small || ""}`,
      )
    }
  }
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)}`)
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err)
  process.exit(1)
})
