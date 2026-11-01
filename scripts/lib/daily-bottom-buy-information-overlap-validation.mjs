/**
 * Information overlap among correction-stage variables (research only).
 * Same 120-day episodes as the correction-stage study. Fixed buckets, not searched.
 * Not a buy rule.
 */

import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import { summarizeNumeric } from "./daily-bottom-buy-validation-core.mjs"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  attachObservationFeatures,
  assertNoEtfInStudyUniverse,
} from "./daily-bottom-buy-cross-asset-validation.mjs"
import { STAGE_PCTS, buildCorrectionEpisodes } from "./daily-bottom-buy-correction-stage-validation.mjs"
import { attachTrendFields } from "./daily-bottom-buy-trend-regime-validation.mjs"

export { EQUITY_CANDIDATES, FROZEN_THRESHOLDS, STAGE_PCTS, assertNoEtfInStudyUniverse }

/** Fixed ATR contrast used in the prior study. Not searched. */
export const ATR_LOW_MAX = 3
export const ATR_HIGH_MIN = 4

export const CORE_VARS = [
  "dd120",
  "dd252",
  "atrPct",
  "rv20",
  "ma200Gap",
  "ma200Slope",
  "rsSpy60",
  "rsSpy120",
  "rsQqq120",
  "rsi14",
  "stochK",
  "bbPctB",
  "ma20DevPct",
  "volRatio",
  "ret5",
  "ret20",
]

export const FOCUS_PAIRS = [
  ["dd120", "dd252"],
  ["dd120", "atrPct"],
  ["atrPct", "rv20"],
  ["ma200Gap", "ma200Slope"],
  ["ma200Gap", "rsSpy120"],
  ["rsSpy60", "rsSpy120"],
  ["rsSpy120", "rsQqq120"],
  ["rsi14", "stochK"],
  ["rsi14", "bbPctB"],
  ["atrPct", "volRatio"],
  ["dd252", "ma200Gap"],
  ["dd120", "rsSpy120"],
]

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function round4(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 10000) / 10000
}

export function pearson(xs, ys) {
  const pairs = []
  for (let i = 0; i < xs.length; i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) pairs.push([xs[i], ys[i]])
  }
  const n = pairs.length
  if (n < 5) return { n, r: null }
  const mx = pairs.reduce((s, p) => s + p[0], 0) / n
  const my = pairs.reduce((s, p) => s + p[1], 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (const [x, y] of pairs) {
    const a = x - mx
    const b = y - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  if (dx <= 0 || dy <= 0) return { n, r: null }
  return { n, r: round4(num / Math.sqrt(dx * dy)) }
}

export function spearman(xs, ys) {
  const pairs = []
  for (let i = 0; i < xs.length; i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) pairs.push([xs[i], ys[i]])
  }
  if (pairs.length < 5) return { n: pairs.length, r: null }
  const rx = rank(pairs.map((p) => p[0]))
  const ry = rank(pairs.map((p) => p[1]))
  return pearson(rx, ry)
}

function rank(values) {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const out = new Array(values.length)
  let i = 0
  while (i < order.length) {
    let j = i
    while (j + 1 < order.length && order[j + 1].v === order[i].v) j++
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) out[order[k].i] = avg
    i = j + 1
  }
  return out
}

function median(vals) {
  return summarizeNumeric(vals.filter((v) => Number.isFinite(v))).median
}

function rate(n, d) {
  if (!d) return null
  return round2((n / d) * 100)
}

function retN(bars, i, n) {
  if (i < n || !(bars[i - n].close > 0)) return null
  return ((bars[i].close - bars[i - n].close) / bars[i - n].close) * 100
}

function dayFlags(bars, i) {
  const b = bars[i]
  const prev = i > 0 ? bars[i - 1] : null
  const rsiUpturn =
    i >= 2 &&
    b.rsi14 != null &&
    bars[i - 1].rsi14 != null &&
    bars[i - 2].rsi14 != null &&
    b.rsi14 > bars[i - 1].rsi14 &&
    bars[i - 1].rsi14 <= bars[i - 2].rsi14
  const ret5Now = b.ret5
  const ret5Prev = i >= 1 ? retN(bars, i - 1, 5) : null
  return {
    rsiUpturn,
    stochUp: Boolean(b.stochCrossUp),
    volSpike: b.volRatio != null && b.volRatio >= 1.5,
    reclaim: Boolean(b.reclaimUndercut),
    higherLow: Boolean(b.higherLow),
    ma20Improve: prev != null && prev.ma20DevPct != null && b.ma20DevPct != null && prev.ma20DevPct < 0 && b.ma20DevPct > prev.ma20DevPct,
    ret5Turn: ret5Prev != null && ret5Now != null && ret5Prev < 0 && ret5Now > ret5Prev && i >= 1 && b.close > prev.close,
  }
}

function pack(rows) {
  const d20 = rows.map((r) => r.d20).filter((v) => v != null)
  const d60 = rows.map((r) => r.d60).filter((v) => v != null)
  return {
    n: rows.length,
    smallSample: rows.length < 30,
    maeMedian: median(rows.map((r) => r.mae)),
    d20Median: median(d20),
    d60Median: median(d60),
    d60LossPct: rate(d60.filter((v) => v < 0).length, d60.length),
    hit5Pct: rate(rows.filter((r) => r.hit5).length, rows.length),
    hit10Pct: rate(rows.filter((r) => r.hit10).length, rows.length),
    daysToLowMedian: median(rows.map((r) => r.daysToLow)),
  }
}

function rowsOf(episodes, bars) {
  const rows = []
  for (const ep of episodes) {
    for (const level of STAGE_PCTS) {
      const st = ep.stages[level]
      if (!st?.outcome) continue
      const b = bars[st.idx]
      const flags = dayFlags(bars, st.idx)
      rows.push({
        symbol: ep.symbol,
        date: b.date,
        level,
        dd120: st.snap.drawdownFromPeak,
        dd252: b.dd52,
        atrPct: b.atrPct,
        rv20: b.vol20Pct,
        ma200Gap: b.ma200Gap,
        ma200Slope: b.ma200Slope,
        ma50AboveMa200: b.ma50AboveMa200,
        aboveMa200: b.aboveMa200,
        rsSpy60: b.rsSpy60,
        rsSpy120: b.rsSpy120,
        rsQqq120: b.rsQqq120,
        rsi14: b.rsi14,
        stochK: b.stochK,
        bbPctB: b.bbPctB,
        ma20DevPct: b.ma20DevPct,
        volRatio: b.volRatio,
        ret5: b.ret5,
        ret20: round2(retN(bars, st.idx, 20)),
        mae: st.outcome.maePct,
        d20: st.outcome.d20,
        d60: st.outcome.d60,
        hit5: st.outcome.hit5,
        hit10: st.outcome.hit10,
        daysToLow: st.outcome.daysToLow,
        onOrBeforeLow: st.idx <= ep.evalLowIdx,
        ...flags,
      })
    }
  }
  return rows
}

function pairTable(rows) {
  return FOCUS_PAIRS.map(([a, b]) => ({
    a,
    b,
    pearson: pearson(rows.map((r) => r[a]), rows.map((r) => r[b])),
    spearman: spearman(rows.map((r) => r[a]), rows.map((r) => r[b])),
  }))
}

function overlapLabel(r) {
  if (r == null) return "unknown"
  const a = Math.abs(r)
  if (a >= 0.7) return "high"
  if (a >= 0.4) return "moderate"
  return "low"
}

function atrSide(v) {
  if (v == null || !Number.isFinite(v)) return null
  if (v < ATR_LOW_MAX) return "low"
  if (v >= ATR_HIGH_MIN) return "high"
  return "mid"
}

const ATR_BANDS = [
  ["lt2", (v) => v < 2],
  ["2_3", (v) => v >= 2 && v < 3],
  ["3_4", (v) => v >= 3 && v < 4],
  ["4_5", (v) => v >= 4 && v < 5],
  ["gt5", (v) => v >= 5],
]

function byAtrBands(rows) {
  const out = {}
  for (const [id, pred] of ATR_BANDS) {
    out[id] = pack(rows.filter((r) => r.atrPct != null && pred(r.atrPct)))
  }
  return out
}

function depthTable(rows) {
  const out = {}
  for (const level of STAGE_PCTS) out[level] = pack(rows.filter((r) => r.level === level))
  return out
}

function withinDepthAtr(rows) {
  const out = {}
  for (const level of [10, 15, 20, 25, 30]) {
    const at = rows.filter((r) => r.level === level)
    out[level] = {
      low: pack(at.filter((r) => atrSide(r.atrPct) === "low")),
      high: pack(at.filter((r) => atrSide(r.atrPct) === "high")),
      bands: byAtrBands(at),
    }
  }
  return out
}

function withinDepthSplit(rows, yesPred, noPred, levels = [10, 15, 20]) {
  const out = {}
  for (const level of levels) {
    const at = rows.filter((r) => r.level === level)
    out[level] = {
      yes: pack(at.filter(yesPred)),
      no: pack(at.filter(noPred)),
    }
  }
  return out
}

const DD252_BANDS = [
  ["gt_m10", (v) => v > -10],
  ["m10_m20", (v) => v <= -10 && v > -20],
  ["m20_m30", (v) => v <= -20 && v > -30],
  ["m30_m40", (v) => v <= -30 && v > -40],
  ["le_m40", (v) => v <= -40],
]

const RV_BANDS = [
  ["lt1", (v) => v < 1],
  ["1_1_5", (v) => v >= 1 && v < 1.5],
  ["1_5_2", (v) => v >= 1.5 && v < 2],
  ["2_3", (v) => v >= 2 && v < 3],
  ["gt3", (v) => v >= 3],
]

function byBands(rows, field, bands) {
  const out = {}
  for (const [id, pred] of bands) {
    out[id] = pack(rows.filter((r) => r[field] != null && pred(r[field])))
  }
  return out
}

function withinDepthAndAtr(rows, pred) {
  const out = {}
  for (const level of [10, 15, 20]) {
    out[level] = {}
    for (const side of ["low", "high"]) {
      const at = rows.filter((r) => r.level === level && atrSide(r.atrPct) === side)
      out[level][side] = {
        yes: pack(at.filter(pred)),
        no: pack(at.filter((r) => !pred(r))),
      }
    }
  }
  return out
}

/**
 * Descriptive label only. Uses a pre-set gap of 2 MAE points and n>=30.
 * Not a trading rule and not fit to maximize a result.
 */
export function infoLevelFromGaps(gaps) {
  const usable = gaps.filter(
    (g) => g.nLow >= 30 && g.nHigh >= 30 && g.maeLow != null && g.maeHigh != null,
  )
  if (usable.length < 2) return { level: "B", usable: usable.length, note: "fewer than two stages with n>=30 on both sides" }
  const diffs = usable.map((g) => round2(g.maeHigh - g.maeLow))
  const sameUp = diffs.every((d) => d >= 2)
  const sameDown = diffs.every((d) => d <= -2)
  const anyBig = diffs.some((d) => Math.abs(d) >= 2)
  let level = "B"
  if (sameUp || sameDown) level = "A"
  else if (!anyBig) level = "C"
  return { level, usable: usable.length, maeDiffs: diffs }
}

function percentile(value, values) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!xs.length || value == null || !Number.isFinite(value)) return null
  const below = xs.filter((v) => v <= value).length
  return round2((below / xs.length) * 100)
}

const PATTERN_KEYS = ["rsiUpturn", "stochUp", "volSpike", "reclaim", "higherLow", "ma20Improve", "ret5Turn"]

export function analyzeInformation(episodesBySymbol) {
  const rows = episodesBySymbol.flatMap((x) => rowsOf(x.episodes, x.bars))
  const at10 = rows.filter((r) => r.level === 10)
  const pairs10 = pairTable(at10)
  const pairsAllStages = pairTable(rows)

  const atrGaps = []
  const rsGaps = []
  const maGaps = []
  const depthAtr = withinDepthAtr(rows)
  for (const level of [10, 15, 20, 25, 30]) {
    const cell = depthAtr[level]
    atrGaps.push({
      level,
      nLow: cell.low.n,
      nHigh: cell.high.n,
      maeLow: cell.low.maeMedian,
      maeHigh: cell.high.maeMedian,
      d60Low: cell.low.d60Median,
      d60High: cell.high.d60Median,
      lossLow: cell.low.d60LossPct,
      lossHigh: cell.high.d60LossPct,
    })
  }
  const weakRs = (r) => r.rsSpy120 != null && r.rsSpy120 < 0
  const strongRs = (r) => r.rsSpy120 != null && r.rsSpy120 >= 0
  const rsSplit = withinDepthSplit(rows, weakRs, strongRs)
  const maSplit = withinDepthSplit(
    rows,
    (r) => r.aboveMa200 === false,
    (r) => r.aboveMa200 === true,
    [5, 10, 15, 20, 25, 30],
  )
  const slopeSplit = withinDepthSplit(
    rows,
    (r) => r.ma200Slope != null && r.ma200Slope <= 0,
    (r) => r.ma200Slope != null && r.ma200Slope > 0,
  )
  const ma50Split = withinDepthSplit(
    rows,
    (r) => r.ma50AboveMa200 === false,
    (r) => r.ma50AboveMa200 === true,
  )
  const dd252Within = {}
  const rvWithin = {}
  for (const level of [10, 15, 20]) {
    const at = rows.filter((r) => r.level === level)
    dd252Within[level] = byBands(at, "dd252", DD252_BANDS)
    rvWithin[level] = byBands(at, "rv20", RV_BANDS)
  }
  const rsWithinAtr = {}
  for (const level of [10, 15, 20]) {
    rsWithinAtr[level] = {}
    for (const side of ["low", "high"]) {
      const at = rows.filter((r) => r.level === level && atrSide(r.atrPct) === side)
      rsWithinAtr[level][side] = {
        weak: pack(at.filter(weakRs)),
        strong: pack(at.filter(strongRs)),
      }
    }
  }
  for (const level of [10, 15, 20]) {
    rsGaps.push({
      level,
      nLow: rsSplit[level].yes.n,
      nHigh: rsSplit[level].no.n,
      maeLow: rsSplit[level].yes.maeMedian,
      maeHigh: rsSplit[level].no.maeMedian,
    })
    maGaps.push({
      level,
      nLow: maSplit[level].yes.n,
      nHigh: maSplit[level].no.n,
      maeLow: maSplit[level].yes.maeMedian,
      maeHigh: maSplit[level].no.maeMedian,
    })
  }

  const patterns = {}
  const leadingRows = rows.filter((r) => r.onOrBeforeLow)
  for (const key of PATTERN_KEYS) {
    patterns[key] = withinDepthAndAtr(leadingRows, (r) => r[key] === true)
  }

  const dd10 = rows.find((r) => r.level === 10)
  const dd25 = rows.filter((r) => r.level === 25)
  const dd10pack = pack(rows.filter((r) => r.level === 10))
  const dd25pack = pack(dd25)

  return {
    nStageRows: rows.length,
    nAt10: at10.length,
    nEpisodes: new Set(episodesBySymbol.flatMap((x) => x.episodes.map((e) => `${e.symbol}|${e.startDate}`))).size,
    correlationsAtMinus10: pairs10.map((p) => ({
      ...p,
      overlap: overlapLabel(p.spearman.r),
    })),
    correlationsAllStageRows: pairsAllStages.map((p) => ({
      ...p,
      overlap: overlapLabel(p.spearman.r),
      note: "Stage rows repeat an episode that passes several depths.",
    })),
    depth: depthTable(rows),
    atrBandsAt10: byAtrBands(at10),
    atrWithinDepth: depthAtr,
    rvWithinDepth: rvWithin,
    dd252WithinDepth: dd252Within,
    rsWithinDepth: rsSplit,
    rsWithinDepthAndAtr: rsWithinAtr,
    ma200WithinDepth: maSplit,
    ma200SlopeWithinDepth: slopeSplit,
    ma50AboveWithinDepth: ma50Split,
    patternsWithinDepthAndAtr: patterns,
    info: {
      atrGivenDepth: infoLevelFromGaps(atrGaps),
      rsGivenDepth: infoLevelFromGaps(rsGaps),
      ma200GivenDepth: infoLevelFromGaps(maGaps),
      depth10vs25: {
        mae10: dd10pack.maeMedian,
        mae25: dd25pack.maeMedian,
        n10: dd10pack.n,
        n25: dd25pack.n,
        dd120Example: dd10 ? "present" : "missing",
      },
    },
    rowsForPercentile: {
      atrAt10: at10.map((r) => r.atrPct),
      dd252At10: at10.map((r) => r.dd252),
      rsAt10: at10.map((r) => r.rsSpy120),
      ma200GapAt10: at10.map((r) => r.ma200Gap),
    },
  }
}

export function analyzeSymbolInfo(meta, rawBars, bench = {}) {
  if (!rawBars?.length) return { symbol: meta.symbol, status: "data unavailable", episodes: [], bars: [] }
  const bars = attachTrendFields(
    attachObservationFeatures(enrichBarsWithIndicators(rawBars), bench.spy || null, bench.qqq || null),
    bench.spy || null,
    bench.qqq || null,
  )
  const episodes = buildCorrectionEpisodes(bars, 120).map((ep) => ({ ...ep, symbol: meta.symbol }))
  return { symbol: meta.symbol, status: "ok", episodes, bars }
}

export function msftPlacement(rawBars, bench, percentileSource) {
  if (!rawBars?.length) return { status: "data unavailable" }
  const bars = attachTrendFields(
    attachObservationFeatures(enrichBarsWithIndicators(rawBars), bench.spy || null, bench.qqq || null),
    bench.spy || null,
    bench.qqq || null,
  )
  const episodes = buildCorrectionEpisodes(bars, 120)
  const want = ["2026-06-08", "2026-06-17", "2026-06-25"]
  const byDate = new Map(bars.map((b, i) => [b.date, i]))
  const days = {}
  for (const d of want) {
    const i = byDate.get(d)
    if (i == null) {
      days[d] = { status: "date missing" }
      continue
    }
    const b = bars[i]
    const ep = episodes.find((e) => i >= e.startIdx && i <= e.endIdx)
    const dd120 = ep ? round2(((b.close - ep.peak) / ep.peak) * 100) : null
    days[d] = {
      close: round2(b.close),
      dd120,
      dd252: b.dd52,
      atrPct: b.atrPct,
      rv20: b.vol20Pct,
      ma200Gap: b.ma200Gap,
      ma200Slope: b.ma200Slope,
      aboveMa200: b.aboveMa200,
      regime: b.regime,
      rsSpy60: b.rsSpy60,
      rsSpy120: b.rsSpy120,
      rsQqq120: b.rsQqq120,
      rsi14: round2(b.rsi14),
      stochK: round2(b.stochK),
      bbPctB: round2(b.bbPctB),
      ma20DevPct: round2(b.ma20DevPct),
      volRatio: b.volRatio,
      count: b.count,
      percentileVsMinus10Stage: {
        atrPct: percentile(b.atrPct, percentileSource.atrAt10),
        dd252: percentile(b.dd52, percentileSource.dd252At10),
        rsSpy120: percentile(b.rsSpy120, percentileSource.rsAt10),
        ma200Gap: percentile(b.ma200Gap, percentileSource.ma200GapAt10),
      },
    }
  }
  return { status: "ok", days }
}
