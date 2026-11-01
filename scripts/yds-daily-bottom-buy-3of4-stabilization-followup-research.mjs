#!/usr/bin/env node
/**
 * Price path after the first 5-session pause in new close lows. Research only.
 *   node scripts/yds-daily-bottom-buy-3of4-stabilization-followup-research.mjs
 *
 * Does not change production code, UI, API, DB, thresholds, or strategy.
 * T0 is the first pause in new close lows. It is not an entry signal.
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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-3of4-stabilization-followup-result.json")

const PRIMARY_K = 5
const SEARCH = 60
const PATH_WIN = 20
const HORIZON = 60
const NEED = SEARCH + PATH_WIN + HORIZON
const KS = [3, 5, 7]
const BAND = 3

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

function isNewLow(closes, t) {
  if (t <= 0) return false
  return closes[t] < minOf(closes, 0, t - 1)
}

function noNewLow(closes, t, k) {
  if (t < k) return false
  for (let i = t - k + 1; i <= t; i++) {
    if (isNewLow(closes, i)) return false
  }
  return true
}

function firstT0(closes, k, maxDay) {
  const end = Math.min(maxDay, closes.length - 1)
  for (let t = k; t <= end; t++) if (noNewLow(closes, t, k)) return t
  return null
}

function firstWhere(from, to, pred) {
  for (let t = from; t <= to; t++) if (pred(t)) return t
  return null
}

function bandAfterT0(closes, t0, t, band) {
  if (t < t0 + 5) return false
  const px = closes[t0]
  for (let i = t - 4; i <= t; i++) {
    if (i <= t0) return false
    const p = pctChange(closes[i], px)
    if (p == null || p < -band || p > band) return false
  }
  return true
}

function threeUp(closes, t) {
  return (
    t >= 3 &&
    closes[t] > closes[t - 1] &&
    closes[t - 1] > closes[t - 2] &&
    closes[t - 2] > closes[t - 3]
  )
}

function risingStructure(closes, t) {
  if (t < 4) return false
  return maxOf(closes, t - 2, t) > maxOf(closes, t - 4, t - 3) && minOf(closes, t - 2, t) > minOf(closes, t - 4, t - 3)
}

function hlHold(closes, t0, preLow, t) {
  if (t < t0 + 4) return false
  const earlyLo = minOf(closes, t - 4, t - 3)
  const lateLo = minOf(closes, t - 2, t)
  if (!(lateLo > earlyLo) || !(lateLo > preLow) || !(closes[t] > lateLo)) return false
  let dip = false
  for (let i = t0 + 1; i <= t; i++) {
    if (closes[i] < preLow) return false
    if (closes[i] < closes[t0]) dip = true
  }
  return dip
}

function hlAfter(closes, preLow, rebreakDay, t) {
  if (rebreakDay == null || t < rebreakDay + 4) return false
  const earlyLo = minOf(closes, t - 4, t - 3)
  const lateLo = minOf(closes, t - 2, t)
  if (!(lateLo > earlyLo) || !(closes[t] > lateLo)) return false
  const breakLow = minOf(closes, rebreakDay, t - 1)
  return breakLow < preLow && lateLo > breakLow
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
    entryVsDay0: pctChange(px, closes[0]),
  }
}

function postLow(closes, t0) {
  const end = Math.min(t0 + HORIZON, closes.length - 1)
  let idx = t0
  for (let i = t0 + 1; i <= end; i++) if (closes[i] < closes[idx]) idx = i
  const daysAfter = (level) => {
    const target = closes[0] * (1 + level / 100)
    for (let i = idx + 1; i <= end; i++) if (closes[i] >= target - 1e-8) return i - idx
    return null
  }
  let hit5 = false
  let hit10 = false
  for (let i = t0 + 1; i <= end; i++) {
    const p = pctChange(closes[i], closes[0])
    if (p >= 5 - 1e-6) hit5 = true
    if (p >= 10 - 1e-6) hit10 = true
  }
  return {
    lowVsT0: pctChange(closes[idx], closes[t0]),
    lowVsDay0: pctChange(closes[idx], closes[0]),
    daysToLow: idx - t0,
    daysLowToPlus5VsDay0: daysAfter(5),
    daysLowToPlus10VsDay0: daysAfter(10),
    hit5VsDay0: hit5,
    hit10VsDay0: hit10,
  }
}

function firstTurn(closes, t0) {
  const end = Math.min(t0 + 10, closes.length - 1)
  for (let t = t0 + 1; t <= end; t++) {
    if (threeUp(closes, t) || (t >= t0 + 4 && risingStructure(closes, t))) return t
  }
  return null
}

function exclusiveLabel(row) {
  const rebreak = row.rebreakDay != null
  const cross = row.day0CrossDay != null
  const range = row.rangeDay != null
  if (rebreak && cross && row.day0CrossDay > row.rebreakDay) return "rebreakThenDay0"
  if (rebreak) return "rebreakNoDay0"
  if (range && cross && row.rangeDay < row.day0CrossDay) return "rangeThenDay0"
  if (row.aboveAtT0 && cross) return "reclaimNoRebreak"
  if (row.aboveAtT0) return "alreadyAbove"
  if (cross) return "crossNoRebreak"
  if (range) return "rangeNoDay0"
  return "unresolved"
}

const EVENT_ORDER = { rebreak: 0, hlAfter: 1, hlHold: 2, turn: 3, range: 4, day0Cross: 5, aboveAtT0: 6 }

function describe(closes, k) {
  const t0 = firstT0(closes, k, SEARCH)
  if (t0 == null) return { t0: null }
  const preLow = minOf(closes, 0, t0 - 1)
  const end20 = Math.min(t0 + PATH_WIN, closes.length - 1)
  const end10 = Math.min(t0 + 10, closes.length - 1)
  const rebreakDay = firstWhere(t0 + 1, end10, (t) => closes[t] < preLow)
  const rebreak20Day = firstWhere(t0 + 1, end20, (t) => closes[t] < preLow)
  const rangeDay = firstWhere(t0 + 5, end20, (t) => bandAfterT0(closes, t0, t, BAND))
  const hlHoldDay = firstWhere(t0 + 4, end20, (t) => hlHold(closes, t0, preLow, t))
  const hlAfterDay =
    rebreakDay == null ? null : firstWhere(rebreakDay + 4, end20, (t) => hlAfter(closes, preLow, rebreakDay, t))
  const day0CrossDay = firstWhere(t0 + 1, end20, (t) => closes[t] > closes[0] && closes[t - 1] <= closes[0])
  const turnDay = firstTurn(closes, t0)
  const hlDay = hlHoldDay == null ? hlAfterDay : hlAfterDay == null ? hlHoldDay : Math.min(hlHoldDay, hlAfterDay)
  const events = []
  if (closes[t0] > closes[0]) events.push({ id: "aboveAtT0", day: t0 })
  if (rebreakDay != null) events.push({ id: "rebreak", day: rebreakDay })
  if (hlHoldDay != null) events.push({ id: "hlHold", day: hlHoldDay })
  if (hlAfterDay != null) events.push({ id: "hlAfter", day: hlAfterDay })
  if (rangeDay != null) events.push({ id: "range", day: rangeDay })
  if (day0CrossDay != null) events.push({ id: "day0Cross", day: day0CrossDay })
  if (turnDay != null) events.push({ id: "turn", day: turnDay })
  events.sort((a, b) => a.day - b.day || EVENT_ORDER[a.id] - EVENT_ORDER[b.id])
  const row = {
    t0,
    preLowVsDay0: pctChange(preLow, closes[0]),
    t0VsDay0: pctChange(closes[t0], closes[0]),
    aboveAtT0: closes[t0] > closes[0],
    rebreakDay,
    rebreak20Day,
    rangeDay,
    hlHoldDay,
    hlAfterDay,
    hlDay,
    day0CrossDay,
    turnDay,
    firstEvent: events[0]?.id ?? "none",
    sequence: events.map((e) => e.id).slice(0, 4).join(">"),
    post: postLow(closes, t0),
    fwdT0: forwardFrom(closes, t0),
    fwdDay0: forwardFrom(closes, 0),
    fwdHl: hlDay == null ? null : forwardFrom(closes, hlDay),
    fwdCross: day0CrossDay == null ? null : forwardFrom(closes, day0CrossDay),
    fwdTurn: turnDay == null ? null : forwardFrom(closes, turnDay),
    fwdRebreak: rebreakDay == null ? null : forwardFrom(closes, rebreakDay),
    rebreakVsT0: rebreakDay == null ? null : pctChange(closes[rebreakDay], closes[t0]),
  }
  row.label = exclusiveLabel(row)
  const up5 = closes[t0] * 1.05
  row.missed5BeforeHl = hlDay != null && hitBetween(closes, t0, hlDay, up5)
  row.missed5BeforeCross = day0CrossDay != null && hitBetween(closes, t0, day0CrossDay, up5)
  row.missed5BeforeTurn = turnDay != null && hitBetween(closes, t0, turnDay, up5)
  row.missed5BeforeRebreak = rebreakDay != null && hitBetween(closes, t0, rebreakDay, up5)
  row.hit5VsT0Within20 = hitBetween(closes, t0, Math.min(t0 + PATH_WIN, closes.length - 1) + 1, closes[t0] * 1.05)
  return row
}

function hitBetween(closes, fromExclusive, toExclusive, target) {
  for (let i = fromExclusive + 1; i < toExclusive; i++) if (closes[i] >= target - 1e-8) return true
  return false
}

function timingBucket(day) {
  if (day == null) return "noneBy60"
  if (day <= 5) return "d4_5"
  if (day <= 10) return "d6_10"
  if (day <= 15) return "d11_15"
  if (day <= 20) return "d16_20"
  return "after20"
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
    for (let i = ep.openIdx; i <= ep.openIdx + NEED; i++) closes.push(bars[i].close)
    const byK = {}
    for (const k of KS) byK[k] = describe(closes, k)
    episodes.push({
      split: ep.openIdx < split.splitIdx ? "train" : "test",
      byK,
    })
  }
  return { symbol: meta.symbol, status: "ok", split, built: built.length, short, episodes }
}

function fwdStats(rows, pick) {
  const use = rows.map(pick).filter((f) => f && f.full)
  return {
    n: use.length,
    entryVsDay0: num(use, (f) => f.entryVsDay0),
    d5: num(use, (f) => f.d5),
    d10: num(use, (f) => f.d10),
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

function cashReturn(rows, pickFwd, key) {
  return num(rows, (r) => {
    const f = pickFwd(r)
    if (!f || !f.full) return 0
    return f[key]
  })
}

function groupOutcome(rows) {
  return {
    n: rows.length,
    t0Day: num(rows, (r) => r.t0),
    t0VsDay0: num(rows, (r) => r.t0VsDay0),
    belowDay0AtT0Pct: rate(rows.filter((r) => r.t0VsDay0 < 0).length, rows.length),
    aboveAtT0Pct: rate(rows.filter((r) => r.aboveAtT0).length, rows.length),
    postMinVsT0: num(rows, (r) => r.post.lowVsT0),
    postMinVsDay0: num(rows, (r) => r.post.lowVsDay0),
    daysToPostMin: num(rows, (r) => r.post.daysToLow),
    d5: num(rows, (r) => r.fwdT0?.d5),
    d10: num(rows, (r) => r.fwdT0?.d10),
    d20: num(rows, (r) => r.fwdT0?.d20),
    d40: num(rows, (r) => r.fwdT0?.d40),
    d60: num(rows, (r) => r.fwdT0?.d60),
    mae: num(rows, (r) => r.fwdT0?.mae),
    extraDrop: num(rows, (r) => r.fwdT0?.extraDrop),
    hit5Pct: rate(rows.filter((r) => r.fwdT0?.hit5).length, rows.length),
    hit10Pct: rate(rows.filter((r) => r.fwdT0?.hit10).length, rows.length),
    hit5VsDay0Pct: rate(rows.filter((r) => r.post.hit5VsDay0).length, rows.length),
    hit10VsDay0Pct: rate(rows.filter((r) => r.post.hit10VsDay0).length, rows.length),
    daysLowToPlus5VsDay0: num(rows, (r) => r.post.daysLowToPlus5VsDay0),
    daysLowToPlus10VsDay0: num(rows, (r) => r.post.daysLowToPlus10VsDay0),
  }
}

function incidence(rows) {
  const n = rows.length
  return {
    n,
    rebreak10Pct: rate(rows.filter((r) => r.rebreakDay != null).length, n),
    rebreak20Pct: rate(rows.filter((r) => r.rebreak20Day != null).length, n),
    rangePct: rate(rows.filter((r) => r.rangeDay != null).length, n),
    rangeWithoutRebreakPct: rate(rows.filter((r) => r.rangeDay != null && r.rebreakDay == null).length, n),
    hlHoldPct: rate(rows.filter((r) => r.hlHoldDay != null).length, n),
    hlAfterPct: rate(rows.filter((r) => r.hlAfterDay != null).length, n),
    hlEitherPct: rate(rows.filter((r) => r.hlDay != null).length, n),
    aboveAtT0Pct: rate(rows.filter((r) => r.aboveAtT0).length, n),
    day0Cross20Pct: rate(rows.filter((r) => r.day0CrossDay != null).length, n),
    day0Either20Pct: rate(rows.filter((r) => r.aboveAtT0 || r.day0CrossDay != null).length, n),
    turnPct: rate(rows.filter((r) => r.turnDay != null).length, n),
  }
}

function laterEntry(rows, pickDay, pickFwd, missedKey) {
  const filled = rows.filter((r) => pickDay(r) != null)
  const missed = rows.filter((r) => pickDay(r) == null)
  return {
    n: rows.length,
    fillPct: rate(filled.length, rows.length),
    missedPlus5VsT0BeforeEntryPct: rate(filled.filter((r) => r[missedKey]).length, filled.length),
    filled: fwdStats(filled, pickFwd),
    cashD20: cashReturn(rows, pickFwd, "d20"),
    cashD40: cashReturn(rows, pickFwd, "d40"),
    cashD60: cashReturn(rows, pickFwd, "d60"),
    conditionalOnSignal: {
      n: filled.length,
      t0: fwdStats(filled, (r) => r.fwdT0),
      signal: fwdStats(filled, pickFwd),
    },
    noSignal: {
      n: missed.length,
      t0: fwdStats(missed, (r) => r.fwdT0),
      hit5VsT0Within20Pct: rate(missed.filter((r) => r.hit5VsT0Within20).length, missed.length),
      day0Either20Pct: rate(missed.filter((r) => r.aboveAtT0 || r.day0CrossDay != null).length, missed.length),
    },
  }
}

function summarizeSplit(rows) {
  const withT0 = rows.filter((r) => r.t0 != null)
  const labels = [
    "alreadyAbove",
    "crossNoRebreak",
    "reclaimNoRebreak",
    "rangeThenDay0",
    "rebreakThenDay0",
    "rebreakNoDay0",
    "rangeNoDay0",
    "unresolved",
  ]
  const groups = {}
  for (const label of labels) groups[label] = groupOutcome(withT0.filter((r) => r.label === label))
  const direct = withT0.filter((r) => ["alreadyAbove", "crossNoRebreak", "reclaimNoRebreak"].includes(r.label))
  const still = withT0.filter((r) => ["rebreakNoDay0", "rangeNoDay0", "unresolved"].includes(r.label))
  groups.directDay0Combined = groupOutcome(direct)
  groups.stillWeakCombined = groupOutcome(still)
  const rebreak = withT0.filter((r) => r.rebreakDay != null)
  return {
    n: rows.length,
    nT0: withT0.length,
    nNoT0: rows.length - withT0.length,
    t0SharePct: rate(withT0.length, rows.length),
    t0Day: num(withT0, (r) => r.t0),
    t0VsDay0: num(withT0, (r) => r.t0VsDay0),
    incidence: incidence(withT0),
    groups,
    fromT0: groupOutcome(withT0),
    entry: {
      day0: fwdStats(withT0, (r) => r.fwdDay0),
      t0: fwdStats(withT0, (r) => r.fwdT0),
      higherLow: laterEntry(withT0, (r) => r.hlDay, (r) => r.fwdHl, "missed5BeforeHl"),
      day0Recover: laterEntry(withT0, (r) => r.day0CrossDay, (r) => r.fwdCross, "missed5BeforeCross"),
      upsideTurn: laterEntry(withT0, (r) => r.turnDay, (r) => r.fwdTurn, "missed5BeforeTurn"),
      rebreakDay: laterEntry(withT0, (r) => r.rebreakDay, (r) => r.fwdRebreak, "missed5BeforeRebreak"),
    },
    rebreak: {
      n: rebreak.length,
      sharePct: rate(rebreak.length, withT0.length),
      daysFromT0: num(rebreak, (r) => r.rebreakDay - r.t0),
      rebreakVsT0: num(rebreak, (r) => r.rebreakVsT0),
      rebreakVsDay0: num(rebreak, (r) => r.fwdRebreak?.entryVsDay0),
      postMinVsT0: num(rebreak, (r) => r.post.lowVsT0),
      postMinVsDay0: num(rebreak, (r) => r.post.lowVsDay0),
      daysToPostMin: num(rebreak, (r) => r.post.daysToLow),
      daysLowToPlus5VsDay0: num(rebreak, (r) => r.post.daysLowToPlus5VsDay0),
      daysLowToPlus10VsDay0: num(rebreak, (r) => r.post.daysLowToPlus10VsDay0),
      hit5VsDay0Pct: rate(rebreak.filter((r) => r.post.hit5VsDay0).length, rebreak.length),
      hit10VsDay0Pct: rate(rebreak.filter((r) => r.post.hit10VsDay0).length, rebreak.length),
      fromT0: fwdStats(rebreak, (r) => r.fwdT0),
      fromRebreakDay: fwdStats(rebreak, (r) => r.fwdRebreak),
      thenDay0: groupOutcome(rebreak.filter((r) => r.label === "rebreakThenDay0")),
      noDay0: groupOutcome(rebreak.filter((r) => r.label === "rebreakNoDay0")),
    },
  }
}

function bySplit(rows, build) {
  return {
    all: build(rows),
    train: build(rows.filter((r) => r.split === "train")),
    test: build(rows.filter((r) => r.split === "test")),
  }
}

function timingBlock(rows) {
  const names = ["d4_5", "d6_10", "d11_15", "d16_20", "after20", "noneBy60"]
  const out = {}
  const nTrain = rows.filter((r) => r.split === "train").length
  const nTest = rows.filter((r) => r.split === "test").length
  for (const name of names) {
    const subset = rows.filter((r) => timingBucket(r.t0) === name)
    out[name] = bySplit(subset, (list) => {
      const path = list.filter((r) => r.t0 != null)
      return {
        n: list.length,
        rebreak10Pct: rate(path.filter((r) => r.rebreakDay != null).length, path.length),
        day0Either20Pct: rate(path.filter((r) => r.aboveAtT0 || r.day0CrossDay != null).length, path.length),
        day0Cross20Pct: rate(path.filter((r) => r.day0CrossDay != null).length, path.length),
        hlEitherPct: rate(path.filter((r) => r.hlDay != null).length, path.length),
        fromT0: path.length ? fwdStats(path, (r) => r.fwdT0) : null,
      }
    })
    out[name].all.shareOfSamplePct = rate(subset.length, rows.length)
    out[name].train.shareOfSplitPct = rate(subset.filter((r) => r.split === "train").length, nTrain)
    out[name].test.shareOfSplitPct = rate(subset.filter((r) => r.split === "test").length, nTest)
  }
  return out
}

function sequenceBlock(rows) {
  const withT0 = rows.filter((r) => r.t0 != null)
  const keys = new Map()
  for (const r of withT0) keys.set(r.sequence || "none", (keys.get(r.sequence || "none") || 0) + 1)
  const top = [...keys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k)
  const firstIds = ["aboveAtT0", "rebreak", "hlHold", "hlAfter", "turn", "range", "day0Cross", "none"]
  const pack = (list) => ({
    n: list.length,
    firstEvent: Object.fromEntries(firstIds.map((id) => [id, rate(list.filter((r) => r.firstEvent === id).length, list.length)])),
    topSequences: Object.fromEntries(top.map((k) => [k, {
      n: list.filter((r) => r.sequence === k).length,
      pct: rate(list.filter((r) => r.sequence === k).length, list.length),
    }])),
  })
  return bySplit(withT0, pack)
}

function sensitivity(allRows) {
  const out = {}
  for (const k of KS) {
    const rows = allRows.map((r) => ({ split: r.split, ...r.byK[k] }))
    const view = bySplit(rows, summarizeSplit)
    const thin = (node) => ({
      n: node.n,
      nT0: node.nT0,
      nNoT0: node.nNoT0,
      t0Day: node.t0Day,
      t0VsDay0: node.t0VsDay0,
      incidence: node.incidence,
      groupN: Object.fromEntries(Object.entries(node.groups).map(([id, g]) => [id, g.n])),
      groupD60Median: Object.fromEntries(Object.entries(node.groups).map(([id, g]) => [id, g.d60?.median ?? null])),
      groupMaeMedian: Object.fromEntries(Object.entries(node.groups).map(([id, g]) => [id, g.mae?.median ?? null])),
      day0D60Median: node.entry.day0.d60?.median ?? null,
      t0D60Median: node.entry.t0.d60?.median ?? null,
      t0MaeMedian: node.entry.t0.mae?.median ?? null,
      hlFillPct: node.entry.higherLow.fillPct,
      hlFilledD60Median: node.entry.higherLow.filled.d60?.median ?? null,
      hlConditionalT0D60Median: node.entry.higherLow.conditionalOnSignal.t0.d60?.median ?? null,
      crossFillPct: node.entry.day0Recover.fillPct,
      crossFilledD60Median: node.entry.day0Recover.filled.d60?.median ?? null,
      turnFillPct: node.entry.upsideTurn.fillPct,
      turnFilledD60Median: node.entry.upsideTurn.filled.d60?.median ?? null,
      rebreakFillPct: node.entry.rebreakDay.fillPct,
      rebreakFilledD60Median: node.entry.rebreakDay.filled.d60?.median ?? null,
      rebreakFromT0D60Median: node.rebreak.fromT0.d60?.median ?? null,
    })
    out[`k${k}`] = { all: thin(view.all), train: thin(view.train), test: thin(view.test) }
  }
  const sign = (k, side, a, b) => {
    const node = out[`k${k}`][side]
    if (node[a] == null || node[b] == null) return null
    return node[a] - node[b]
  }
  out.direction = {}
  for (const k of KS) {
    const t0MinusDay0 = { train: sign(k, "train", "t0D60Median", "day0D60Median"), test: sign(k, "test", "t0D60Median", "day0D60Median") }
    const hlMinusT0 = {
      train: (out[`k${k}`].train.hlFilledD60Median ?? 0) - (out[`k${k}`].train.hlConditionalT0D60Median ?? 0),
      test: (out[`k${k}`].test.hlFilledD60Median ?? 0) - (out[`k${k}`].test.hlConditionalT0D60Median ?? 0),
    }
    out.direction[`k${k}`] = {
      t0MinusDay0,
      hlFilledMinusConditionalT0: hlMinusT0,
      sameSignT0VsDay0: t0MinusDay0.train != null && t0MinusDay0.test != null && Math.sign(t0MinusDay0.train) === Math.sign(t0MinusDay0.test),
      sameSignHlVsConditionalT0: Math.sign(hlMinusT0.train) === Math.sign(hlMinusT0.test),
    }
  }
  return out
}

function med(stat) {
  return stat?.median ?? null
}

function interpret(doc) {
  const t = doc.test
  const tr = doc.train
  const lines = []
  lines.push(
    `Test T0 중앙값 ${med(t.t0Day)}일, 평균 ${t.t0Day?.mean ?? null}일. Train 중앙값 ${med(tr.t0Day)}일, 평균 ${tr.t0Day?.mean ?? null}일. T0 없음은 Test ${t.nNoT0}건, Train ${tr.nNoT0}건.`
  )
  lines.push(
    `Test 발생 비율: 10일 내 재하락 ${t.incidence.rebreak10Pct}%, 횡보 ${t.incidence.rangePct}%, Higher Low ${t.incidence.hlEitherPct}% (저점 유지 ${t.incidence.hlHoldPct}%, 재하락 후 ${t.incidence.hlAfterPct}%), T0에 이미 Day 0 위 ${t.incidence.aboveAtT0Pct}%, 이후 20일 내 Day 0 상향 돌파 ${t.incidence.day0Cross20Pct}%, 둘 중 하나 ${t.incidence.day0Either20Pct}%.`
  )
  const g = t.groups
  lines.push(
    `Test T0 기준 D+60 중앙값: 재하락 없이 회복 묶음 ${med(g.directDay0Combined.d60)}% (n=${g.directDay0Combined.n}), 횡보 후 회복 ${med(g.rangeThenDay0.d60)}% (n=${g.rangeThenDay0.n}), 재하락 후 Day 0 회복 ${med(g.rebreakThenDay0.d60)}% (n=${g.rebreakThenDay0.n}), 재하락 후 20일 내 미회복 ${med(g.rebreakNoDay0.d60)}% (n=${g.rebreakNoDay0.n}), 미결정 ${med(g.unresolved.d60)}% (n=${g.unresolved.n}). 이 D+20 이하는 분류 구간과 겹친다.`
  )
  lines.push(
    `같은 T0 표본의 진입 D+60 중앙값 Test: Day 0 ${med(t.entry.day0.d60)}%, T0 ${med(t.entry.t0.d60)}%, Higher Low 체결분 ${med(t.entry.higherLow.filled.d60)}% (체결 ${t.entry.higherLow.fillPct}%), Day 0 돌파 체결분 ${med(t.entry.day0Recover.filled.d60)}% (체결 ${t.entry.day0Recover.fillPct}%), 상승전환 체결분 ${med(t.entry.upsideTurn.filled.d60)}% (체결 ${t.entry.upsideTurn.fillPct}%). 미체결 D+60은 0으로 두면 Higher Low ${med(t.entry.higherLow.cashD60)}%, Day 0 돌파 ${med(t.entry.day0Recover.cashD60)}%.`
  )
  lines.push(
    `재하락 에피소드만 비교한 Test D+60 중앙값: T0 진입 ${med(t.rebreak.fromT0.d60)}%, 재하락 확인일 진입 ${med(t.rebreak.fromRebreakDay.d60)}%. 재하락 확인일 가격은 정의상 T0 이전 최저 종가보다 낮다. 최종 저점 진입은 계산하지 않았다.`
  )
  const s5 = doc.sensitivity.k5.test
  const s3 = doc.sensitivity.k3.test
  const s7 = doc.sensitivity.k7.test
  lines.push(
    `Test 재하락 비율은 3일 ${s3.incidence.rebreak10Pct}%, 5일 ${s5.incidence.rebreak10Pct}%, 7일 ${s7.incidence.rebreak10Pct}%. T0 대비 Day 0 진입 D+60 차이(T0-Day0)의 Train/Test 부호 일치는 3일 ${doc.sensitivity.direction.k3.sameSignT0VsDay0}, 5일 ${doc.sensitivity.direction.k5.sameSignT0VsDay0}, 7일 ${doc.sensitivity.direction.k7.sameSignT0VsDay0}.`
  )
  lines.push(
    "T0는 하락 저점 갱신이 한 번 멈춘 관찰 시점이다. 이후 재하락, 횡보, Higher Low, Day 0 회복은 서로 다른 경로이며, 확인 진입의 체결분 성과는 그 신호가 나온 에피소드만 포함한다."
  )
  return lines
}

function assertMath() {
  const pause = [100, 99, 98, 97, 96, 95, 96, 96.5, 96.2, 96.4, 96.3]
  if (firstT0(pause, 5, 60) !== 10) throw new Error("T0 should be day 10")
  if (noNewLow(pause, 9, 5)) throw new Error("day 5 is still inside the window at t=9")
  const rebreak = pause.concat([96, 94])
  const rec = describe(pad(rebreak, 94), 5)
  if (rec.t0 !== 10 || rec.rebreakDay !== 12) throw new Error(`rebreak day ${rec.rebreakDay}`)
  const hl = [100, 99, 98, 97, 96, 95, 96, 96.5, 96.2, 96.4, 96.3, 96, 95.6, 95.4, 95.5, 96, 96.2]
  if (!hlHold(hl, 10, 95, 16)) throw new Error("higher low hold should confirm on day 16")
  if (hlHold(hl, 10, 95, 15)) throw new Error("day 15 late low is not higher")
  const after = [100, 99, 98, 97, 96, 95, 96, 96.5, 96.2, 96.4, 96.3, 96, 94, 93, 93.5, 94, 94.5, 95]
  if (!hlAfter(after, 95, 12, 17)) throw new Error("higher low after the break should confirm on day 17")
  const up = pause.concat([97, 98, 99, 100.5])
  if (threeUp(up, 13) !== true) throw new Error("three up closes")
  const cross = describe(pad(pause.concat([96, 97, 101]), 101), 5)
  if (cross.day0CrossDay !== 13) throw new Error(`cross day ${cross.day0CrossDay}`)
  const labeled = describe(pad(after, 95), 5)
  if (labeled.label !== "rebreakNoDay0") throw new Error(`label ${labeled.label}`)
}

function pad(closes, last) {
  const out = closes.slice()
  while (out.length < NEED + 1) out.push(last)
  return out
}

function main() {
  assertMath()
  assertNoEtfInStudyUniverse()
  console.log("3/4 pause follow-up. 48 names. Close path after T0. No ranking.")
  const blocks = []
  for (const meta of EQUITY_CANDIDATES) {
    const row = analyzeSymbol(meta, loadCached(meta.yahoo))
    console.log(`  ${meta.symbol}: ${row.status} episodes=${row.episodes?.length ?? 0} short=${row.short ?? 0}`)
    blocks.push(row)
  }
  const ready = blocks.filter((b) => b.status === "ok")
  const all = ready.flatMap((b) => b.episodes || [])
  const rows = all.map((r) => ({ split: r.split, ...r.byK[PRIMARY_K] }))
  const view = bySplit(rows, summarizeSplit)
  const withT0 = rows.filter((r) => r.t0 != null)
  const doc = {
    generatedAt: new Date().toISOString(),
    definition: {
      universe: "Existing 48 single names. ETF names are not included.",
      thresholds: FROZEN_THRESHOLDS,
      episodeDef: EPISODE_DEF,
      trainRatio: TRAIN_RATIO,
      day0: "Rising-edge open when count first reaches at least 3. Later 3/4 or 4/4 days inside that episode are not new episodes.",
      t0: "First session through Day 60 where none of the last K closes undercut the lowest close from Day 0 through the prior session. Primary K is 5. T0 is not an entry.",
      sample: "Day 0 plus 140 later sessions exist, so a T0 as late as Day 60 and a confirmation as late as T0+20 still have 60 sessions after the entry.",
      price: "Session closes only. High and low are not used.",
      rebreak: "Within 10 sessions after T0, a close under the minimum close from Day 0 through the session before T0.",
      range: "Five consecutive closes strictly after T0, completed by T0+20, all inside ±3% of the T0 close.",
      higherLow: "On the last 5 closes, the late triple low is above the early pair low and today's close is above that late low. Hold requires the late low to stay above the pre-T0 low and a dip below the T0 close. After-break requires the late low to be above the worst close from the 10-day rebreak through yesterday.",
      day0Cross: "First session after T0, through T0+20, whose close is above the Day 0 close while the prior close is at or below it. A T0 close already above Day 0 is recorded separately and is not this cross.",
      turn: "Within 10 sessions after T0, three consecutive up closes, or a 5-close structure with both a higher high and a higher low.",
      exclusive: "rebreak then Day 0 cross, else rebreak without that cross, else range completed before the cross, else reclaim, else already above, else cross without rebreak, else range without Day 0, else unresolved.",
      entry: "Each forward window starts at that entry. The eventual low is not an entry. Unfilled confirmation stays in the sample. Cash figures set only D+20, D+40, and D+60 to 0 when unfilled.",
      overlap: "Group D+5, D+10, and D+20 from T0 overlap the 20-session window that assigned the path.",
      notASignal: "No path is a production entry.",
    },
    coverage: {
      symbols: EQUITY_CANDIDATES.length,
      withData: ready.length,
      episodesBuilt: ready.reduce((s, b) => s + b.built, 0),
      shortHorizonExcluded: ready.reduce((s, b) => s + b.short, 0),
      sample: rows.length,
      train: rows.filter((r) => r.split === "train").length,
      test: rows.filter((r) => r.split === "test").length,
      dataStart: ready.map((b) => b.split?.dataStart).filter(Boolean).sort()[0] ?? null,
      dataEnd: ready.map((b) => b.split?.dataEnd).filter(Boolean).sort().at(-1) ?? null,
    },
    overall: view.all,
    train: view.train,
    test: view.test,
    t0Timing: timingBlock(rows),
    pathClassification: {
      incidence: bySplit(withT0, incidence),
      sequences: sequenceBlock(rows),
      labels: bySplit(withT0, (list) => {
        const ids = ["alreadyAbove", "crossNoRebreak", "reclaimNoRebreak", "rangeThenDay0", "rebreakThenDay0", "rebreakNoDay0", "rangeNoDay0", "unresolved"]
        return Object.fromEntries(ids.map((id) => [id, { n: list.filter((r) => r.label === id).length, pct: rate(list.filter((r) => r.label === id).length, list.length) }]))
      }),
    },
    reBreakdown: bySplit(withT0, (list) => summarizeSplit(list).rebreak),
    higherLow: bySplit(withT0, (list) => ({
      hold: groupOutcome(list.filter((r) => r.hlHoldDay != null)),
      afterRebreak: groupOutcome(list.filter((r) => r.hlAfterDay != null)),
      neither: groupOutcome(list.filter((r) => r.hlDay == null)),
      entry: laterEntry(list, (r) => r.hlDay, (r) => r.fwdHl, "missed5BeforeHl"),
    })),
    recovery: bySplit(withT0, (list) => ({
      alreadyAbove: groupOutcome(list.filter((r) => r.label === "alreadyAbove")),
      crossNoRebreak: groupOutcome(list.filter((r) => r.label === "crossNoRebreak")),
      rangeThenDay0: groupOutcome(list.filter((r) => r.label === "rangeThenDay0")),
      rebreakThenDay0: groupOutcome(list.filter((r) => r.label === "rebreakThenDay0")),
      entry: laterEntry(list, (r) => r.day0CrossDay, (r) => r.fwdCross, "missed5BeforeCross"),
    })),
    entryComparison: bySplit(withT0, (list) => summarizeSplit(list).entry),
    timingBuckets: timingBlock(rows),
    sensitivity: sensitivity(all),
    interpretation: [],
  }
  doc.interpretation = interpret(doc)
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc))
  console.log(`wrote ${OUT_JSON}`)
  console.log(doc.interpretation.join("\n"))
}

main()
