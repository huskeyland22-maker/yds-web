#!/usr/bin/env node
/**
 * SOXL mechanical -10% and -15% limit-buy study (research only).
 *
 *   node scripts/soxl-crash-buy-v1.mjs
 *
 * Writes only:
 *   scripts/.cache/soxl-crash-buy-v1-daily-ohlcv.json
 *   scripts/.cache/soxl-crash-buy-v1-result.json
 *
 * Does not read or write ETF sell v1–v9 results or dbb-* caches.
 * Returns are omitted when split adjustment is not confirmed.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { barsFromYahooChartResult } from "../api/_lib/dailyBottomBuyHandler.js"
import {
  COMMISSION,
  CONSERVATIVE_SLIPPAGE,
  LIMIT_FACTORS,
  SELECTED_STRATEGY,
  assessBars,
  buyAndHoldPriceReturn,
  confirmSplitAdjustment,
  holdFromFillClose,
  quoteDividendGap,
  splitsFromChartResult,
  summarizeDividendGap,
  summarizeStrategy,
  buildOrders,
  withoutOpenSession,
} from "./lib/soxl-crash-buy-v1.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const OHLC_PATH = path.join(CACHE, "soxl-crash-buy-v1-daily-ohlcv.json")
const RESULT_PATH = path.join(CACHE, "soxl-crash-buy-v1-result.json")
const START = "2010-03-01"

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
}

function assertOwnPath(filePath) {
  const base = path.basename(filePath)
  if (base.startsWith("dbb-") || base.includes("etf-sell-backtest")) {
    throw new Error(`refusing to write protected cache ${base}`)
  }
}

async function fetchChart() {
  const period1 = Math.floor(new Date(`${START}T00:00:00Z`).getTime() / 1000)
  const period2 = Math.floor(Date.now() / 1000)
  const url =
    "https://query1.finance.yahoo.com/v8/finance/chart/SOXL" +
    `?period1=${period1}&period2=${period2}&interval=1d&events=div%2Csplit&includeAdjustedClose=true`
  const res = await fetch(url, { headers: YAHOO_HEADERS })
  if (!res.ok) throw new Error(`Yahoo SOXL HTTP ${res.status}`)
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error("Yahoo SOXL empty chart")
  return result
}

function alignedAdjCloses(chartResult, bars) {
  const ts = chartResult?.timestamp ?? []
  const close = chartResult?.indicators?.quote?.[0]?.close ?? []
  const adj = chartResult?.indicators?.adjclose?.[0]?.adjclose ?? []
  const byDate = new Map()
  for (let i = 0; i < ts.length; i++) {
    const c = close?.[i]
    if (c == null || !Number.isFinite(c) || c <= 0) continue
    const date = new Date(ts[i] * 1000).toISOString().slice(0, 10)
    const adjClose = Number(adj?.[i])
    if (Number.isFinite(adjClose) && adjClose > 0) byDate.set(date, adjClose)
  }
  return bars.map((bar) => byDate.get(bar.date) ?? null)
}

function strategyBlock(bars, factor, mode) {
  const summary = summarizeStrategy(bars, factor, mode)
  const orders = buildOrders(bars, factor, mode)
  return {
    ...summary,
    versusSameSessionClose: mode === "base" ? holdFromFillClose(orders, bars) : null,
  }
}

async function main() {
  assertOwnPath(OHLC_PATH)
  assertOwnPath(RESULT_PATH)
  const chart = await fetchChart()
  const parsed = barsFromYahooChartResult(chart)
  const session = withoutOpenSession(parsed, Date.now(), chart?.meta?.currentTradingPeriod?.regular?.end)
  const bars = session.bars
  const yahooSplits = splitsFromChartResult(chart)
  const barCheck = assessBars(bars)
  const splitCheck = confirmSplitAdjustment(bars, yahooSplits)
  const dividend = summarizeDividendGap(alignedAdjCloses(chart, bars).map((adj, i) => quoteDividendGap(bars[i].close, adj)))
  const qualityPass = barCheck.ok && splitCheck.confirmed

  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(
    OHLC_PATH,
    JSON.stringify({
      symbol: "SOXL",
      source: "Yahoo Finance chart API v8 quote OHLC",
      requestedStart: START,
      fetchedAt: new Date().toISOString(),
      priceAdjustment: splitCheck.confirmed ? "split-adjusted quote OHLC confirmed against published splits" : "unconfirmed",
      droppedOpenSession: session.droppedDate,
      count: bars.length,
      first: bars[0]?.date ?? null,
      last: bars.at(-1)?.date ?? null,
      bars,
    }),
  )

  const result = {
    researchOnly: true,
    selectedStrategy: SELECTED_STRATEGY,
    reproducesDiscretionaryStrategy: false,
    implemented: ["A", "B"],
    notImplemented: ["C", "D"],
    assumptions: {
      order: "One day order after close T for session T+1. Unfilled orders expire that session.",
      signalSample: "Each session is an independent hypothetical order, including days that overlap another fill.",
      capitalPath: "A separate one-position path holds a fill for the observation horizon and places no new order during that window. The horizon is not a sell rule.",
      baseFill: "Gap fills at the open. Touch fills at the limit. Commission 0. Slippage 0.",
      conservativeFill: `Gap fills at the limit plus ${CONSERVATIVE_SLIPPAGE} slippage. Touch is not a fill. Commission ${COMMISSION}.`,
      costsFixedBeforeRun: true,
    },
    quality: {
      pass: qualityPass,
      droppedOpenSession: session.droppedDate,
      bars: barCheck,
      splits: splitCheck,
      dividendGap: dividend,
    },
    buyAndHoldPriceReturn: null,
    strategies: null,
  }

  if (qualityPass) {
    result.buyAndHoldPriceReturn = {
      basis: "first close to last close, quote price, dividends excluded",
      first: bars[0].date,
      last: bars.at(-1).date,
      return: buyAndHoldPriceReturn(bars),
    }
    result.strategies = {
      A: {
        limit: "prior close x 0.90",
        base: strategyBlock(bars, LIMIT_FACTORS.A, "base"),
        conservative: strategyBlock(bars, LIMIT_FACTORS.A, "conservative"),
      },
      B: {
        limit: "prior close x 0.85",
        base: strategyBlock(bars, LIMIT_FACTORS.B, "base"),
        conservative: strategyBlock(bars, LIMIT_FACTORS.B, "conservative"),
      },
    }
  }

  fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2))
  console.log(
    JSON.stringify({
      qualityPass,
      count: bars.length,
      first: barCheck.first,
      last: barCheck.last,
      splitIssues: splitCheck.issues,
      barIssues: barCheck.issues,
      wrote: [path.basename(OHLC_PATH), path.basename(RESULT_PATH)],
    }),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
