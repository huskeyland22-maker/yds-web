/**
 * Daily Bottom Buy — diagnostic validation (research / observation only).
 * Same 144 Test episodes + FROZEN_THRESHOLDS. No strategy / threshold / universe changes.
 * Does NOT optimize thresholds. Observes associations under current frozen rules.
 */

import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import {
  TRAIN_RATIO,
  conditionFlags,
  summarizeNumeric,
  timeSplitBars,
} from "./daily-bottom-buy-validation-core.mjs"
import {
  EPISODE_DEF,
  FROZEN_THRESHOLDS,
  buildSplitBuyEpisodes,
} from "./daily-bottom-split-buy-sim.mjs"
import { SPLIT_SIM_STUDY_ETFS, SMALL_SAMPLE_N } from "./daily-bottom-entry-outcome-analysis.mjs"
import {
  analyzeEntryPath,
  computeExpectancy,
  split5050ReturnAt,
  MAX_HORIZON,
} from "./daily-bottom-profit-loss-validation.mjs"

export { SPLIT_SIM_STUDY_ETFS, SMALL_SAMPLE_N, FROZEN_THRESHOLDS }

/** Observation bands only — NOT candidate new thresholds / NOT optimized. */
export const STRENGTH_BANDS = {
  rsi: [
    { id: "near_36", label: "RSI near ≤36 (30 < rsi ≤ 36)", pred: (v) => v != null && v > 30 && v <= 36 },
    { id: "le_30", label: "RSI ≤ 30", pred: (v) => v != null && v <= 30 },
    { id: "le_25", label: "RSI ≤ 25", pred: (v) => v != null && v <= 25 },
  ],
  stoch: [
    { id: "near_15_4", label: "Stoch near ≤15.4 (10 < k ≤ 15.4)", pred: (v) => v != null && v > 10 && v <= 15.4 },
    { id: "le_10", label: "Stoch ≤ 10", pred: (v) => v != null && v <= 10 },
    { id: "le_5", label: "Stoch ≤ 5", pred: (v) => v != null && v <= 5 },
  ],
  bb: [
    { id: "near_0_01", label: "BB%B near ≤0.01 (0 < bb ≤ 0.01)", pred: (v) => v != null && v > 0 && v <= 0.01 },
    { id: "le_0", label: "BB%B ≤ 0", pred: (v) => v != null && v <= 0 },
    { id: "le_neg_0_05", label: "BB%B ≤ -0.05", pred: (v) => v != null && v <= -0.05 },
  ],
  ma: [
    { id: "near_neg_4_2", label: "MA20 near ≤-4.2% (-6 < ma ≤ -4.2)", pred: (v) => v != null && v > -6 && v <= -4.2 },
    { id: "le_neg_6", label: "MA20 ≤ -6%", pred: (v) => v != null && v <= -6 },
    { id: "le_neg_8", label: "MA20 ≤ -8%", pred: (v) => v != null && v <= -8 },
  ],
}

export const PAIR_COMBOS = [
  { id: "rsi_stoch", keys: ["rsi", "stoch"] },
  { id: "rsi_bb", keys: ["rsi", "bb"] },
  { id: "rsi_ma", keys: ["rsi", "ma"] },
  { id: "stoch_bb", keys: ["stoch", "bb"] },
  { id: "stoch_ma", keys: ["stoch", "ma"] },
  { id: "bb_ma", keys: ["bb", "ma"] },
]

export const TRIPLE_COMBOS = [
  { id: "rsi_stoch_bb", keys: ["rsi", "stoch", "bb"] },
  { id: "rsi_stoch_ma", keys: ["rsi", "stoch", "ma"] },
  { id: "rsi_bb_ma", keys: ["rsi", "bb", "ma"] },
  { id: "stoch_bb_ma", keys: ["stoch", "bb", "ma"] },
]

export const COMBO_MIN_N = 8

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function fwdVals(outcomes, h) {
  return outcomes
    .map((o) => o.path?.forwardRet?.[h])
    .filter((v) => v != null && Number.isFinite(v))
}

function hitRate(outcomes, target) {
  const n = outcomes.length
  if (!n) return null
  const hits = outcomes.filter((o) => o.path?.hitUp?.[target]).length
  return round2((hits / n) * 100)
}

function maeRate(outcomes, th) {
  const xs = outcomes.map((o) => o.path?.maePct).filter((v) => v != null)
  if (!xs.length) return null
  return round2((xs.filter((v) => v >= th).length / xs.length) * 100)
}

/**
 * Distribution + expectancy + trimmed variants for one return series.
 */
export function analyzeReturnDistribution(vals) {
  const xs = vals.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b)
  const base = summarizeNumeric(xs)
  const exp = computeExpectancy(xs)
  const n = xs.length
  if (!n) {
    return {
      n: 0,
      mean: null,
      median: null,
      positivePct: null,
      negativePct: null,
      worst: null,
      best: null,
      percentiles: { p10: null, p25: null, p50: null, p75: null, p90: null },
      expectancy: null,
      payoffRatio: null,
      avgWin: null,
      avgLoss: null,
      trimmed: null,
    }
  }
  const pos = xs.filter((v) => v > 0).length
  const neg = xs.filter((v) => v < 0).length

  function dropTopFrac(frac) {
    const k = Math.floor(n * frac)
    if (k <= 0) return computeExpectancy(xs)
    return computeExpectancy(xs.slice(0, n - k))
  }
  function dropBottomFrac(frac) {
    const k = Math.floor(n * frac)
    if (k <= 0) return computeExpectancy(xs)
    return computeExpectancy(xs.slice(k))
  }
  function trimBoth(frac) {
    const k = Math.floor(n * frac)
    if (k <= 0) return computeExpectancy(xs)
    const trimmed = xs.slice(k, n - k)
    return {
      ...computeExpectancy(trimmed),
      nKept: trimmed.length,
      nDroppedEachTail: k,
    }
  }

  return {
    n,
    mean: base.mean,
    median: base.median,
    positivePct: round2((pos / n) * 100),
    negativePct: round2((neg / n) * 100),
    worst: base.min,
    best: base.max,
    percentiles: {
      p10: base.p10,
      p25: base.p25,
      p50: base.median,
      p75: base.p75,
      p90: base.p90,
    },
    avgWin: exp.avgWin,
    avgLoss: exp.avgLoss,
    expectancy: exp.expectancy,
    payoffRatio: exp.payoffRatio,
    winRate: exp.winRate,
    lossRate: exp.lossRate,
    variants: {
      A_full: { label: "all episodes", ...exp },
      B_dropTop10pct: { label: "exclude top 10% returns", ...dropTopFrac(0.1) },
      C_dropTop20pct: { label: "exclude top 20% returns", ...dropTopFrac(0.2) },
      D_dropBottom10pct: { label: "exclude bottom 10% returns", ...dropBottomFrac(0.1) },
      E_trim10pctEach: { label: "trim 10% each tail", ...trimBoth(0.1) },
    },
  }
}

function flagsMatch(flags, keys) {
  return keys.every((k) => flags[k] === true)
}

function sampleLabel(n) {
  if (n < SMALL_SAMPLE_N) return "small sample"
  if (n < 16) return "표본 제한"
  return "표본 충분"
}

/**
 * @param {{symbol:string, theme?:string}} meta
 * @param {any[]} bars
 */
export function analyzeEtfDiagnostic(meta, bars) {
  const enriched = enrichBarsWithIndicators(bars)
  const split = timeSplitBars(enriched, TRAIN_RATIO)
  const episodes = buildSplitBuyEpisodes(enriched, FROZEN_THRESHOLDS, {
    fromIdx: split.splitIdx,
    toIdx: enriched.length,
  })

  const outcomes = episodes.map((ep) => {
    const row = enriched[ep.openIdx]
    const flags = conditionFlags(row, FROZEN_THRESHOLDS)
    const path = analyzeEntryPath(enriched, ep.openIdx, ep.openPrice, MAX_HORIZON)
    /** @type {Record<number, ReturnType<typeof split5050ReturnAt>>} */
    const splitFwd = {}
    for (const h of [20, 40, 60]) {
      splitFwd[h] = split5050ReturnAt(enriched, ep, h)
    }
    let after4Mae = null
    if (ep.reached4 && ep.fill4Idx != null && ep.fill4Price > 0) {
      const p4 = analyzeEntryPath(enriched, ep.fill4Idx, ep.fill4Price, MAX_HORIZON)
      after4Mae = p4?.maePct ?? null
    }
    return {
      symbol: meta.symbol,
      openDate: ep.openDate,
      openPrice: ep.openPrice,
      openIdx: ep.openIdx,
      openCount: ep.openCount,
      reached4: ep.reached4,
      fill4Date: ep.fill4Date,
      fill4Price: ep.fill4Price,
      fill4Idx: ep.fill4Idx,
      daysTo4: ep.daysTo4,
      indicators: {
        rsi14: row.rsi14 ?? null,
        stochK: row.stochK ?? null,
        bbPctB: row.bbPctB ?? null,
        ma20DevPct: row.ma20DevPct ?? null,
      },
      flags,
      path,
      splitFwd,
      after4Mae,
    }
  })

  return {
    symbol: meta.symbol,
    theme: meta.theme || "",
    split,
    episodeDef: EPISODE_DEF,
    thresholds: FROZEN_THRESHOLDS,
    episodeCount: outcomes.length,
    reached4Count: outcomes.filter((o) => o.reached4).length,
    outcomes,
  }
}

function comboPerf(outcomes, id, keys) {
  const matched = outcomes.filter((o) => flagsMatch(o.flags, keys))
  const n = matched.length
  const d20 = fwdVals(matched, 20)
  const d60 = fwdVals(matched, 60)
  const mae = matched.map((o) => o.path?.maePct).filter((v) => v != null)
  return {
    id,
    keys,
    n,
    smallSample: n < COMBO_MIN_N,
    sampleNote: n < COMBO_MIN_N ? "small sample — no statistical conclusion" : null,
    d20Median: summarizeNumeric(d20).median,
    d20Mean: summarizeNumeric(d20).mean,
    d60Median: summarizeNumeric(d60).median,
    d60Mean: summarizeNumeric(d60).mean,
    reachPlus5: hitRate(matched, 5),
    reachPlus10: hitRate(matched, 10),
    maeMedian: summarizeNumeric(mae).median,
    maeGe10Pct: maeRate(matched, 10),
  }
}

function conditionPresenceStats(outcomes) {
  const keys = ["rsi", "stoch", "bb", "ma"]
  /** @type {Record<string, any>} */
  const out = {}
  for (const k of keys) {
    const alone = outcomes.filter(
      (o) => o.flags[k] && keys.filter((x) => o.flags[x]).length === 1,
    )
    const withOthers = outcomes.filter(
      (o) => o.flags[k] && keys.filter((x) => o.flags[x]).length >= 2,
    )
    const at3 = outcomes.filter((o) => o.flags[k] && o.openCount >= 3)
    const at4 = outcomes.filter((o) => o.reached4 && o.flags[k])
    const d20 = fwdVals(at3, 20)
    const d60 = fwdVals(at3, 60)
    out[k] = {
      nFlagTrueAtEntry: outcomes.filter((o) => o.flags[k]).length,
      nAloneAtEntry: alone.length,
      nWithOthersAtEntry: withOthers.length,
      nAt3Entry: at3.length,
      nAmongReached4: at4.length,
      d20: summarizeNumeric(d20),
      d60: summarizeNumeric(d60),
      d20Expectancy: computeExpectancy(d20).expectancy,
      d60Expectancy: computeExpectancy(d60).expectancy,
    }
  }
  return out
}

function strengthBandStats(outcomes) {
  /** @type {Record<string, any>} */
  const result = {}
  for (const [name, bands] of Object.entries(STRENGTH_BANDS)) {
    const field =
      name === "rsi"
        ? "rsi14"
        : name === "stoch"
          ? "stochK"
          : name === "bb"
            ? "bbPctB"
            : "ma20DevPct"
    result[name] = bands.map((band) => {
      const matched = outcomes.filter((o) => band.pred(o.indicators[field]))
      const d20 = fwdVals(matched, 20)
      const d60 = fwdVals(matched, 60)
      return {
        id: band.id,
        label: band.label,
        n: matched.length,
        smallSample: matched.length < COMBO_MIN_N,
        d20Median: summarizeNumeric(d20).median,
        d20Mean: summarizeNumeric(d20).mean,
        d60Median: summarizeNumeric(d60).median,
        d60Mean: summarizeNumeric(d60).mean,
        maeMedian: summarizeNumeric(matched.map((o) => o.path?.maePct).filter((v) => v != null)).median,
        maeGe10Pct: maeRate(matched, 10),
        note: "observation band only — not a new threshold",
      }
    })
  }
  return result
}

function etfSummary(e, pooled) {
  const oo = e.outcomes
  const n = oo.length
  const d20 = fwdVals(oo, 20)
  const d60 = fwdVals(oo, 60)
  const exp60 = computeExpectancy(d60)
  const mae = oo.map((o) => o.path?.maePct).filter((v) => v != null)
  const split60 = oo
    .map((o) => o.splitFwd?.[60]?.retPct)
    .filter((v) => v != null && Number.isFinite(v))
  const after4Weak = oo.filter(
    (o) =>
      o.reached4 &&
      ((o.after4Mae != null && o.after4Mae >= 10) ||
        (o.path?.forwardAvailable?.[60] &&
          o.path.forwardRet[60] != null &&
          o.path.forwardRet[60] < 0)),
  )
  const label = sampleLabel(n)
  return {
    symbol: e.symbol,
    n,
    sampleStatus: label,
    smallSample: n < SMALL_SAMPLE_N,
    reached4Pct: n ? round2((e.reached4Count / n) * 100) : null,
    d20Median: summarizeNumeric(d20).median,
    d20Mean: summarizeNumeric(d20).mean,
    d60Median: summarizeNumeric(d60).median,
    d60Mean: summarizeNumeric(d60).mean,
    d60PositivePct: d60.length
      ? round2((d60.filter((v) => v > 0).length / d60.length) * 100)
      : null,
    d60Expectancy: exp60.expectancy,
    payoffRatio: exp60.payoffRatio,
    reachPlus5: hitRate(oo, 5),
    reachPlus10: hitRate(oo, 10),
    maeMedian: summarizeNumeric(mae).median,
    maeGe10Pct: maeRate(oo, 10),
    maeGe20Pct: maeRate(oo, 20),
    split5050D60Expectancy: computeExpectancy(split60).expectancy,
    vsPool: {
      d60MedianDelta:
        pooled.d60Median != null && summarizeNumeric(d60).median != null
          ? round2(summarizeNumeric(d60).median - pooled.d60Median)
          : null,
      d60ExpectancyDelta:
        pooled.d60Expectancy != null && exp60.expectancy != null
          ? round2(exp60.expectancy - pooled.d60Expectancy)
          : null,
      reachPlus5Delta:
        pooled.reachPlus5 != null && hitRate(oo, 5) != null
          ? round2(hitRate(oo, 5) - pooled.reachPlus5)
          : null,
      maeGe10Delta:
        pooled.maeGe10Pct != null && maeRate(oo, 10) != null
          ? round2(maeRate(oo, 10) - pooled.maeGe10Pct)
          : null,
    },
    conditionPresence: conditionPresenceStats(oo),
    after4WeakCount: after4Weak.length,
    after4WeakPct: e.reached4Count
      ? round2((after4Weak.length / e.reached4Count) * 100)
      : null,
  }
}

/**
 * Flag ETFs for further review only (no removal recommendation).
 */
export function findFurtherReviewCandidates(etfRows, pooled) {
  const sufficient = etfRows.filter((e) => !e.smallSample)
  const A = sufficient
    .filter((e) => e.d60Median != null && pooled.d60Median != null && e.d60Median < pooled.d60Median - 3)
    .map((e) => ({
      symbol: e.symbol,
      reason: "A",
      detail: `D+60 median ${e.d60Median}% vs pool ${pooled.d60Median}% (n=${e.n})`,
      label: "추가 검증 우선 대상",
    }))
  const B = sufficient
    .filter(
      (e) =>
        e.d60Expectancy != null &&
        (e.d60Expectancy < 0 ||
          (pooled.d60Expectancy != null && e.d60Expectancy < pooled.d60Expectancy * 0.4)),
    )
    .map((e) => ({
      symbol: e.symbol,
      reason: "B",
      detail: `D+60 expectancy ${e.d60Expectancy}% vs pool ${pooled.d60Expectancy}% (n=${e.n})`,
      label: "추가 검증 우선 대상",
    }))
  const C = sufficient
    .filter(
      (e) =>
        e.reachPlus5 != null &&
        pooled.reachPlus5 != null &&
        e.reachPlus5 < pooled.reachPlus5 - 15,
    )
    .map((e) => ({
      symbol: e.symbol,
      reason: "C",
      detail: `+5% reach ${e.reachPlus5}% vs pool ${pooled.reachPlus5}% (n=${e.n})`,
      label: "추가 검증 우선 대상",
    }))
  const D = sufficient
    .filter(
      (e) =>
        e.maeGe10Pct != null &&
        pooled.maeGe10Pct != null &&
        e.maeGe10Pct > pooled.maeGe10Pct + 10,
    )
    .map((e) => ({
      symbol: e.symbol,
      reason: "D",
      detail: `MAE≥10% ${e.maeGe10Pct}% vs pool ${pooled.maeGe10Pct}% (n=${e.n})`,
      label: "추가 검증 우선 대상",
    }))
  const E = sufficient
    .filter((e) => e.after4WeakPct != null && e.after4WeakPct >= 40 && e.reached4Pct != null)
    .map((e) => ({
      symbol: e.symbol,
      reason: "E",
      detail: `after4 weak ${e.after4WeakPct}% of reached4 (n=${e.n}, reached4Pct=${e.reached4Pct})`,
      label: "추가 검증 우선 대상",
    }))
  // F: structure differs — large gap on both reach and MAE or expectancy
  const F = sufficient
    .filter((e) => {
      const r5 = e.vsPool?.reachPlus5Delta
      const mae = e.vsPool?.maeGe10Delta
      const exp = e.vsPool?.d60ExpectancyDelta
      return (
        (r5 != null && Math.abs(r5) >= 20) ||
        (mae != null && Math.abs(mae) >= 15) ||
        (exp != null && Math.abs(exp) >= 8)
      )
    })
    .map((e) => ({
      symbol: e.symbol,
      reason: "F",
      detail: `structure deltas reach+5=${e.vsPool.reachPlus5Delta} mae≥10=${e.vsPool.maeGe10Delta} d60E=${e.vsPool.d60ExpectancyDelta}`,
      label: "추가 검증 우선 대상",
    }))

  return { A, B, C, D, E, F }
}

/**
 * Condition-refinement diagnostic observations (no threshold change).
 */
export function conditionRefinementObservations(outcomes, comboRows) {
  const notes = []
  const largeCombos = comboRows.filter((c) => !c.smallSample && c.n >= COMBO_MIN_N)
  if (largeCombos.length >= 2) {
    const byD60 = [...largeCombos].sort(
      (a, b) => (b.d60Median ?? -999) - (a.d60Median ?? -999),
    )
    const hi = byD60[0]
    const lo = byD60[byD60.length - 1]
    if (hi && lo && hi.d60Median != null && lo.d60Median != null) {
      notes.push({
        type: "combo_spread",
        detail: `Among combos with n≥${COMBO_MIN_N}: highest D+60 median ${hi.id}=${hi.d60Median}% (n=${hi.n}) vs lowest ${lo.id}=${lo.d60Median}% (n=${lo.n}). Observation only.`,
      })
    }
  }

  const after4Deep = outcomes.filter((o) => o.reached4 && (o.after4Mae ?? 0) >= 10)
  notes.push({
    type: "after4_deep_drop",
    n: after4Deep.length,
    detail: `4/4 then MAE≥10% after 4/4 price: ${after4Deep.length} episodes (observation).`,
    examples: after4Deep.slice(0, 8).map((o) => ({
      symbol: o.symbol,
      openDate: o.openDate,
      after4Mae: o.after4Mae,
      flags: o.flags,
      indicators: o.indicators,
    })),
  })

  // Same openCount=3 but indicator strength spread
  const count3 = outcomes.filter((o) => o.openCount === 3)
  if (count3.length) {
    const rsi = count3.map((o) => o.indicators.rsi14).filter((v) => v != null)
    notes.push({
      type: "same_count_indicator_spread",
      n: count3.length,
      rsi: summarizeNumeric(rsi),
      stoch: summarizeNumeric(count3.map((o) => o.indicators.stochK).filter((v) => v != null)),
      bb: summarizeNumeric(count3.map((o) => o.indicators.bbPctB).filter((v) => v != null)),
      ma: summarizeNumeric(count3.map((o) => o.indicators.ma20DevPct).filter((v) => v != null)),
      detail:
        "Among openCount=3 entries, indicator levels still vary widely — candidate for future strength banding study (not applied now).",
    })
  }

  return notes
}

/**
 * @param {ReturnType<typeof analyzeEtfDiagnostic>[]} etfResults
 */
export function poolDiagnostic(etfResults) {
  const outcomes = etfResults.flatMap((e) => e.outcomes)
  const n = outcomes.length

  const dist = {
    d20: analyzeReturnDistribution(fwdVals(outcomes, 20)),
    d40: analyzeReturnDistribution(fwdVals(outcomes, 40)),
    d60: analyzeReturnDistribution(fwdVals(outcomes, 60)),
  }

  const poolMeta = {
    d60Median: dist.d60.median,
    d60Expectancy: dist.d60.expectancy,
    reachPlus5: hitRate(outcomes, 5),
    maeGe10Pct: maeRate(outcomes, 10),
  }

  const etfTable = etfResults.map((e) => etfSummary(e, poolMeta))

  const allCombos = [
    ...PAIR_COMBOS.map((c) => comboPerf(outcomes, c.id, c.keys)),
    ...TRIPLE_COMBOS.map((c) => comboPerf(outcomes, c.id, c.keys)),
    comboPerf(outcomes, "all4", ["rsi", "stoch", "bb", "ma"]),
  ]

  const conditionStats = conditionPresenceStats(outcomes)
  const strength = strengthBandStats(outcomes)
  const furtherReview = findFurtherReviewCandidates(etfTable, poolMeta)
  const refinement = conditionRefinementObservations(outcomes, allCombos)

  // Per-ETF combo spotlight (only n>=5)
  const etfComboNotes = etfResults.map((e) => {
    const combos = PAIR_COMBOS.map((c) => comboPerf(e.outcomes, c.id, c.keys)).filter(
      (c) => c.n >= 5,
    )
    return {
      symbol: e.symbol,
      n: e.episodeCount,
      smallSample: e.episodeCount < SMALL_SAMPLE_N,
      combos,
    }
  })

  return {
    n,
    nReached4: outcomes.filter((o) => o.reached4).length,
    nFullHorizon60: outcomes.filter((o) => o.path?.fullHorizon60).length,
    nOpenCount3: outcomes.filter((o) => o.openCount === 3).length,
    nOpenCount4: outcomes.filter((o) => o.openCount >= 4).length,
    distribution: dist,
    etfTable,
    conditionStats,
    combos: allCombos,
    strengthBands: strength,
    furtherReview,
    refinementObservations: refinement,
    etfComboNotes,
    overfitGuard: {
      thresholdsOptimized: false,
      etfSpecificThresholds: false,
      gridSearchPerformed: false,
      note: "Frozen thresholds observed only. Any future threshold change requires separate Train/Test or OOS study.",
    },
  }
}
