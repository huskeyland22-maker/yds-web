/**
 * Daily Bottom Buy — profit/loss structure validation (research only).
 * Same Test episodes as split-sim / entry-outcome (10-ETF historical validation universe).
 * Does not change strategy, thresholds, product universe, UI, or API.
 */

import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import { TRAIN_RATIO, summarizeNumeric, timeSplitBars } from "./daily-bottom-buy-validation-core.mjs"
import {
  EPISODE_DEF,
  FROZEN_THRESHOLDS,
  buildSplitBuyEpisodes,
} from "./daily-bottom-split-buy-sim.mjs"
import { SPLIT_SIM_STUDY_ETFS, SMALL_SAMPLE_N } from "./daily-bottom-entry-outcome-analysis.mjs"

export { SPLIT_SIM_STUDY_ETFS, SMALL_SAMPLE_N }

export const UP_TARGETS = [3, 5, 10, 15, 20]
export const DOWN_TARGETS = [3, 5, 10, 15, 20, 30]
export const FORWARD_DAYS = [5, 10, 20, 40, 60]
export const MAE_MFE_THRESHOLDS = [5, 10, 15, 20]
export const MAX_HORIZON = 60

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function round4(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 10000) / 10000
}

/**
 * Price-path metrics from 3/4 entry (up to maxHorizon trading days).
 */
export function analyzeEntryPath(enriched, entryIdx, entryPrice, maxHorizon = MAX_HORIZON) {
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
  const daysToUp = {}
  /** @type {Record<number, boolean>} */
  const hitUp = {}
  for (const t of UP_TARGETS) {
    daysToUp[t] = null
    hitUp[t] = false
  }
  /** @type {Record<number, number|null>} */
  const daysToDown = {}
  /** @type {Record<number, boolean>} */
  const hitDown = {}
  for (const t of DOWN_TARGETS) {
    daysToDown[t] = null
    hitDown[t] = false
  }

  let minClose = entryPrice
  let maxClose = entryPrice
  let maeDays = 0
  let mfeDays = 0
  let maePct = 0
  let mfePct = 0

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
    if (px > maxClose) {
      maxClose = px
      mfeDays = days
      mfePct = ((maxClose - entryPrice) / entryPrice) * 100
    }

    for (const t of UP_TARGETS) {
      if (!hitUp[t] && ret >= t) {
        hitUp[t] = true
        daysToUp[t] = days
      }
    }
    for (const t of DOWN_TARGETS) {
      if (!hitDown[t] && ret <= -t) {
        hitDown[t] = true
        daysToDown[t] = days
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
    fullHorizon60: available >= maxHorizon,
    daysToUp,
    hitUp,
    daysToDown,
    hitDown,
    maePct: round2(maePct),
    maeDays,
    mfePct: round2(mfePct),
    mfeDays,
    minClose: round2(minClose),
    maxClose: round2(maxClose),
    forwardRet,
    forwardAvailable,
  }
}

/**
 * 50/50 NAV return at openIdx + horizon (percent).
 * No 4/4: NAV = 0.5*(px/P3) + 0.5
 * With 4/4 (fill on or before horizon day): NAV = 0.5*(px/P3) + 0.5*(px/P4)
 */
export function split5050ReturnAt(enriched, ep, horizon) {
  const lastIdx = enriched.length - 1
  const idx = ep.openIdx + horizon
  if (idx > lastIdx) return { available: false, retPct: null, nav: null, deployed4: false }
  const px = enriched[idx].close
  if (!(px > 0) || !(ep.openPrice > 0)) {
    return { available: false, retPct: null, nav: null, deployed4: false }
  }
  const deployed4 =
    ep.reached4 &&
    ep.fill4Idx != null &&
    ep.fill4Price > 0 &&
    ep.fill4Idx <= idx
  let nav
  if (deployed4) {
    nav = 0.5 * (px / ep.openPrice) + 0.5 * (px / ep.fill4Price)
  } else {
    nav = 0.5 * (px / ep.openPrice) + 0.5
  }
  return {
    available: true,
    retPct: round2((nav - 1) * 100),
    nav: round4(nav),
    deployed4,
  }
}

/**
 * Scan 50/50 NAV path for first hit of +targetPct within maxHorizon.
 */
export function split5050HitTarget(enriched, ep, targetPct, maxHorizon = MAX_HORIZON) {
  const lastIdx = enriched.length - 1
  const scanEnd = Math.min(lastIdx, ep.openIdx + maxHorizon)
  for (let j = ep.openIdx + 1; j <= scanEnd; j++) {
    const h = j - ep.openIdx
    const r = split5050ReturnAt(enriched, ep, h)
    if (r.available && r.retPct != null && r.retPct >= targetPct) {
      return { hit: true, days: h }
    }
  }
  return { hit: false, days: null }
}

export function summarizeLevelReach(outcomes, side, level) {
  const n = outcomes.length
  const hits = outcomes.filter((o) =>
    side === "up" ? o.path?.hitUp?.[level] : o.path?.hitDown?.[level],
  )
  const days = hits
    .map((o) => (side === "up" ? o.path.daysToUp[level] : o.path.daysToDown[level]))
    .filter((d) => d != null)
  return {
    level: side === "up" ? `+${level}%` : `-${level}%`,
    nHit: hits.length,
    hitRate: n ? round2((hits.length / n) * 100) : null,
    nMiss: n - hits.length,
    daysAmongHits: summarizeNumeric(days),
  }
}

export function summarizeForwardReturns(vals) {
  const xs = vals.filter((v) => Number.isFinite(v))
  if (!xs.length) {
    return {
      n: 0,
      median: null,
      mean: null,
      positivePct: null,
      negativePct: null,
      worst: null,
      best: null,
    }
  }
  const pos = xs.filter((v) => v > 0).length
  const neg = xs.filter((v) => v < 0).length
  const base = summarizeNumeric(xs)
  return {
    n: xs.length,
    median: base.median,
    mean: base.mean,
    positivePct: round2((pos / xs.length) * 100),
    negativePct: round2((neg / xs.length) * 100),
    worst: base.min,
    best: base.max,
  }
}

/**
 * Win/loss payoff & expectancy (returns in percent).
 */
export function computeExpectancy(vals) {
  const xs = vals.filter((v) => Number.isFinite(v))
  if (!xs.length) {
    return {
      n: 0,
      winRate: null,
      lossRate: null,
      avgWin: null,
      avgLoss: null,
      medianWin: null,
      medianLoss: null,
      payoffRatio: null,
      expectancy: null,
      expectancySign: null,
    }
  }
  const wins = xs.filter((v) => v > 0)
  const losses = xs.filter((v) => v < 0)
  const winRate = wins.length / xs.length
  const lossRate = losses.length / xs.length
  const avgWin = wins.length ? wins.reduce((s, v) => s + v, 0) / wins.length : null
  const avgLoss = losses.length ? losses.reduce((s, v) => s + v, 0) / losses.length : null
  const absAvgLoss = avgLoss != null ? Math.abs(avgLoss) : null
  const payoffRatio =
    avgWin != null && absAvgLoss != null && absAvgLoss > 0 ? avgWin / absAvgLoss : null
  const expectancy =
    avgWin != null && absAvgLoss != null
      ? winRate * avgWin - lossRate * absAvgLoss
      : avgWin != null
        ? winRate * avgWin
        : absAvgLoss != null
          ? -lossRate * absAvgLoss
          : 0
  const medWin = summarizeNumeric(wins).median
  const medLoss = summarizeNumeric(losses).median
  return {
    n: xs.length,
    winRate: round2(winRate * 100),
    lossRate: round2(lossRate * 100),
    avgWin: round2(avgWin),
    avgLoss: round2(avgLoss),
    medianWin: medWin,
    medianLoss: medLoss,
    payoffRatio: round4(payoffRatio),
    expectancy: round2(expectancy),
    expectancySign: expectancy > 0 ? "positive" : expectancy < 0 ? "negative" : "zero",
  }
}

/**
 * @param {{symbol:string, theme?:string}} meta
 * @param {any[]} bars
 */
export function analyzeEtfProfitLoss(meta, bars) {
  const enriched = enrichBarsWithIndicators(bars)
  const split = timeSplitBars(enriched, TRAIN_RATIO)
  const episodes = buildSplitBuyEpisodes(enriched, FROZEN_THRESHOLDS, {
    fromIdx: split.splitIdx,
    toIdx: enriched.length,
  })

  const outcomes = episodes.map((ep) => {
    const path = analyzeEntryPath(enriched, ep.openIdx, ep.openPrice, MAX_HORIZON)
    /** @type {Record<number, ReturnType<typeof split5050ReturnAt>>} */
    const splitFwd = {}
    for (const h of FORWARD_DAYS) {
      splitFwd[h] = split5050ReturnAt(enriched, ep, h)
    }
    const hit5 = split5050HitTarget(enriched, ep, 5)
    const hit10 = split5050HitTarget(enriched, ep, 10)
    return {
      symbol: meta.symbol,
      openDate: ep.openDate,
      openPrice: ep.openPrice,
      openIdx: ep.openIdx,
      reached4: ep.reached4,
      fill4Date: ep.fill4Date,
      fill4Price: ep.fill4Price,
      fill4Idx: ep.fill4Idx,
      daysTo4: ep.daysTo4,
      path,
      splitFwd,
      splitHitPlus5Within60: hit5,
      splitHitPlus10Within60: hit10,
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

function caseRow(o) {
  const p = o.path
  return {
    ticker: o.symbol,
    entryDate: o.openDate,
    entryPrice: o.openPrice,
    reached4: o.reached4,
    fill4Date: o.fill4Date,
    fill4Price: o.fill4Price,
    maePct: p?.maePct ?? null,
    maeDays: p?.maeDays ?? null,
    mfePct: p?.mfePct ?? null,
    d20: p?.forwardRet?.[20] ?? null,
    d40: p?.forwardRet?.[40] ?? null,
    d60: p?.forwardRet?.[60] ?? null,
    hitPlus3: p?.hitUp?.[3] ?? false,
    hitPlus5: p?.hitUp?.[5] ?? false,
    hitPlus10: p?.hitUp?.[10] ?? false,
    splitD20: o.splitFwd?.[20]?.retPct ?? null,
    splitD40: o.splitFwd?.[40]?.retPct ?? null,
    splitD60: o.splitFwd?.[60]?.retPct ?? null,
  }
}

/**
 * @param {ReturnType<typeof analyzeEtfProfitLoss>[]} etfResults
 */
export function poolProfitLossValidation(etfResults) {
  const outcomes = etfResults.flatMap((e) => e.outcomes)
  const n = outcomes.length
  const paths = outcomes.map((o) => o.path).filter(Boolean)

  const upReach = {}
  for (const t of UP_TARGETS) upReach[`p${t}`] = summarizeLevelReach(outcomes, "up", t)
  const downReach = {}
  for (const t of DOWN_TARGETS) downReach[`m${t}`] = summarizeLevelReach(outcomes, "down", t)

  /** @type {Record<string, any>} */
  const forwards = {}
  for (const h of FORWARD_DAYS) {
    const vals = paths
      .filter((p) => p.forwardAvailable[h])
      .map((p) => p.forwardRet[h])
      .filter((v) => v != null)
    forwards[`d${h}`] = {
      ...summarizeForwardReturns(vals),
      nMissing: n - vals.length,
    }
  }

  const maeVals = paths.map((p) => p.maePct).filter((v) => v != null)
  const mfeVals = paths.map((p) => p.mfePct).filter((v) => v != null)
  /** @type {Record<string, number|null>} */
  const maeRates = {}
  /** @type {Record<string, number|null>} */
  const mfeRates = {}
  for (const th of MAE_MFE_THRESHOLDS) {
    maeRates[`ge${th}`] = maeVals.length
      ? round2((maeVals.filter((v) => v >= th).length / maeVals.length) * 100)
      : null
    mfeRates[`ge${th}`] = mfeVals.length
      ? round2((mfeVals.filter((v) => v >= th).length / mfeVals.length) * 100)
      : null
  }

  /** @type {Record<string, any>} */
  const singleExpectancy = {}
  for (const h of [20, 40, 60]) {
    const vals = paths
      .filter((p) => p.forwardAvailable[h])
      .map((p) => p.forwardRet[h])
      .filter((v) => v != null)
    singleExpectancy[`d${h}`] = computeExpectancy(vals)
  }

  /** @type {Record<string, any>} */
  const splitReturns = {}
  /** @type {Record<string, any>} */
  const splitStructure = {}
  for (const h of [20, 40, 60]) {
    const rows = outcomes
      .map((o) => o.splitFwd[h])
      .filter((r) => r?.available && r.retPct != null)
    const vals = rows.map((r) => r.retPct)
    splitReturns[`d${h}`] = {
      ...summarizeForwardReturns(vals),
      nMissing: n - vals.length,
    }
    const exp = computeExpectancy(vals)
    const worstCase = [...outcomes]
      .filter((o) => o.splitFwd[h]?.available && o.splitFwd[h].retPct != null)
      .sort((a, b) => a.splitFwd[h].retPct - b.splitFwd[h].retPct)[0]
    splitStructure[`d${h}`] = {
      ...exp,
      maxLossPct: summarizeNumeric(vals).min,
      worstEpisode: worstCase ? caseRow(worstCase) : null,
      reachPlus5AtHorizon: vals.length
        ? round2((vals.filter((v) => v >= 5).length / vals.length) * 100)
        : null,
      reachPlus10AtHorizon: vals.length
        ? round2((vals.filter((v) => v >= 10).length / vals.length) * 100)
        : null,
    }
  }

  const crash = {
    A_maeGe10: outcomes.filter((o) => (o.path?.maePct ?? 0) >= 10).map(caseRow),
    B_maeGe15: outcomes.filter((o) => (o.path?.maePct ?? 0) >= 15).map(caseRow),
    C_maeGe20: outcomes.filter((o) => (o.path?.maePct ?? 0) >= 20).map(caseRow),
    D_d60LeNeg10: outcomes.filter(
      (o) => o.path?.forwardAvailable?.[60] && o.path.forwardRet[60] != null && o.path.forwardRet[60] <= -10,
    ).map(caseRow),
    E_d60LeNeg20: outcomes.filter(
      (o) => o.path?.forwardAvailable?.[60] && o.path.forwardRet[60] != null && o.path.forwardRet[60] <= -20,
    ).map(caseRow),
  }
  const after4ThenDeepDrop = outcomes
    .filter((o) => o.reached4 && (o.path?.maePct ?? 0) >= 10)
    .map(caseRow)
    .sort((a, b) => (b.maePct ?? 0) - (a.maePct ?? 0))

  const etfTable = etfResults.map((e) => {
    const oo = e.outcomes
    const pp = oo.map((o) => o.path).filter(Boolean)
    const d20 = pp.filter((p) => p.forwardAvailable[20]).map((p) => p.forwardRet[20]).filter((v) => v != null)
    const d40 = pp.filter((p) => p.forwardAvailable[40]).map((p) => p.forwardRet[40]).filter((v) => v != null)
    const d60 = pp.filter((p) => p.forwardAvailable[60]).map((p) => p.forwardRet[60]).filter((v) => v != null)
    const mae = pp.map((p) => p.maePct).filter((v) => v != null)
    const n60 = d60.length
    return {
      symbol: e.symbol,
      n: e.episodeCount,
      smallSample: e.episodeCount < SMALL_SAMPLE_N,
      reachPlus5: summarizeLevelReach(oo, "up", 5).hitRate,
      reachPlus10: summarizeLevelReach(oo, "up", 10).hitRate,
      d20Median: summarizeNumeric(d20).median,
      d40Median: summarizeNumeric(d40).median,
      d60Median: summarizeNumeric(d60).median,
      d60Mean: summarizeNumeric(d60).mean,
      d60NegativePct: n60
        ? round2((d60.filter((v) => v < 0).length / n60) * 100)
        : null,
      maeMedian: summarizeNumeric(mae).median,
      maeGe10Pct: mae.length
        ? round2((mae.filter((v) => v >= 10).length / mae.length) * 100)
        : null,
    }
  })

  const worstByD60 = [...outcomes]
    .filter((o) => o.path?.forwardAvailable?.[60] && o.path.forwardRet[60] != null)
    .sort((a, b) => a.path.forwardRet[60] - b.path.forwardRet[60])
    .slice(0, 5)
    .map(caseRow)

  const worstByMae = [...outcomes]
    .filter((o) => o.path?.maePct != null)
    .sort((a, b) => b.path.maePct - a.path.maePct)
    .slice(0, 5)
    .map(caseRow)

  const keyFive = {
    singleD20Expectancy: singleExpectancy.d20?.expectancy ?? null,
    singleD60Expectancy: singleExpectancy.d60?.expectancy ?? null,
    split5050D60Expectancy: splitStructure.d60?.expectancy ?? null,
    maeGe10Pct: maeRates.ge10 ?? null,
    maeGe20Pct: maeRates.ge20 ?? null,
  }

  return {
    n,
    nReached4: outcomes.filter((o) => o.reached4).length,
    nFullHorizon60: paths.filter((p) => p.fullHorizon60).length,
    upReach,
    downReach,
    forwards,
    maeMfe: {
      mae: {
        ...summarizeNumeric(maeVals),
        worst: maeVals.length ? round2(Math.max(...maeVals)) : null,
        rates: maeRates,
      },
      mfe: {
        ...summarizeNumeric(mfeVals),
        best: mfeVals.length ? round2(Math.max(...mfeVals)) : null,
        rates: mfeRates,
      },
    },
    singleExpectancy,
    split5050Returns: splitReturns,
    split5050Structure: splitStructure,
    crash,
    after4ThenDeepDrop,
    etfTable,
    worstByD60,
    worstByMae,
    keyFive,
    outcomesCompact: outcomes.map((o) => ({
      symbol: o.symbol,
      openDate: o.openDate,
      reached4: o.reached4,
      mae: o.path?.maePct,
      d60: o.path?.forwardRet?.[60],
      splitD60: o.splitFwd?.[60]?.retPct,
    })),
  }
}
