#!/usr/bin/env node
/**
 * Individual-stock DBB cross-section diagnostic (research only).
 *
 *   node scripts/validate-daily-bottom-buy-cross-asset-analysis.mjs
 *
 * Fetches Yahoo daily OHLCV for single names. Does not analyze ETFs as subjects.
 * Does not change strategy, thresholds, UI, or API.
 * Writes scripts/.cache/yds-daily-bottom-buy-cross-asset-result.json
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  analyzeEquity,
  assertNoEtfInStudyUniverse,
  extractMsft2026Window,
  poolCrossAsset,
} from "./lib/daily-bottom-buy-cross-asset-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const OUT_JSON = path.join(CACHE, "yds-daily-bottom-buy-cross-asset-result.json")
const START = "2016-01-01"

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
}

function cacheFile(yahoo) {
  return path.join(BAR_DIR, `${yahoo.replace(/[^A-Za-z0-9.-]/g, "_")}.json`)
}

async function fetchYahoo(yahoo) {
  const period1 = Math.floor(new Date(`${START}T00:00:00Z`).getTime() / 1000)
  const period2 = Math.floor(Date.now() / 1000)
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=history`
  const res = await fetch(url, { headers: YAHOO_HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const err = json?.chart?.error
  if (err) throw new Error(err.description || "yahoo chart error")
  const result = json?.chart?.result?.[0]
  const ts = result?.timestamp ?? []
  const q = result?.indicators?.quote?.[0] ?? {}
  const bars = []
  for (let i = 0; i < ts.length; i++) {
    const c = q.close?.[i]
    if (c == null || !Number.isFinite(c) || c <= 0) continue
    const o = Number.isFinite(q.open?.[i]) ? q.open[i] : c
    const h = Number.isFinite(q.high?.[i]) ? q.high[i] : Math.max(o, c)
    const l = Number.isFinite(q.low?.[i]) ? q.low[i] : Math.min(o, c)
    bars.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open: o,
      high: Math.max(h, o, c),
      low: Math.min(l, o, c),
      close: c,
      volume: Number.isFinite(q.volume?.[i]) ? q.volume[i] : 0,
    })
  }
  return bars
}

async function loadBars(yahoo) {
  fs.mkdirSync(BAR_DIR, { recursive: true })
  const cp = cacheFile(yahoo)
  if (fs.existsSync(cp)) {
    const raw = JSON.parse(fs.readFileSync(cp, "utf8"))
    if (Array.isArray(raw.bars) && raw.bars.length) return raw.bars
  }
  const bars = await fetchYahoo(yahoo)
  fs.writeFileSync(
    cp,
    JSON.stringify({
      yahoo,
      source: "Yahoo Finance chart API v8",
      requestedStart: START,
      fetchedAt: new Date().toISOString(),
      count: bars.length,
      first: bars[0]?.date ?? null,
      last: bars[bars.length - 1]?.date ?? null,
      bars,
    }),
  )
  return bars
}

function closeMap(bars) {
  const m = new Map()
  for (const b of bars) m.set(b.date, b.close)
  return m
}

async function main() {
  assertNoEtfInStudyUniverse()
  console.log(`Equity diagnostic: ${EQUITY_CANDIDATES.length} names. ETFs excluded. Thresholds frozen.`)

  let spy = []
  let qqq = []
  try {
    spy = await loadBars("SPY")
    qqq = await loadBars("QQQ")
    console.log(`Benchmarks only (not study members): SPY ${spy.length}, QQQ ${qqq.length}`)
  } catch (err) {
    console.log(`Benchmark fetch failed (${err.message}). Relative strength left null.`)
  }
  const bench = { spy: closeMap(spy), qqq: closeMap(qqq) }

  const results = []
  const coverage = []
  for (const meta of EQUITY_CANDIDATES) {
    try {
      const bars = await loadBars(meta.yahoo)
      if (!bars.length) {
        coverage.push({ symbol: meta.symbol, status: "data unavailable", barCount: 0 })
        results.push({ symbol: meta.symbol, group: meta.group, status: "data unavailable", episodes: [] })
        console.log(`  ${meta.symbol}: data unavailable`)
        continue
      }
      const analyzed = analyzeEquity(meta, bars, bench)
      results.push(analyzed)
      coverage.push({
        symbol: meta.symbol,
        group: meta.group,
        status: analyzed.status,
        barCount: analyzed.barCount ?? bars.length,
        dataStart: analyzed.dataStart ?? bars[0]?.date ?? null,
        dataEnd: analyzed.dataEnd ?? bars[bars.length - 1]?.date ?? null,
        episodeCount: analyzed.episodeCount,
      })
      console.log(`  ${meta.symbol}: ${analyzed.status} bars=${analyzed.barCount ?? bars.length} episodes=${analyzed.episodeCount}`)
    } catch (err) {
      coverage.push({ symbol: meta.symbol, status: "data unavailable", error: err.message })
      results.push({ symbol: meta.symbol, group: meta.group, status: "data unavailable", episodes: [] })
      console.log(`  ${meta.symbol}: data unavailable (${err.message})`)
    }
  }

  const pooled = poolCrossAsset(results)
  let msft = { status: "data unavailable" }
  try {
    const msftBars = await loadBars("MSFT")
    msft = extractMsft2026Window(msftBars)
  } catch (err) {
    msft = { status: "data unavailable", error: err.message }
  }

  const doc = {
    generatedAt: new Date().toISOString(),
    study: "Individual-stock 3/4 follow-through and secondary-low diagnostic",
    disclaimer: {
      strategyUnchanged: true,
      thresholds: FROZEN_THRESHOLDS,
      thresholdsOptimized: false,
      newBuyRulesAdopted: false,
      etfStudyExcluded: true,
      benchmarksNotSubjects: ["SPY", "QQQ"],
      lookAhead: "Signals use data through that close. Low dates are evaluation labels only. hindsight_min_rsi is not tradable.",
      episodeDef: "buildSplitBuyEpisodes rising-edge count>=3, full history after warmup (not the prior ETF test-144 set).",
    },
    coverage,
    totals: {
      requested: EQUITY_CANDIDATES.length,
      dataUnavailable: coverage.filter((c) => c.status === "data unavailable").length,
      insufficientHistory: coverage.filter((c) => c.status === "insufficient history").length,
      enough: coverage.filter((c) => c.status === "충분한 데이터").length,
      needsMore: coverage.filter((c) => c.status === "추가 검증 필요").length,
      episodes: pooled.nEpisodes,
      reached4: pooled.nReached4,
    },
    dropFrom3: pooled.dropFrom3,
    from3: pooled.from3,
    signalTable: pooled.signalTable,
    aux: pooled.aux,
    nearLowOnDeepDrop: pooled.nearLowOnDeepDrop,
    bySymbol: pooled.bySymbol,
    focus: pooled.focus,
    msft2026: msft,
    diagnosis:
      "이번 분석은 전략을 수정하지 않았으며, 향후 매수조건을 개선할 수 있는 후보 신호를 찾기 위한 진단 결과다.",
  }

  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc), "utf8")
  console.log(`Wrote ${OUT_JSON}`)
  console.log(`episodes=${pooled.nEpisodes} symbols_with_episodes=${pooled.nSymbolsWithEpisodes}`)
}

main()
