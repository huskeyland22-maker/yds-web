#!/usr/bin/env node
/**
 * Causal entry windows after an exact 3-of-4 open. Research only.
 *   node scripts/yds-daily-bottom-buy-3of4-entry-window-research.mjs
 *
 * Does not change production code, UI, API, DB, thresholds, or strategy.
 * A later T0 is not used to decide an earlier entry.
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
import { JUDGE_GATES } from "./lib/daily-bottom-buy-individual-stock-train-test-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-3of4-entry-window-result.json")

const SEARCH = 60
const HORIZON = 60
const NEED = SEARCH + HORIZON
const REBREAK_DAYS = 10
const CALENDAR = [0, 1, 3, 5, 7, 10]
const RULES = ["no1", "no3", "no5", "persist3"]
const MIN_N = JUDGE_GATES.minN
const MAE_PP = JUDGE_GATES.maeImprovePp

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

function noNewLow(closes, t, k) {
  if (t < k) return false
  for (let i = t - k + 1; i <= t; i++) if (isNewLow(closes, i)) return false
  return true
}

function firstQuiet(closes, k, end) {
  for (let t = k; t <= end; t++) if (noNewLow(closes, t, k)) return t
  return null
}

function firstPersist(closes, end) {
  let streak = 0
  for (let t = 5; t <= end; t++) {
    if (noNewLow(closes, t, 5)) streak += 1
    else streak = 0
    if (streak >= 3) return t
  }
  return null
}

function firstT0(closes) {
  return firstQuiet(closes, 5, Math.min(SEARCH, closes.length - 1))
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
    entryVsDay0: pctChange(px, closes[0]),
  }
}

function stateAt(closes, t, t0) {
  return {
    new1: t >= 1 ? isNewLow(closes, t) : null,
    new3: t >= 3 ? !noNewLow(closes, t, 3) : null,
    new5: t >= 5 ? !noNewLow(closes, t, 5) : null,
    vsDay0: pctChange(closes[t], closes[0]),
    vsRunningLow: pctChange(closes[t], minOf(closes, 0, t)),
    daysToT0: t0 == null ? null : t0 - t,
  }
}

function describe(closes) {
  const end = Math.min(SEARCH, closes.length - 1)
  const t0 = firstT0(closes)
  const rules = {
    no1: firstQuiet(closes, 1, end),
    no3: firstQuiet(closes, 3, end),
    no5: firstQuiet(closes, 5, end),
    persist3: firstPersist(closes, end),
  }
  let rebreak = null
  let daysToRebreak = null
  if (t0 != null) {
    const preLow = minOf(closes, 0, t0 - 1)
    const rebreakEnd = Math.min(t0 + REBREAK_DAYS, closes.length - 1)
    rebreak = false
    for (let t = t0 + 1; t <= rebreakEnd; t++) {
      if (closes[t] < preLow) {
        rebreak = true
        daysToRebreak = t - t0
        break
      }
    }
  }
  const fwd = { day0: forwardFrom(closes, 0) }
  for (const day of CALENDAR) if (day !== 0) fwd[`d${day}`] = forwardFrom(closes, day)
  fwd.t0 = t0 == null ? null : forwardFrom(closes, t0)
  for (const id of RULES) fwd[id] = rules[id] == null ? null : forwardFrom(closes, rules[id])
  const state = {}
  for (const day of CALENDAR) state[`d${day}`] = stateAt(closes, day, t0)
  return { t0, rules, rebreak, daysToRebreak, fwd, state }
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
  for (const ep of built) {
    if (ep.openCount !== 3) {
      if (ep.openCount >= 4) openedAt4 += 1
      continue
    }
    if (ep.openIdx + NEED >= bars.length) {
      short += 1
      continue
    }
    const closes = []
    for (let i = ep.openIdx; i <= ep.openIdx + NEED; i++) closes.push(bars[i].close)
    const path = describe(closes)
    const dates = { day0: ep.openDate }
    for (const day of CALENDAR) if (day !== 0) dates[`d${day}`] = bars[ep.openIdx + day].date
    dates.t0 = path.t0 == null ? null : bars[ep.openIdx + path.t0].date
    for (const id of RULES) dates[id] = path.rules[id] == null ? null : bars[ep.openIdx + path.rules[id]].date
    episodes.push({
      symbol: meta.symbol,
      split: ep.openIdx < split.splitIdx ? "train" : "test",
      dates,
      ...path,
    })
  }
  return { symbol: meta.symbol, status: "ok", split, built: built.length, short, openedAt4, episodes }
}

function hits(list, key) {
  return rate(list.filter((r) => r.f?.[key]).length, list.length)
}

function perf(rows, pick) {
  const use = rows.map((r) => ({ split: r.split, src: r, f: pick(r) })).filter((r) => r.f?.full)
  const build = (list) => ({
    n: list.length,
    day: num(list, (r) => r.day),
    entryVsDay0: num(list, (r) => r.f.entryVsDay0),
    belowDay0Pct: rate(list.filter((r) => r.f.entryVsDay0 < 0).length, list.length),
    aboveDay0Pct: rate(list.filter((r) => r.f.entryVsDay0 > 0).length, list.length),
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
  return { use, build }
}

function block(rows, dayOf, pickFwd) {
  const ready = perf(rows, pickFwd)
  const use = ready.use.map((r) => ({ ...r, day: dayOf(r.src) }))
  return {
    all: ready.build(use),
    train: ready.build(use.filter((r) => r.split === "train")),
    test: ready.build(use.filter((r) => r.split === "test")),
  }
}

function paired(rows, dayOf, pickFwd) {
  const use = rows.filter((r) => r.fwd.day0?.full && pickFwd(r)?.full)
  const build = (list) => {
    const d60 = list.map((r) => pickFwd(r).d60 - r.fwd.day0.d60)
    const mae = list.map((r) => pickFwd(r).mae - r.fwd.day0.mae)
    const d20 = list.map((r) => pickFwd(r).d20 - r.fwd.day0.d20)
    const px = list.map((r) => pickFwd(r).entryVsDay0)
    let better = 0
    let worse = 0
    let mixed = 0
    for (let i = 0; i < list.length; i++) {
      const dUp = d60[i] > 0
      const mDown = mae[i] < 0
      if (dUp && mDown) better += 1
      else if (d60[i] < 0 && mae[i] > 0) worse += 1
      else mixed += 1
    }
    return {
      n: list.length,
      smallSample: list.length < MIN_N,
      entryVsDay0: summarizeNumeric(px),
      d20: summarizeNumeric(d20),
      d60: summarizeNumeric(d60),
      mae: summarizeNumeric(mae),
      day: num(list, dayOf),
      betterPct: rate(better, list.length),
      worsePct: rate(worse, list.length),
      mixedPct: rate(mixed, list.length),
    }
  }
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
  return { nDates: counts.length, counts: summarizeNumeric(counts) }
}

function reduction(n, base) {
  return { n, remainingPct: rate(n, base), reductionPct: base ? round2(100 - (n / base) * 100) : null }
}

function opposite(a, b) {
  if (a == null || b == null || a === 0 || b === 0) return false
  return a * b < 0
}

function judge(rulePacks) {
  const rows = RULES.map((id) => {
    const p = rulePacks[id].paired
    return {
      id,
      trainMae: p.train.mae?.median,
      testMae: p.test.mae?.median,
      trainD60: p.train.d60?.median,
      testD60: p.test.d60?.median,
      testPx: p.test.entryVsDay0?.median,
      shrink: rulePacks[id].reduction.reductionPct,
      testN: p.test.n,
      trainN: p.train.n,
    }
  })
  const improved = (row) =>
    row.testN >= MIN_N &&
    row.trainN >= MIN_N &&
    row.trainMae <= -MAE_PP &&
    row.testMae <= -MAE_PP &&
    row.trainD60 >= 0 &&
    row.testD60 >= 0
  const signsDiffer = rows.filter((row) => {
    const maeOpp = opposite(row.trainMae, row.testMae) && Math.abs(row.trainMae) >= MAE_PP && Math.abs(row.testMae) >= MAE_PP
    const d60Opp = opposite(row.trainD60, row.testD60) && Math.abs(row.trainD60) >= MAE_PP && Math.abs(row.testD60) >= MAE_PP
    return maeOpp || d60Opp
  })
  const good = rows.filter(improved)
  if (good.length) {
    return { code: "A", rule: good[0].id, label: "신규 저점 중단을 기다리는 것이 MAE를 낮추면서도 D+60을 유지/개선한다." }
  }
  if (signsDiffer.length) {
    return { code: "D", rules: signsDiffer.map((row) => row.id), label: "일부 waiting rule이 개선되지만 Train/Test 방향이 달라 일반화 근거가 부족하다." }
  }
  const shrinks = rows.filter((row) => row.shrink >= 20)
  const priceUp = rows.filter((row) => row.testPx > 1)
  if (shrinks.length && priceUp.length) {
    return { code: "B", label: "신규 저점 중단을 기다리면 후보는 줄지만 가격 상승으로 인해 성과 개선이 충분하지 않다." }
  }
  return { code: "C", label: "대부분의 waiting rule에서 Day0와 의미 있는 차이가 없어 전략 변경 근거가 부족하다." }
}

function loadCachedEpisodes() {
  const blocks = []
  for (const meta of EQUITY_CANDIDATES) {
    const row = analyzeSymbol(meta, loadCached(meta.yahoo))
    console.log(`  ${meta.symbol}: ${row.status} episodes=${row.episodes?.length ?? 0} short=${row.short ?? 0} openedAt4=${row.openedAt4 ?? 0}`)
    blocks.push(row)
  }
  return blocks
}

function assertMath() {
  const pause = [100, 99, 98, 97, 96, 95, 96, 96.5, 96.2, 96.4, 96.3]
  const quiet = pause.concat(Array(NEED).fill(96))
  if (firstT0(quiet) !== 10) throw new Error("T0")
  if (firstQuiet(quiet, 1, 60) !== 6) throw new Error("no1")
  if (firstQuiet(quiet, 3, 60) !== 8) throw new Error("no3")
  if (firstQuiet(quiet, 5, 60) !== 10) throw new Error("no5")
  if (firstPersist(quiet, 60) !== 12) throw new Error("persist")
  const crashed = quiet.slice()
  crashed[30] = 50
  if (firstQuiet(crashed, 5, 60) !== 10) throw new Error("future moved T0")
  const broken = pause.concat([96, 94]).concat(Array(NEED).fill(94))
  const rec = describe(broken)
  if (rec.t0 !== 10 || rec.rebreak !== true || rec.daysToRebreak !== 2) throw new Error("rebreak")
}

function sideCell(blockSide) {
  return {
    n: blockSide.n,
    day: blockSide.day?.median ?? null,
    px: blockSide.entryVsDay0?.median ?? null,
    pxP25: blockSide.entryVsDay0?.p25 ?? null,
    pxP75: blockSide.entryVsDay0?.p75 ?? null,
    below: blockSide.belowDay0Pct,
    above: blockSide.aboveDay0Pct,
    d20: blockSide.d20?.median ?? null,
    d60: blockSide.d60?.median ?? null,
    mae: blockSide.mae?.median ?? null,
    hitM10: blockSide.hitM10Pct,
    hit10: blockSide.hit10Pct,
  }
}

function main() {
  assertMath()
  assertNoEtfInStudyUniverse()
  console.log("node scripts/yds-daily-bottom-buy-3of4-entry-window-research.mjs")
  const blocks = loadCachedEpisodes()
  const ready = blocks.filter((b) => b.status === "ok")
  const rows = ready.flatMap((b) => b.episodes || [])
  const entries = {
    day0: block(rows, () => 0, (r) => r.fwd.day0),
    day1: block(rows, () => 1, (r) => r.fwd.d1),
    day3: block(rows, () => 3, (r) => r.fwd.d3),
    day5: block(rows, () => 5, (r) => r.fwd.d5),
    day7: block(rows, () => 7, (r) => r.fwd.d7),
    day10: block(rows, () => 10, (r) => r.fwd.d10),
    no1: block(rows, (r) => r.rules.no1, (r) => r.fwd.no1),
    no3: block(rows, (r) => r.rules.no3, (r) => r.fwd.no3),
    no5: block(rows, (r) => r.rules.no5, (r) => r.fwd.no5),
    persist3: block(rows, (r) => r.rules.persist3, (r) => r.fwd.persist3),
    t0: block(rows, (r) => r.t0, (r) => r.fwd.t0),
  }
  const pairs = {}
  for (const id of ["day1", "day3", "day5", "day7", "day10", ...RULES, "t0"]) {
    const dayOf = id.startsWith("day") ? () => Number(id.slice(3)) : id === "t0" ? (r) => r.t0 : (r) => r.rules[id]
    const pick = id.startsWith("day") ? (r) => r.fwd[`d${id.slice(3)}`] : id === "t0" ? (r) => r.fwd.t0 : (r) => r.fwd[id]
    pairs[id] = paired(rows, dayOf, pick)
  }
  const state = {}
  for (const day of CALENDAR) {
    const key = `d${day}`
    const build = (list) => ({
      n: list.length,
      new1Pct: rate(list.filter((r) => r.state[key].new1).length, list.length),
      new3Pct: rate(list.filter((r) => r.state[key].new3).length, list.length),
      new5Pct: rate(list.filter((r) => r.state[key].new5).length, list.length),
      vsDay0: num(list, (r) => r.state[key].vsDay0),
      vsRunningLow: num(list, (r) => r.state[key].vsRunningLow),
      daysToT0: num(list, (r) => r.state[key].daysToT0),
    })
    state[key] = {
      all: build(rows),
      train: build(rows.filter((r) => r.split === "train")),
      test: build(rows.filter((r) => r.split === "test")),
      note: "daysToT0 uses the later T0 date and is descriptive only. It is not an entry input.",
    }
  }
  const withT0 = rows.filter((r) => r.t0 != null)
  const rebreakRows = withT0.filter((r) => r.rebreak)
  const calmRows = withT0.filter((r) => r.rebreak === false)
  const rebreak = {
    nT0: withT0.length,
    testT0: withT0.filter((r) => r.split === "test").length,
    rebreakN: rebreakRows.length,
    noRebreakN: calmRows.length,
    rebreakPct: rate(rebreakRows.length, withT0.length),
    noRebreakPct: rate(calmRows.length, withT0.length),
    daysToRebreak: {
      all: num(rebreakRows, (r) => r.daysToRebreak),
      train: num(rebreakRows.filter((r) => r.split === "train"), (r) => r.daysToRebreak),
      test: num(rebreakRows.filter((r) => r.split === "test"), (r) => r.daysToRebreak),
    },
    rebreak: block(rebreakRows, (r) => r.t0, (r) => r.fwd.t0),
    noRebreak: block(calmRows, (r) => r.t0, (r) => r.fwd.t0),
    note: "재하락 여부는 T0 시점에는 알 수 없는 미래 정보이므로 매수 조건으로 사용할 수 없다.",
  }
  const baseN = rows.length
  const shrinkIds = [["day0", rows, (r) => r.dates.day0], ["no1", rows.filter((r) => r.rules.no1 != null), (r) => r.dates.no1], ["no3", rows.filter((r) => r.rules.no3 != null), (r) => r.dates.no3], ["no5", rows.filter((r) => r.rules.no5 != null), (r) => r.dates.no5], ["persist3", rows.filter((r) => r.rules.persist3 != null), (r) => r.dates.persist3]]
  const shrinkage = {}
  const crowd = {}
  for (const [id, list, dateOf] of shrinkIds) {
    shrinkage[id] = {
      ...reduction(list.length, baseN),
      testN: list.filter((r) => r.split === "test").length,
      testReductionPct: reduction(list.filter((r) => r.split === "test").length, rows.filter((r) => r.split === "test").length).reductionPct,
    }
    crowd[id] = concurrency(list, dateOf)
  }
  const labels = {
    day0: "Day0",
    day1: "Day1",
    day3: "Day3",
    day5: "Day5",
    day7: "Day7",
    day10: "Day10",
    no1: "최근1일 신규저점 없음",
    no3: "최근3일 신규저점 없음",
    no5: "최근5일 신규저점 없음",
    persist3: "5일 신규저점 없음 + 3일 유지",
    t0: "T0",
  }
  const table = Object.keys(labels).map((id) => ({
    id,
    label: labels[id],
    sameAsT0: id === "no5" || id === "t0",
    test: sideCell(entries[id].test),
    train: sideCell(entries[id].train),
    pairedTest: id === "day0" ? null : {
      d60: pairs[id].test.d60?.median ?? null,
      mae: pairs[id].test.mae?.median ?? null,
      d20: pairs[id].test.d20?.median ?? null,
      px: pairs[id].test.entryVsDay0?.median ?? null,
      betterPct: pairs[id].test.betterPct,
      worsePct: pairs[id].test.worsePct,
      mixedPct: pairs[id].test.mixedPct,
      n: pairs[id].test.n,
    },
    pairedTrain: id === "day0" ? null : {
      d60: pairs[id].train.d60?.median ?? null,
      mae: pairs[id].train.mae?.median ?? null,
      betterPct: pairs[id].train.betterPct,
      worsePct: pairs[id].train.worsePct,
      n: pairs[id].train.n,
    },
  }))
  const rulePacks = {}
  for (const id of RULES) rulePacks[id] = { paired: pairs[id], reduction: shrinkage[id] }
  const verdict = judge(rulePacks)
  const identical = rows.filter((r) => r.rules.no5 === r.t0).length
  const doc = {
    generatedAt: new Date().toISOString(),
    definition: {
      universe: "Existing 48 single names. ETF names are not included.",
      thresholds: FROZEN_THRESHOLDS,
      episodeDef: EPISODE_DEF,
      exactly3: "Day 0 is the episode open only when that open has exactly 3 of the 4 frozen conditions.",
      t0: "First session from Day 5 through Day 60 where none of the last 5 closes undercut the lowest close from Day 0 through the prior session.",
      rules: {
        no1: "First session after Day 0 where that close is not a new close low.",
        no3: "First session where none of the last 3 closes is a new close low. The window cannot start before Day 3.",
        no5: "Same close test as T0. Checked below against the T0 day.",
        persist3: "The 5-day no-new-low state has been true for 3 consecutive sessions. A new low resets the streak.",
      },
      causal: "Each rule uses closes through that session only. daysToT0 is stored as a description and is not an entry input.",
      rebreak: "Within 10 sessions after T0, a close under the pre-T0 minimum. This is not a buy filter.",
      mae: "Worst later close within 60 sessions, in percent of the entry close.",
      paired: "Rule or calendar entry minus the Day 0 entry on the same episode. Better means D+60 is higher and MAE is lower. Worse means both move the other way.",
      judge: "A requires MAE at least 1 point lower and D+60 not lower, on both Train and Test, for a waiting rule. Opposite signs are D. A rule that removes at least 20% and whose Test entry is more than 1% above Day 0, without A, is B. Otherwise C.",
      notASignal: "No row is a production entry.",
    },
    coverage: {
      symbols: EQUITY_CANDIDATES.length,
      withData: ready.length,
      episodesBuilt: ready.reduce((s, b) => s + b.built, 0),
      openedAt4Excluded: ready.reduce((s, b) => s + b.openedAt4, 0),
      shortHorizonExcluded: ready.reduce((s, b) => s + b.short, 0),
      sample: rows.length,
      train: rows.filter((r) => r.split === "train").length,
      test: rows.filter((r) => r.split === "test").length,
      no5EqualsT0: identical,
      no5EqualsT0Pct: rate(identical, rows.length),
      dataStart: ready.map((b) => b.split?.dataStart).filter(Boolean).sort()[0] ?? null,
      dataEnd: ready.map((b) => b.split?.dataEnd).filter(Boolean).sort().at(-1) ?? null,
    },
    dailyState: state,
    entries,
    pairs,
    rebreak,
    shrinkage,
    concurrency: crowd,
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

function interpret(doc) {
  const lines = []
  lines.push(doc.summaryTable.map((row) => {
    const p = row.pairedTest
    const delta = p ? ` paired D+60 ${p.d60} MAE ${p.mae}` : ""
    return `${row.label}: Test n ${row.test.n}, day ${row.test.day}, px ${row.test.px}, D+20 ${row.test.d20}, D+60 ${row.test.d60}, MAE ${row.test.mae}, -10% ${row.test.hitM10}, +10% ${row.test.hit10}${delta}`
  }).join(" | "))
  const t0 = doc.rebreak
  lines.push(`T0 ${t0.nT0}, Test ${t0.testT0}. 10일 내 재하락 ${t0.rebreakN} (${t0.rebreakPct}%), 없음 ${t0.noRebreakN} (${t0.noRebreakPct}%). ${t0.note}`)
  lines.push(`${doc.conclusion.code}. ${doc.conclusion.label}`)
  lines.push(`5일 조건과 T0가 같은 날인 비율 ${doc.coverage.no5EqualsT0Pct}%.`)
  return lines
}

main()
