#!/usr/bin/env node
/**
 * Calendar walk-forward of RSI+Stoch+BB versus the other exact 3-of-4 opens.
 *   node scripts/yds-daily-bottom-buy-3of4-walkforward-research.mjs
 *
 * Does not change production code, UI, API, DB, thresholds, or strategy.
 * Periods are fixed. No threshold search.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import { summarizeNumeric } from "./lib/daily-bottom-buy-validation-core.mjs"
import {
  EPISODE_DEF,
  FROZEN_THRESHOLDS,
  buildSplitBuyEpisodes,
} from "./lib/daily-bottom-split-buy-sim.mjs"
import {
  EQUITY_CANDIDATES,
  MIN_BARS,
  WARMUP_IDX,
  attachObservationFeatures,
  assertNoEtfInStudyUniverse,
} from "./lib/daily-bottom-buy-cross-asset-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-3of4-walkforward-result.json")

const HORIZON = 60
const NEED = 120
const MIN_N = 20
const MIN_SYMBOL = 10
const KEYS = [
  { id: "rsi", flag: "flagRsi" },
  { id: "stoch", flag: "flagStoch" },
  { id: "bb", flag: "flagBb" },
  { id: "ma", flag: "flagMa" },
]
const PERIODS = [
  { id: "p1", label: "2016-2021", start: "2016-01-01", end: "2021-12-31" },
  { id: "p2", label: "2022-2023", start: "2022-01-01", end: "2023-12-31" },
  { id: "p3", label: "2024-2026", start: "2024-01-01", end: "2026-09-25" },
]
const ROLLING = [2018, 2019, 2020, 2021, 2022, 2023, 2024].map((year) => ({
  id: `${year}-${year + 2}`,
  label: `${year}-${year + 2}`,
  start: `${year}-01-01`,
  end: `${year + 2}-12-31`,
}))

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function rate(n, d) {
  if (!d) return null
  return round2((n / d) * 100)
}

function pctChange(next, base) {
  if (!(base > 0) || !Number.isFinite(next)) return null
  return (next / base - 1) * 100
}

function inRange(date, start, end) {
  return date >= start && date <= end
}

function comboId(bar) {
  const on = KEYS.filter((k) => bar[k.flag]).map((k) => k.id)
  return on.length === 3 ? on.join("_") : "other"
}

function forwardFrom(closes, entry) {
  const px = closes[entry]
  const end = Math.min(entry + HORIZON, closes.length - 1)
  if (!(px > 0) || end <= entry) return null
  let minPx = px
  let minAt = entry
  let maxPx = px
  for (let i = entry + 1; i <= end; i++) {
    if (closes[i] < minPx) {
      minPx = closes[i]
      minAt = i
    }
    if (closes[i] > maxPx) maxPx = closes[i]
  }
  return {
    full: end - entry === HORIZON,
    d20: pctChange(closes[entry + 20], px),
    d60: pctChange(closes[entry + 60], px),
    mae: ((px - minPx) / px) * 100,
    daysToLow: minAt - entry,
    hit5: maxPx >= px * 1.05 - 1e-8,
    hit10: maxPx >= px * 1.1 - 1e-8,
    hitM5: minPx <= px * 0.95 + 1e-8,
    hitM10: minPx <= px * 0.9 + 1e-8,
    hitM15: minPx <= px * 0.85 + 1e-8,
  }
}

function hits(list, key) {
  return rate(list.filter((r) => r.fwd?.[key]).length, list.length)
}

function metric(list) {
  const use = list.filter((r) => r.fwd?.full)
  return {
    n: use.length,
    d20: summarizeNumeric(use.map((r) => r.fwd.d20)),
    d60: summarizeNumeric(use.map((r) => r.fwd.d60)),
    mae: summarizeNumeric(use.map((r) => r.fwd.mae)),
    hitM5Pct: hits(use, "hitM5"),
    hitM10Pct: hits(use, "hitM10"),
    hitM15Pct: hits(use, "hitM15"),
    hit5Pct: hits(use, "hit5"),
    hit10Pct: hits(use, "hit10"),
  }
}

function view(block) {
  return {
    n: block.n,
    d20: block.d20?.median ?? null,
    d60: block.d60?.median ?? null,
    mae: block.mae?.median ?? null,
    hitM5Pct: block.hitM5Pct,
    hitM10Pct: block.hitM10Pct,
    hitM15Pct: block.hitM15Pct,
    hit5Pct: block.hit5Pct,
    hit10Pct: block.hit10Pct,
  }
}

function pairVerdict(a, b) {
  if (a.n < MIN_N || b.n < MIN_N) return { comparable: false, verdict: "insufficient" }
  const maeLower = a.mae.median < b.mae.median
  const maeHigher = a.mae.median > b.mae.median
  const tailLower = a.hitM10Pct < b.hitM10Pct
  const tailHigher = a.hitM10Pct > b.hitM10Pct
  const lowerCount = Number(maeLower) + Number(tailLower)
  const higherCount = Number(maeHigher) + Number(tailHigher)
  let verdict = "tie"
  if (lowerCount === 2) verdict = "advantage"
  else if (higherCount === 2 || (lowerCount === 1 && higherCount === 1) || (higherCount === 1 && lowerCount === 0)) verdict = "mismatch"
  else if (lowerCount === 1 && higherCount === 0) verdict = "partial"
  return {
    comparable: true,
    verdict,
    maeDiff: round2(a.mae.median - b.mae.median),
    tailDiff: round2(a.hitM10Pct - b.hitM10Pct),
  }
}

function conclude(fixed, rolling) {
  const comp = fixed.filter((row) => row.comparison.comparable)
  const adv = comp.filter((row) => row.comparison.verdict === "advantage").length
  const partial = comp.filter((row) => row.comparison.verdict === "partial").length
  const mismatch = comp.filter((row) => row.comparison.verdict === "mismatch").length
  const roll = rolling.filter((row) => row.comparison.comparable)
  const rollAdv = roll.filter((row) => row.comparison.verdict === "advantage").length
  const rollPartial = roll.filter((row) => row.comparison.verdict === "partial").length
  const rollMismatch = roll.filter((row) => row.comparison.verdict === "mismatch").length
  const counts = { fixedComparable: comp.length, adv, partial, mismatch, rollComparable: roll.length, rollAdv, rollPartial, rollMismatch }
  if (adv >= 2 && partial === 0 && mismatch === 0 && rollMismatch === 0 && rollAdv > 0 && rollAdv >= rollPartial) {
    return { ...counts, code: "A", label: "시간축 OOS에서도 A(RSI+Stoch+BB)의 하방 위험이 반복적으로 낮게 나타난다." }
  }
  if (adv === 0 && rollAdv === 0) {
    return { ...counts, code: "C", label: "시간축 OOS에서 차이가 재현되지 않아 기존 결과만으로 전략 변경 근거가 부족하다." }
  }
  return { ...counts, code: "B", label: "일부 기간에서는 반복되지만 시간에 따라 방향이 달라져 일관성이 부족하다." }
}

function loadCached(yahoo) {
  const cp = path.join(BAR_DIR, `${yahoo.replace(/[^A-Za-z0-9.-]/g, "_")}.json`)
  if (!fs.existsSync(cp)) return null
  const raw = JSON.parse(fs.readFileSync(cp, "utf8"))
  return Array.isArray(raw.bars) ? raw.bars : null
}

function analyzeSymbol(meta, rawBars) {
  if (!rawBars?.length || rawBars.length < MIN_BARS) {
    return { symbol: meta.symbol, status: rawBars?.length ? "insufficient history" : "data unavailable" }
  }
  const bars = attachObservationFeatures(enrichBarsWithIndicators(rawBars))
  const fromIdx = Math.min(WARMUP_IDX, Math.max(0, bars.length - 1))
  const built = buildSplitBuyEpisodes(bars, FROZEN_THRESHOLDS, { fromIdx, toIdx: bars.length }, EPISODE_DEF)
  const episodes = []
  let short = 0
  let openedAt4 = 0
  for (const ep of built) {
    if (ep.openCount !== 3) {
      if (ep.openCount >= 4) openedAt4 += 1
      continue
    }
    if (ep.openIdx + NEED >= bars.length || ep.openIdx < 20) {
      short += 1
      continue
    }
    const bar = bars[ep.openIdx]
    const combo = comboId(bar)
    if (combo === "other" || bar.count !== 3) continue
    const closes = []
    for (let i = ep.openIdx; i <= ep.openIdx + HORIZON; i++) closes.push(bars[i].close)
    episodes.push({
      symbol: meta.symbol,
      date: bar.date,
      group: combo === "rsi_stoch_bb" ? "A" : "B",
      combo,
      fwd: forwardFrom(closes, 0),
    })
  }
  return { symbol: meta.symbol, status: "ok", built: built.length, short, openedAt4, episodes }
}

function slicePair(rows) {
  const a = metric(rows.filter((r) => r.group === "A"))
  const b = metric(rows.filter((r) => r.group === "B"))
  const symbolsA = new Set(rows.filter((r) => r.group === "A").map((r) => r.symbol))
  const symbolsB = new Set(rows.filter((r) => r.group === "B").map((r) => r.symbol))
  let both = 0
  for (const symbol of symbolsA) if (symbolsB.has(symbol)) both += 1
  return {
    A: a,
    B: b,
    comparison: pairVerdict(a, b),
    symbolsA: symbolsA.size,
    symbolsB: symbolsB.size,
    symbolsBoth: both,
  }
}

function symbolConcentration(rows) {
  const aRows = rows.filter((r) => r.group === "A")
  const b = metric(rows.filter((r) => r.group === "B"))
  const bySymbol = new Map()
  for (const row of aRows) {
    if (!bySymbol.has(row.symbol)) bySymbol.set(row.symbol, [])
    bySymbol.get(row.symbol).push(row)
  }
  const ranked = [...bySymbol.entries()].map(([symbol, list]) => {
    const block = metric(list)
    const enough = block.n >= MIN_SYMBOL
    return {
      symbol,
      n: block.n,
      insufficient: !enough,
      mae: block.mae?.median ?? null,
      hitM10Pct: block.hitM10Pct,
      belowBBoth: enough && block.mae.median < b.mae.median && block.hitM10Pct < b.hitM10Pct,
    }
  }).sort((x, y) => y.n - x.n || x.symbol.localeCompare(y.symbol))
  const top5 = ranked.slice(0, 5)
  const top5Set = new Set(top5.map((row) => row.symbol))
  const withoutTop5 = slicePair(rows.filter((r) => r.group === "B" || !top5Set.has(r.symbol)))
  const enough = ranked.filter((row) => !row.insufficient)
  return {
    symbols: ranked.length,
    episodes: aRows.length,
    top10: ranked.slice(0, 10),
    top5SharePct: rate(top5.reduce((s, row) => s + row.n, 0), aRows.length),
    symbolsN10: enough.length,
    symbolsBelowBBoth: enough.filter((row) => row.belowBBoth).length,
    perSymbol: ranked,
    withoutTop5: {
      A: view(withoutTop5.A),
      B: view(withoutTop5.B),
      comparison: withoutTop5.comparison,
    },
  }
}

function assertMath() {
  const low = { n: 30, mae: { median: 3 }, hitM10Pct: 10 }
  const high = { n: 30, mae: { median: 7 }, hitM10Pct: 30 }
  const opposite = { n: 30, mae: { median: 7 }, hitM10Pct: 5 }
  if (pairVerdict(low, high).verdict !== "advantage") throw new Error("advantage")
  if (pairVerdict(low, opposite).verdict !== "mismatch") throw new Error("opposite")
  if (pairVerdict(low, { n: 30, mae: { median: 7 }, hitM10Pct: 10 }).verdict !== "partial") throw new Error("partial")
  if (pairVerdict({ n: 19, mae: { median: 1 }, hitM10Pct: 1 }, high).comparable !== false) throw new Error("small")
  if (!inRange("2021-12-31", PERIODS[0].start, PERIODS[0].end)) throw new Error("p1")
  if (inRange("2022-01-01", PERIODS[0].start, PERIODS[0].end)) throw new Error("p1 edge")
  if (!inRange("2024-01-01", PERIODS[2].start, PERIODS[2].end)) throw new Error("p3")
  if (ROLLING.length !== 7 || ROLLING[0].id !== "2018-2020" || ROLLING[6].id !== "2024-2026") throw new Error("rolling")
}

function fmt(id, group, block) {
  const v = view(block)
  const mark = v.n < MIN_N ? " sample 부족" : ""
  return `${id} ${group}: n ${v.n} D+20 ${v.d20} D+60 ${v.d60} MAE ${v.mae} -5 ${v.hitM5Pct} -10 ${v.hitM10Pct} -15 ${v.hitM15Pct} +5 ${v.hit5Pct} +10 ${v.hit10Pct}${mark}`
}

function fmtCmp(id, row) {
  const c = row.comparison
  if (!c.comparable) return `${id}: sample 부족 A ${row.A.n} B ${row.B.n}`
  return `${id}: A MAE ${view(row.A).mae} B MAE ${view(row.B).mae} diff ${c.maeDiff} | A -10 ${view(row.A).hitM10Pct} B -10 ${view(row.B).hitM10Pct} diff ${c.tailDiff} | ${c.verdict} | symbols A ${row.symbolsA} B ${row.symbolsB} both ${row.symbolsBoth}`
}

function main() {
  assertMath()
  assertNoEtfInStudyUniverse()
  console.log("node scripts/yds-daily-bottom-buy-3of4-walkforward-research.mjs")
  const blocks = []
  for (const meta of EQUITY_CANDIDATES) {
    const row = analyzeSymbol(meta, loadCached(meta.yahoo))
    console.log(`  ${meta.symbol}: ${row.status} episodes=${row.episodes?.length ?? 0}`)
    blocks.push(row)
  }
  const ready = blocks.filter((b) => b.status === "ok")
  const rows = ready.flatMap((b) => b.episodes || [])
  const fixed = PERIODS.map((period) => {
    const subset = rows.filter((r) => inRange(r.date, period.start, period.end))
    return { ...period, n: subset.length, ...slicePair(subset) }
  })
  const rolling = ROLLING.map((window) => {
    const subset = rows.filter((r) => inRange(r.date, window.start, window.end))
    return { ...window, n: subset.length, ...slicePair(subset) }
  })
  const names = symbolConcentration(rows)
  const verdict = conclude(fixed, rolling)
  const outside = rows.filter((r) => !PERIODS.some((period) => inRange(r.date, period.start, period.end))).length
  const doc = {
    generatedAt: new Date().toISOString(),
    definition: {
      universe: "Existing 48 single names. ETF names are not included.",
      thresholds: FROZEN_THRESHOLDS,
      episodeDef: EPISODE_DEF,
      exactly3: "Day 0 is the episode open only when that open has exactly 3 of the 4 frozen conditions. The same forward close window as the prior 3/4 studies is used.",
      groups: "A is RSI+Stoch+BB. B is the other three exact-3 combinations pooled. The two groups are separate episodes.",
      split: "Periods use the Day 0 calendar date. The per-symbol 70/30 split is not used.",
      periods: PERIODS,
      rolling: "Each window is three calendar years. Windows overlap, so the counts are not independent samples.",
      verdict: "Comparable only when both groups have n at least 20. Advantage means A has a lower MAE median and a lower additional -10% rate. Partial means exactly one of those two is lower and the other is equal. Mismatch means A is higher on both, higher on one and lower on the other, or higher on one and equal on the other. A lower D+60 is not a failure.",
      conclusionRule: "A requires at least two comparable fixed periods, all of them advantage, no rolling mismatch, and rolling advantages at least as common as rolling partials. C applies when neither the fixed periods nor the rolling windows show an advantage. Any other mix is B.",
      notASignal: "No result is a production filter.",
    },
    coverage: {
      symbols: EQUITY_CANDIDATES.length,
      withData: ready.length,
      episodesBuilt: ready.reduce((s, b) => s + b.built, 0),
      openedAt4Excluded: ready.reduce((s, b) => s + b.openedAt4, 0),
      shortHorizonExcluded: ready.reduce((s, b) => s + b.short, 0),
      sample: rows.length,
      groupA: rows.filter((r) => r.group === "A").length,
      groupB: rows.filter((r) => r.group === "B").length,
      outsidePeriods: outside,
    },
    fixed,
    rolling,
    concentration: names,
    conclusion: verdict,
  }
  doc.interpretation = interpret(doc)
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc))
  if (doc.coverage.sample !== 1447 || outside !== 0) {
    throw new Error(`sample ${doc.coverage.sample} outside ${outside}`)
  }
  console.log(`wrote ${OUT_JSON}`)
  console.log(doc.interpretation.join("\n"))
  console.log(`${doc.conclusion.code}. ${doc.conclusion.label}`)
  console.log("production 변경 없음")
}

function interpret(doc) {
  const lines = []
  lines.push(`n ${doc.coverage.sample} A ${doc.coverage.groupA} B ${doc.coverage.groupB}`)
  lines.push("fixed")
  for (const row of doc.fixed) {
    lines.push(fmt(row.label, "A", row.A))
    lines.push(fmt(row.label, "B", row.B))
    lines.push(fmtCmp(row.label, row))
  }
  lines.push("rolling")
  for (const row of doc.rolling) lines.push(fmtCmp(row.label, row))
  const top = doc.concentration.top10.map((row) => `${row.symbol} ${row.n}${row.insufficient ? " 참고" : ` MAE ${row.mae} -10 ${row.hitM10Pct}`}`).join(", ")
  lines.push(`A symbols ${doc.concentration.symbols} top5 share ${doc.concentration.top5SharePct}%`)
  lines.push(`top10 ${top}`)
  lines.push(`n>=10 symbols ${doc.concentration.symbolsN10} both-below-B ${doc.concentration.symbolsBelowBBoth}`)
  const ex = doc.concentration.withoutTop5
  lines.push(`without top5 A n ${ex.A.n} MAE ${ex.A.mae} -10 ${ex.A.hitM10Pct} | B n ${ex.B.n} MAE ${ex.B.mae} -10 ${ex.B.hitM10Pct} | ${ex.comparison.comparable ? ex.comparison.verdict : "sample 부족"}`)
  lines.push(`fixed advantage ${doc.conclusion.adv}/${doc.conclusion.fixedComparable} rolling advantage ${doc.conclusion.rollAdv}/${doc.conclusion.rollComparable} rolling mismatch ${doc.conclusion.rollMismatch}`)
  return lines
}

main()
