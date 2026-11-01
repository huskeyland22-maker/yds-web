#!/usr/bin/env node
/**
 * After a 3-of-4 open, does the decline slow before a later entry? Research only.
 *   node scripts/yds-daily-bottom-buy-3of4-stabilization-research.mjs
 *
 * Does not change production code, UI, API, DB, thresholds, or strategy.
 * Day 0 is an observation start, not an entry signal.
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
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-3of4-stabilization-result.json")

const HORIZON = 60
const SCAN = 20
const NEED = SCAN + HORIZON
const CHECK_DAYS = [1, 2, 3, 4, 5, 7, 10, 15]
const WAITS = [4, 5, 7, 10, 15]
const SENS_WAITS = [3, 4, 5, 7, 10, 15]
const SENS_BANDS = [2, 3, 5]
const SENS_NOLOW = [3, 5, 7]

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

function maxOf(arr, a, b) {
  let m = -Infinity
  for (let i = a; i <= b; i++) if (arr[i] > m) m = arr[i]
  return m
}

function hlSpan(highs, lows, a, b) {
  return maxOf(highs, a, b) - minOf(lows, a, b)
}

function meanAbsRet(closes, from, to) {
  let s = 0
  let n = 0
  for (let i = from; i <= to; i++) {
    if (!(closes[i - 1] > 0)) continue
    s += Math.abs(closes[i] / closes[i - 1] - 1)
    n += 1
  }
  return n ? s / n : null
}

/** Today's close is below every earlier close from Day 0. */
function isNewLow(closes, t) {
  if (t <= 0) return false
  return closes[t] < minOf(closes, 0, t - 1)
}

/** None of the last k closes broke the low that stood before that session. */
function noNewLow(closes, t, k) {
  if (t < k) return false
  for (let i = t - k + 1; i <= t; i++) {
    if (isNewLow(closes, i)) return false
  }
  return true
}

function newLowCount(closes, a, b) {
  let n = 0
  for (let i = Math.max(1, a); i <= b; i++) if (isNewLow(closes, i)) n += 1
  return n
}

function rangeShrinkPriorN(closes, highs, lows, t, n) {
  if (t < n * 2 - 1) return false
  const recent = hlSpan(highs, lows, t - n + 1, t)
  const prior = hlSpan(highs, lows, t - 2 * n + 1, t - n)
  return recent < prior
}

function rangeShrinkSinceDay0(highs, lows, t, n) {
  if (t < n) return false
  const recent = hlSpan(highs, lows, t - n + 1, t)
  const prior = hlSpan(highs, lows, 0, t - n)
  return recent < prior
}

function volShrink(closes, t, n) {
  const priorEnd = t - n
  const priorStart = priorEnd - 4
  if (priorStart < 1) return false
  const recent = meanAbsRet(closes, t - n + 1, t)
  const prior = meanAbsRet(closes, priorStart, priorEnd)
  if (recent == null || prior == null) return false
  return recent < prior
}

function freqDown(closes, t, w) {
  if (t < w * 2) return false
  return newLowCount(closes, t - w + 1, t) < newLowCount(closes, t - 2 * w + 1, t - w)
}

function inBand(closes, t, bandPct) {
  if (t < 4) return false
  const p0 = closes[0]
  const hi = maxOf(closes, t - 4, t)
  const lo = minOf(closes, t - 4, t)
  return lo >= p0 * (1 - bandPct / 100) && hi <= p0 * (1 + bandPct / 100)
}

function ruleBook(closes, highs, lows) {
  return {
    rangePrior3: (t) => rangeShrinkPriorN(closes, highs, lows, t, 3),
    rangePrior5: (t) => rangeShrinkPriorN(closes, highs, lows, t, 5),
    rangePrior7: (t) => rangeShrinkPriorN(closes, highs, lows, t, 7),
    rangeSince3: (t) => rangeShrinkSinceDay0(highs, lows, t, 3),
    rangeSince5: (t) => rangeShrinkSinceDay0(highs, lows, t, 5),
    rangeSince7: (t) => rangeShrinkSinceDay0(highs, lows, t, 7),
    vol3: (t) => volShrink(closes, t, 3),
    vol5: (t) => volShrink(closes, t, 5),
    vol7: (t) => volShrink(closes, t, 7),
    noLow3: (t) => noNewLow(closes, t, 3),
    noLow5: (t) => noNewLow(closes, t, 5),
    noLow7: (t) => noNewLow(closes, t, 7),
    base2: (t) => inBand(closes, t, 2),
    base3: (t) => inBand(closes, t, 3),
    base5: (t) => inBand(closes, t, 5),
    ease3: (t) => freqDown(closes, t, 3) && volShrink(closes, t, 3),
    ease5: (t) => freqDown(closes, t, 5) && volShrink(closes, t, 5),
  }
}

function firstTrue(fn, maxDay) {
  for (let t = 1; t <= maxDay; t++) if (fn(t)) return t
  return null
}

function bucketOf(day) {
  if (day == null) return "noneBy20"
  if (day <= 3) return "d1_3"
  if (day <= 5) return "d4_5"
  if (day <= 10) return "d6_10"
  if (day <= 15) return "d11_15"
  if (day <= 20) return "d16_20"
  return "noneBy20"
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
    d5: at(5),
    d10: at(10),
    d20: at(20),
    d40: at(40),
    d60: at(60),
    mae: ((px - minPx) / px) * 100,
    extraDrop: pctChange(minPx, px),
    daysToLow: minAt - entry,
    hit5: maxPx >= px * 1.05 - 1e-8,
    hit10: maxPx >= px * 1.1 - 1e-8,
  }
}

function hitPlus(closes, from, to, level) {
  const p0 = closes[0]
  const end = Math.min(to, closes.length - 1)
  for (let i = from; i <= end; i++) {
    if (pctChange(closes[i], p0) >= level - 1e-6) return i
  }
  return null
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
  for (const ep of built) {
    if (ep.openIdx + NEED >= bars.length) {
      short += 1
      continue
    }
    const closes = []
    const highs = []
    const lows = []
    for (let i = ep.openIdx; i <= ep.openIdx + NEED; i++) {
      closes.push(bars[i].close)
      highs.push(Number.isFinite(bars[i].high) ? bars[i].high : bars[i].close)
      lows.push(Number.isFinite(bars[i].low) ? bars[i].low : bars[i].close)
    }
    const rules = ruleBook(closes, highs, lows)
    const first = {}
    for (const [id, fn] of Object.entries(rules)) first[id] = firstTrue(fn, SCAN)
    const openedAt4 = ep.openCount >= 4
    const later4 = !openedAt4 && ep.fill4Idx != null
    const fourOffset = openedAt4 ? 0 : later4 ? ep.fill4Idx - ep.openIdx : null
    const lowIdx = (() => {
      let idx = 0
      for (let i = 1; i <= HORIZON; i++) if (closes[i] < closes[idx]) idx = i
      return idx
    })()
    const fwd = forwardFrom(closes, 0)
    const fourFwd = fourOffset != null ? forwardFrom(closes, fourOffset) : null
    const pre4 =
      fourOffset == null ? null : fourOffset === 0 ? 0 : pctChange(closes[(() => {
        let idx = 0
        for (let i = 1; i <= fourOffset - 1; i++) if (closes[i] < closes[idx]) idx = i
        return idx
      })()], closes[0])
    let post4Low = null
    let daysToLowAfter4 = null
    if (fourOffset != null) {
      let idx = fourOffset
      for (let i = fourOffset + 1; i <= HORIZON; i++) if (closes[i] < closes[idx]) idx = i
      post4Low = pctChange(closes[idx], closes[0])
      daysToLowAfter4 = idx - fourOffset
    }
    const firstUp = hitPlus(closes, 1, HORIZON, 5)
    const down3BeforeUp = (() => {
      if (firstUp == null) return false
      for (let i = 1; i < firstUp; i++) if (pctChange(closes[i], closes[0]) <= -3 + 1e-6) return true
      return false
    })()
    episodes.push({
      split: ep.openIdx < split.splitIdx ? "train" : "test",
      closes,
      highs,
      lows,
      first,
      openedAt4,
      later4,
      reached4: openedAt4 || later4,
      daysTo4: fourOffset,
      pre4Drop: pre4,
      post4LowVsDay0: post4Low,
      daysToLowAfter4,
      fourFwd,
      lowVsDay0: pctChange(closes[lowIdx], closes[0]),
      daysToLow: lowIdx,
      fwd,
      firstUp,
      fastRebound: firstUp != null && firstUp <= 5 && !down3BeforeUp,
    })
  }
  return { symbol: meta.symbol, status: "ok", split, built: built.length, short, episodes }
}

function fwdPack(rows, pick) {
  const use = rows.map((r) => pick(r)).filter((f) => f && f.full)
  return {
    n: use.length,
    d20: num(use, (f) => f.d20),
    d40: num(use, (f) => f.d40),
    d60: num(use, (f) => f.d60),
    mae: num(use, (f) => f.mae),
    extraDrop: num(use, (f) => f.extraDrop),
    daysToLow: num(use, (f) => f.daysToLow),
    hit5Pct: rate(use.filter((f) => f.hit5).length, use.length),
    hit10Pct: rate(use.filter((f) => f.hit10).length, use.length),
  }
}

function day0Pack(rows) {
  return {
    n: rows.length,
    lowVsDay0: num(rows, (r) => r.lowVsDay0),
    daysToLow: num(rows, (r) => r.daysToLow),
    mae: num(rows, (r) => r.fwd?.mae),
    d5: num(rows, (r) => r.fwd?.d5),
    d10: num(rows, (r) => r.fwd?.d10),
    d20: num(rows, (r) => r.fwd?.d20),
    d40: num(rows, (r) => r.fwd?.d40),
    d60: num(rows, (r) => r.fwd?.d60),
    hit5Pct: rate(rows.filter((r) => r.fwd?.hit5).length, rows.length),
    hit10Pct: rate(rows.filter((r) => r.fwd?.hit10).length, rows.length),
  }
}

function bySplit(rows, build) {
  return {
    all: build(rows),
    train: build(rows.filter((r) => r.split === "train")),
    test: build(rows.filter((r) => r.split === "test")),
  }
}

function durationBuckets(rows) {
  const ids = Object.keys(rows[0]?.first || {})
  const names = ["d1_3", "d4_5", "d6_10", "d11_15", "d16_20", "noneBy20"]
  const out = {
    note: "Bucket is the first day, through Day 20, that the named rule is true. Outcomes are measured from Day 0. D+5, D+10, and D+20 overlap the window that assigned the bucket.",
  }
  for (const id of ids) {
    out[id] = {}
    for (const name of names) {
      const subset = rows.filter((r) => bucketOf(r.first[id]) === name)
      out[id][name] = bySplit(subset, day0Pack)
    }
  }
  return out
}

function declineState(closes, t) {
  const p0 = closes[0]
  const new3 = t >= 2 && closes[t] < minOf(closes, t - 2, t - 1)
  const new5 = t >= 4 && closes[t] < minOf(closes, t - 4, t - 1)
  const threeDown = t >= 3 && closes[t] < closes[t - 1] && closes[t - 1] < closes[t - 2] && closes[t - 2] < closes[t - 3]
  let higherHigh = null
  let lowerHigh = null
  let higherLow = null
  let lowerLow = null
  if (t >= 4) {
    const earlyHi = maxOf(closes, t - 4, t - 3)
    const lateHi = maxOf(closes, t - 2, t)
    const earlyLo = minOf(closes, t - 4, t - 3)
    const lateLo = minOf(closes, t - 2, t)
    higherHigh = lateHi > earlyHi
    lowerHigh = lateHi < earlyHi
    higherLow = lateLo > earlyLo
    lowerLow = lateLo < earlyLo
  }
  return {
    vsDay0: pctChange(closes[t], p0),
    belowDay0: closes[t] < p0,
    vsRunningLow: pctChange(closes[t], minOf(closes, 0, t)),
    newLowToday: isNewLow(closes, t),
    new3DayLow: new3,
    new5DayLow: new5,
    threeDownCloses: threeDown,
    higherHigh,
    lowerHigh,
    higherLow,
    lowerLow,
  }
}

function declineContinuation(rows) {
  const days = [3, 5, 10, 20]
  const out = {
    note: "State on that session, using only closes through that session. A new 3-day or 5-day low means today's close is below the prior closes in that trailing window.",
  }
  for (const day of days) {
    const states = rows.map((r) => ({ split: r.split, ...declineState(r.closes, day) }))
    out[`d${day}`] = bySplit(states, (list) => ({
      n: list.length,
      vsDay0: num(list, (r) => r.vsDay0),
      belowDay0Pct: rate(list.filter((r) => r.belowDay0).length, list.length),
      newLowTodayPct: rate(list.filter((r) => r.newLowToday).length, list.length),
      new3DayLowPct: rate(list.filter((r) => r.new3DayLow).length, list.length),
      new5DayLowPct: rate(list.filter((r) => r.new5DayLow).length, list.length),
      threeDownPct: rate(list.filter((r) => r.threeDownCloses).length, list.length),
      higherHighPct: rate(list.filter((r) => r.higherHigh).length, list.length),
      lowerHighPct: rate(list.filter((r) => r.lowerHigh).length, list.length),
      higherLowPct: rate(list.filter((r) => r.higherLow).length, list.length),
      lowerLowPct: rate(list.filter((r) => r.lowerLow).length, list.length),
      vsRunningLow: num(list, (r) => r.vsRunningLow),
    }))
  }
  const still = rows.filter((r) => {
    const s = declineState(r.closes, 20)
    return s.belowDay0 && (s.new5DayLow || s.newLowToday)
  })
  out.stillDecliningAtDay20 = {
    note: "Day 20 close is below Day 0 and that session is a new low versus Day 0 or versus the prior 4 closes. This state can overlap an earlier stabilization print.",
    ...bySplit(still, day0Pack),
  }
  return out
}

function signalSummary(rows) {
  const ids = Object.keys(rows[0]?.first || {})
  const out = {
    note: "Share of episodes whose first true day for that rule falls in the bucket. Rules are not combined into one score.",
  }
  for (const id of ids) {
    const days = rows.map((r) => r.first[id]).filter((d) => d != null)
    out[id] = bySplit(rows, (list) => {
      const counts = {}
      for (const name of ["d1_3", "d4_5", "d6_10", "d11_15", "d16_20", "noneBy20"]) {
        counts[name] = list.filter((r) => bucketOf(r.first[id]) === name).length
      }
      const pct = {}
      for (const [k, v] of Object.entries(counts)) pct[k] = rate(v, list.length)
      return {
        n: list.length,
        counts,
        pct,
        firstDay: summarizeNumeric(list.map((r) => r.first[id]).filter((d) => d != null)),
      }
    })
    out[id].firstDayAmongTriggers = summarizeNumeric(days)
  }
  return out
}

function reboundBefore(closes, from, to) {
  return hitPlus(closes, from, to, 5) != null
}

function entryFor(row, fn, minWait) {
  if (minWait === 0) {
    return { entry: 0, missedBeforeEntry: false, missedBeforeWait: false }
  }
  let entry = null
  for (let t = minWait; t <= SCAN; t++) {
    if (fn(t)) {
      entry = t
      break
    }
  }
  const missedBeforeWait = reboundBefore(row.closes, 1, minWait - 1)
  const missedBeforeEntry =
    entry == null ? reboundBefore(row.closes, 1, SCAN) : reboundBefore(row.closes, 1, entry - 1)
  return { entry, missedBeforeEntry, missedBeforeWait }
}

function entryStats(rows, pickEntry) {
  const plans = rows.map((r) => ({ row: r, ...pickEntry(r) }))
  const filled = plans.filter((p) => p.entry != null)
  const fwds = filled.map((p) => forwardFrom(p.row.closes, p.entry)).filter((f) => f && f.full)
  const cashD = (key) =>
    plans.map((p) => {
      if (p.entry == null) return 0
      const f = forwardFrom(p.row.closes, p.entry)
      return f && f.full ? f[key] : null
    })
  const cashHit = (key) =>
    plans.filter((p) => {
      if (p.entry == null) return false
      const f = forwardFrom(p.row.closes, p.entry)
      return Boolean(f && f.full && f[key])
    }).length
  return {
    n: plans.length,
    filledN: fwds.length,
    fillPct: rate(fwds.length, plans.length),
    missedPlus5BeforeEntryPct: rate(plans.filter((p) => p.missedBeforeEntry).length, plans.length),
    missedPlus5BeforeMinWaitPct: rate(plans.filter((p) => p.missedBeforeWait).length, plans.length),
    filled: {
      n: fwds.length,
      d20: num(fwds, (f) => f.d20),
      d40: num(fwds, (f) => f.d40),
      d60: num(fwds, (f) => f.d60),
      mae: num(fwds, (f) => f.mae),
      extraDrop: num(fwds, (f) => f.extraDrop),
      daysToLow: num(fwds, (f) => f.daysToLow),
      hit5Pct: rate(fwds.filter((f) => f.hit5).length, fwds.length),
      hit10Pct: rate(fwds.filter((f) => f.hit10).length, fwds.length),
    },
    allUnfilledAsCash0: {
      note: "No fill by Day 20 earns 0. A rebound during the wait is not credited.",
      d20: summarizeNumeric(cashD("d20")),
      d40: summarizeNumeric(cashD("d40")),
      d60: summarizeNumeric(cashD("d60")),
      mae: summarizeNumeric(cashD("mae")),
      hit5Pct: rate(cashHit("hit5"), plans.length),
      hit10Pct: rate(cashHit("hit10"), plans.length),
    },
  }
}

function entryTiming(rows) {
  const ids = Object.keys(rows[0]?.first ? ruleBook(rows[0].closes, rows[0].highs, rows[0].lows) : {})
  const out = {
    note: "H1 enters at the Day 0 close. Later rules enter at the first close, on or after the minimum wait and no later than Day 20, where that rule is true. Episodes with no such close stay in the sample as no-fill. A +5% close before the entry is counted, not dropped.",
    H1: bySplit(rows, (list) => entryStats(list, () => ({ entry: 0, missedBeforeEntry: false, missedBeforeWait: false }))),
  }
  for (const id of ids) {
    out[id] = {}
    for (const wait of WAITS) {
      out[id][`min${wait}`] = bySplit(rows, (list) =>
        entryStats(list, (r) => entryFor(r, ruleBook(r.closes, r.highs, r.lows)[id], wait)),
      )
    }
  }
  return out
}

function minimumWaitAnalysis(rows) {
  const out = {
    note: "Every episode is marked at that session, whether or not a stabilization rule is true. Forward results assume an entry at that close, so a name that already bounced is bought at the higher close.",
  }
  for (const day of CHECK_DAYS) {
    const marked = rows.map((r) => {
      const f = forwardFrom(r.closes, day)
      return {
        split: r.split,
        vsDay0: pctChange(r.closes[day], r.closes[0]),
        belowDay0: r.closes[day] < r.closes[0],
        newLowToday: isNewLow(r.closes, day),
        alreadyPlus5: hitPlus(r.closes, 1, day, 5) != null,
        f,
      }
    })
    out[`d${day}`] = bySplit(marked, (list) => ({
      n: list.length,
      belowDay0Pct: rate(list.filter((r) => r.belowDay0).length, list.length),
      vsDay0: num(list, (r) => r.vsDay0),
      newLowTodayPct: rate(list.filter((r) => r.newLowToday).length, list.length),
      alreadyPlus5Pct: rate(list.filter((r) => r.alreadyPlus5).length, list.length),
      d20: num(list, (r) => r.f?.d20),
      d60: num(list, (r) => r.f?.d60),
      mae: num(list, (r) => r.f?.mae),
      hit5Pct: rate(list.filter((r) => r.f?.hit5).length, list.length),
      hit10Pct: rate(list.filter((r) => r.f?.hit10).length, list.length),
    }))
  }
  return out
}

function transitionBlock(rows) {
  const hit = rows.filter((r) => r.reached4)
  const later = rows.filter((r) => r.later4)
  const slice = (list) => ({
    n: list.length,
    daysTo4: num(list, (r) => r.daysTo4),
    pre4ExtraDrop: num(list, (r) => r.pre4Drop),
    post4LowVsDay0: num(list, (r) => r.post4LowVsDay0),
    daysToLowAfter4: num(list, (r) => r.daysToLowAfter4),
    d20FromDay0: num(list, (r) => r.fwd?.d20),
    d60FromDay0: num(list, (r) => r.fwd?.d60),
    maeFromDay0: num(list, (r) => r.fwd?.mae),
    d20From4: num(list, (r) => r.fourFwd?.d20),
    d60From4: num(list, (r) => r.fourFwd?.d60),
    maeFrom4: num(list, (r) => r.fourFwd?.mae),
  })
  return {
    note: "4/4 is a count of 4 inside the existing episode. An open that is already 4 has daysTo4 = 0. Performance from Day 0 is not an entry rule.",
    reached4: bySplit(hit, slice),
    laterOnly: bySplit(later, slice),
    notReached: bySplit(rows.filter((r) => !r.reached4), slice),
  }
}

function gap(rows, pred) {
  const yes = rows.filter(pred)
  const no = rows.filter((r) => !pred(r))
  const y = num(yes, (r) => r.fwd?.d60).median
  const n = num(no, (r) => r.fwd?.d60).median
  const yMae = num(yes, (r) => r.fwd?.mae).median
  const nMae = num(no, (r) => r.fwd?.mae).median
  return {
    yesN: yes.length,
    noN: no.length,
    d60Yes: y,
    d60No: n,
    d60Gap: y == null || n == null ? null : round2(y - n),
    maeYes: yMae,
    maeNo: nMae,
    maeGap: yMae == null || nMae == null ? null : round2(yMae - nMae),
  }
}

function association(rows) {
  const rules = {
    noLow5By10: (r) => r.first.noLow5 != null && r.first.noLow5 <= 10,
    base3By10: (r) => r.first.base3 != null && r.first.base3 <= 10,
    ease5By10: (r) => r.first.ease5 != null && r.first.ease5 <= 10,
    rangePrior5By10: (r) => r.first.rangePrior5 != null && r.first.rangePrior5 <= 10,
    reached4: (r) => r.reached4,
  }
  const out = {
    note: "Gap is the Day 0 D+60 median when the flag is true minus the median when it is false. A larger gap is not a decision to trade the flag.",
  }
  for (const [id, pred] of Object.entries(rules)) {
    out[id] = bySplit(rows, (list) => gap(list, pred))
  }
  const crossPreds = [
    ["noLow5By10", rules.noLow5By10],
    ["base3By10", rules.base3By10],
  ]
  out.cross = {}
  for (const [id, pred] of crossPreds) {
    const cells = {
      both: (r) => pred(r) && r.reached4,
      stabilizeOnly: (r) => pred(r) && !r.reached4,
      fourOnly: (r) => !pred(r) && r.reached4,
      neither: (r) => !pred(r) && !r.reached4,
    }
    out.cross[id] = {}
    for (const [name, fn] of Object.entries(cells)) {
      out.cross[id][name] = bySplit(rows.filter(fn), day0Pack)
    }
  }
  return out
}

function pathSplit(rows) {
  const labeled = rows.map((r) => {
    const up = r.firstUp
    const stab = r.first.noLow5
    let kind = "noPlus5"
    if (r.fastRebound) kind = "fastRebound"
    else if (stab != null && up != null && stab < up) kind = "stabilizeThenRebound"
    else if (up != null) kind = "laterReboundWithoutThisPause"
    return { split: r.split, kind }
  })
  const count = (list) => {
    const keys = ["fastRebound", "stabilizeThenRebound", "laterReboundWithoutThisPause", "noPlus5"]
    const counts = {}
    for (const k of keys) counts[k] = list.filter((r) => r.kind === k).length
    const pct = {}
    for (const k of keys) pct[k] = rate(counts[k], list.length)
    return { n: list.length, counts, pct }
  }
  return {
    note: "Uses the 5-session no-new-low rule only as a label, not as the preferred rule. Fast rebound is a +5% close within 5 sessions with no -3% close before it. Stabilize-then-rebound means that no-new-low print happens before the first +5% close. A fast +5% is not treated as a good entry.",
    ...bySplit(labeled, count),
  }
}

function sensitivity(rows) {
  const cells = []
  for (const wait of SENS_WAITS) {
    for (const band of SENS_BANDS) {
      for (const k of SENS_NOLOW) {
        const stats = {}
        for (const side of ["all", "train", "test"]) {
          const list = side === "all" ? rows : rows.filter((r) => r.split === side)
          const fn = (t, closes) => noNewLow(closes, t, k) && inBand(closes, t, band)
          const block = entryStats(list, (r) => entryFor(r, (t) => fn(t, r.closes), wait))
          const h1 = entryStats(list, () => ({ entry: 0, missedBeforeEntry: false, missedBeforeWait: false }))
          stats[side] = {
            fillPct: block.fillPct,
            missedPlus5BeforeEntryPct: block.missedPlus5BeforeEntryPct,
            filledD60: block.filled.d60.median,
            filledMae: block.filled.mae.median,
            cashD60: block.allUnfilledAsCash0.d60.median,
            h1D60: h1.filled.d60.median,
            filledMinusH1: round2((block.filled.d60.median ?? NaN) - (h1.filled.d60.median ?? NaN)),
            cashMinusH1: round2((block.allUnfilledAsCash0.d60.median ?? NaN) - (h1.allUnfilledAsCash0.d60.median ?? NaN)),
          }
        }
        cells.push({ wait, band, noNewLowDays: k, ...stats })
      }
    }
  }
  const sameSign = (pick) => {
    let agree = 0
    let comparable = 0
    for (const c of cells) {
      const a = c.train[pick]
      const b = c.test[pick]
      if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) continue
      comparable += 1
      if ((a > 0 && b > 0) || (a < 0 && b < 0) || (a === 0 && b === 0)) agree += 1
    }
    return { comparable, agree, agreePct: rate(agree, comparable) }
  }
  return {
    note: "Each cell enters on or after the wait, through Day 20, when both a no-new-low run and a 5-close band around Day 0 are true. filledMinusH1 drops episodes that never qualify. cashMinusH1 keeps them at 0. Neither column is a rule to trade.",
    cells,
    filledGapSameSignTrainTest: sameSign("filledMinusH1"),
    cashGapSameSignTrainTest: sameSign("cashMinusH1"),
  }
}

function fmt(v) {
  return v == null || Number.isNaN(v) ? "n/a" : String(v)
}

function interpret(doc) {
  const t = doc.test
  const tr = doc.train
  const w = doc.minimumWaitAnalysis
  const lines = []
  lines.push(
    `Test에서 Day 0 포함 60거래일 최저 종가까지 중앙값은 ${fmt(t.daysToLow.median)}거래일, 평균 ${fmt(t.daysToLow.mean)}거래일이다. Train 중앙값은 ${fmt(tr.daysToLow.median)}거래일이다. 최저 종가의 Day 0 대비 하락 중앙값은 Test ${fmt(t.lowVsDay0.median)}%, Train ${fmt(tr.lowVsDay0.median)}%이다.`,
  )
  const days = [4, 5, 7, 10, 15]
  const bits = days.map((d) => {
    const x = w[`d${d}`].test
    return `${d}일 중앙 ${fmt(x.vsDay0.median)}%, Day 0 아래 ${fmt(x.belowDay0Pct)}%, 이미 +5% ${fmt(x.alreadyPlus5Pct)}%, 그 종가 진입 D+60 중앙 ${fmt(x.d60.median)}%`
  })
  lines.push(`달력 기준으로 모든 Test 에피소드를 그 날 종가에 진입하면: ${bits.join("; ")}.`)
  const none = doc.durationBuckets.noLow5.noneBy20.test
  const early = doc.durationBuckets.noLow5.d4_5.test
  lines.push(
    `5거래일 저점 갱신 중단을 예로 들면, Test에서 4~5일째 처음 나타난 그룹 n=${fmt(early.n)}의 Day 0 기준 D+60 중앙값은 ${fmt(early.d60.median)}%, 20일까지 한 번도 없는 그룹 n=${fmt(none.n)}은 ${fmt(none.d60.median)}%이다. 이 그룹 배정은 Day 20까지의 가격을 쓰므로 D+20 이하는 그 정보와 겹친다.`,
  )
  const a = doc.transitionTo4of4.association
  lines.push(
    `Day 0 기준 D+60 중앙값 차이는, Test에서 10일 이내 5일 저점중단이 있는 쪽 빼는 없는 쪽이 ${fmt(a.noLow5By10.test.d60Gap)}%포인트, 4/4 도달 빼는 미도달이 ${fmt(a.reached4.test.d60Gap)}%포인트이다. Train에서는 각각 ${fmt(a.noLow5By10.train.d60Gap)}와 ${fmt(a.reached4.train.d60Gap)}이다.`,
  )
  lines.push(
    `Test 경로 라벨(5일 저점중단 기준)은 빠른 반등 ${fmt(doc.pathSplit.test.pct.fastRebound)}%, 저점중단 뒤 +5% ${fmt(doc.pathSplit.test.pct.stabilizeThenRebound)}%, 그 중단 없이 나중에 +5% ${fmt(doc.pathSplit.test.pct.laterReboundWithoutThisPause)}%, 60일 내 +5% 없음 ${fmt(doc.pathSplit.test.pct.noPlus5)}%이다. Train은 빠른 반등 ${fmt(doc.pathSplit.train.pct.fastRebound)}%, 저점중단 뒤 +5% ${fmt(doc.pathSplit.train.pct.stabilizeThenRebound)}%이다.`,
  )
  lines.push(
    `민감도 ${doc.sensitivity.cells.length}개 칸에서, 체결만 본 D+60이 Day 0 진입보다 높은 방향이 Train과 Test에서 같은 칸은 ${fmt(doc.sensitivity.filledGapSameSignTrainTest.agree)}/${fmt(doc.sensitivity.filledGapSameSignTrainTest.comparable)}이다. 미체결을 0으로 둔 비교가 같은 방향인 칸은 ${fmt(doc.sensitivity.cashGapSameSignTrainTest.agree)}/${fmt(doc.sensitivity.cashGapSameSignTrainTest.comparable)}이다.`,
  )
  lines.push(
    "기다리는 동안 +5%가 먼저 나온 에피소드는 빼지 않았다. 미체결은 현금 0으로만 남긴다. 어느 대기일이나 둔화 규칙을 매수 규칙으로 고르지 않는다.",
  )
  return lines
}

function assertMath() {
  const closes = [100, 90, 91, 92, 93, 94, 95, 96]
  if (!isNewLow(closes, 1)) throw new Error("day1 should be a new low")
  if (isNewLow(closes, 4)) throw new Error("day4 should not be a new low")
  if (!noNewLow(closes, 4, 3)) throw new Error("days 2-4 do not break the low")
  if (noNewLow(closes, 3, 3)) throw new Error("day1 is inside the last 3 days")
  if (!inBand([100, 99, 100, 101, 100], 4, 3)) throw new Error("tight band")
  if (inBand([100, 90, 100, 101, 100], 4, 3)) throw new Error("90 is outside 3%")
  const up = []
  for (let i = 0; i <= 60; i++) up.push(100 + i)
  if (hitPlus(up, 1, 60, 5) !== 5) throw new Error("plus 5 on day 5")
}

function main() {
  assertMath()
  assertNoEtfInStudyUniverse()
  console.log("3/4 stabilization study. 48 names. Close path plus high/low range. No ranking.")
  const blocks = []
  for (const meta of EQUITY_CANDIDATES) {
    const row = analyzeSymbol(meta, loadCached(meta.yahoo))
    console.log(`  ${meta.symbol}: ${row.status} episodes=${row.episodes?.length ?? 0} short=${row.short ?? 0}`)
    blocks.push(row)
  }
  const ready = blocks.filter((b) => b.status === "ok")
  const episodes = ready.flatMap((b) => b.episodes || [])
  const trainRows = episodes.filter((r) => r.split === "train")
  const testRows = episodes.filter((r) => r.split === "test")
  const overall = day0Pack(episodes)
  const train = day0Pack(trainRows)
  const test = day0Pack(testRows)
  const transition = transitionBlock(episodes)
  transition.association = association(episodes)
  const doc = {
    generatedAt: new Date().toISOString(),
    definition: {
      universe: "Existing 48 single names. ETF names are not included.",
      thresholds: FROZEN_THRESHOLDS,
      episodeDef: EPISODE_DEF,
      trainRatio: TRAIN_RATIO,
      day0: "Rising-edge open when count first reaches at least 3. Later 3/4 or 4/4 days inside that episode are not new episodes.",
      sample: "Day 20 and 60 sessions after Day 20 both exist, so every wait through Day 20 has a 60-session forward window.",
      price: "Session close for returns and lows. High and low are used only for the range-contraction rules.",
      structure: "Over the last 5 closes, the early pair is t-4 and t-3 and the late triple is t-2 through t.",
      rangePrior: "Recent N-session high-low span is smaller than the previous N-session span.",
      rangeSince: "Recent N-session high-low span is smaller than the span from Day 0 through the session before that window. The older span is longer, so this comparison is easier to pass.",
      vol: "Mean absolute close-to-close change over N sessions is smaller than over the 5 sessions immediately before those N sessions.",
      noNewLow: "None of the last K closes undercut the lowest close from Day 0 through the prior session.",
      base: "All of the last 5 closes sit inside the stated band around the Day 0 close.",
      ease: "New-low count over the last W sessions is lower than over the previous W sessions, and the vol rule for that W is also true.",
      entry: "Conditional entry is the first session from the minimum wait through Day 20 where the rule is true. No fill stays in the sample. A +5% close before that entry is counted.",
      cash: "Unfilled waits earn 0. They do not receive the rebound that happened while waiting.",
      notASignal: "Day 0 is only the start of the observation. None of these rules is a production entry.",
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
    },
    overall,
    train,
    test,
    durationBuckets: durationBuckets(episodes),
    declineContinuation: declineContinuation(episodes),
    stabilizationSignals: signalSummary(episodes),
    entryTiming: entryTiming(episodes),
    minimumWaitAnalysis: minimumWaitAnalysis(episodes),
    transitionTo4of4: transition,
    pathSplit: pathSplit(episodes),
    sensitivity: sensitivity(episodes),
    interpretation: [],
  }
  doc.interpretation = interpret(doc)
  const slim = JSON.parse(JSON.stringify(doc, (key, value) => {
    if (key === "closes" || key === "highs" || key === "lows") return undefined
    return value
  }))
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(slim, null, 2))
  console.log(`wrote ${OUT_JSON}`)
  console.log(`sample ${episodes.length} train ${trainRows.length} test ${testRows.length}`)
}

main()
