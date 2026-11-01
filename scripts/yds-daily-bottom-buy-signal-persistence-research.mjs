#!/usr/bin/env node
/**
 * Signal persistence after the first 3/4 or 4/4 day (research only).
 *   node scripts/yds-daily-bottom-buy-signal-persistence-research.mjs
 *
 * Does not change production code, UI, API, or frozen thresholds.
 * DayN is the close N trading sessions after Day0. A missing bar is not
 * replaced by the next session.
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
import { atrBand } from "./lib/daily-bottom-buy-individual-stock-train-test-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-signal-persistence-result.json")

const HORIZON = 60
const LAGS = [0, 1, 3, 5, 10]
const MAX_LAG = 10
const BANDS = ["lt3", "b3_4", "ge4"]

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

function countAt(bars, i) {
  return conditionFlags(bars[i], FROZEN_THRESHOLDS).count
}

/** Consecutive sessions from start, inclusive, while count stays at or above minCount. */
export function streakLength(counts, start, minCount) {
  let n = 0
  for (let j = start; j < counts.length; j++) {
    if (counts[j] < minCount) break
    n += 1
  }
  return n
}

/** Sessions after start until count is at or below maxCount. Null if it never happens. */
export function sessionsUntilAtMost(counts, start, maxCount) {
  for (let j = start + 1; j < counts.length; j++) {
    if (counts[j] <= maxCount) return j - start
  }
  return null
}

/** First later index inside an uninterrupted >=3 run where count reaches 4. */
export function firstFourOffset(counts, start) {
  const run = streakLength(counts, start, 3)
  for (let k = 1; k < run; k++) {
    if (counts[start + k] >= 4) return k
  }
  return null
}

function windowMin(bars, from, to) {
  const end = Math.min(to, bars.length - 1)
  if (from > end) return null
  let min = Infinity
  let idx = null
  for (let j = from; j <= end; j++) {
    const c = bars[j].close
    if (c < min) {
      min = c
      idx = j
    }
  }
  return Number.isFinite(min) ? { min, idx } : null
}

/**
 * One delayed close versus Day0, plus the 60-session path after that close.
 * sharedLow is the lowest close on [day0, day0+60].
 */
export function describeEntry(bars, day0, lag, sharedLow) {
  const entryIdx = day0 + lag
  const entry = bars[entryIdx]?.close
  const day0Close = bars[day0]?.close
  if (!(entry > 0) || !(day0Close > 0)) return null
  if (entryIdx + HORIZON >= bars.length) return null
  const after = windowMin(bars, entryIdx + 1, entryIdx + HORIZON)
  const vsDay0 = pctChange(entry, day0Close)
  let maxUp = 0
  let minPx = entry
  for (let j = entryIdx + 1; j <= entryIdx + HORIZON; j++) {
    const c = bars[j].close
    if (c > maxUp) maxUp = c
    if (c < minPx) minPx = c
  }
  const extraDrop = pctChange(after.min, entry)
  const mae = entry > after.min ? ((entry - after.min) / entry) * 100 : 0
  const fwd = (n) => pctChange(bars[entryIdx + n].close, entry)
  return {
    vsDay0,
    cheaper: entry < day0Close,
    dearer: entry > day0Close,
    aboveLow: sharedLow > 0 ? pctChange(entry, sharedLow) : null,
    extraDrop,
    daysToLow: after.idx - entryIdx,
    mae,
    d5: fwd(5),
    d10: fwd(10),
    d20: fwd(20),
    d40: fwd(40),
    d60: fwd(60),
    hit5: maxUp >= entry * 1.05,
    hit10: maxUp >= entry * 1.1,
    drop10: after.min <= entry * 0.9,
    drop20: after.min <= entry * 0.8,
  }
}

function pack(rows) {
  const num = (pick) => summarizeNumeric(rows.map(pick))
  return {
    n: rows.length,
    entryVsDay0Median: num((r) => r.vsDay0).median,
    entryVsDay0Mean: num((r) => r.vsDay0).mean,
    cheaperPct: rate(rows.filter((r) => r.cheaper).length, rows.length),
    dearerPct: rate(rows.filter((r) => r.dearer).length, rows.length),
    flatPct: rate(rows.filter((r) => !r.cheaper && !r.dearer).length, rows.length),
    aboveLowMedian: num((r) => r.aboveLow).median,
    extraDropMedian: num((r) => r.extraDrop).median,
    daysToLowMedian: num((r) => r.daysToLow).median,
    maeMedian: num((r) => r.mae).median,
    maeMean: num((r) => r.mae).mean,
    d5Median: num((r) => r.d5).median,
    d10Median: num((r) => r.d10).median,
    d20Median: num((r) => r.d20).median,
    d40Median: num((r) => r.d40).median,
    d60Median: num((r) => r.d60).median,
    hit5Pct: rate(rows.filter((r) => r.hit5).length, rows.length),
    hit10Pct: rate(rows.filter((r) => r.hit10).length, rows.length),
    drop10Pct: rate(rows.filter((r) => r.drop10).length, rows.length),
    drop20Pct: rate(rows.filter((r) => r.drop20).length, rows.length),
  }
}

function packBySplit(rows) {
  return {
    train: pack(rows.filter((r) => r.split === "train")),
    test: pack(rows.filter((r) => r.split === "test")),
  }
}

function sameSign(a, b) {
  if (a == null || b == null) return null
  if (a === 0 && b === 0) return true
  if (a === 0 || b === 0) return false
  return a > 0 === b > 0
}

function gap(a, b) {
  if (a == null || b == null) return null
  return round2(a - b)
}

function directionBlock(byLag) {
  const day0 = {
    train: byLag["0"].train,
    test: byLag["0"].test,
  }
  const lags = {}
  for (const lag of LAGS) {
    if (lag === 0) continue
    const key = String(lag)
    const trainGap = byLag[key].train.entryVsDay0Median
    const testGap = byLag[key].test.entryVsDay0Median
    const trainD60 = gap(byLag[key].train.d60Median, day0.train.d60Median)
    const testD60 = gap(byLag[key].test.d60Median, day0.test.d60Median)
    const trainMae = gap(byLag[key].train.maeMedian, day0.train.maeMedian)
    const testMae = gap(byLag[key].test.maeMedian, day0.test.maeMedian)
    const trainD20 = gap(byLag[key].train.d20Median, day0.train.d20Median)
    const testD20 = gap(byLag[key].test.d20Median, day0.test.d20Median)
    lags[key] = {
      entryVsDay0: { train: trainGap, test: testGap, sameDirection: sameSign(trainGap, testGap) },
      d20VsDay0: { train: trainD20, test: testD20, sameDirection: sameSign(trainD20, testD20) },
      d60VsDay0: { train: trainD60, test: testD60, sameDirection: sameSign(trainD60, testD60) },
      maeVsDay0: { train: trainMae, test: testMae, sameDirection: sameSign(trainMae, testMae) },
    }
  }
  return lags
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
  const counts = bars.map((_, i) => countAt(bars, i))
  const events = []
  let short34 = 0
  let short44 = 0
  for (const ep of built) {
    if (ep.openCount === 3) {
      const row = buildEvent(bars, counts, ep.openIdx, split.splitIdx, "3/4")
      if (!row) short34 += 1
      else {
        const run = streakLength(counts, ep.openIdx, 3)
        const to4 = firstFourOffset(counts, ep.openIdx)
        row.ge3Days = run
        row.ge4Days = null
        row.daysTo4 = to4
        row.daysToLe2 = sessionsUntilAtMost(counts, ep.openIdx, 2)
        row.episodeDaysTo4 = ep.daysTo4
        events.push(row)
      }
    }
    const fourIdx = ep.openCount >= 4 ? ep.openIdx : ep.fill4Idx
    if (fourIdx != null) {
      const row = buildEvent(bars, counts, fourIdx, split.splitIdx, "4/4")
      if (!row) short44 += 1
      else {
        row.ge4Days = streakLength(counts, fourIdx, 4)
        row.ge3Days = streakLength(counts, fourIdx, 3)
        row.daysTo4 = null
        row.daysToLe2 = sessionsUntilAtMost(counts, fourIdx, 2)
        events.push(row)
      }
    }
  }
  return {
    symbol: meta.symbol,
    status: "ok",
    split,
    built: built.length,
    short34,
    short44,
    events,
  }
}

function buildEvent(bars, counts, day0, splitIdx, kind) {
  if (day0 + MAX_LAG + HORIZON >= bars.length) return null
  const shared = windowMin(bars, day0, day0 + HORIZON)
  if (!shared) return null
  const b = bars[day0]
  const entries = {}
  for (const lag of LAGS) {
    const described = describeEntry(bars, day0, lag, shared.min)
    if (!described) return null
    entries[String(lag)] = described
  }
  return {
    kind,
    split: day0 < splitIdx ? "train" : "test",
    atrBand: atrBand(b.atrPct),
    lowVsDay0: pctChange(shared.min, b.close),
    entries,
  }
}

function timingTables(events) {
  const out = {}
  for (const lag of LAGS) {
    const rows = events.map((ev) => ({ split: ev.split, ...ev.entries[String(lag)] }))
    out[String(lag)] = packBySplit(rows)
  }
  return out
}

function persistenceTables(events, dayField) {
  const cuts = [
    { id: "d1", test: (ev) => ev[dayField] === 1 },
    { id: "d2plus", test: (ev) => ev[dayField] >= 2 },
    { id: "d3plus", test: (ev) => ev[dayField] >= 3 },
    { id: "d5plus", test: (ev) => ev[dayField] >= 5 },
  ]
  const out = {}
  for (const cut of cuts) {
    const rows = events.filter(cut.test).map((ev) => ({
      split: ev.split,
      lowVsDay0: ev.lowVsDay0,
      ...ev.entries["0"],
    }))
    const packed = packBySplit(rows)
    out[cut.id] = {
      train: persistenceSlice(packed.train, rows.filter((r) => r.split === "train")),
      test: persistenceSlice(packed.test, rows.filter((r) => r.split === "test")),
    }
  }
  return out
}

function persistenceSlice(packed, rows) {
  return {
    n: packed.n,
    lowVsDay0Median: summarizeNumeric(rows.map((r) => r.lowVsDay0)).median,
    aboveLowMedian: packed.aboveLowMedian,
    d20Median: packed.d20Median,
    d60Median: packed.d60Median,
    maeMedian: packed.maeMedian,
  }
}

function durationSummary(events, field) {
  return {
    train: summarizeNumeric(events.filter((e) => e.split === "train").map((e) => e[field])),
    test: summarizeNumeric(events.filter((e) => e.split === "test").map((e) => e[field])),
  }
}

function atrDay0VsDay5(events) {
  const out = {}
  for (const band of BANDS) {
    const subset = events.filter((ev) => ev.atrBand === band)
    const day0 = packBySplit(subset.map((ev) => ({ split: ev.split, ...ev.entries["0"] })))
    const day5 = packBySplit(subset.map((ev) => ({ split: ev.split, ...ev.entries["5"] })))
    out[band] = { day0, day5 }
  }
  return out
}

function assertMath() {
  const counts = [3, 3, 4, 4, 3, 1, 4]
  if (streakLength(counts, 0, 3) !== 5) throw new Error("ge3 streak")
  if (streakLength(counts, 2, 4) !== 2) throw new Error("ge4 streak")
  if (firstFourOffset(counts, 0) !== 2) throw new Error("days to 4")
  if (sessionsUntilAtMost(counts, 0, 2) !== 5) throw new Error("days to <=2")
  if (streakLength([4], 0, 4) !== 1) throw new Error("single day")
  const bars = []
  for (let i = 0; i < 80; i++) bars.push({ close: 100 - (i <= 5 ? i : 5) + (i > 5 ? (i - 5) * 0.1 : 0) })
  bars[0].close = 100
  const shared = windowMin(bars, 0, 60)
  const day0 = describeEntry(bars, 0, 0, shared.min)
  const day5 = describeEntry(bars, 0, 5, shared.min)
  if (!(day5.vsDay0 < 0)) throw new Error("day5 should be cheaper on the synthetic path")
  if (!(day0.aboveLow >= 0)) throw new Error("day0 sits on or above the shared low")
  if (day0.vsDay0 !== 0) throw new Error("day0 versus itself")
}

function main() {
  assertMath()
  assertNoEtfInStudyUniverse()
  console.log("Signal persistence study. 48 names. Close-only. No ranking.")
  const blocks = []
  for (const meta of EQUITY_CANDIDATES) {
    const row = analyzeSymbol(meta, loadCached(meta.yahoo))
    const n = row.events?.length ?? 0
    console.log(`  ${meta.symbol}: ${row.status} events=${n}`)
    blocks.push(row)
  }
  const ready = blocks.filter((b) => b.status === "ok")
  const events = ready.flatMap((b) => b.events || [])
  const three = events.filter((e) => e.kind === "3/4")
  const four = events.filter((e) => e.kind === "4/4")
  const timing3 = timingTables(three)
  const timing4 = timingTables(four)
  const persist3 = persistenceTables(three, "ge3Days")
  const persist4 = persistenceTables(four, "ge4Days")
  const coverage = {
    symbols: EQUITY_CANDIDATES.length,
    withData: ready.length,
    episodesBuilt: ready.reduce((s, b) => s + b.built, 0),
    shortHorizon34: ready.reduce((s, b) => s + b.short34, 0),
    shortHorizon44: ready.reduce((s, b) => s + b.short44, 0),
    sample34: three.length,
    sample44: four.length,
    train34: three.filter((e) => e.split === "train").length,
    test34: three.filter((e) => e.split === "test").length,
    train44: four.filter((e) => e.split === "train").length,
    test44: four.filter((e) => e.split === "test").length,
    dataStart: ready.map((b) => b.split?.dataStart).filter(Boolean).sort()[0] ?? null,
    dataEnd: ready.map((b) => b.split?.dataEnd).filter(Boolean).sort().at(-1) ?? null,
    splitDateMin: ready.map((b) => b.split?.splitDate).filter(Boolean).sort()[0] ?? null,
    splitDateMax: ready.map((b) => b.split?.splitDate).filter(Boolean).sort().at(-1) ?? null,
  }
  const doc = {
    generatedAt: new Date().toISOString(),
    study: "Close path after the first 3/4 day and the first 4/4 day, including a wait of 1, 3, 5, or 10 trading sessions",
    method: {
      universe: "Existing 48 single names. ETF names are not included.",
      thresholds: FROZEN_THRESHOLDS,
      episodeDef: EPISODE_DEF,
      trainRatio: TRAIN_RATIO,
      horizon: HORIZON,
      lags: LAGS,
      dayN: "DayN is the close N trading sessions after Day0. The next session is not substituted when that index is missing.",
      sample: "An event stays in the sample only when Day10 and 60 sessions after Day10 both exist, so every lag shares the same episodes.",
      three: "Day0 is the existing rising-edge open on a day whose count is exactly 3. A day that opens at 4 is not a 3/4 event.",
      four: "Day0 is the first count of 4 inside the existing episode: the open day when the episode opens at 4, otherwise the episode fill4 index. A later 4 after the episode window is not a second event.",
      entryVsDay0: "(entry close / Day0 close - 1) * 100. Negative means a lower entry price than Day0.",
      sharedLow: "Lowest close from Day0 through Day0+60, inclusive. aboveLowMedian is how far the entry close sits above that low.",
      mae: "Largest close-to-close drop from the entry close to the lowest later close inside the next 60 sessions. The entry close itself is not a drawdown.",
      hits: "+5% and +10% are any later close in the 60 sessions at or above that gain. -10% and -20% are any later close at or below that loss.",
      persistence: "A run is consecutive sessions from Day0 while the count stays at or above 3, or at or above 4. The 2+/3+/5+ groups include the longer runs. The 1-day group is a run of exactly one session.",
      atr: "Existing bands: ATR<3, 3<=ATR<4, ATR>=4. ATR is the Day0 value. No ATR rule is selected.",
      selection: "No wait is chosen from Test.",
    },
    disclaimer: {
      researchOnly: true,
      productionUnchanged: true,
      notARanking: true,
    },
    coverage,
    timing: { "3/4": timing3, "4/4": timing4 },
    persistence: {
      "3/4": {
        groups: persist3,
        ge3Days: durationSummary(three, "ge3Days"),
        daysTo4: durationSummary(three, "daysTo4"),
        daysToLe2: durationSummary(three, "daysToLe2"),
        reached4Pct: {
          train: rate(three.filter((e) => e.split === "train" && e.daysTo4 != null).length, three.filter((e) => e.split === "train").length),
          test: rate(three.filter((e) => e.split === "test" && e.daysTo4 != null).length, three.filter((e) => e.split === "test").length),
        },
      },
      "4/4": {
        groups: persist4,
        ge4Days: durationSummary(four, "ge4Days"),
        ge3Days: durationSummary(four, "ge3Days"),
        daysToLe2: durationSummary(four, "daysToLe2"),
      },
    },
    direction: { "3/4": directionBlock(timing3), "4/4": directionBlock(timing4) },
    atrDay0VsDay5: { "3/4": atrDay0VsDay5(three), "4/4": atrDay0VsDay5(four) },
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc))
  console.log(`Wrote ${OUT_JSON}`)
  console.log(JSON.stringify(coverage))
  const brief = {}
  for (const kind of ["3/4", "4/4"]) {
    brief[kind] = {}
    for (const lag of LAGS) {
      const row = doc.timing[kind][String(lag)]
      brief[kind][lag] = {
        train: pickBrief(row.train),
        test: pickBrief(row.test),
      }
    }
  }
  console.log(JSON.stringify({ brief, direction: doc.direction, persist: {
    "3/4": doc.persistence["3/4"].groups,
    "4/4": doc.persistence["4/4"].groups,
  }, atr: doc.atrDay0VsDay5 }, null, 0))
}

function pickBrief(p) {
  return {
    n: p.n,
    vs0: p.entryVsDay0Median,
    cheap: p.cheaperPct,
    dear: p.dearerPct,
    aboveLow: p.aboveLowMedian,
    mae: p.maeMedian,
    d20: p.d20Median,
    d60: p.d60Median,
    hit5: p.hit5Pct,
    hit10: p.hit10Pct,
    drop10: p.drop10Pct,
    drop20: p.drop20Pct,
  }
}

main()
