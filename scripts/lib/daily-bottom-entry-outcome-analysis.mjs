/**
 * Daily Bottom Buy — 3/4 entry outcome analysis (research only).
 * Uses the same episode builder as split-buy sim (rising-edge count≥3 on Test).
 * Does not change strategy thresholds, universe product rules, or UI.
 */

import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import { TRAIN_RATIO, summarizeNumeric, timeSplitBars } from "./daily-bottom-buy-validation-core.mjs"
import {
  EPISODE_DEF,
  FROZEN_THRESHOLDS,
  buildSplitBuyEpisodes,
} from "./daily-bottom-split-buy-sim.mjs"

/** ETF set used by the frozen split-sim cache (144 Test episodes). */
export const SPLIT_SIM_STUDY_ETFS = [
  { symbol: "SMH", theme: "반도체 / AI 칩" },
  { symbol: "XLK", theme: "대형 기술" },
  { symbol: "GRID", theme: "전력망" },
  { symbol: "URA", theme: "우라늄" },
  { symbol: "BOTZ", theme: "로봇" },
  { symbol: "CIBR", theme: "사이버보안" },
  { symbol: "ITA", theme: "방산" },
  { symbol: "XLF", theme: "금융" },
  { symbol: "XLY", theme: "경기소비" },
  { symbol: "XLV", theme: "헬스케어" },
]

export const TARGET_PCTS = [3, 5, 10, 15]
export const FORWARD_DAYS = [5, 10, 20, 40, 60]
export const MAE_THRESHOLDS = [5, 10, 15, 20]
export const SMALL_SAMPLE_N = 12

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

/**
 * Forward path metrics from a fixed entry close.
 * @param {{ close: number, date: string }[]} enriched
 * @param {number} entryIdx
 * @param {number} entryPrice
 * @param {number} [maxHorizon=60]
 */
export function analyzePricePathFromEntry(enriched, entryIdx, entryPrice, maxHorizon = 60) {
  if (
    !enriched?.length ||
    entryIdx == null ||
    entryIdx < 0 ||
    entryIdx >= enriched.length ||
    !(entryPrice > 0)
  ) {
    return null
  }

  const lastIdx = enriched.length - 1
  const available = lastIdx - entryIdx
  const scanEnd = Math.min(lastIdx, entryIdx + maxHorizon)

  /** @type {Record<number, number|null>} */
  const daysToTarget = {}
  /** @type {Record<number, boolean>} */
  const hitTarget = {}
  for (const t of TARGET_PCTS) {
    daysToTarget[t] = null
    hitTarget[t] = false
  }

  let minClose = entryPrice
  let maeDays = 0
  let maePct = 0

  for (let j = entryIdx + 1; j <= scanEnd; j++) {
    const px = enriched[j].close
    if (!(px > 0)) continue
    const ret = ((px - entryPrice) / entryPrice) * 100
    const days = j - entryIdx

    if (px < minClose) {
      minClose = px
      maeDays = days
      maePct = ((entryPrice - minClose) / entryPrice) * 100
    }

    for (const t of TARGET_PCTS) {
      if (!hitTarget[t] && ret >= t) {
        hitTarget[t] = true
        daysToTarget[t] = days
      }
    }
  }

  /** @type {Record<number, number|null>} */
  const forwardRet = {}
  /** @type {Record<number, boolean>} */
  const forwardAvailable = {}
  for (const h of FORWARD_DAYS) {
    const ok = entryIdx + h <= lastIdx
    forwardAvailable[h] = ok
    if (!ok) {
      forwardRet[h] = null
      continue
    }
    const px = enriched[entryIdx + h].close
    forwardRet[h] = px > 0 ? round2(((px - entryPrice) / entryPrice) * 100) : null
  }

  return {
    availableForwardDays: available,
    fullHorizon60: available >= 60,
    daysToTarget,
    hitTarget,
    maePct: round2(maePct),
    maeDays,
    minClose: round2(minClose),
    forwardRet,
    forwardAvailable,
  }
}

/**
 * @param {number[]} values
 * @param {{ requirePositive?: boolean }} [opts]
 */
export function summarizeWithHitRate(values, opts = {}) {
  const xs = values.filter((v) => Number.isFinite(v))
  const base = summarizeNumeric(xs)
  if (!xs.length) {
    return { ...base, positiveRate: null, hitRate: null }
  }
  const pos = xs.filter((v) => v > 0).length
  const hit = opts.requirePositive ? pos : xs.filter((v) => v >= 0).length
  return {
    ...base,
    positiveRate: round2((pos / xs.length) * 100),
    hitRate: round2((hit / xs.length) * 100),
  }
}

/**
 * Target reach summary: days among hits + reach rate among episodes with enough forward data.
 * @param {Array<{ daysToTarget: Record<number, number|null>, hitTarget: Record<number, boolean>, fullHorizon60: boolean, availableForwardDays: number }>} paths
 * @param {number} targetPct
 */
export function summarizeTargetReach(paths, targetPct) {
  const withAnyFwd = paths.filter((p) => p.availableForwardDays >= 1)
  const hits = withAnyFwd.filter((p) => p.hitTarget[targetPct])
  const days = hits.map((p) => p.daysToTarget[targetPct]).filter((d) => d != null)
  const fullMiss = withAnyFwd.filter((p) => p.fullHorizon60 && !p.hitTarget[targetPct])
  const truncatedMiss = withAnyFwd.filter((p) => !p.fullHorizon60 && !p.hitTarget[targetPct])
  return {
    targetPct,
    nEligible: withAnyFwd.length,
    nHit: hits.length,
    reachRate: withAnyFwd.length ? round2((hits.length / withAnyFwd.length) * 100) : null,
    daysAmongHits: summarizeNumeric(days),
    nFullHorizonMiss: fullMiss.length,
    nTruncatedWithoutHit: truncatedMiss.length,
  }
}

/**
 * @param {ReturnType<typeof enrichBarsWithIndicators>} enriched
 * @param {ReturnType<typeof buildSplitBuyEpisodes>[number]} ep
 * @param {string} symbol
 */
export function buildEpisodeOutcome(enriched, ep, symbol) {
  const from3 = analyzePricePathFromEntry(enriched, ep.openIdx, ep.openPrice, 60)
  let from4 = null
  if (ep.reached4 && ep.fill4Idx != null && ep.fill4Price > 0) {
    from4 = analyzePricePathFromEntry(enriched, ep.fill4Idx, ep.fill4Price, 60)
  }

  const continuedDropAfter4 =
    from4 != null && from4.maePct != null && from4.maePct > 0
      ? from4.maePct
      : null

  return {
    symbol,
    openDate: ep.openDate,
    openPrice: ep.openPrice,
    openIdx: ep.openIdx,
    openCount: ep.openCount,
    reached4: ep.reached4,
    fill4Date: ep.fill4Date,
    fill4Price: ep.fill4Price,
    fill4Idx: ep.fill4Idx,
    daysTo4: ep.daysTo4,
    from3,
    from4,
    continuedDropAfter4,
  }
}

/**
 * @param {{symbol:string, theme?:string}} meta
 * @param {{date:string, open:number, high:number, low:number, close:number, volume?:number}[]} bars
 */
export function analyzeEtfEntryOutcomes(meta, bars) {
  const enriched = enrichBarsWithIndicators(bars)
  const split = timeSplitBars(enriched, TRAIN_RATIO)
  const episodes = buildSplitBuyEpisodes(enriched, FROZEN_THRESHOLDS, {
    fromIdx: split.splitIdx,
    toIdx: enriched.length,
  })
  const outcomes = episodes.map((ep) => buildEpisodeOutcome(enriched, ep, meta.symbol))
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

/**
 * @param {ReturnType<typeof buildEpisodeOutcome>[]} outcomes
 */
export function poolEntryOutcomeStats(outcomes) {
  const paths3 = outcomes.map((o) => o.from3).filter(Boolean)
  const with4 = outcomes.filter((o) => o.reached4 && o.from4)

  /** @type {Record<string, any>} */
  const targets = {}
  for (const t of TARGET_PCTS) {
    targets[`p${t}`] = summarizeTargetReach(paths3, t)
  }

  /** @type {Record<string, any>} */
  const forwards = {}
  for (const h of FORWARD_DAYS) {
    const vals = paths3
      .filter((p) => p.forwardAvailable[h])
      .map((p) => p.forwardRet[h])
      .filter((v) => v != null)
    forwards[`d${h}`] = {
      ...summarizeWithHitRate(vals),
      nAvailable: paths3.filter((p) => p.forwardAvailable[h]).length,
      nMissingHorizon: paths3.length - paths3.filter((p) => p.forwardAvailable[h]).length,
    }
  }

  const maeVals = paths3.map((p) => p.maePct).filter((v) => v != null)
  /** @type {Record<string, number|null>} */
  const maeRates = {}
  for (const th of MAE_THRESHOLDS) {
    maeRates[`ge${th}`] = maeVals.length
      ? round2((maeVals.filter((v) => v >= th).length / maeVals.length) * 100)
      : null
  }

  const daysTo4 = with4.map((o) => o.daysTo4).filter((d) => d != null)
  const mae4 = with4.map((o) => o.from4.maePct).filter((v) => v != null)
  /** @type {Record<string, number|null>} */
  const mae4Rates = {}
  for (const th of MAE_THRESHOLDS) {
    mae4Rates[`ge${th}`] = mae4.length
      ? round2((mae4.filter((v) => v >= th).length / mae4.length) * 100)
      : null
  }

  const fwd4 = {}
  for (const h of [20, 40, 60]) {
    const vals = with4
      .filter((o) => o.from4.forwardAvailable[h])
      .map((o) => o.from4.forwardRet[h])
      .filter((v) => v != null)
    fwd4[`d${h}`] = {
      ...summarizeWithHitRate(vals),
      nAvailable: with4.filter((o) => o.from4.forwardAvailable[h]).length,
    }
  }

  const noPlus3In60 = outcomes.filter(
    (o) => o.from3?.fullHorizon60 && !o.from3.hitTarget[3],
  )
  const after4MaeGe10 = with4.filter((o) => (o.from4?.maePct ?? 0) >= 10)
  const after4LossD60 = with4.filter(
    (o) => o.from4?.forwardAvailable[60] && o.from4.forwardRet[60] != null && o.from4.forwardRet[60] < 0,
  )
  const continuedAfter4 = with4.filter((o) => (o.from4?.maePct ?? 0) > 0)
  const after4NoPlus3In60 = with4.filter(
    (o) => o.from4?.fullHorizon60 && !o.from4.hitTarget[3],
  )

  let worstMaeCase = null
  if (outcomes.length) {
    const sorted = [...outcomes].filter((o) => o.from3).sort(
      (a, b) => (b.from3.maePct ?? -1) - (a.from3.maePct ?? -1),
    )
    if (sorted[0]) worstMaeCase = episodeCaseRow(sorted[0])
  }

  return {
    n: outcomes.length,
    nReached4: with4.length,
    nFullHorizon60: paths3.filter((p) => p.fullHorizon60).length,
    targets,
    forwards,
    mae: {
      ...summarizeNumeric(maeVals),
      rates: maeRates,
      worst: maeVals.length ? round2(Math.max(...maeVals)) : null,
      worstCase: worstMaeCase,
    },
    after4: {
      n: with4.length,
      daysTo4: summarizeNumeric(daysTo4),
      mae: {
        ...summarizeNumeric(mae4),
        rates: mae4Rates,
        worst: mae4.length ? round2(Math.max(...mae4)) : null,
      },
      forwards: fwd4,
      continuedDropCount: continuedAfter4.length,
      continuedDropPct: with4.length
        ? round2((continuedAfter4.length / with4.length) * 100)
        : null,
      maeGe10Count: after4MaeGe10.length,
      lossAtD60Count: after4LossD60.length,
      noPlus3In60After3Count: noPlus3In60.length,
      noPlus3In60After4Count: after4NoPlus3In60.length,
      noPlus3In60After4: after4NoPlus3In60.map(episodeCaseRow),
    },
  }
}

/**
 * @param {ReturnType<typeof buildEpisodeOutcome>} o
 */
export function episodeCaseRow(o) {
  const p = o.from3
  return {
    symbol: o.symbol,
    entryDate: o.openDate,
    entryPrice: o.openPrice,
    fill4Date: o.fill4Date,
    fill4Price: o.fill4Price,
    maePct: p?.maePct ?? null,
    maeDays: p?.maeDays ?? null,
    d20: p?.forwardRet?.[20] ?? null,
    d40: p?.forwardRet?.[40] ?? null,
    d60: p?.forwardRet?.[60] ?? null,
    hitPlus3: p?.hitTarget?.[3] ?? false,
    daysToPlus3: p?.daysToTarget?.[3] ?? null,
    hitPlus5: p?.hitTarget?.[5] ?? false,
    daysToPlus5: p?.daysToTarget?.[5] ?? null,
    fullHorizon60: p?.fullHorizon60 ?? false,
    maeAfter4: o.from4?.maePct ?? null,
    d20After4: o.from4?.forwardRet?.[20] ?? null,
    d40After4: o.from4?.forwardRet?.[40] ?? null,
    d60After4: o.from4?.forwardRet?.[60] ?? null,
  }
}

/**
 * @param {ReturnType<typeof buildEpisodeOutcome>[]} outcomes
 */
export function extractWorstTails(outcomes) {
  const rows = outcomes.filter((o) => o.from3).map(episodeCaseRow)
  const byMae = [...rows].sort((a, b) => (b.maePct ?? -1) - (a.maePct ?? -1))
  const noRebound = rows.filter((r) => r.fullHorizon60 && !r.hitPlus3)
  const with4 = outcomes.filter((o) => o.reached4 && o.from4)
  const continued = with4
    .filter((o) => (o.from4.maePct ?? 0) > 0)
    .map(episodeCaseRow)
    .sort((a, b) => (b.maeAfter4 ?? -1) - (a.maeAfter4 ?? -1))
  const mae10 = with4
    .filter((o) => (o.from4.maePct ?? 0) >= 10)
    .map(episodeCaseRow)
    .sort((a, b) => (b.maeAfter4 ?? -1) - (a.maeAfter4 ?? -1))
  const loss60 = with4
    .filter(
      (o) =>
        o.from4.forwardAvailable[60] &&
        o.from4.forwardRet[60] != null &&
        o.from4.forwardRet[60] < 0,
    )
    .map(episodeCaseRow)
    .sort((a, b) => (a.d60After4 ?? 0) - (b.d60After4 ?? 0))

  return {
    A_topMaeAfter3: byMae.slice(0, 10),
    B_noPlus3In60: noRebound,
    C_continuedDropAfter4: continued,
    D_after4MaeGe10: mae10,
    E_after4LossAtD60: loss60,
  }
}

/**
 * @param {ReturnType<typeof analyzeEtfEntryOutcomes>[]} etfResults
 */
export function buildEtfSummaryTable(etfResults) {
  return etfResults.map((e) => {
    const pooled = poolEntryOutcomeStats(e.outcomes)
    const n = e.episodeCount
    return {
      symbol: e.symbol,
      n,
      smallSample: n < SMALL_SAMPLE_N,
      reachPlus5: pooled.targets.p5?.reachRate ?? null,
      reachPlus10: pooled.targets.p10?.reachRate ?? null,
      d20Median: pooled.forwards.d20?.median ?? null,
      d60Median: pooled.forwards.d60?.median ?? null,
      maeMedian: pooled.mae?.median ?? null,
      maeGe10Pct: pooled.mae?.rates?.ge10 ?? null,
      reached4Pct: n ? round2((e.reached4Count / n) * 100) : null,
      reached4Count: e.reached4Count,
    }
  })
}
