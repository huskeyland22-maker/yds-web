/**
 * Risk after the first MA20 rise, versus the same episode's day 0 (research only).
 * MA20(t) > MA20(t-3), first print on day +1..+30. The later low is evaluation only.
 * Not a buy rule. ATR bands stay <3, 3–4, >=4.
 */

import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import { summarizeNumeric, timeSplitBars, TRAIN_RATIO } from "./daily-bottom-buy-validation-core.mjs"
import { FROZEN_THRESHOLDS, buildSplitBuyEpisodes } from "./daily-bottom-split-buy-sim.mjs"
import {
  EQUITY_CANDIDATES,
  MIN_BARS,
  WARMUP_IDX,
  attachObservationFeatures,
  assertNoEtfInStudyUniverse,
} from "./daily-bottom-buy-cross-asset-validation.mjs"
import { atrBand } from "./daily-bottom-buy-individual-stock-train-test-validation.mjs"
import { firstSignalIndex } from "./daily-bottom-buy-recovery-signals-validation.mjs"

export {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  TRAIN_RATIO,
  atrBand,
  assertNoEtfInStudyUniverse,
  firstSignalIndex,
}

export const HORIZONS = [1, 3, 5, 10, 20, 40, 60]
export const DROP_PCTS = [3, 5, 10, 15]
export const CRASH_WINDOWS = [
  { id: "covid_2020", start: "2020-02-20", end: "2020-04-30" },
  { id: "bear_2022", start: "2022-01-03", end: "2022-10-14" },
]

/** Fixed letter gates. Not used to edit the MA20 rule. */
export const JUDGE_GATES = {
  maeDropPp: 2,
  tailDropPp: 5,
  regimeMaeWorsePp: 1,
  regimeTailWorsePp: 5,
  minN: 30,
  top3ShareMax: 50,
}

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function rate(n, d) {
  if (!d) return null
  return round2((n / d) * 100)
}

function inWindow(date, w) {
  return date >= w.start && date <= w.end
}

/**
 * Path starting at idx. MAE uses lows through the horizon.
 * Drop flags use later closes. The low index is the first session at the minimum low.
 */
export function pathFrom(bars, idx, horizon) {
  if (idx == null || idx < 0 || idx >= bars.length) return null
  const entry = bars[idx].close
  if (!(entry > 0)) return null
  const last = Math.min(bars.length - 1, idx + horizon)
  let minLow = bars[idx].low
  let minIdx = idx
  const drops = { 3: false, 5: false, 10: false, 15: false }
  for (let j = idx; j <= last; j++) {
    if (bars[j].low < minLow) {
      minLow = bars[j].low
      minIdx = j
    }
    if (j === idx) continue
    const r = ((bars[j].close - entry) / entry) * 100
    for (const pct of DROP_PCTS) {
      if (r <= -pct) drops[pct] = true
    }
  }
  const full = idx + horizon < bars.length
  const ret = full && bars[idx + horizon].close > 0 ? round2(((bars[idx + horizon].close - entry) / entry) * 100) : null
  return {
    mae: round2(((entry - minLow) / entry) * 100),
    daysToLow: minIdx - idx,
    lowIdx: minIdx,
    drop3: drops[3],
    drop5: drops[5],
    drop10: drops[10],
    drop15: drops[15],
    ret,
    full,
  }
}

export function lowTiming(lowIdx, signalIdx) {
  if (lowIdx == null || signalIdx == null) return null
  if (lowIdx < signalIdx) return "before"
  if (lowIdx === signalIdx) return "sameDay"
  return "after"
}

function nums(rows, pick) {
  return summarizeNumeric(rows.map(pick))
}

export function packPaths(rows, pick) {
  const stats = rows.map(pick).filter(Boolean)
  const mae = nums(stats, (s) => s.mae)
  return {
    n: rows.length,
    nPath: stats.length,
    nFull60: stats.filter((s) => s.full).length,
    maeMedian: mae.median,
    maeMean: mae.mean,
    drop3Pct: rate(stats.filter((s) => s.drop3).length, stats.length),
    drop5Pct: rate(stats.filter((s) => s.drop5).length, stats.length),
    drop10Pct: rate(stats.filter((s) => s.drop10).length, stats.length),
    drop15Pct: rate(stats.filter((s) => s.drop15).length, stats.length),
    daysToLowMedian: nums(stats, (s) => s.daysToLow).median,
    d20Median: nums(stats, (s) => (s.horizonReturn ? s.horizonReturn[20] : s.ret20)).median,
    d40Median: nums(stats, (s) => (s.horizonReturn ? s.horizonReturn[40] : s.ret40)).median,
    d60Median: nums(stats, (s) => (s.horizonReturn ? s.horizonReturn[60] : s.ret60)).median,
  }
}

function horizonBundle(bars, idx) {
  const byH = {}
  for (const h of HORIZONS) {
    const p = pathFrom(bars, idx, h)
    byH[h] = p
  }
  const ret = {}
  for (const h of [5, 10, 20, 40, 60]) ret[h] = byH[h]?.ret ?? null
  const main = byH[60]
  return {
    ...main,
    ret20: ret[20],
    ret40: ret[40],
    ret60: ret[60],
    horizonReturn: ret,
    byHorizon: Object.fromEntries(
      HORIZONS.map((h) => [
        h,
        byH[h]
          ? { mae: byH[h].mae, drop5: byH[h].drop5, drop10: byH[h].drop10, daysToLow: byH[h].daysToLow, ret: byH[h].ret }
          : null,
      ]),
    ),
  }
}

function preSignal(bars, openIdx, signalIdx) {
  const entry = bars[openIdx].close
  if (!(entry > 0) || signalIdx <= openIdx) {
    return { mae: null, dropClose: null, lowBefore: false }
  }
  let minLow = bars[openIdx].low
  let minIdx = openIdx
  for (let j = openIdx; j < signalIdx; j++) {
    if (bars[j].low < minLow) {
      minLow = bars[j].low
      minIdx = j
    }
  }
  const lastClose = bars[signalIdx - 1].close
  return {
    mae: round2(((entry - minLow) / entry) * 100),
    dropClose: lastClose > 0 ? round2(((lastClose - entry) / entry) * 100) : null,
    lowIdx: minIdx,
    sessions: signalIdx - openIdx,
  }
}

export function analyzeMa20RiskSymbol(meta, rawBars) {
  if (!rawBars?.length || rawBars.length < MIN_BARS) {
    return { symbol: meta.symbol, status: rawBars?.length ? "insufficient history" : "data unavailable", rows: [], split: null, bars: null }
  }
  const bars = attachObservationFeatures(enrichBarsWithIndicators(rawBars), null, null)
  const split = timeSplitBars(bars, TRAIN_RATIO)
  const fromIdx = Math.min(WARMUP_IDX, bars.length - 1)
  const built = buildSplitBuyEpisodes(bars, FROZEN_THRESHOLDS, { fromIdx, toIdx: bars.length })
  const rows = built.map((ep) => {
    const open = ep.openIdx
    const signalIdx = firstSignalIndex(bars, open, "ma20Up")
    const day0 = horizonBundle(bars, open)
    const day0LowEnd = Math.min(bars.length - 1, open + 60)
    let lowPx = Infinity
    let lowIdx = open
    for (let j = open; j <= day0LowEnd; j++) {
      if (bars[j].low < lowPx) {
        lowPx = bars[j].low
        lowIdx = j
      }
    }
    const signal = signalIdx == null ? null : horizonBundle(bars, signalIdx)
    const pre = signalIdx == null ? null : preSignal(bars, open, signalIdx)
    return {
      symbol: meta.symbol,
      date: bars[open].date,
      idx: open,
      split: open < split.splitIdx ? "train" : "test",
      atrBand: atrBand(bars[open].atrPct),
      atrPct: bars[open].atrPct ?? null,
      signalIdx,
      signalDay: signalIdx == null ? null : signalIdx - open,
      signalDate: signalIdx == null ? null : bars[signalIdx].date,
      day0,
      signal,
      pre,
      evalLowIdx: lowIdx,
      timing: signalIdx == null ? null : lowTiming(lowIdx, signalIdx),
    }
  })
  return { symbol: meta.symbol, status: "ok", split, bars, rows }
}

function summarizeSide(rows, key) {
  const stats = rows.map((r) => r[key]).filter(Boolean)
  const mae = nums(stats, (s) => s.mae)
  return {
    n: rows.length,
    nPath: stats.length,
    nFull60: stats.filter((s) => s.full).length,
    maeMedian: mae.median,
    maeMean: mae.mean,
    drop3Pct: rate(stats.filter((s) => s.drop3).length, stats.length),
    drop5Pct: rate(stats.filter((s) => s.drop5).length, stats.length),
    drop10Pct: rate(stats.filter((s) => s.drop10).length, stats.length),
    drop15Pct: rate(stats.filter((s) => s.drop15).length, stats.length),
    daysToLowMedian: nums(stats, (s) => s.daysToLow).median,
    d5Median: nums(stats, (s) => s.horizonReturn?.[5]).median,
    d10Median: nums(stats, (s) => s.horizonReturn?.[10]).median,
    d20Median: nums(stats, (s) => s.horizonReturn?.[20]).median,
    d40Median: nums(stats, (s) => s.horizonReturn?.[40]).median,
    d60Median: nums(stats, (s) => s.horizonReturn?.[60]).median,
  }
}

function gap(a, b) {
  if (a == null || b == null) return null
  return round2(a - b)
}

function pairedGap(rows) {
  const day0 = summarizeSide(rows, "day0")
  const signal = summarizeSide(rows, "signal")
  return {
    n: rows.length,
    day0,
    signal,
    maeGap: gap(day0.maeMedian, signal.maeMedian),
    tail5Gap: gap(day0.drop5Pct, signal.drop5Pct),
    tail10Gap: gap(day0.drop10Pct, signal.drop10Pct),
    tail15Gap: gap(day0.drop15Pct, signal.drop15Pct),
    d20Gap: gap(signal.d20Median, day0.d20Median),
    d60Gap: gap(signal.d60Median, day0.d60Median),
  }
}

function horizonTable(rows, key) {
  const out = {}
  for (const h of HORIZONS) {
    const xs = rows.map((r) => r[key]?.byHorizon?.[h]).filter(Boolean)
    out[h] = {
      n: xs.length,
      maeMedian: nums(xs, (s) => s.mae).median,
      drop10Pct: rate(xs.filter((s) => s.drop10).length, xs.length),
      daysToLowMedian: nums(xs, (s) => s.daysToLow).median,
      retMedian: nums(xs, (s) => s.ret).median,
    }
  }
  return out
}

function timingTable(rows) {
  const out = {}
  for (const id of ["before", "sameDay", "after"]) {
    const sub = rows.filter((r) => r.timing === id)
    out[id] = {
      n: sub.length,
      pct: rate(sub.length, rows.length),
      fromSignal: summarizeSide(sub, "signal"),
      fromDay0: summarizeSide(sub, "day0"),
    }
  }
  return out
}

function symbolShift(rows) {
  const by = new Map()
  for (const row of rows) {
    if (!by.has(row.symbol)) by.set(row.symbol, [])
    by.get(row.symbol).push(row)
  }
  const list = []
  const maeDeltas = []
  for (const [symbol, listRows] of by) {
    const day0 = summarizeSide(listRows, "day0")
    const signal = summarizeSide(listRows, "signal")
    const maeChange = round2(day0.maeMedian - signal.maeMedian)
    const tailChange = round2(day0.drop10Pct - signal.drop10Pct)
    const d60Change = round2(signal.d60Median - day0.d60Median)
    if (listRows.length >= 5 && maeChange != null) maeDeltas.push(maeChange)
    list.push({ symbol, n: listRows.length, maeChange, tailChange, d60Change })
  }
  const sums = new Map()
  for (const row of rows) {
    if (row.day0?.mae == null || row.signal?.mae == null) continue
    const d = row.day0.mae - row.signal.mae
    sums.set(row.symbol, (sums.get(row.symbol) || 0) + d)
  }
  const ranked = [...sums.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const totalAbs = ranked.reduce((s, x) => s + Math.abs(x[1]), 0)
  const top3 = ranked.slice(0, 3).map(([symbol, sumMaeDrop]) => ({
    symbol,
    sumMaeDrop: round2(sumMaeDrop),
    shareOfAbsSumPct: totalAbs > 0 ? round2((Math.abs(sumMaeDrop) / totalAbs) * 100) : null,
  }))
  return {
    names: list.length,
    namesN5: maeDeltas.length,
    maeChangeMedianOfSymbolMedians: nums(maeDeltas.map((v) => ({ v })), (x) => x.v).median,
    top3,
    top3SharePct: totalAbs > 0 ? round2((top3.reduce((s, x) => s + Math.abs(x.sumMaeDrop), 0) / totalAbs) * 100) : null,
    symbols: list.sort((a, b) => b.n - a.n || a.symbol.localeCompare(b.symbol)),
  }
}

function crashPair(rows) {
  const out = {}
  for (const w of CRASH_WINDOWS) {
    const inside = rows.filter((r) => inWindow(r.date, w) && r.signal)
    out[w.id] = pairedGap(inside)
  }
  return out
}

export function judgeMa20Risk(input) {
  const { train, test, testAtr, bear2022, top3SharePct } = input
  const ready = train && test && train.n >= JUDGE_GATES.minN && test.n >= JUDGE_GATES.minN && train.maeGap != null && test.maeGap != null
  if (!ready) return { code: "B", reason: "paired n below 30", gates: JUDGE_GATES }
  const flip = train.maeGap * test.maeGap < 0 && Math.abs(train.maeGap) >= 1 && Math.abs(test.maeGap) >= 1
  const regimeFlip =
    bear2022 &&
    bear2022.n >= JUDGE_GATES.minN &&
    (bear2022.maeGap <= -JUDGE_GATES.regimeMaeWorsePp || bear2022.tail10Gap <= -JUDGE_GATES.regimeTailWorsePp)
  if (flip || regimeFlip) {
    return { code: "D", train: train.maeGap, test: test.maeGap, bear2022, gates: JUDGE_GATES }
  }
  const atrOk = ["lt3", "b3_4", "ge4"].every((id) => {
    const g = testAtr?.[id]
    if (!g || g.n < JUDGE_GATES.minN) return true
    return g.maeGap > 0 && g.tail10Gap > 0
  })
  const concentrated = top3SharePct != null && top3SharePct > JUDGE_GATES.top3ShareMax
  const maeDown = test.maeGap >= JUDGE_GATES.maeDropPp && train.maeGap > 0
  const tailDown = test.tail10Gap >= JUDGE_GATES.tailDropPp && train.tail10Gap > 0
  if (maeDown && tailDown && atrOk && !concentrated) return { code: "A", gates: JUDGE_GATES }
  if (test.maeGap >= JUDGE_GATES.maeDropPp || test.tail10Gap >= JUDGE_GATES.tailDropPp) return { code: "B", gates: JUDGE_GATES }
  if (test.maeGap < 1 && (test.tail10Gap == null || test.tail10Gap < JUDGE_GATES.tailDropPp)) return { code: "C", gates: JUDGE_GATES }
  return { code: "B", gates: JUDGE_GATES }
}

function sideBlock(rows) {
  const paired = rows.filter((r) => r.signal)
  const missed = rows.filter((r) => !r.signal)
  const preMae = nums(paired, (r) => r.pre?.mae)
  return {
    n: rows.length,
    signalN: paired.length,
    missN: missed.length,
    occ: rate(paired.length, rows.length),
    daysMedian: nums(paired, (r) => r.signalDay).median,
    daysMean: nums(paired, (r) => r.signalDay).mean,
    allDay0: summarizeSide(rows, "day0"),
    paired: pairedGap(paired),
    missedDay0: summarizeSide(missed, "day0"),
    preMaeMedian: preMae.median,
    preMaeMean: preMae.mean,
    preCloseChangeMedian: nums(paired, (r) => r.pre?.dropClose).median,
    preDrop5Pct: rate(paired.filter((r) => r.pre?.dropClose != null && r.pre.dropClose <= -5).length, paired.length),
    preDrop10Pct: rate(paired.filter((r) => r.pre?.dropClose != null && r.pre.dropClose <= -10).length, paired.length),
    horizonsFromDay0: horizonTable(paired, "day0"),
    horizonsFromSignal: horizonTable(paired, "signal"),
    timing: timingTable(paired),
  }
}

export function poolMa20Risk(analyzed) {
  const rows = analyzed.filter((x) => x.status === "ok").flatMap((x) => x.rows)
  const train = rows.filter((r) => r.split === "train")
  const test = rows.filter((r) => r.split === "test")
  const trainBlock = sideBlock(train)
  const testBlock = sideBlock(test)
  const testAtr = {}
  for (const id of ["lt3", "b3_4", "ge4"]) {
    testAtr[id] = pairedGap(test.filter((r) => r.atrBand === id && r.signal))
    testAtr[id].allDay0N = test.filter((r) => r.atrBand === id).length
  }
  const trainAtr = {}
  for (const id of ["lt3", "b3_4", "ge4"]) trainAtr[id] = pairedGap(train.filter((r) => r.atrBand === id && r.signal))
  const symbols = symbolShift(test.filter((r) => r.signal))
  const crash = { train: crashPair(train), test: crashPair(test) }
  const judgment = judgeMa20Risk({
    train: trainBlock.paired,
    test: testBlock.paired,
    testAtr,
    bear2022: crash.train.bear_2022,
    top3SharePct: symbols.top3SharePct,
  })
  const splits = analyzed.map((x) => x.split).filter(Boolean)
  return {
    coverage: {
      symbols: analyzed.length,
      withData: analyzed.filter((x) => x.status === "ok").length,
      dataStart: splits.map((s) => s.dataStart).filter(Boolean).sort()[0] ?? null,
      dataEnd: splits.map((s) => s.dataEnd).filter(Boolean).sort().at(-1) ?? null,
      splitDateMin: splits.map((s) => s.splitDate).filter(Boolean).sort()[0] ?? null,
      splitDateMax: splits.map((s) => s.splitDate).filter(Boolean).sort().at(-1) ?? null,
    },
    counts: { train: train.length, test: test.length },
    train: trainBlock,
    test: testBlock,
    trainAtr,
    testAtr,
    crash,
    symbols,
    judgment,
  }
}

export function msftMa20Case(rawBars) {
  const block = analyzeMa20RiskSymbol({ symbol: "MSFT" }, rawBars)
  if (block.status !== "ok") return { status: block.status }
  const row = block.rows.find((r) => r.date === "2026-06-17")
  if (!row) return { status: "2026-06-17 is not a 3/4 open", splitDate: block.split?.splitDate ?? null }
  const bars = block.bars
  const low = bars[row.evalLowIdx]
  return {
    status: "ok",
    split: row.split,
    date: row.date,
    close: round2(bars[row.idx].close),
    atrPct: row.atrPct,
    atrBand: row.atrBand,
    signalDate: row.signalDate,
    signalDay: row.signalDay,
    signalClose: row.signalIdx == null ? null : round2(bars[row.signalIdx].close),
    evalLowDate: low.date,
    evalLow: round2(low.low),
    timing: row.timing,
    day0: {
      mae: row.day0.mae,
      drop5: row.day0.drop5,
      drop10: row.day0.drop10,
      drop15: row.day0.drop15,
      d20: row.day0.ret20,
      d40: row.day0.ret40,
      d60: row.day0.ret60,
      daysToLow: row.day0.daysToLow,
    },
    signal: row.signal
      ? {
          mae: row.signal.mae,
          drop5: row.signal.drop5,
          drop10: row.signal.drop10,
          drop15: row.signal.drop15,
          d20: row.signal.ret20,
          d40: row.signal.ret40,
          d60: row.signal.ret60,
          daysToLow: row.signal.daysToLow,
        }
      : null,
    preMae: row.pre?.mae ?? null,
  }
}
