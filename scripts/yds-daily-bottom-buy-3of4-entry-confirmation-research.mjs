#!/usr/bin/env node
/**
 * Causal entry checks after the first 5-day pause in new close lows. Research only.
 *   node scripts/yds-daily-bottom-buy-3of4-entry-confirmation-research.mjs
 *
 * Does not change production code, UI, API, DB, thresholds, or strategy.
 * Each signal uses only closes through that session. The entry is that close.
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
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-3of4-entry-confirmation-result.json")

const SEARCH = 60
const PATH_WIN = 20
const HORIZON = 60
const NEED = SEARCH + PATH_WIN + HORIZON
const REBREAK_DAYS = 10
const LOW_RATE = 20
const PRIMARY = ["hold3", "noLow3", "higherLow", "up2", "up3", "break5", "day0Cross", "t0Cross"]
const SENS = ["hold3", "hold4", "hold5", "up2", "up3", "break3", "break5", "break7"]

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
  for (let i = t - k + 1; i <= t; i++) if (isNewLow(closes, i)) return false
  return true
}

function firstT0(closes) {
  const end = Math.min(SEARCH, closes.length - 1)
  for (let t = 5; t <= end; t++) if (noNewLow(closes, t, 5)) return t
  return null
}

function firstHold(closes, t0, preLow, need, end) {
  let streak = 0
  for (let t = t0 + 1; t <= end; t++) {
    if (closes[t] >= preLow) streak += 1
    else streak = 0
    if (streak >= need) return t
  }
  return null
}

function firstNoLow(closes, t0, k, end) {
  for (let t = t0 + 1; t <= end; t++) if (noNewLow(closes, t, k)) return t
  return null
}

function firstHigherLow(closes, t0, preLow, end) {
  for (let t = t0 + 4; t <= end; t++) {
    const earlyLo = minOf(closes, t - 4, t - 3)
    const lateLo = minOf(closes, t - 2, t)
    if (!(lateLo > earlyLo) || !(lateLo > preLow)) continue
    if (!(closes[t] > lateLo) || !(closes[t] > closes[t - 1])) continue
    return t
  }
  return null
}

function firstUp(closes, t0, n, end) {
  for (let t = Math.max(t0 + 1, n); t <= end; t++) {
    let ok = true
    for (let i = 0; i < n; i++) {
      if (!(closes[t - i] > closes[t - i - 1])) {
        ok = false
        break
      }
    }
    if (ok) return t
  }
  return null
}

function firstBreak(closes, t0, lookback, end) {
  for (let t = t0 + 1; t <= end; t++) {
    if (t < lookback) continue
    if (closes[t] > maxOf(closes, t - lookback, t - 1)) return t
  }
  return null
}

function firstCross(closes, t0, level, end) {
  for (let t = t0 + 1; t <= end; t++) {
    if (closes[t] > level && closes[t - 1] <= level) return t
  }
  return null
}

function forwardFrom(closes, entry, t0) {
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
    hitM5: minPx <= px * 0.95 + 1e-8,
    hitM10: minPx <= px * 0.9 + 1e-8,
    entryVsDay0: pctChange(px, closes[0]),
    entryVsT0: pctChange(px, closes[t0]),
  }
}

function describe(closes) {
  const t0 = firstT0(closes)
  if (t0 == null) return { t0: null }
  const preLow = minOf(closes, 0, t0 - 1)
  const end = Math.min(t0 + PATH_WIN, closes.length - 1)
  const sig = {
    hold3: firstHold(closes, t0, preLow, 3, end),
    hold4: firstHold(closes, t0, preLow, 4, end),
    hold5: firstHold(closes, t0, preLow, 5, end),
    noLow3: firstNoLow(closes, t0, 3, end),
    higherLow: firstHigherLow(closes, t0, preLow, end),
    up2: firstUp(closes, t0, 2, end),
    up3: firstUp(closes, t0, 3, end),
    break3: firstBreak(closes, t0, 3, end),
    break5: firstBreak(closes, t0, 5, end),
    break7: firstBreak(closes, t0, 7, end),
    day0Cross: firstCross(closes, t0, closes[0], end),
    t0Cross: firstCross(closes, t0, closes[t0], end),
  }
  let rebreakDay = null
  const rebreakEnd = Math.min(t0 + REBREAK_DAYS, closes.length - 1)
  for (let t = t0 + 1; t <= rebreakEnd; t++) {
    if (closes[t] < preLow) {
      rebreakDay = t
      break
    }
  }
  const fwd = {}
  const early = {}
  for (const [id, day] of Object.entries(sig)) {
    fwd[id] = day == null ? null : forwardFrom(closes, day, t0)
    early[id] = day == null ? null : {
      vsT0: pctChange(closes[day], closes[t0]) >= 5 - 1e-6,
      vsDay0: pctChange(closes[day], closes[0]) >= 5 - 1e-6,
    }
  }
  let first = null
  for (const id of PRIMARY) {
    if (sig[id] == null) continue
    if (first == null || sig[id] < sig[first] || (sig[id] === sig[first] && PRIMARY.indexOf(id) < PRIMARY.indexOf(first))) {
      first = id
    }
  }
  return {
    t0,
    rebreakDay,
    aboveAtT0: closes[t0] > closes[0],
    sig,
    fwd,
    early,
    first,
    fwdT0: forwardFrom(closes, t0, t0),
    fwdDay0: forwardFrom(closes, 0, t0),
  }
}

function fwdStats(rows, pick) {
  const use = rows.map(pick).filter((f) => f && f.full)
  return {
    n: use.length,
    entryVsDay0: num(use, (f) => f.entryVsDay0),
    entryVsT0: num(use, (f) => f.entryVsT0),
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
    hitM5Pct: rate(use.filter((f) => f.hitM5).length, use.length),
    hitM10Pct: rate(use.filter((f) => f.hitM10).length, use.length),
  }
}

function paired(rows, id) {
  const use = rows.filter((r) => r.fwd[id]?.full && r.fwdT0?.full)
  return {
    n: use.length,
    d20: num(use, (r) => r.fwd[id].d20 - r.fwdT0.d20),
    d60: num(use, (r) => r.fwd[id].d60 - r.fwdT0.d60),
    mae: num(use, (r) => r.fwd[id].mae - r.fwdT0.mae),
    entryVsT0: num(use, (r) => r.fwd[id].entryVsT0),
    daysAfterT0: num(use, (r) => r.sig[id] - r.t0),
  }
}

function signalBlock(rows, id) {
  const filled = rows.filter((r) => r.sig[id] != null)
  const missed = rows.filter((r) => r.sig[id] == null)
  const ratePct = rate(filled.length, rows.length)
  return {
    nEpisodes: rows.length,
    nSignal: filled.length,
    nMissedBy20: missed.length,
    ratePct,
    lowFrequency: ratePct != null && ratePct < LOW_RATE,
    dayAfterT0: num(filled, (r) => r.sig[id] - r.t0),
    performance: fwdStats(filled, (r) => r.fwd[id]),
    pairedVsT0: paired(filled, id),
    noSignalFromT0: fwdStats(missed, (r) => r.fwdT0),
    early: {
      n: filled.length,
      plus5VsT0Pct: rate(filled.filter((r) => r.early[id]?.vsT0).length, filled.length),
      plus5VsDay0Pct: rate(filled.filter((r) => r.early[id]?.vsDay0).length, filled.length),
      entryVsT0: num(filled, (r) => r.fwd[id]?.entryVsT0),
      entryVsDay0: num(filled, (r) => r.fwd[id]?.entryVsDay0),
    },
  }
}

function pack(rows) {
  const withT0 = rows.filter((r) => r.t0 != null)
  const signals = {}
  for (const id of PRIMARY) signals[id] = signalBlock(withT0, id)
  const first = {}
  for (const id of PRIMARY) first[id] = rate(withT0.filter((r) => r.first === id).length, withT0.length)
  const both = withT0.filter((r) => r.sig.hold3 != null && r.sig.noLow3 != null)
  return {
    n: rows.length,
    nT0: withT0.length,
    nNoT0: rows.length - withT0.length,
    t0Day: num(withT0, (r) => r.t0),
    rebreak10Pct: rate(withT0.filter((r) => r.rebreakDay != null).length, withT0.length),
    aboveAtT0Pct: rate(withT0.filter((r) => r.aboveAtT0).length, withT0.length),
    baseline: {
      day0: fwdStats(withT0, (r) => r.fwdDay0),
      t0: fwdStats(withT0, (r) => r.fwdT0),
    },
    signals,
    firstSignalPct: first,
    holdVsNoLow: {
      nBoth: both.length,
      sameDayPct: rate(both.filter((r) => r.sig.hold3 === r.sig.noLow3).length, both.length),
      dayGap: num(both, (r) => r.sig.noLow3 - r.sig.hold3),
    },
  }
}

function groupCut(rows) {
  const out = { n: rows.length, t0: fwdStats(rows, (r) => r.fwdT0), signals: {} }
  for (const id of PRIMARY) {
    const filled = rows.filter((r) => r.sig[id] != null)
    const after = rows.filter((r) => r.rebreakDay != null && r.sig[id] != null && r.sig[id] >= r.rebreakDay)
    const before = rows.filter((r) => r.rebreakDay != null && r.sig[id] != null && r.sig[id] < r.rebreakDay)
    out.signals[id] = {
      ...signalBlock(rows, id),
      onOrAfterRebreak: rows.some((r) => r.rebreakDay != null) ? {
        n: after.length,
        rateOfGroupPct: rate(after.length, rows.length),
        dayAfterT0: num(after, (r) => r.sig[id] - r.t0),
        performance: fwdStats(after, (r) => r.fwd[id]),
        pairedVsT0: paired(after, id),
      } : null,
      beforeRebreak: rows.some((r) => r.rebreakDay != null) ? {
        n: before.length,
        rateOfGroupPct: rate(before.length, rows.length),
        performance: fwdStats(before, (r) => r.fwd[id]),
        pairedVsT0: paired(before, id),
      } : null,
    }
  }
  return out
}

function bySplit(rows, build) {
  return {
    all: build(rows),
    train: build(rows.filter((r) => r.split === "train")),
    test: build(rows.filter((r) => r.split === "test")),
  }
}

function thinSignal(block) {
  return {
    ratePct: block.ratePct,
    lowFrequency: block.lowFrequency,
    nSignal: block.nSignal,
    nMissedBy20: block.nMissedBy20,
    dayMedian: block.dayAfterT0?.median ?? null,
    dayMean: block.dayAfterT0?.mean ?? null,
    d20Median: block.performance.d20?.median ?? null,
    d60Median: block.performance.d60?.median ?? null,
    maeMedian: block.performance.mae?.median ?? null,
    hit5Pct: block.performance.hit5Pct,
    hit10Pct: block.performance.hit10Pct,
    hitM5Pct: block.performance.hitM5Pct,
    hitM10Pct: block.performance.hitM10Pct,
    pairedD20Median: block.pairedVsT0.d20?.median ?? null,
    pairedD60Median: block.pairedVsT0.d60?.median ?? null,
    pairedMaeMedian: block.pairedVsT0.mae?.median ?? null,
    entryVsT0Median: block.early.entryVsT0?.median ?? null,
    plus5VsT0Pct: block.early.plus5VsT0Pct,
    plus5VsDay0Pct: block.early.plus5VsDay0Pct,
    noSignalT0D60Median: block.noSignalFromT0.d60?.median ?? null,
  }
}

function sensitivity(rows) {
  const out = {}
  for (const id of SENS) {
    const view = bySplit(rows.filter((r) => r.t0 != null), (list) => signalBlock(list, id))
    out[id] = {
      all: thinSignal(view.all),
      train: thinSignal(view.train),
      test: thinSignal(view.test),
    }
    out[id].sameSign = {
      pairedMae: sameSign(out[id].train.pairedMaeMedian, out[id].test.pairedMaeMedian),
      pairedD20: sameSign(out[id].train.pairedD20Median, out[id].test.pairedD20Median),
      pairedD60: sameSign(out[id].train.pairedD60Median, out[id].test.pairedD60Median),
    }
  }
  return out
}

function sameSign(a, b) {
  if (a == null || b == null) return null
  if (a === 0 || b === 0) return a === b
  return Math.sign(a) === Math.sign(b)
}

function med(stat) {
  return stat?.median ?? null
}

function interpret(doc) {
  const t = doc.test
  const lines = []
  const ranked = PRIMARY.map((id) => ({ id, rate: t.signals[id].ratePct })).sort((a, b) => b.rate - a.rate)
  lines.push(
    `Test 발생률이 가장 높은 확인은 ${ranked[0].id} ${ranked[0].rate}%이다. 순서는 발생 횟수이며 성과 순위가 아니다. 20% 미만은 ${PRIMARY.filter((id) => t.signals[id].lowFrequency).join(", ") || "없다"}.`
  )
  lines.push(
    `Test 중앙 발생일(T0 이후): ${PRIMARY.map((id) => `${id} ${med(t.signals[id].dayAfterT0)}일`).join(", ")}.`
  )
  lines.push(
    `Test에서 신호 당일 이미 T0 대비 +5%인 비율: ${PRIMARY.map((id) => `${id} ${t.signals[id].early.plus5VsT0Pct}%`).join(", ")}.`
  )
  const bothMae = PRIMARY.filter((id) => doc.sensitivity[id] ? doc.sensitivity[id].sameSign.pairedMae && (doc.sensitivity[id].test.pairedMaeMedian < 0) : sameSign(doc.train.signals[id].pairedVsT0.mae?.median, t.signals[id].pairedVsT0.mae?.median) && t.signals[id].pairedVsT0.mae?.median < 0)
  const bothD60 = PRIMARY.filter((id) => sameSign(doc.train.signals[id].pairedVsT0.d60?.median, t.signals[id].pairedVsT0.d60?.median) && (t.signals[id].pairedVsT0.d60?.median > 0) && (doc.train.signals[id].pairedVsT0.d60?.median > 0))
  lines.push(
    `같은 에피소드에서 T0 진입 대비 MAE 차이가 Train·Test 모두 음수인 신호: ${bothMae.join(", ") || "없다"}. D+60 차이가 양쪽 모두 양수인 신호: ${bothD60.join(", ") || "없다"}. MAE 차이는 신호 이후 구간만 본다. T0와 신호 사이의 가격 변화는 entryVsT0에 있다.`
  )
  lines.push(
    `hold3과 noLow3이 같은 날인 비율은 Test ${t.holdVsNoLow.sameDayPct}%이다. 둘을 한 신호로 합치지 않는다.`
  )
  lines.push(
    "재하락 여부는 T0 이후 10거래일의 경로 분류다. 신호보다 늦게 저점을 깨는 경우, 그 분류는 진입 시점에는 알 수 없다. 저점을 깬 뒤에 나온 신호만 onOrAfterRebreak에 따로 두었다."
  )
  return lines
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
    episodes.push({ split: ep.openIdx < split.splitIdx ? "train" : "test", ...describe(closes) })
  }
  return { symbol: meta.symbol, status: "ok", split, built: built.length, short, episodes }
}

function frequencyTable(view) {
  const out = {}
  for (const side of ["all", "train", "test"]) {
    out[side] = {}
    for (const id of PRIMARY) {
      const s = view[side].signals[id]
      out[side][id] = {
        nEpisodes: s.nEpisodes,
        nSignal: s.nSignal,
        nMissedBy20: s.nMissedBy20,
        ratePct: s.ratePct,
        lowFrequency: s.lowFrequency,
      }
    }
  }
  return out
}

function timingTable(view) {
  const out = {}
  for (const side of ["all", "train", "test"]) {
    out[side] = {}
    for (const id of PRIMARY) out[side][id] = view[side].signals[id].dayAfterT0
  }
  return out
}

function performanceTable(view) {
  const out = {}
  for (const side of ["all", "train", "test"]) {
    out[side] = { baseline: view[side].baseline, signals: {} }
    for (const id of PRIMARY) out[side].signals[id] = view[side].signals[id].performance
  }
  return out
}

function pairedTable(view) {
  const out = {
    note: "Difference is the signal entry minus the T0 entry on episodes where that signal fired. A negative MAE difference means the drawdown after the signal was smaller than the drawdown after T0. The 60-session windows do not end on the same day. Entry versus T0 is the price gap already realized before the signal.",
  }
  for (const side of ["all", "train", "test"]) {
    out[side] = {}
    for (const id of PRIMARY) {
      out[side][id] = view[side].signals[id].pairedVsT0
      out[side][id].noSignalFromT0 = view[side].signals[id].noSignalFromT0
    }
  }
  return out
}

function earlyTable(view) {
  const out = {}
  for (const side of ["all", "train", "test"]) {
    out[side] = {}
    for (const id of PRIMARY) out[side][id] = view[side].signals[id].early
  }
  return out
}

function assertMath() {
  const pause = [100, 99, 98, 97, 96, 95, 96, 96.5, 96.2, 96.4, 96.3]
  if (firstT0(pause.concat(Array(80).fill(96))) !== 10) throw new Error("T0")
  const held = pause.concat([96, 96.1, 96.2, 90])
  const row = describe(pad(held, 90))
  if (row.sig.hold3 !== 13) throw new Error(`hold3 ${row.sig.hold3}`)
  if (row.sig.noLow3 !== 11) throw new Error(`noLow3 ${row.sig.noLow3}`)
  const crashed = held.slice()
  crashed[20] = 50
  const later = describe(pad(crashed, 50))
  if (later.sig.hold3 !== row.sig.hold3) throw new Error("future crash moved hold3")
  const up = pause.concat([97, 98, 99])
  const upRow = describe(pad(up, 99))
  if (upRow.sig.up2 !== 12) throw new Error(`up2 ${upRow.sig.up2}`)
  if (upRow.sig.up3 !== 13) throw new Error(`up3 ${upRow.sig.up3}`)
  const prior = [96, 96, 96, 96, 96]
  const bo = pause.concat(prior, [97])
  const boRow = describe(pad(bo, 97))
  if (boRow.sig.break5 !== 16) throw new Error(`break5 ${boRow.sig.break5}`)
  if (!(97 > Math.max(...prior))) throw new Error("break uses today")
  const flat = pause.concat([96.3, 96.3])
  const flatRow = describe(pad(flat, 96.3))
  if (flatRow.sig.t0Cross != null && flatRow.sig.t0Cross < 12) throw new Error("equal close is not a cross")
}

function pad(closes, last) {
  const out = closes.slice()
  while (out.length < NEED + 1) out.push(last)
  return out
}

function main() {
  assertMath()
  assertNoEtfInStudyUniverse()
  console.log("3/4 entry confirmation. 48 names. Causal closes only. No ranking.")
  const blocks = []
  for (const meta of EQUITY_CANDIDATES) {
    const row = analyzeSymbol(meta, loadCached(meta.yahoo))
    console.log(`  ${meta.symbol}: ${row.status} episodes=${row.episodes?.length ?? 0} short=${row.short ?? 0}`)
    blocks.push(row)
  }
  const ready = blocks.filter((b) => b.status === "ok")
  const rows = ready.flatMap((b) => b.episodes || [])
  const view = bySplit(rows, pack)
  const withT0 = rows.filter((r) => r.t0 != null)
  const doc = {
    generatedAt: new Date().toISOString(),
    definition: {
      universe: "Existing 48 single names. ETF names are not included.",
      thresholds: FROZEN_THRESHOLDS,
      episodeDef: EPISODE_DEF,
      trainRatio: TRAIN_RATIO,
      day0: "Rising-edge open when count first reaches at least 3. Later 3/4 or 4/4 days inside that episode are not new episodes.",
      t0: "First session through Day 60 where none of the last 5 closes undercut the lowest close from Day 0 through the prior session. T0 is a baseline entry, not a confirmation.",
      sample: "Day 0 plus 140 later sessions exist, so a signal as late as T0+20 still has 60 sessions after the entry.",
      window: "Signals are the first match strictly after T0 and no later than T0+20. Only the first day is kept.",
      price: "Session closes only. The entry is the signal day's close. Later highs, lows, and rebounds are not used to decide the signal.",
      hold: "Need consecutive closes after T0 at or above the minimum close from Day 0 through the session before T0. The signal is the session that completes the streak.",
      noLow3: "First session after T0 where none of the last 3 closes undercut the lowest close from Day 0 through the prior session. The window may include T0.",
      higherLow: "On the last 5 closes, the late triple low is above the early pair low and above the pre-T0 low, today's close is above that late low, and today's close is above yesterday. No later session is read.",
      up: "The signal day completes 2 or 3 consecutive higher closes. Earlier sessions in the streak may include T0.",
      breakout: "Today's close is above the highest close of the previous N sessions. Today is not inside that high.",
      day0Cross: "First close after T0 above the Day 0 close, with the prior close at or below it. A T0 close already above Day 0 is not this signal.",
      t0Cross: "First close after T0 above the T0 close, with the prior close at or below it.",
      rebreak: "Within 10 sessions after T0, a close under the pre-T0 minimum. This labels the path. A signal that prints before that break does not know the label yet.",
      lowFrequency: "Occurrence under 20% of T0 episodes is marked. The mark is a frequency label, not a strategy decision.",
      paired: "Signal minus T0 on the same episode. MAE after a later entry does not include the move from T0 to that entry.",
      notASignal: "No confirmation is a production entry. Occurrence is not a rank.",
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
    signalFrequency: frequencyTable(view),
    signalTiming: timingTable(view),
    entryPerformance: performanceTable(view),
    sameEpisodeComparison: pairedTable(view),
    rebreakdownAnalysis: bySplit(withT0, (list) => ({
      rebreak: groupCut(list.filter((r) => r.rebreakDay != null)),
      noRebreak: groupCut(list.filter((r) => r.rebreakDay == null)),
    })),
    earlyRecoveryAnalysis: earlyTable(view),
    sensitivity: sensitivity(rows),
    interpretation: [],
  }
  doc.interpretation = interpret(doc)
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc))
  console.log(`wrote ${OUT_JSON}`)
  console.log(doc.interpretation.join("\n"))
}

main()
