#!/usr/bin/env node
/**
 * Correction-stage diagnostic (research only).
 *
 *   node scripts/validate-daily-bottom-buy-correction-stages.mjs
 *
 * Reads scripts/.cache/eq-ohlcv from the prior equity study. No new universe.
 * Does not change strategy, thresholds, UI, API, or production code.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  analyzeSymbolCorrections,
  assertNoEtfInStudyUniverse,
  msftStageContext,
  poolCorrectionStudy,
} from "./lib/daily-bottom-buy-correction-stage-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-correction-stage-result.json")

function cacheFile(yahoo) {
  return path.join(BAR_DIR, `${yahoo.replace(/[^A-Za-z0-9.-]/g, "_")}.json`)
}

function loadCached(yahoo) {
  const cp = cacheFile(yahoo)
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

function slim(windowPack) {
  if (!windowPack) return null
  return {
    nEpisodes: windowPack.nEpisodes,
    byLevel: windowPack.byLevel,
    ma200: windowPack.ma200,
    atrAtMinus10: windowPack.atrAtMinus10,
    volumeAtMinus10: windowPack.volumeAtMinus10,
    patterns: windowPack.patterns,
    patternA: windowPack.patternA,
  }
}

function main() {
  assertNoEtfInStudyUniverse()
  console.log("Correction-stage diagnostic. 48 names. ETFs excluded. Thresholds frozen.")
  const spy = loadCached("SPY")
  const qqq = loadCached("QQQ")
  const bench = { spy: closeMap(spy), qqq: closeMap(qqq) }
  const analyzed = []
  for (const meta of EQUITY_CANDIDATES) {
    const bars = loadCached(meta.yahoo)
    if (!bars?.length) {
      analyzed.push({ symbol: meta.symbol, status: "data unavailable", byWindow: {} })
      console.log(`  ${meta.symbol}: data unavailable`)
      continue
    }
    const row = analyzeSymbolCorrections(meta, bars, bench)
    const n60 = row.byWindow[60]?.n ?? 0
    const n120 = row.byWindow[120]?.n ?? 0
    console.log(`  ${meta.symbol}: episodes60=${n60} episodes120=${n120}`)
    analyzed.push(row)
  }
  const pooled = poolCorrectionStudy(analyzed)
  const msftBars = loadCached("MSFT")
  const msft = msftStageContext(msftBars)
  const doc = {
    generatedAt: new Date().toISOString(),
    study: "Individual-stock correction stages (causal trailing-high episodes)",
    disclaimer: {
      strategyUnchanged: true,
      thresholds: FROZEN_THRESHOLDS,
      thresholdsOptimized: false,
      newBuyRulesAdopted: false,
      etfStudyExcluded: true,
      episodeStart: "First close at or below -5% of the trailing high, using only that window. The later low is not an input.",
      episodeEnd: "Close back within 2% of the frozen peak, or 252 trading days, whichever first.",
      evaluationHorizon: 60,
    },
    totals: {
      requested: EQUITY_CANDIDATES.length,
      withData: analyzed.filter((a) => a.status === "ok").length,
      episodes60: pooled.window60.nEpisodes,
      episodes120: pooled.window120.nEpisodes,
      episodes52w: pooled.dd52.nEpisodes,
    },
    window60: slim(pooled.window60),
    window120: slim(pooled.window120),
    dd52: slim(pooled.dd52),
    msft2026: msft,
    diagnosis:
      "이번 분석은 전략을 변경하지 않았으며, 개별 종목의 조정 단계와 저점 형성 과정을 이해하기 위한 진단이다.",
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc), "utf8")
  console.log(`Wrote ${OUT_JSON}`)
  console.log(`episodes60=${doc.totals.episodes60} episodes120=${doc.totals.episodes120}`)
}

main()
