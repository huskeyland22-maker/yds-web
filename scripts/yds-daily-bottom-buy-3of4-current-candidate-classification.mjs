#!/usr/bin/env node
/**
 * Classify the latest exact 3-of-4 equity candidates.
 *   node scripts/yds-daily-bottom-buy-3of4-current-candidate-classification.mjs
 *
 * Read-only. Does not change production code, UI, API, DB, or strategy.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import { conditionFlags } from "./lib/daily-bottom-buy-validation-core.mjs"
import {
  EPISODE_DEF,
  FROZEN_THRESHOLDS,
  buildSplitBuyEpisodes,
} from "./lib/daily-bottom-split-buy-sim.mjs"
import {
  WARMUP_IDX,
  attachObservationFeatures,
  assertNoEtfInStudyUniverse,
} from "./lib/daily-bottom-buy-cross-asset-validation.mjs"
import { drawdownFromRollingHigh } from "./lib/daily-bottom-buy-correction-stage-validation.mjs"
import { researchEquityUniverse } from "./lib/equity-daily-bottom-buy.mjs"
import { barsFromYahooChartResult } from "../api/_lib/dailyBottomBuyHandler.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-3of4-current-candidate-classification-result.json")
const DEPTH = 120
const LOOKBACK_DAYS = 30
const EMPTY_SCAN_DAYS = 10
const PRIOR_SYMBOLS = ["JPM", "AMT", "RTX", "HD", "NEE", "PLD"]
const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
}

function roundTo(v, digits) {
  if (v == null || !Number.isFinite(Number(v))) return null
  return Number(Number(v).toFixed(digits))
}

function loadCached(yahoo) {
  const cp = path.join(BAR_DIR, `${yahoo.replace(/[^A-Za-z0-9.-]/g, "_")}.json`)
  if (!fs.existsSync(cp)) return null
  const raw = JSON.parse(fs.readFileSync(cp, "utf8"))
  return Array.isArray(raw.bars) ? raw.bars : null
}

async function fetchYahooBars(yahoo) {
  const period2 = Math.floor(Date.now() / 1000)
  const period1 = period2 - 400 * 86400
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=history`
  const res = await fetch(url, { headers: YAHOO_HEADERS, cache: "no-store" })
  if (!res.ok) throw new Error(`Yahoo ${yahoo} HTTP ${res.status}`)
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error(`Yahoo ${yahoo} empty_chart`)
  return barsFromYahooChartResult(result, period2)
}

function classify(flags) {
  if (flags.count !== 3) return null
  const met = []
  const unmet = []
  const named = [
    ["rsi", "RSI", flags.rsi],
    ["stoch", "Stoch", flags.stoch],
    ["bb", "BB", flags.bb],
    ["ma", "MA20", flags.ma],
  ]
  for (const [id, label, on] of named) (on ? met : unmet).push({ id, label })
  const combination = met.map((row) => row.label).join(" + ")
  const type = flags.ma ? "B" : "A"
  return { type, combination, met: met.map((row) => row.label), unmet: unmet.map((row) => row.label) }
}

function snapshot(meta, bars, idx) {
  const bar = bars[idx]
  const flags = conditionFlags(bar, FROZEN_THRESHOLDS)
  const kind = classify(flags)
  return {
    symbol: meta.symbol,
    name: meta.name,
    date: bar.date,
    close: roundTo(bar.close, 2),
    score: flags.count,
    rsi: roundTo(bar.rsi14, 2),
    stoch: roundTo(bar.stochK, 2),
    bb: roundTo(bar.bbPctB, 2),
    ma20Gap: roundTo(bar.ma20DevPct, 2),
    atr: roundTo(bar.atrPct, 2),
    dd120: roundTo(drawdownFromRollingHigh(bars, idx, DEPTH), 2),
    type: kind?.type ?? null,
    combination: kind?.combination ?? null,
    met: kind?.met ?? [],
    unmet: kind?.unmet ?? [],
  }
}

function prepare(meta, rawBars) {
  const enriched = attachObservationFeatures(enrichBarsWithIndicators(rawBars), null, null)
  const byDate = new Map()
  enriched.forEach((bar, idx) => byDate.set(bar.date, idx))
  return { meta, bars: enriched, byDate }
}

function episodesInWindow(prepared, dates) {
  const want = new Set(dates)
  const rows = []
  for (const item of prepared) {
    const { bars, meta } = item
    if (bars.length < 30) continue
    const fromIdx = Math.min(WARMUP_IDX, Math.max(0, bars.length - 1))
    const built = buildSplitBuyEpisodes(bars, FROZEN_THRESHOLDS, { fromIdx, toIdx: bars.length }, EPISODE_DEF)
    for (const ep of built) {
      if (ep.openCount !== 3) continue
      const date = bars[ep.openIdx].date
      if (!want.has(date)) continue
      const row = snapshot(meta, bars, ep.openIdx)
      rows.push(row)
    }
  }
  return rows
}

function countsByDate(rows, dates) {
  return dates.map((date) => {
    const day = rows.filter((row) => row.date === date)
    const a = day.filter((row) => row.type === "A").length
    const b = day.filter((row) => row.type === "B").length
    return { date, typeA: a, typeB: b, total: a + b }
  })
}

function dayPattern(daily) {
  const active = daily.filter((row) => row.total > 0)
  return {
    aOnly: active.filter((row) => row.typeA > 0 && row.typeB === 0).length,
    bOnly: active.filter((row) => row.typeB > 0 && row.typeA === 0).length,
    both: active.filter((row) => row.typeA > 0 && row.typeB > 0).length,
    none: daily.filter((row) => row.total === 0).length,
  }
}

function assertMath() {
  const a = classify({ rsi: true, stoch: true, bb: true, ma: false, count: 3 })
  const b = classify({ rsi: true, stoch: false, bb: true, ma: true, count: 3 })
  const four = classify({ rsi: true, stoch: true, bb: true, ma: true, count: 4 })
  if (a.type !== "A" || a.combination !== "RSI + Stoch + BB" || a.unmet.join() !== "MA20") throw new Error("type A")
  if (b.type !== "B" || b.combination !== "RSI + BB + MA20") throw new Error("type B")
  if (four !== null) throw new Error("four")
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor
      cursor += 1
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return out
}

async function main() {
  assertMath()
  assertNoEtfInStudyUniverse()
  console.log("node scripts/yds-daily-bottom-buy-3of4-current-candidate-classification.mjs")
  const universe = researchEquityUniverse()
  const loaded = await mapPool(universe, 6, async (meta) => {
    try {
      const bars = await fetchYahooBars(meta.yahoo)
      if (!bars?.length) throw new Error("empty")
      return { meta, bars, source: "yahoo" }
    } catch (error) {
      const cached = loadCached(meta.yahoo)
      return { meta, bars: cached, source: cached ? "cache" : "missing", error: String(error?.message || error) }
    }
  })
  const prepared = []
  for (const row of loaded) {
    if (!row.bars?.length || row.bars.length < DEPTH) {
      console.log(`  ${row.meta.symbol}: ${row.source} unavailable`)
      continue
    }
    prepared.push({ ...prepare(row.meta, row.bars), source: row.source })
    console.log(`  ${row.meta.symbol}: ${row.source} bars=${row.bars.length} last=${row.bars[row.bars.length - 1].date}`)
  }
  const dateCounts = new Map()
  for (const item of prepared) {
    for (const bar of item.bars) dateCounts.set(bar.date, (dateCounts.get(bar.date) || 0) + 1)
  }
  const calendar = [...dateCounts.entries()]
    .filter(([, n]) => n >= Math.ceil(prepared.length * 0.5))
    .map(([date]) => date)
    .sort()
  const latest = calendar.at(-1) ?? null
  const last30 = calendar.slice(-LOOKBACK_DAYS)
  const last10 = calendar.slice(-EMPTY_SCAN_DAYS)
  const onDate = (date) => prepared.flatMap((item) => {
    const idx = item.byDate.get(date)
    if (idx == null) return []
    const row = snapshot(item.meta, item.bars, idx)
    return row.score === 3 ? [row] : []
  })
  const latestRows = latest ? onDate(latest) : []
  const tenDayCounts = countsByDate(last10.flatMap((date) => onDate(date).map((row) => row)), last10)
  const discoveredDate = latestRows.length ? latest : [...last10].reverse().find((date) => onDate(date).length > 0) ?? null
  const discovered = discoveredDate && discoveredDate !== latest ? onDate(discoveredDate) : latestRows
  const episodeRows = episodesInWindow(prepared, last30)
  const episodeDaily = countsByDate(episodeRows, last30)
  const prior = PRIOR_SYMBOLS.map((symbol) => {
    const item = prepared.find((row) => row.meta.symbol === symbol)
    if (!item) return { symbol, status: "해당 기간 후보 아님", reason: "no data" }
    const hits = last30.flatMap((date) => {
      const idx = item.byDate.get(date)
      if (idx == null) return []
      const row = snapshot(item.meta, item.bars, idx)
      return row.score === 3 ? [row] : []
    })
    if (!hits.length) {
      const idx = item.byDate.get(latest)
      const now = idx == null ? null : snapshot(item.meta, item.bars, idx)
      return { symbol, name: item.meta.name, status: "해당 기간 후보 아님", latestScore: now?.score ?? null, latestDate: now?.date ?? null }
    }
    return { symbol, name: item.meta.name, status: "found", hits }
  })
  const doc = {
    generatedAt: new Date().toISOString(),
    definition: {
      thresholds: FROZEN_THRESHOLDS,
      exact3: "A day is a 3/4 candidate when that session's frozen condition count is exactly 3. Same indicator path as the equity candidate view.",
      typeA: "RSI, Stoch, and BB pass, and MA20 gap is above -4.2%.",
      typeB: "The other three exact-3 combinations. MA20 passes.",
      latest: "The latest date shared by at least half of the loaded symbols.",
      episodes: "Episode opens use the existing split-buy episode rule and count only opens whose Day 0 is inside the last 30 shared sessions.",
      priorWindow: "The six names are checked on exact-3 sessions inside those same 30 sessions. Classification uses that session only.",
      notASignal: "No weight, threshold, or scan change.",
    },
    coverage: {
      symbols: universe.length,
      loaded: prepared.length,
      yahoo: prepared.filter((row) => row.source === "yahoo").length,
      cache: prepared.filter((row) => row.source === "cache").length,
      latest,
      last30Start: last30[0] ?? null,
      last30End: last30.at(-1) ?? null,
    },
    latestCandidates: latestRows,
    discoveredDate,
    discoveredCandidates: discovered,
    tenDayCounts,
    episodeDaily,
    episodePattern: dayPattern(episodeDaily),
    priorNames: prior,
  }
  const aN = latestRows.filter((row) => row.type === "A").length
  const bN = latestRows.filter((row) => row.type === "B").length
  doc.latestSummary = {
    n: latestRows.length,
    typeA: aN,
    typeB: bN,
    typeASharePct: latestRows.length ? roundTo((aN / latestRows.length) * 100, 2) : null,
    typeBSharePct: latestRows.length ? roundTo((bN / latestRows.length) * 100, 2) : null,
  }
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc))
  console.log(`wrote ${OUT_JSON}`)
  console.log(interpret(doc).join("\n"))
  console.log("production 변경 없음")
}

function rowLine(row) {
  return `${row.symbol} ${row.name} ${row.date} close ${row.close} score ${row.score} TYPE ${row.type} ${row.combination} RSI ${row.rsi} Stoch ${row.stoch} BB ${row.bb} MA20 ${row.ma20Gap} ATR ${row.atr} DD120 ${row.dd120} met ${row.met.join("+")} unmet ${row.unmet.join("+")}`
}

function interpret(doc) {
  const lines = []
  lines.push(`latest ${doc.coverage.latest} loaded ${doc.coverage.loaded} yahoo ${doc.coverage.yahoo} cache ${doc.coverage.cache}`)
  lines.push("1 latest candidates")
  if (!doc.latestCandidates.length) {
    lines.push("최근 거래일 3/4 후보 없음")
    for (const day of doc.tenDayCounts) lines.push(`${day.date} A ${day.typeA} B ${day.typeB} total ${day.total}`)
    lines.push(`first found ${doc.discoveredDate || "none"}`)
    for (const row of doc.discoveredCandidates) lines.push(rowLine(row))
  } else {
    for (const row of doc.latestCandidates) lines.push(rowLine(row))
  }
  lines.push(`2 TYPE A n ${doc.latestSummary.typeA} share ${doc.latestSummary.typeASharePct} | TYPE B n ${doc.latestSummary.typeB} share ${doc.latestSummary.typeBSharePct}`)
  lines.push("3 episode pattern")
  for (const day of doc.episodeDaily) lines.push(`${day.date} A ${day.typeA} B ${day.typeB} total ${day.total}`)
  lines.push(`A only ${doc.episodePattern.aOnly} B only ${doc.episodePattern.bOnly} both ${doc.episodePattern.both}`)
  lines.push("4 prior six")
  for (const row of doc.priorNames) {
    if (row.status !== "found") {
      lines.push(`${row.symbol} 해당 기간 후보 아님 latest ${row.latestDate || "-"} score ${row.latestScore ?? "-"}`)
      continue
    }
    for (const hit of row.hits) lines.push(rowLine(hit))
  }
  return lines
}

main()
