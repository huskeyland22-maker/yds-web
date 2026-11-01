#!/usr/bin/env node
/**
 * Price path after a 3-of-4 episode open (research only).
 *   node scripts/yds-daily-bottom-buy-3of4-price-path-research.mjs
 *
 * Does not change production code, UI, API, DB, thresholds, or strategy.
 * Prices are session closes. An intraday low is not used.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import {
  conditionFlags,
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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-3of4-price-path-result.json")

const HORIZON = 60
const PRIMARY = {
  upPct: 5,
  fastDays: 5,
  fastBlockDropPct: 3,
  extraDropPct: 5,
  bandPct: 3,
  bandDays: 5,
  horizon: HORIZON,
}

const EXTRA_DROPS = [3, 5, 7]
const BANDS = [2, 3, 5]
const BAND_DAYS = [3, 5, 7]

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

function atOrBelow(pct, level) {
  return pct <= -level + 1e-6
}

function atOrAbove(pct, level) {
  return pct >= level - 1e-6
}

/** Consecutive sessions from start, inclusive, while count stays at or above minCount. */
function streakLength(counts, start, minCount) {
  let n = 0
  for (let j = start; j < counts.length; j++) {
    if (counts[j] < minCount) break
    n += 1
  }
  return n
}

/**
 * Classify one close path. path[0] is Day 0.
 * Priority, first match wins: A, C, B, D, otherRecovered.
 * A is a fast +5% with no -3% close before it.
 * C is B plus a base around the post-Day0 low, and the +5% comes after that base.
 * D is no +5% versus Day 0 inside the horizon.
 * otherRecovered reached +5% but matches neither A nor B.
 * @param {number[]} path
 * @param {typeof PRIMARY} spec
 */
export function classifyPath(path, spec = PRIMARY) {
  const p0 = path[0]
  if (!(p0 > 0) || path.length <= spec.horizon) {
    return { classId: "insufficient", letter: null }
  }
  const last = spec.horizon
  const rel = (i) => pctChange(path[i], p0)

  let firstUp = null
  let firstDownBlock = null
  for (let i = 1; i <= last; i++) {
    const r = rel(i)
    if (firstUp == null && atOrAbove(r, spec.upPct)) firstUp = i
    if (firstDownBlock == null && atOrBelow(r, spec.fastBlockDropPct)) firstDownBlock = i
  }
  const isA =
    firstUp != null &&
    firstUp <= spec.fastDays &&
    (firstDownBlock == null || firstDownBlock > firstUp)

  let lowIdx = 1
  for (let i = 2; i <= last; i++) {
    if (path[i] < path[lowIdx]) lowIdx = i
  }
  const extraDrop = rel(lowIdx)
  const hasExtra = atOrBelow(extraDrop, spec.extraDropPct)
  let upAfterLow = null
  if (hasExtra) {
    for (let i = lowIdx + 1; i <= last; i++) {
      if (atOrAbove(rel(i), spec.upPct)) {
        upAfterLow = i
        break
      }
    }
  }
  const isB = hasExtra && upAfterLow != null

  let bandEnd = null
  if (isB) {
    const lo = path[lowIdx]
    const band = spec.bandPct / 100
    let run = 0
    for (let i = lowIdx; i <= last; i++) {
      if (Math.abs(path[i] / lo - 1) <= band + 1e-9) {
        run += 1
        if (run === spec.bandDays) bandEnd = i
      } else if (bandEnd == null) {
        run = 0
      } else {
        break
      }
    }
  }
  let upAfterBand = null
  if (bandEnd != null) {
    for (let i = bandEnd + 1; i <= last; i++) {
      if (atOrAbove(rel(i), spec.upPct)) {
        upAfterBand = i
        break
      }
    }
  }
  const isC = isB && upAfterBand != null

  let classId = "otherRecovered"
  let letter = "other"
  if (isA) {
    classId = "fastRebound"
    letter = "A"
  } else if (isC) {
    classId = "dropBaseRebound"
    letter = "C"
  } else if (isB) {
    classId = "dropThenRebound"
    letter = "B"
  } else if (firstUp == null) {
    classId = "unrecovered"
    letter = "D"
  }
  return { classId, letter, firstUp, extraDrop, lowIdx, isA, isB, isC }
}

function windowLow(path, from, to) {
  const end = Math.min(to, path.length - 1)
  if (from > end) return null
  let idx = from
  for (let i = from + 1; i <= end; i++) {
    if (path[i] < path[idx]) idx = i
  }
  return idx
}

function daysUntil(path, from, end, pred) {
  const last = Math.min(end, path.length - 1)
  for (let i = from + 1; i <= last; i++) {
    if (pred(path[i])) return i - from
  }
  return null
}

function forwardFrom(path, entry, horizon) {
  const px = path[entry]
  if (!(px > 0)) return null
  const end = Math.min(entry + horizon, path.length - 1)
  if (end <= entry) return null
  let minPx = px
  let maxPx = px
  for (let i = entry + 1; i <= end; i++) {
    if (path[i] < minPx) minPx = path[i]
    if (path[i] > maxPx) maxPx = path[i]
  }
  const at = (n) => (entry + n <= path.length - 1 ? pctChange(path[entry + n], px) : null)
  return {
    sessions: end - entry,
    full: end - entry === horizon,
    d5: at(5),
    d10: at(10),
    d20: at(20),
    d40: at(40),
    d60: at(60),
    mae: ((px - minPx) / px) * 100,
    hit5: maxPx >= px * 1.05 - 1e-8,
    hit10: maxPx >= px * 1.1 - 1e-8,
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
  const counts = bars.map((_, i) => conditionFlags(bars[i], FROZEN_THRESHOLDS).count)
  const episodes = []
  let short = 0
  for (const ep of built) {
    const openIdx = ep.openIdx
    if (openIdx + HORIZON >= bars.length) {
      short += 1
      continue
    }
    const end = Math.min(bars.length - 1, openIdx + HORIZON * 2)
    const path = []
    for (let i = openIdx; i <= end; i++) path.push(bars[i].close)
    const openedAt4 = ep.openCount >= 4
    const later4 = !openedAt4 && ep.fill4Idx != null
    const fourOffset = openedAt4 ? 0 : later4 ? ep.fill4Idx - openIdx : null
    const cls = classifyPath(path, PRIMARY)
    const lowIdx = windowLow(path, 0, HORIZON)
    const p0 = path[0]
    const lowPx = path[lowIdx]
    const fwd = forwardFrom(path, 0, HORIZON)
    const fourFwd = fourOffset != null ? forwardFrom(path, fourOffset, HORIZON) : null
    const hsFwd = forwardFrom(path, lowIdx, HORIZON)
    const pre4 =
      fourOffset == null
        ? null
        : fourOffset === 0
          ? 0
          : pctChange(path[windowLow(path, 0, fourOffset - 1)], p0)
    const post4Low =
      fourOffset == null
        ? null
        : pctChange(path[windowLow(path, fourOffset, HORIZON)], p0)
    episodes.push({
      symbol: meta.symbol,
      split: openIdx < split.splitIdx ? "train" : "test",
      openCount: ep.openCount,
      ge3Days: streakLength(counts, openIdx, 3),
      openedAt4,
      later4,
      reached4: openedAt4 || later4,
      daysTo4: fourOffset,
      letter: cls.letter,
      classId: cls.classId,
      path,
      lowIdx,
      daysToLow: lowIdx,
      lowVsDay0: pctChange(lowPx, p0),
      day0IsLow: lowIdx === 0,
      aboveLow: pctChange(p0, lowPx),
      fwd,
      fourFwd,
      hsFwd,
      pre4Drop: pre4,
      post4LowVsDay0: post4Low,
      rec5: daysUntil(path, lowIdx, HORIZON, (c) => c >= lowPx * 1.05 - 1e-8),
      rec10: daysUntil(path, lowIdx, HORIZON, (c) => c >= lowPx * 1.1 - 1e-8),
      recP0: daysUntil(path, lowIdx, HORIZON, (c) => c >= p0 - 1e-8),
    })
  }
  return {
    symbol: meta.symbol,
    status: "ok",
    split,
    built: built.length,
    short,
    episodes,
  }
}

function num(rows, pick) {
  return summarizeNumeric(rows.map(pick))
}

function fwdBlock(rows, pickFwd) {
  const withFwd = rows.map((r) => ({ ...r, f: pickFwd(r) })).filter((r) => r.f)
  const full = withFwd.filter((r) => r.f.full)
  const use = full.length ? full : withFwd
  return {
    n: use.length,
    fullHorizonN: full.length,
    d20: num(use, (r) => r.f.d20),
    d60: num(use, (r) => r.f.d60),
    mae: num(use, (r) => r.f.mae),
    hit5Pct: rate(use.filter((r) => r.f.hit5).length, use.length),
    hit10Pct: rate(use.filter((r) => r.f.hit10).length, use.length),
  }
}

function pathShares(rows) {
  const letters = ["A", "B", "C", "D", "other"]
  const counts = {}
  for (const letter of letters) counts[letter] = rows.filter((r) => r.letter === letter).length
  const n = rows.length
  const pct = {}
  for (const letter of letters) pct[letter] = rate(counts[letter], n)
  return { n, counts, pct }
}

function recoveryBlock(rows) {
  const pack = (field) => {
    const hits = rows.map((r) => r[field]).filter((v) => v != null)
    return {
      reachedPct: rate(hits.length, rows.length),
      daysAmongReached: summarizeNumeric(hits),
    }
  }
  return {
    n: rows.length,
    fromLowPlus5: pack("rec5"),
    fromLowPlus10: pack("rec10"),
    backToDay0: pack("recP0"),
    note: "Search stops at Day 60. A miss is not a later recovery.",
  }
}

function lowBlock(rows) {
  return {
    n: rows.length,
    daysToLow: num(rows, (r) => r.daysToLow),
    lowVsDay0: num(rows, (r) => r.lowVsDay0),
    day0IsLowPct: rate(rows.filter((r) => r.day0IsLow).length, rows.length),
    day0Within1PctOfLowPct: rate(rows.filter((r) => r.aboveLow != null && r.aboveLow <= 1).length, rows.length),
    day0Within2PctOfLowPct: rate(rows.filter((r) => r.aboveLow != null && r.aboveLow <= 2).length, rows.length),
    aboveLow: num(rows, (r) => r.aboveLow),
  }
}

function outcomeBlock(rows) {
  const fwd = fwdBlock(rows, (r) => r.fwd)
  return {
    n: rows.length,
    path: pathShares(rows),
    low: lowBlock(rows),
    recovery: recoveryBlock(rows),
    d5: num(rows, (r) => r.fwd?.d5),
    d10: num(rows, (r) => r.fwd?.d10),
    d20: fwd.d20,
    d40: num(rows, (r) => r.fwd?.d40),
    d60: fwd.d60,
    mae: fwd.mae,
    hit5Pct: fwd.hit5Pct,
    hit10Pct: fwd.hit10Pct,
  }
}

function bySplit(rows, build) {
  return {
    all: build(rows),
    train: build(rows.filter((r) => r.split === "train")),
    test: build(rows.filter((r) => r.split === "test")),
  }
}

function persistenceBlock(rows) {
  const cuts = [
    { id: "d1", test: (r) => r.ge3Days === 1 },
    { id: "d2plus", test: (r) => r.ge3Days >= 2 },
    { id: "d3plus", test: (r) => r.ge3Days >= 3 },
    { id: "d5plus", test: (r) => r.ge3Days >= 5 },
  ]
  const out = {
    note: "Groups overlap. A 5-day run is also inside the 2-day and 3-day groups. The run is consecutive closes with count >= 3, including Day 0.",
  }
  for (const cut of cuts) {
    const subset = rows.filter(cut.test)
    out[cut.id] = bySplit(subset, (list) => ({
      n: list.length,
      lowVsDay0: num(list, (r) => r.lowVsDay0),
      daysToLow: num(list, (r) => r.daysToLow),
      d20: num(list, (r) => r.fwd?.d20),
      d60: num(list, (r) => r.fwd?.d60),
      mae: num(list, (r) => r.fwd?.mae),
      hit5Pct: rate(list.filter((r) => r.fwd?.hit5).length, list.length),
      hit10Pct: rate(list.filter((r) => r.fwd?.hit10).length, list.length),
    }))
  }
  return out
}

function transitionBlock(rows) {
  const hit = rows.filter((r) => r.reached4)
  const miss = rows.filter((r) => !r.reached4)
  const later = hit.filter((r) => r.later4)
  const slice = (list) => ({
    n: list.length,
    daysTo4: num(list, (r) => r.daysTo4),
    pre4ExtraDrop: num(list, (r) => r.pre4Drop),
    post4LowVsDay0: num(list, (r) => r.post4LowVsDay0),
    d20: num(list, (r) => r.fwd?.d20),
    d60: num(list, (r) => r.fwd?.d60),
    mae: num(list, (r) => r.fwd?.mae),
  })
  return {
    note: "4/4 means count reached 4 inside the existing episode. An open that is already 4/4 has daysTo4 = 0. A 4/4 after the episode has cooled is a new episode, not a transition.",
    transitioned: bySplit(hit, slice),
    openedAlready4: bySplit(hit.filter((r) => r.openedAt4), slice),
    transitionedLater: bySplit(later, slice),
    notTransitioned: bySplit(miss, slice),
  }
}

function entryBlock(rows) {
  const later = rows.filter((r) => r.later4 && r.fourFwd?.full && r.fwd?.full)
  const hsFull = rows.filter((r) => r.hsFwd?.full)
  return {
    hindsightWarning:
      "The low entry uses the lowest close inside Day 0 through Day 60. That low is known only after the window. It is not a tradable signal.",
    day0: bySplit(rows, (list) => fwdBlock(list, (r) => r.fwd)),
    day4OnLaterTransitionSameEpisode: {
      note: "Same episodes only: opened at exactly 3, reached 4 later, and both entries still have 60 later sessions.",
      n: later.length,
      trainN: later.filter((r) => r.split === "train").length,
      testN: later.filter((r) => r.split === "test").length,
      day0Entry: bySplit(later, (list) => fwdBlock(list, (r) => r.fwd)),
      day4Entry: bySplit(later, (list) => fwdBlock(list, (r) => r.fourFwd)),
    },
    hindsightLow: {
      nWithFull60AfterLow: hsFull.length,
      excludedBecauseLowTooLate: rows.length - hsFull.length,
      entry: bySplit(hsFull, (list) => fwdBlock(list, (r) => r.hsFwd)),
    },
  }
}

function sensitivityBlock(rows) {
  const cells = []
  for (const extraDropPct of EXTRA_DROPS) {
    for (const bandPct of BANDS) {
      for (const bandDays of BAND_DAYS) {
        const spec = { ...PRIMARY, extraDropPct, bandPct, bandDays }
        const labeled = rows.map((r) => ({ split: r.split, letter: classifyPath(r.path, spec).letter }))
        const shares = bySplit(labeled, pathShares)
        cells.push({
          extraDropPct,
          bandPct,
          bandDays,
          all: shares.all.pct,
          train: shares.train.pct,
          test: shares.test.pct,
          testN: shares.test.n,
        })
      }
    }
  }
  const testC = cells.map((c) => c.test.C).filter((v) => v != null)
  const testB = cells.map((c) => c.test.B).filter((v) => v != null)
  const testA = cells.map((c) => c.test.A).filter((v) => v != null)
  const bcBeatsA = (c, side) => {
    const a = c[side].A
    const bc = (c[side].B ?? 0) + (c[side].C ?? 0)
    if (a == null) return null
    return bc > a
  }
  return {
    note: "The grid changes only the extra-low, the base band, and the base length. It does not choose a rule for production. A stays the fast +5% path with the fixed -3% block.",
    primary: { extraDropPct: 5, bandPct: 3, bandDays: 5 },
    cells,
    testCRange: { min: round2(Math.min(...testC)), max: round2(Math.max(...testC)) },
    testBRange: { min: round2(Math.min(...testB)), max: round2(Math.max(...testB)) },
    testARange: { min: round2(Math.min(...testA)), max: round2(Math.max(...testA)) },
    bcAboveAEveryTrainCell: cells.every((c) => bcBeatsA(c, "train") === true),
    bcAboveAEveryTestCell: cells.every((c) => bcBeatsA(c, "test") === true),
    cAboveAEveryTestCell: cells.every((c) => c.test.C != null && c.test.A != null && c.test.C > c.test.A),
  }
}

function fmt(v) {
  return v == null ? "n/a" : String(v)
}

function interpret(doc) {
  const t = doc.test
  const tr = doc.train
  const sens = doc.sensitivity
  const later = doc.entryComparison.day4OnLaterTransitionSameEpisode
  const t4 = later.day4Entry.test
  const t0 = later.day0Entry.test
  const daysLater = doc.transitionTo4of4.transitionedLater.test.daysTo4
  const lines = []
  lines.push(
    `Test에서 Day 0 포함 60거래일 최저점까지 중앙값 ${fmt(t.low.daysToLow.median)}거래일, 평균 ${fmt(t.low.daysToLow.mean)}거래일이다. Train 중앙값은 ${fmt(tr.low.daysToLow.median)}거래일이다.`,
  )
  lines.push(
    `Test에서 Day 0 자신이 그 구간의 최저 종가인 비율은 ${fmt(t.low.day0IsLowPct)}%이다. Day 0 종가가 최저 종가 대비 1% 이내인 비율은 ${fmt(t.low.day0Within1PctOfLowPct)}%, 2% 이내는 ${fmt(t.low.day0Within2PctOfLowPct)}%이다. 최저점의 Day 0 대비 하락 중앙값은 ${fmt(t.low.lowVsDay0.median)}%이다.`,
  )
  lines.push(
    `기본 분류(추가 저점 -5%, 횡보 ±3%·5일)에서 Test 빠른 반등 A는 ${fmt(t.path.pct.A)}%, 추가 하락 후 반등 B는 ${fmt(t.path.pct.B)}%, 조정·횡보 후 반등 C는 ${fmt(t.path.pct.C)}%, 미회복 D는 ${fmt(t.path.pct.D)}%, 그 밖 회복 other는 ${fmt(t.path.pct.other)}%이다.`,
  )
  lines.push(
    `같은 분류의 Train 비율은 A ${fmt(tr.path.pct.A)}%, B ${fmt(tr.path.pct.B)}%, C ${fmt(tr.path.pct.C)}%, D ${fmt(tr.path.pct.D)}%, other ${fmt(tr.path.pct.other)}%이다.`,
  )
  lines.push(
    `3/4로 연 뒤 같은 에피소드 안에서 나중에 4/4가 된 경우, Test의 4/4까지 기간 중앙값은 ${fmt(daysLater.median)}거래일, 평균은 ${fmt(daysLater.mean)}거래일이다. Day 0이 이미 4/4인 경우는 이 중앙값에 넣지 않았다.`,
  )
  lines.push(
    `같은 에피소드에서 3/4 다음날 이후의 4/4 종가 진입과 Day 0 종가 진입을 비교하면, Test D+20 중앙값은 Day 0 ${fmt(t0.d20.median)}% / 4/4 ${fmt(t4.d20.median)}%, D+60 중앙값은 Day 0 ${fmt(t0.d60.median)}% / 4/4 ${fmt(t4.d60.median)}%, MAE 중앙값은 Day 0 ${fmt(t0.mae.median)}% / 4/4 ${fmt(t4.mae.median)}%이다. 표본 수는 Test ${fmt(later.testN)}이다. 이 차이는 규칙의 우열을 정하지 않는다.`,
  )
  lines.push(
    `민감도 27개 조합에서 Test C 비율은 ${fmt(sens.testCRange.min)}%에서 ${fmt(sens.testCRange.max)}% 사이다. B+C가 A보다 큰 조합은 Train ${sens.bcAboveAEveryTrainCell ? "전부" : "일부"}, Test ${sens.bcAboveAEveryTestCell ? "전부" : "일부"}이다. C 단독이 A보다 큰 Test 조합은 ${sens.cAboveAEveryTestCell ? "전부" : "일부가 아니다"}.`,
  )
  lines.push(
    "최저점 매수 수치는 구간이 끝난 뒤에만 알 수 있는 hindsight이다. 매수 시점으로 쓰지 않는다.",
  )
  return lines
}

function assertMath() {
  const flat = (n, rels) => {
    const path = rels.map((r) => 100 * (1 + r / 100))
    while (path.length <= n) path.push(path[path.length - 1])
    return path
  }
  const a = classifyPath(flat(60, [0, 1, 2, 3, 4, 6]))
  if (a.letter !== "A") throw new Error(`expected A, got ${a.letter}`)
  const blocked = classifyPath(flat(60, [0, -4, 6]))
  if (blocked.letter === "A" || blocked.letter === "B" || blocked.letter === "C") {
    throw new Error(`-4% then +6% should not be A/B/C, got ${blocked.letter}`)
  }
  const b = classifyPath(flat(60, [0, -6, 2, 6]))
  if (b.letter !== "B") throw new Error(`expected B, got ${b.letter}`)
  const c = classifyPath(flat(60, [0, -6, -6, -6, -6, -6, -5, 8]))
  if (c.letter !== "C") throw new Error(`expected C, got ${c.letter}`)
  const d = classifyPath(flat(60, [0, -1]))
  if (d.letter !== "D") throw new Error(`expected D, got ${d.letter}`)
  const aFirst = classifyPath(flat(60, [0, 6, -8, -8, -8, -8, -8, 8]))
  if (aFirst.letter !== "A") throw new Error(`A must win priority, got ${aFirst.letter}`)
  if (streakLength([3, 3, 4, 1], 0, 3) !== 3) throw new Error("streak")
}

function main() {
  assertMath()
  assertNoEtfInStudyUniverse()
  console.log("3/4 price-path study. 48 names. Close-only. No ranking.")
  const blocks = []
  for (const meta of EQUITY_CANDIDATES) {
    const row = analyzeSymbol(meta, loadCached(meta.yahoo))
    console.log(`  ${meta.symbol}: ${row.status} episodes=${row.episodes?.length ?? 0} short=${row.short ?? 0}`)
    blocks.push(row)
  }
  const ready = blocks.filter((b) => b.status === "ok")
  const episodes = ready.flatMap((b) => b.episodes || [])
  const overall = outcomeBlock(episodes)
  const trainRows = episodes.filter((r) => r.split === "train")
  const testRows = episodes.filter((r) => r.split === "test")
  const train = outcomeBlock(trainRows)
  const test = outcomeBlock(testRows)
  const doc = {
    generatedAt: new Date().toISOString(),
    definition: {
      universe: "Existing 48 single names. ETF names are not included.",
      thresholds: FROZEN_THRESHOLDS,
      episodeDef: EPISODE_DEF,
      trainRatio: TRAIN_RATIO,
      horizon: HORIZON,
      price: "Session close. Day N is N trading sessions after Day 0. A missing session is not filled with a later close.",
      day0: "Day 0 is the existing rising-edge open, the first day count reaches at least 3. Later 3/4 or 4/4 days inside that episode are not new episodes. An open at 4 is still Day 0 of that episode.",
      sample: "An episode is in the classified sample only when 60 sessions after Day 0 exist.",
      priority: ["A fastRebound", "C dropBaseRebound", "B dropThenRebound", "D unrecovered", "otherRecovered"],
      pathRules: {
        A: "Within 5 sessions, a close is at least +5% versus Day 0, and no earlier close in that span is -3% or worse versus Day 0.",
        B: "The lowest close after Day 0, through Day 60, is -5% or worse versus Day 0, and a later close in the same window is at least +5% versus Day 0.",
        C: "B, and after that low there are at least 5 consecutive closes inside ±3% of the low, and a +5% versus Day 0 close comes after that run.",
        D: "No close through Day 60 is +5% versus Day 0.",
        other: "A +5% close happens, but the path is not A and not B.",
      },
      primary: PRIMARY,
      mae: "Worst later close within 60 sessions after the entry, as a percent below the entry. Zero when no later close is lower.",
      hindsight: "The low entry is the minimum close from Day 0 through Day 60. It is not a signal.",
    },
    coverage: {
      symbols: EQUITY_CANDIDATES.length,
      withData: ready.length,
      episodesBuilt: ready.reduce((s, b) => s + b.built, 0),
      shortHorizonExcluded: ready.reduce((s, b) => s + b.short, 0),
      sample: episodes.length,
      train: trainRows.length,
      test: testRows.length,
      dataStart: ready.map((b) => b.split?.dataStart).filter(Boolean).sort()[0] ?? null,
      dataEnd: ready.map((b) => b.split?.dataEnd).filter(Boolean).sort().at(-1) ?? null,
      splitDateMin: ready.map((b) => b.split?.splitDate).filter(Boolean).sort()[0] ?? null,
      splitDateMax: ready.map((b) => b.split?.splitDate).filter(Boolean).sort().at(-1) ?? null,
    },
    overall,
    train,
    test,
    pathClassification: bySplit(episodes, pathShares),
    lowTiming: bySplit(episodes, lowBlock),
    recovery: bySplit(episodes, recoveryBlock),
    persistence: persistenceBlock(episodes),
    transitionTo4of4: transitionBlock(episodes),
    entryComparison: entryBlock(episodes),
    sensitivity: sensitivityBlock(episodes),
    interpretation: [],
  }
  doc.interpretation = interpret(doc)
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log(`wrote ${OUT_JSON}`)
  console.log(`sample ${episodes.length} train ${trainRows.length} test ${testRows.length}`)
}

main()
