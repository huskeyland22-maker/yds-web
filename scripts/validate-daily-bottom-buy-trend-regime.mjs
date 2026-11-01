#!/usr/bin/env node
/**
 * Trend-regime diagnostic (research only).
 *   node scripts/validate-daily-bottom-buy-trend-regime.mjs
 * Reads scripts/.cache/eq-ohlcv. Does not change strategy, thresholds, UI, or API.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  analyzeSymbolTrend,
  assertNoEtfInStudyUniverse,
  msftTrendSnapshot,
  poolTrendRegime,
} from "./lib/daily-bottom-buy-trend-regime-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-trend-regime-result.json")

function loadCached(yahoo) {
  const cp = path.join(BAR_DIR, `${yahoo.replace(/[^A-Za-z0-9.-]/g, "_")}.json`)
  if (!fs.existsSync(cp)) return null
  const raw = JSON.parse(fs.readFileSync(cp, "utf8"))
  return Array.isArray(raw.bars) ? raw.bars : null
}

function closeMap(bars) {
  const m = new Map()
  if (!bars) return m
  for (const b of bars) m.set(b.date, b.close)
  return m
}

function main() {
  assertNoEtfInStudyUniverse()
  console.log("Trend-regime diagnostic. 48 names. ETFs excluded.")
  const bench = { spy: closeMap(loadCached("SPY")), qqq: closeMap(loadCached("QQQ")) }
  const analyzed = []
  for (const meta of EQUITY_CANDIDATES) {
    const bars = loadCached(meta.yahoo)
    if (!bars?.length) {
      analyzed.push({ symbol: meta.symbol, status: "data unavailable", episodes: [] })
      console.log(`  ${meta.symbol}: data unavailable`)
      continue
    }
    const row = analyzeSymbolTrend(meta, bars, bench)
    console.log(`  ${meta.symbol}: episodes120=${row.episodes.length}`)
    analyzed.push(row)
  }
  const pooled = poolTrendRegime(analyzed)
  const msft = msftTrendSnapshot(loadCached("MSFT"), bench)
  const doc = {
    generatedAt: new Date().toISOString(),
    study: "Uptrend pullback vs downtrend decline (120d correction stages)",
    disclaimer: {
      strategyUnchanged: true,
      thresholds: FROZEN_THRESHOLDS,
      newBuyRulesAdopted: false,
      regimeIsNotARating: true,
      regimeRule:
        "up = close>MA200 AND MA200 20-day slope>0 AND MA50>MA200. down = close<MA200 AND slope<=0 AND MA50<MA200. else neutral if inputs exist.",
      atrCut: "low ATR% < 3, high ATR% >= 4. Fixed, not searched.",
      etfStudyExcluded: true,
      lookAhead: "Regime is taken on the stage date using data through that close.",
    },
    totals: {
      requested: EQUITY_CANDIDATES.length,
      withData: analyzed.filter((a) => a.status === "ok").length,
      episodes120: pooled.nEpisodes120,
    },
    byStage: pooled.byStage,
    band10to30: pooled.band10to30,
    features: pooled.features,
    atrInUptrend: pooled.atrInUptrend,
    combos: pooled.combos,
    largeMae: pooled.largeMae,
    msft2026: msft,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc), "utf8")
  console.log(`Wrote ${OUT_JSON}`)
  console.log(`episodes120=${pooled.nEpisodes120}`)
}

main()
