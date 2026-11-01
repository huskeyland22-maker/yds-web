#!/usr/bin/env node
/**
 * Exactly-3 signal, 120-day depth, and the later 5-day pause. Research only.
 *   node scripts/yds-daily-bottom-buy-3of4-depth-t0-research.mjs
 *
 * Does not change production code, UI, API, DB, thresholds, or strategy.
 * T0 is not assumed to be an entry.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import {
  summarizeNumeric,
  timeSplitBars,
  TRAIN_RATIO,
} from "./lib/daily-bottom-buy-validation-core.mjs"
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
import {
  DEPTH_WINDOW,
  atrBand,
  JUDGE_GATES,
} from "./lib/daily-bottom-buy-individual-stock-train-test-validation.mjs"
import { drawdownFromRollingHigh } from "./lib/daily-bottom-buy-correction-stage-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-3of4-depth-t0-result.json")

const SEARCH = 60
const HORIZON = 60
const NEED = SEARCH + HORIZON
const REBREAK_DAYS = 10
const LEVELS = [10, 15, 20, 25, 30]
const MIN_N = JUDGE_GATES.minN

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

function num(rows, pick) {
  return summarizeNumeric(rows.map(pick))
}

function minOf(arr, a, b) {
  let m = Infinity
  for (let i = a; i <= b; i++) if (arr[i] < m) m = arr[i]
  return m
}

function isNewLow(closes, t) {
  if (t <= 0) return false
  return closes[t] < minOf(closes, 0, t - 1)
}

/** Same rule as the stabilization study: none of the last k closes undercut the low since Day 0. */
function noNewLow(closes, t, k) {
  if (t < k) return false
  for (let i = t - k + 1; i <= t; i++) if (isNewLow(closes, i)) return false
  return true
}

function firstT0(closes) {
  const end = Math.min(SEARCH, closes.length - 1)
  for (let t = 5; t <= end; t++) if (noNewLow(closes, t, 5)) return t
  return null
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
  const at = (n) => (entry + n <= closes.length - 1 ? pctChange(closes[entry + n], px) : null)
  return {
    full: end - entry === HORIZON,
    d20: at(20),
    d60: at(60),
    mae: ((px - minPx) / px) * 100,
    daysToLow: minAt - entry,
    hit5: maxPx >= px * 1.05 - 1e-8,
    hit10: maxPx >= px * 1.1 - 1e-8,
    hitM5: minPx <= px * 0.95 + 1e-8,
    hitM10: minPx <= px * 0.9 + 1e-8,
    hitM15: minPx <= px * 0.85 + 1e-8,
  }
}

function describe(closes) {
  const t0 = firstT0(closes)
  let rebreak = null
  if (t0 != null) {
    const preLow = minOf(closes, 0, t0 - 1)
    const end = Math.min(t0 + REBREAK_DAYS, closes.length - 1)
    rebreak = false
    for (let t = t0 + 1; t <= end; t++) {
      if (closes[t] < preLow) {
        rebreak = true
        break
      }
    }
  }
  return {
    t0,
    rebreak,
    t0VsDay0: t0 == null ? null : pctChange(closes[t0], closes[0]),
    fwd0: forwardFrom(closes, 0),
    fwdT0: t0 == null ? null : forwardFrom(closes, t0),
  }
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
  const split = timeSplitBars(bars, TRAIN_RATIO)
  const fromIdx = Math.min(WARMUP_IDX, Math.max(0, bars.length - 1))
  const built = buildSplitBuyEpisodes(bars, FROZEN_THRESHOLDS, { fromIdx, toIdx: bars.length }, EPISODE_DEF)
  const episodes = []
  let short = 0
  let openedAt4 = 0
  let noDepth = 0
  for (const ep of built) {
    if (ep.openCount !== 3) {
      if (ep.openCount >= 4) openedAt4 += 1
      continue
    }
    if (ep.openIdx + NEED >= bars.length) {
      short += 1
      continue
    }
    const dd = drawdownFromRollingHigh(bars, ep.openIdx, DEPTH_WINDOW)
    if (dd == null) {
      noDepth += 1
      continue
    }
    const closes = []
    for (let i = ep.openIdx; i <= ep.openIdx + NEED; i++) closes.push(bars[i].close)
    const path = describe(closes)
    const t0Idx = path.t0 == null ? null : ep.openIdx + path.t0
    episodes.push({
      symbol: meta.symbol,
      split: ep.openIdx < split.splitIdx ? "train" : "test",
      openDate: ep.openDate,
      t0Date: t0Idx == null ? null : bars[t0Idx].date,
      dd: round2(dd),
      atrDay0: atrBand(bars[ep.openIdx].atrPct),
      atrT0: t0Idx == null ? null : atrBand(bars[t0Idx].atrPct),
      ...path,
    })
  }
  return { symbol: meta.symbol, status: "ok", split, built: built.length, short, openedAt4, noDepth, episodes }
}

function hits(list, key) {
  return rate(list.filter((r) => r.f?.[key]).length, list.length)
}

function metricBlock(rows, pick) {
  const use = rows.map((r) => ({ split: r.split, f: pick(r) })).filter((r) => r.f && r.f.full)
  const build = (list) => ({
    n: list.length,
    d20: num(list, (r) => r.f.d20),
    d60: num(list, (r) => r.f.d60),
    mae: num(list, (r) => r.f.mae),
    daysToLow: num(list, (r) => r.f.daysToLow),
    hitM5Pct: hits(list, "hitM5"),
    hitM10Pct: hits(list, "hitM10"),
    hitM15Pct: hits(list, "hitM15"),
    hit5Pct: hits(list, "hit5"),
    hit10Pct: hits(list, "hit10"),
  })
  return {
    all: build(use),
    train: build(use.filter((r) => r.split === "train")),
    test: build(use.filter((r) => r.split === "test")),
  }
}

function depthSlice(rows, level) {
  const subset = level == null ? rows : rows.filter((r) => r.dd <= -level)
  const withT0 = subset.filter((r) => r.t0 != null)
  const dayStat = (list, pick) => ({
    all: num(list, pick),
    train: num(list.filter((r) => r.split === "train"), pick),
    test: num(list.filter((r) => r.split === "test"), pick),
  })
  return {
    level,
    n: subset.length,
    trainN: subset.filter((r) => r.split === "train").length,
    testN: subset.filter((r) => r.split === "test").length,
    day0: metricBlock(subset, (r) => r.fwd0),
    t0: {
      n: withT0.length,
      trainN: withT0.filter((r) => r.split === "train").length,
      testN: withT0.filter((r) => r.split === "test").length,
      ratePct: {
        all: rate(withT0.length, subset.length),
        train: rate(withT0.filter((r) => r.split === "train").length, subset.filter((r) => r.split === "train").length),
        test: rate(withT0.filter((r) => r.split === "test").length, subset.filter((r) => r.split === "test").length),
      },
      day: dayStat(withT0, (r) => r.t0),
      vsDay0: dayStat(withT0, (r) => r.t0VsDay0),
      performance: metricBlock(withT0, (r) => r.fwdT0),
    },
  }
}

function rebreakSlice(rows) {
  const withT0 = rows.filter((r) => r.t0 != null)
  return {
    nT0: withT0.length,
    rebreak: metricBlock(withT0.filter((r) => r.rebreak), (r) => r.fwdT0),
    noRebreak: metricBlock(withT0.filter((r) => r.rebreak === false), (r) => r.fwdT0),
  }
}

function paired(rows) {
  const use = rows.filter((r) => r.t0 != null && r.fwd0?.full && r.fwdT0?.full)
  const build = (list) => ({
    n: list.length,
    smallSample: list.length < MIN_N,
    d60: num(list, (r) => r.fwdT0.d60 - r.fwd0.d60),
    mae: num(list, (r) => r.fwdT0.mae - r.fwd0.mae),
    entryVsDay0: num(list, (r) => r.t0VsDay0),
    day0HitM10Pct: rate(list.filter((r) => r.fwd0.hitM10).length, list.length),
    t0HitM10Pct: rate(list.filter((r) => r.fwdT0.hitM10).length, list.length),
    day0D60Median: num(list, (r) => r.fwd0.d60).median,
    t0D60Median: num(list, (r) => r.fwdT0.d60).median,
    day0MaeMedian: num(list, (r) => r.fwd0.mae).median,
    t0MaeMedian: num(list, (r) => r.fwdT0.mae).median,
  })
  return {
    all: build(use),
    train: build(use.filter((r) => r.split === "train")),
    test: build(use.filter((r) => r.split === "test")),
  }
}

function concurrency(rows, dateOf) {
  const map = new Map()
  for (const row of rows) {
    const date = dateOf(row)
    if (!date) continue
    if (!map.has(date)) map.set(date, new Set())
    map.get(date).add(row.symbol)
  }
  const counts = [...map.values()].map((set) => set.size)
  const recent = [...map.entries()].filter(([date]) => date >= "2023-01-01").map(([, set]) => set.size)
  return {
    nDates: counts.length,
    all: summarizeNumeric(counts),
    since2023: summarizeNumeric(recent),
  }
}

function reduction(n, base) {
  return {
    n,
    remainingPct: rate(n, base),
    reductionPct: base ? round2(100 - (n / base) * 100) : null,
  }
}

function opposite(a, b) {
  if (a == null || b == null) return true
  return a * b < 0
}

function judge(pair, remainingPct) {
  const train = pair.train
  const test = pair.test
  const reasons = []
  if (test.n < MIN_N || train.n < MIN_N) reasons.push("small_sample")
  const maeOpp = opposite(train.mae?.median, test.mae?.median)
  const d60Opp = opposite(train.d60?.median, test.d60?.median)
  if (maeOpp || d60Opp) reasons.push("train_test_sign")
  const improved = (side) =>
    side.mae?.median < 0 && side.d60?.median > 0 && side.t0HitM10Pct < side.day0HitM10Pct
  if (!reasons.length && remainingPct < 100 && improved(train) && improved(test)) {
    return { code: "A", label: "3/4 + 조정 깊이 + T0 조합이 후보 축소와 성과 개선을 동시에 보여준다.", reasons }
  }
  if (reasons.includes("train_test_sign") || reasons.includes("small_sample")) {
    return { code: "C", label: "조합별 차이가 불안정해서 현재 전략을 바꿀 근거가 부족하다.", reasons }
  }
  return { code: "B", label: "후보는 줄어들지만 성과 개선이 충분하지 않다.", reasons: reasons.length ? reasons : ["performance_not_improved"] }
}

function cell(block, side) {
  const m = block[side]
  return {
    n: m.n,
    d20: m.d20?.median ?? null,
    d60: m.d60?.median ?? null,
    mae: m.mae?.median ?? null,
    hitM10Pct: m.hitM10Pct,
    hit10Pct: m.hit10Pct,
    daysToLow: m.daysToLow?.median ?? null,
  }
}

function summaryRow(id, label, knownAtEntry, nAll, nTest, perf, baseN) {
  return {
    id,
    label,
    knownAtEntry,
    n: nAll,
    testN: nTest,
    test: cell(perf, "test"),
    train: cell(perf, "train"),
    reduction: reduction(nAll, baseN),
  }
}

function assertMath() {
  const bars = Array.from({ length: 120 }, () => ({ high: 100, close: 100, low: 100 }))
  bars[119] = { high: 100, close: 80, low: 80 }
  const dd = drawdownFromRollingHigh(bars, 119, 120)
  if (Math.abs(dd - -20) > 1e-9) throw new Error(`dd ${dd}`)
  if (!(dd <= -15) || dd <= -25) throw new Error("threshold nest")
  const pause = [100, 99, 98, 97, 96, 95, 96, 96.5, 96.2, 96.4, 96.3]
  const closes = pause.concat(Array(NEED).fill(96))
  if (firstT0(closes) !== 10) throw new Error("T0")
  const broken = pause.concat([96, 94]).concat(Array(NEED).fill(94))
  const rec = describe(broken)
  if (rec.t0 !== 10 || rec.rebreak !== true) throw new Error("rebreak")
  const held = describe(closes)
  if (held.rebreak !== false) throw new Error("no rebreak")
  const fake = {
    train: { n: 100, mae: { median: -1 }, d60: { median: 1 }, t0HitM10Pct: 10, day0HitM10Pct: 20 },
    test: { n: 40, mae: { median: -1 }, d60: { median: 1 }, t0HitM10Pct: 10, day0HitM10Pct: 20 },
  }
  if (judge(fake, 40).code !== "A") throw new Error("judge A")
  fake.test.d60.median = -1
  if (judge(fake, 40).code !== "C") throw new Error("judge C")
  fake.test.d60.median = 0
  fake.test.mae.median = -1
  if (judge(fake, 40).code !== "B") throw new Error("judge B")
}

function main() {
  assertMath()
  assertNoEtfInStudyUniverse()
  console.log("node scripts/yds-daily-bottom-buy-3of4-depth-t0-research.mjs")
  const blocks = []
  for (const meta of EQUITY_CANDIDATES) {
    const row = analyzeSymbol(meta, loadCached(meta.yahoo))
    console.log(`  ${meta.symbol}: ${row.status} episodes=${row.episodes?.length ?? 0} short=${row.short ?? 0} openedAt4=${row.openedAt4 ?? 0}`)
    blocks.push(row)
  }
  const ready = blocks.filter((b) => b.status === "ok")
  const rows = ready.flatMap((b) => b.episodes || [])
  const baseN = rows.length
  const byLevel = { base: depthSlice(rows, null) }
  for (const level of LEVELS) byLevel[`dd${level}`] = depthSlice(rows, level)
  const focusLevels = [null, 10, 15, 20]
  const focus = {}
  for (const level of focusLevels) {
    const key = level == null ? "base" : `dd${level}`
    const subset = level == null ? rows : rows.filter((r) => r.dd <= -level)
    focus[key] = { ...byLevel[key], paired: paired(subset), rebreak: rebreakSlice(subset) }
  }
  const dd15 = rows.filter((r) => r.dd <= -15)
  const dd15T0 = dd15.filter((r) => r.t0 != null)
  const atr = {
    dd15T0: metricBlock(dd15T0, (r) => r.fwdT0),
    lt3: metricBlock(dd15T0.filter((r) => r.atrT0 === "lt3"), (r) => r.fwdT0),
    ge4: metricBlock(dd15T0.filter((r) => r.atrT0 === "ge4"), (r) => r.fwdT0),
    noRebreak: metricBlock(dd15T0.filter((r) => r.rebreak === false), (r) => r.fwdT0),
  }
  const stages = [
    ["base", rows, (r) => r.openDate],
    ["dd10", rows.filter((r) => r.dd <= -10), (r) => r.openDate],
    ["dd15", rows.filter((r) => r.dd <= -15), (r) => r.openDate],
    ["dd20", rows.filter((r) => r.dd <= -20), (r) => r.openDate],
    ["dd15T0", dd15T0, (r) => r.t0Date],
  ]
  const crowd = {}
  const shrink = {}
  for (const [id, list, dateOf] of stages) {
    crowd[id] = concurrency(list, dateOf)
    shrink[id] = reduction(list.length, baseN)
  }
  const noRebreakRows = dd15T0.filter((r) => r.rebreak === false)
  const table = [
    summaryRow("base", "3/4", true, rows.length, rows.filter((r) => r.split === "test").length, byLevel.base.day0, baseN),
    summaryRow("dd10", "3/4 + DD<=-10%", true, byLevel.dd10.n, byLevel.dd10.testN, byLevel.dd10.day0, baseN),
    summaryRow("dd15", "3/4 + DD<=-15%", true, byLevel.dd15.n, byLevel.dd15.testN, byLevel.dd15.day0, baseN),
    summaryRow("dd20", "3/4 + DD<=-20%", true, byLevel.dd20.n, byLevel.dd20.testN, byLevel.dd20.day0, baseN),
    summaryRow("dd15T0", "3/4 + DD<=-15% + T0", true, dd15T0.length, dd15T0.filter((r) => r.split === "test").length, byLevel.dd15.t0.performance, baseN),
    summaryRow("dd15T0NoRebreak", "3/4 + DD<=-15% + T0 + NO_REBREAK", false, noRebreakRows.length, noRebreakRows.filter((r) => r.split === "test").length, atr.noRebreak, baseN),
  ]
  const verdict = judge(focus.dd15.paired, shrink.dd15T0.remainingPct)
  const doc = {
    generatedAt: new Date().toISOString(),
    definition: {
      universe: "Existing 48 single names. ETF names are not included.",
      thresholds: FROZEN_THRESHOLDS,
      episodeDef: EPISODE_DEF,
      exactly3: "Day 0 is the episode open only when that open has exactly 3 of the 4 frozen conditions. An open at 4 is not a 3/4 day.",
      depth: "Close versus the highest high of the 120 sessions ending on Day 0, from drawdownFromRollingHigh. A level of -15 keeps draws of -15% and deeper. The depth is not recalculated at T0.",
      t0: "First session through Day 60 where none of the last 5 closes undercut the lowest close from Day 0 through the prior session. Same close rule as the stabilization study.",
      rebreak: "Within 10 sessions after T0, a close under the pre-T0 minimum. NO_REBREAK is known only after those 10 sessions, so it is not an entry that can be taken at the T0 close.",
      atr: "Wilder ATR as a percent of price, banded at under 3, 3 to under 4, and 4 or more. The ATR slices use the T0 session. ATR is not a block.",
      horizon: "D+20, D+60, MAE, and the -5/-10/-15 and +5/+10 hits use later closes within 60 sessions. MAE is the worst later close, not the intraday low.",
      paired: "For a depth filter, T0 minus Day 0 on episodes that reach T0. A negative MAE difference means the drawdown after T0 was smaller. The decline from Day 0 to T0 is outside that MAE.",
      judge: "A requires fewer episodes plus, on the same DD<=-15% and T0 episodes, lower MAE, higher D+60, and a lower additional -10% rate on both Train and Test. Opposite signs or fewer than 30 episodes on either side is C. Otherwise B. NO_REBREAK is not part of this judgment.",
      notASignal: "No row is a production entry.",
    },
    coverage: {
      symbols: EQUITY_CANDIDATES.length,
      withData: ready.length,
      episodesBuilt: ready.reduce((s, b) => s + b.built, 0),
      openedAt4Excluded: ready.reduce((s, b) => s + b.openedAt4, 0),
      shortHorizonExcluded: ready.reduce((s, b) => s + b.short, 0),
      noDepthExcluded: ready.reduce((s, b) => s + b.noDepth, 0),
      sample: rows.length,
      train: rows.filter((r) => r.split === "train").length,
      test: rows.filter((r) => r.split === "test").length,
      dataStart: ready.map((b) => b.split?.dataStart).filter(Boolean).sort()[0] ?? null,
      dataEnd: ready.map((b) => b.split?.dataEnd).filter(Boolean).sort().at(-1) ?? null,
    },
    byDepth: byLevel,
    focus,
    rebreakdown: {
      base: rebreakSlice(rows),
      dd10: rebreakSlice(rows.filter((r) => r.dd <= -10)),
      dd15: rebreakSlice(dd15),
      dd20: rebreakSlice(rows.filter((r) => r.dd <= -20)),
    },
    atr,
    concurrency: crowd,
    shrinkage: shrink,
    summaryTable: table,
    conclusion: verdict,
    interpretation: [],
  }
  doc.interpretation = interpret(doc)
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc))
  console.log(`wrote ${OUT_JSON}`)
  console.log(doc.conclusion.code)
  console.log(doc.conclusion.label)
  console.log(doc.interpretation.join("\n"))
}

function med(stat) {
  return stat?.median ?? null
}

function interpret(doc) {
  const lines = []
  const t = doc.summaryTable
  lines.push(
    t.map((row) => `${row.label}: n ${row.n}, Test ${row.testN}, Test D+60 ${row.test.d60}, MAE ${row.test.mae}, -10% ${row.test.hitM10Pct}, +10% ${row.test.hit10Pct}, 감소 ${row.reduction.reductionPct}%`).join(" | ")
  )
  const p = doc.focus.dd15.paired
  lines.push(
    `DD<=-15% 이고 T0가 있는 같은 에피소드에서 T0 진입 빼기 Day 0 진입. Train MAE ${med(p.train.mae)}, D+60 ${med(p.train.d60)}, -10% ${p.train.day0HitM10Pct}→${p.train.t0HitM10Pct}, n ${p.train.n}. Test MAE ${med(p.test.mae)}, D+60 ${med(p.test.d60)}, -10% ${p.test.day0HitM10Pct}→${p.test.t0HitM10Pct}, n ${p.test.n}. 진입가 대비 Day 0은 Train ${med(p.train.entryVsDay0)}%, Test ${med(p.test.entryVsDay0)}%.`
  )
  lines.push(`${doc.conclusion.code}. ${doc.conclusion.label} 근거: ${doc.conclusion.reasons.join(", ")}.`)
  lines.push("NO_REBREAK 행은 T0 이후 10거래일을 본 경로다. T0 당일 종가에서는 아직 알 수 없다.")
  return lines
}

main()
