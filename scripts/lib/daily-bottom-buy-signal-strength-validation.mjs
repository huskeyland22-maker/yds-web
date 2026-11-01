/**
 * Daily Bottom Buy — signal strength validation (observation only).
 * Same 144 Test episodes + FROZEN_THRESHOLDS. No strategy / threshold changes.
 * Does NOT optimize or select new thresholds.
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
  MAX_HORIZON,
} from "./daily-bottom-profit-loss-validation.mjs"

export { SPLIT_SIM_STUDY_ETFS, SMALL_SAMPLE_N, FROZEN_THRESHOLDS }

/**
 * Reference spans for normalizing "how far past threshold" (observation only).
 * Anchored to the documented weak/strong/very-strong observation bands — NOT new rules.
 */
export const STRENGTH_REF = {
  rsi: { threshold: FROZEN_THRESHOLDS.rsiMax, veryStrong: 25 }, // span 36→25
  stoch: { threshold: FROZEN_THRESHOLDS.stochKMax, veryStrong: 5 }, // 15.4→5
  bb: { threshold: FROZEN_THRESHOLDS.bbPctBMax, veryStrong: -0.05 }, // 0.01→-0.05
  ma: { threshold: FROZEN_THRESHOLDS.ma20DevMax, veryStrong: -8 }, // -4.2→-8
}

export const FOCUS_ETFS = ["SMH", "URA", "BOTZ", "XLV"]
export const GROUP_MIN_N = 8
export const ETF_GROUP_MIN_N = 4

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function round4(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 10000) / 10000
}

/**
 * Normalized strength for one indicator: 0 at/above threshold (not met or barely),
 * 1 at/beyond veryStrong reference. Lower values = stronger for all four.
 */
export function indicatorNormalizedStrength(name, value) {
  if (value == null || !Number.isFinite(value)) return null
  const ref = STRENGTH_REF[name]
  if (!ref) return null
  const span = ref.threshold - ref.veryStrong
  if (!(span > 0)) return null
  // stronger when value is further below threshold
  const raw = ref.threshold - value
  if (raw <= 0) return 0 // not met or exactly at threshold from wrong side
  return round4(Math.min(1, Math.max(0, raw / span)))
}

/**
 * Signal Strength Score = mean of normalized strengths for flags that are true.
 * If none true, null.
 */
export function computeSignalStrengthScore(indicators, flags) {
  const parts = []
  const map = [
    ["rsi", indicators.rsi14, flags.rsi],
    ["stoch", indicators.stochK, flags.stoch],
    ["bb", indicators.bbPctB, flags.bb],
    ["ma", indicators.ma20DevPct, flags.ma],
  ]
  /** @type {Record<string, number|null>} */
  const perIndicator = {}
  for (const [name, val, on] of map) {
    const s = indicatorNormalizedStrength(name, val)
    perIndicator[name] = s
    if (on && s != null) parts.push(s)
  }
  if (!parts.length) {
    return { score: null, perIndicator, nContributing: 0 }
  }
  const score = parts.reduce((a, b) => a + b, 0) / parts.length
  return { score: round4(score), perIndicator, nContributing: parts.length }
}

/**
 * Tertile labels from scores in a cohort (mechanical; not return-optimized).
 */
export function assignTertileGroups(items, scoreKey = "score") {
  const scored = items
    .map((it, i) => ({ i, s: it[scoreKey] }))
    .filter((x) => x.s != null && Number.isFinite(x.s))
    .sort((a, b) => a.s - b.s)
  const n = scored.length
  if (!n) return items.map((it) => ({ ...it, strengthGroup: null }))

  const cuts = [
    scored[Math.max(0, Math.floor(n / 3) - 1)]?.s,
    scored[Math.max(0, Math.floor((2 * n) / 3) - 1)]?.s,
  ]
  // Use index-based tertiles for equal counts
  const groupByIndex = new Map()
  for (let rank = 0; rank < n; rank++) {
    const g = rank < Math.floor(n / 3) ? "Weak" : rank < Math.floor((2 * n) / 3) ? "Medium" : "Strong"
    groupByIndex.set(scored[rank].i, g)
  }
  return items.map((it, i) => ({
    ...it,
    strengthGroup: groupByIndex.get(i) ?? null,
    tertileCutInfo: { nScored: n, approxCuts: cuts },
  }))
}

export function pearsonCorrelation(xs, ys) {
  const pairs = []
  for (let i = 0; i < xs.length; i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) pairs.push([xs[i], ys[i]])
  }
  const n = pairs.length
  if (n < 5) return { n, r: null, note: "sample too small for correlation" }
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
  if (dx <= 0 || dy <= 0) return { n, r: null, note: "zero variance" }
  return { n, r: round4(num / Math.sqrt(dx * dy)) }
}

function fwd(path, h) {
  return path?.forwardAvailable?.[h] ? path.forwardRet?.[h] ?? null : null
}

function groupStats(rows) {
  const n = rows.length
  if (!n) {
    return {
      n: 0,
      smallSample: true,
      sampleNote: "sample too small",
    }
  }
  const horizons = [5, 10, 20, 40, 60]
  /** @type {Record<string, any>} */
  const medians = {}
  for (const h of horizons) {
    const vals = rows.map((r) => fwd(r.path, h)).filter((v) => v != null)
    medians[`d${h}Median`] = summarizeNumeric(vals).median
    medians[`d${h}N`] = vals.length
  }
  const d20 = rows.map((r) => fwd(r.path, 20)).filter((v) => v != null)
  const d60 = rows.map((r) => fwd(r.path, 60)).filter((v) => v != null)
  const mae = rows.map((r) => r.path?.maePct).filter((v) => v != null)
  const hit5 = rows.filter((r) => r.path?.hitUp?.[5]).length
  const hit10 = rows.filter((r) => r.path?.hitUp?.[10]).length
  return {
    n,
    smallSample: n < GROUP_MIN_N,
    sampleNote: n < GROUP_MIN_N ? "sample too small" : null,
    scoreMedian: summarizeNumeric(rows.map((r) => r.score).filter((v) => v != null)).median,
    scoreMean: summarizeNumeric(rows.map((r) => r.score).filter((v) => v != null)).mean,
    ...medians,
    d20Expectancy: computeExpectancy(d20).expectancy,
    d60Expectancy: computeExpectancy(d60).expectancy,
    reachPlus5: round2((hit5 / n) * 100),
    reachPlus10: round2((hit10 / n) * 100),
    maeMedian: summarizeNumeric(mae).median,
    maeGe10Pct: mae.length
      ? round2((mae.filter((v) => v >= 10).length / mae.length) * 100)
      : null,
    maeGe20Pct: mae.length
      ? round2((mae.filter((v) => v >= 20).length / mae.length) * 100)
      : null,
  }
}

function scoreBuckets(rows, edges = [0, 0.25, 0.5, 0.75, 1.01]) {
  const labels = ["0-0.25", "0.25-0.50", "0.50-0.75", "0.75-1.00"]
  return labels.map((label, i) => {
    const lo = edges[i]
    const hi = edges[i + 1]
    const subset = rows.filter((r) => r.score != null && r.score >= lo && r.score < hi)
    const d20 = subset.map((r) => fwd(r.path, 20)).filter((v) => v != null)
    const d60 = subset.map((r) => fwd(r.path, 60)).filter((v) => v != null)
    return {
      bucket: label,
      n: subset.length,
      smallSample: subset.length < GROUP_MIN_N,
      d20Median: summarizeNumeric(d20).median,
      d60Median: summarizeNumeric(d60).median,
      d20Expectancy: computeExpectancy(d20).expectancy,
      d60Expectancy: computeExpectancy(d60).expectancy,
      maeMedian: summarizeNumeric(subset.map((r) => r.path?.maePct).filter((v) => v != null))
        .median,
    }
  })
}

function caseRow(r) {
  return {
    symbol: r.symbol,
    date: r.openDate,
    entryPrice: r.openPrice,
    reached4: r.reached4,
    fill4Date: r.fill4Date,
    openCount: r.openCount,
    indicators: r.indicators,
    flags: r.flags,
    score: r.score,
    strengthGroup: r.strengthGroup,
    perIndicator: r.perIndicator,
    maePct: r.path?.maePct ?? null,
    d20: fwd(r.path, 20),
    d40: fwd(r.path, 40),
    d60: fwd(r.path, 60),
  }
}

/**
 * @param {{symbol:string, theme?:string}} meta
 * @param {any[]} bars
 */
export function analyzeEtfSignalStrength(meta, bars) {
  const enriched = enrichBarsWithIndicators(bars)
  const split = timeSplitBars(enriched, TRAIN_RATIO)
  const episodes = buildSplitBuyEpisodes(enriched, FROZEN_THRESHOLDS, {
    fromIdx: split.splitIdx,
    toIdx: enriched.length,
  })

  const outcomes = episodes.map((ep) => {
    const row3 = enriched[ep.openIdx]
    const flags3 = conditionFlags(row3, FROZEN_THRESHOLDS)
    const ind3 = {
      rsi14: row3.rsi14 ?? null,
      stochK: row3.stochK ?? null,
      bbPctB: row3.bbPctB ?? null,
      ma20DevPct: row3.ma20DevPct ?? null,
    }
    const ss3 = computeSignalStrengthScore(ind3, flags3)
    const path3 = analyzeEntryPath(enriched, ep.openIdx, ep.openPrice, MAX_HORIZON)

    let at4 = null
    if (ep.reached4 && ep.fill4Idx != null) {
      const row4 = enriched[ep.fill4Idx]
      const flags4 = conditionFlags(row4, FROZEN_THRESHOLDS)
      const ind4 = {
        rsi14: row4.rsi14 ?? null,
        stochK: row4.stochK ?? null,
        bbPctB: row4.bbPctB ?? null,
        ma20DevPct: row4.ma20DevPct ?? null,
      }
      const ss4 = computeSignalStrengthScore(ind4, flags4)
      const path4 = analyzeEntryPath(enriched, ep.fill4Idx, ep.fill4Price, MAX_HORIZON)
      at4 = {
        fill4Date: ep.fill4Date,
        fill4Price: ep.fill4Price,
        indicators: ind4,
        flags: flags4,
        score: ss4.score,
        perIndicator: ss4.perIndicator,
        path: path4,
      }
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
      indicators: ind3,
      flags: flags3,
      score: ss3.score,
      perIndicator: ss3.perIndicator,
      path: path3,
      at4,
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

/**
 * @param {ReturnType<typeof analyzeEtfSignalStrength>[]} etfResults
 */
export function poolSignalStrength(etfResults) {
  const all = etfResults.flatMap((e) => e.outcomes)

  // --- 3/4 cohort: rising-edge open with openCount === 3 ---
  const threeExact = all.filter((o) => o.openCount === 3)
  const threeAll = all.filter((o) => o.openCount >= 3) // all entry episodes
  const threeLabeled = assignTertileGroups(threeExact, "score")

  const byGroup3 = {
    Weak: groupStats(threeLabeled.filter((r) => r.strengthGroup === "Weak")),
    Medium: groupStats(threeLabeled.filter((r) => r.strengthGroup === "Medium")),
    Strong: groupStats(threeLabeled.filter((r) => r.strengthGroup === "Strong")),
  }

  // Continuous score vs outcomes (all entries using 3/4-day score)
  const scores = threeAll.map((o) => o.score)
  const d20s = threeAll.map((o) => fwd(o.path, 20))
  const d60s = threeAll.map((o) => fwd(o.path, 60))
  const maes = threeAll.map((o) => o.path?.maePct ?? null)
  const hit5 = threeAll.map((o) => (o.path?.hitUp?.[5] ? 1 : 0))

  const correlations = {
    score_vs_d20: pearsonCorrelation(scores, d20s),
    score_vs_d60: pearsonCorrelation(scores, d60s),
    score_vs_mae: pearsonCorrelation(scores, maes),
    score_vs_hitPlus5: pearsonCorrelation(scores, hit5),
  }
  const buckets = scoreBuckets(threeAll)

  // --- 4/4 cohort: strength at fill4 day ---
  const fourRows = all
    .filter((o) => o.at4 && o.at4.score != null)
    .map((o) => ({
      symbol: o.symbol,
      openDate: o.openDate,
      openPrice: o.openPrice,
      openCount: o.openCount,
      reached4: true,
      fill4Date: o.at4.fill4Date,
      fill4Price: o.at4.fill4Price,
      indicators: o.at4.indicators,
      flags: o.at4.flags,
      score: o.at4.score,
      perIndicator: o.at4.perIndicator,
      path: o.at4.path,
      entry3Score: o.score,
    }))
  const fourLabeled = assignTertileGroups(fourRows, "score")
  const byGroup4 = {
    Weak: groupStats(fourLabeled.filter((r) => r.strengthGroup === "Weak")),
    Medium: groupStats(fourLabeled.filter((r) => r.strengthGroup === "Medium")),
    Strong: groupStats(fourLabeled.filter((r) => r.strengthGroup === "Strong")),
  }

  // ETF × strength (exact 3/4)
  const etfStrength = etfResults.map((e) => {
    const labeled = assignTertileGroups(
      e.outcomes.filter((o) => o.openCount === 3),
      "score",
    )
    // For ETF-level, use GLOBAL tertile cuts from pool for comparability
    return { symbol: e.symbol, n: e.episodeCount, localTertiles: null, labeled }
  })

  // Re-label ETF rows using global score cutoffs from pool 3/4 tertiles
  const globalScored = threeLabeled
    .map((r) => r.score)
    .filter((v) => v != null)
    .sort((a, b) => a - b)
  const nG = globalScored.length
  const cut1 = nG ? globalScored[Math.floor(nG / 3)] : null
  const cut2 = nG ? globalScored[Math.floor((2 * nG) / 3)] : null

  function globalGroup(score) {
    if (score == null || cut1 == null || cut2 == null) return null
    if (score <= cut1) return "Weak"
    if (score <= cut2) return "Medium"
    return "Strong"
  }

  const etfByStrength = etfResults.map((e) => {
    const rows = e.outcomes
      .filter((o) => o.openCount === 3)
      .map((o) => ({ ...o, strengthGroup: globalGroup(o.score) }))
    const groups = {}
    for (const g of ["Weak", "Medium", "Strong"]) {
      const subset = rows.filter((r) => r.strengthGroup === g)
      const st = groupStats(subset)
      groups[g] = {
        ...st,
        smallSample: subset.length < ETF_GROUP_MIN_N,
        sampleNote: subset.length < ETF_GROUP_MIN_N ? "sample too small" : st.sampleNote,
      }
    }
    return {
      symbol: e.symbol,
      nExact3: rows.length,
      smallSample: e.episodeCount < SMALL_SAMPLE_N,
      focus: FOCUS_ETFS.includes(e.symbol),
      groups,
      globalCuts: { cut1, cut2 },
    }
  })

  const strong3 = threeLabeled.filter((r) => r.strengthGroup === "Strong")
  const weak3 = threeLabeled.filter((r) => r.strengthGroup === "Weak")
  const strong4 = fourLabeled.filter((r) => r.strengthGroup === "Strong")

  const failures = {
    A_strong3_maeGe10: strong3.filter((r) => (r.path?.maePct ?? 0) >= 10).map(caseRow),
    B_strong3_d60LeNeg10: strong3
      .filter((r) => fwd(r.path, 60) != null && fwd(r.path, 60) <= -10)
      .map(caseRow),
    C_strong4_maeGe10: strong4.filter((r) => (r.path?.maePct ?? 0) >= 10).map(caseRow),
    D_strong4_d60LeNeg10: strong4
      .filter((r) => fwd(r.path, 60) != null && fwd(r.path, 60) <= -10)
      .map(caseRow),
  }

  const weakWinners = {
    weak3_d60Ge10: weak3.filter((r) => fwd(r.path, 60) != null && fwd(r.path, 60) >= 10).map(caseRow),
    weak3_d60Ge20: weak3.filter((r) => fwd(r.path, 60) != null && fwd(r.path, 60) >= 20).map(caseRow),
  }

  // Core YES/NO/INCONCLUSIVE
  const questions = answerCoreQuestions(byGroup3, byGroup4, correlations, failures, etfByStrength)

  const futureDiagnosis = diagnoseFutureOptions(
    byGroup3,
    byGroup4,
    failures,
    weakWinners,
    etfByStrength,
    questions,
  )

  return {
    nAll: all.length,
    nExact3: threeExact.length,
    nReached4: fourRows.length,
    nFullHorizon60: all.filter((o) => o.path?.fullHorizon60).length,
    strengthRef: STRENGTH_REF,
    classificationMethod:
      "Tertiles of Signal Strength Score within cohort (exact openCount=3 for 3/4; fill4-day score for 4/4). Not return-optimized.",
    group3: byGroup3,
    group4: byGroup4,
    correlations,
    scoreBuckets: buckets,
    etfByStrength,
    focusEtfDetail: etfByStrength.filter((e) => e.focus),
    failures,
    weakWinners,
    questions,
    futureDiagnosis,
    overfitGuard: {
      thresholdsOptimized: false,
      newRulesProposed: false,
      note: "Observation only. Score is analytical, not a buy signal.",
    },
  }
}

function monotoneImprove(weakMed, midMed, strongMed) {
  if (weakMed == null || midMed == null || strongMed == null) return null
  return strongMed > midMed && midMed > weakMed
}

function monotoneDecrease(weakMed, midMed, strongMed) {
  if (weakMed == null || midMed == null || strongMed == null) return null
  return strongMed < midMed && midMed < weakMed
}

function answerCoreQuestions(g3, g4, corr, failures, etfByStrength) {
  const ns = [g3.Weak?.n ?? 0, g3.Medium?.n ?? 0, g3.Strong?.n ?? 0]
  const enough = ns.every((n) => n >= GROUP_MIN_N)

  // ① median return improves with strength?
  let q1 = "INCONCLUSIVE"
  let q1Evidence = ""
  if (!enough) {
    q1Evidence = `group sizes ${ns.join("/")}`
  } else {
    const d20 = [g3.Weak.d20Median, g3.Medium.d20Median, g3.Strong.d20Median]
    const d60 = [g3.Weak.d60Median, g3.Medium.d60Median, g3.Strong.d60Median]
    const up20 = monotoneImprove(...d20)
    const up60 = monotoneImprove(...d60)
    if (up20 && up60) q1 = "YES"
    else if (d20[2] <= d20[0] && d60[2] <= d60[0]) q1 = "NO"
    else q1 = "INCONCLUSIVE"
    q1Evidence = `D+20 med Weak/Med/Strong=${d20.join("/")}; D+60 med=${d60.join("/")}; r(score,d60)=${corr.score_vs_d60.r}`
  }

  // ② MAE decreases with strength?
  let q2 = "INCONCLUSIVE"
  let q2Evidence = ""
  if (!enough) {
    q2Evidence = `group sizes ${ns.join("/")}`
  } else {
    const mae = [g3.Weak.maeMedian, g3.Medium.maeMedian, g3.Strong.maeMedian]
    const mae10 = [g3.Weak.maeGe10Pct, g3.Medium.maeGe10Pct, g3.Strong.maeGe10Pct]
    const down = monotoneDecrease(...mae)
    if (down && mae10[2] < mae10[0]) q2 = "YES"
    else if (mae[2] >= mae[0] && mae10[2] >= mae10[0]) q2 = "NO"
    else q2 = "INCONCLUSIVE"
    q2Evidence = `MAE med Weak/Med/Strong=${mae.join("/")}; MAE≥10% ${mae10.join("/")}; r(score,mae)=${corr.score_vs_mae.r}`
  }

  // ③ large losses remain in Strong?
  const a = failures.A_strong3_maeGe10.length
  const b = failures.B_strong3_d60LeNeg10.length
  const c = failures.C_strong4_maeGe10.length
  const d = failures.D_strong4_d60LeNeg10.length
  const q3 = a + b + c + d > 0 ? "YES" : g3.Strong?.n >= GROUP_MIN_N ? "NO" : "INCONCLUSIVE"
  const q3Evidence = `Strong3 MAE≥10%: ${a}; Strong3 D+60≤-10%: ${b}; Strong4 MAE≥10%: ${c}; Strong4 D+60≤-10%: ${d}`

  // ④ ETF heterogeneity?
  const focus = etfByStrength.filter((e) => e.focus)
  const patterns = focus.map((e) => {
    const w = e.groups.Weak.d60Median
    const s = e.groups.Strong.d60Median
    const wn = e.groups.Weak.n
    const sn = e.groups.Strong.n
    if (wn < ETF_GROUP_MIN_N || sn < ETF_GROUP_MIN_N) return { symbol: e.symbol, pattern: "sample too small" }
    if (w == null || s == null) return { symbol: e.symbol, pattern: "missing" }
    return { symbol: e.symbol, pattern: s > w ? "stronger_better" : s < w ? "stronger_worse" : "flat", w, s }
  })
  const usable = patterns.filter((p) => p.pattern === "stronger_better" || p.pattern === "stronger_worse")
  let q4 = "INCONCLUSIVE"
  if (usable.length >= 2) {
    const kinds = new Set(usable.map((p) => p.pattern))
    q4 = kinds.size > 1 ? "YES" : "INCONCLUSIVE"
  }
  const q4Evidence = patterns.map((p) => `${p.symbol}:${p.pattern}${p.w != null ? `(W${p.w}/S${p.s})` : ""}`).join("; ")

  return {
    q1_strongerImprovesMedianReturn: { answer: q1, evidence: q1Evidence },
    q2_strongerReducesMae: { answer: q2, evidence: q2Evidence },
    q3_largeLossesRemainInStrong: { answer: q3, evidence: q3Evidence },
    q4_etfHeterogeneity: { answer: q4, evidence: q4Evidence },
    group4_maeNote: {
      weakMaeGe10: g4.Weak?.maeGe10Pct,
      mediumMaeGe10: g4.Medium?.maeGe10Pct,
      strongMaeGe10: g4.Strong?.maeGe10Pct,
      weakMaeMed: g4.Weak?.maeMedian,
      strongMaeMed: g4.Strong?.maeMedian,
      n: [g4.Weak?.n, g4.Medium?.n, g4.Strong?.n],
    },
  }
}

function diagnoseFutureOptions(g3, g4, failures, weakWinners, etfByStrength, questions) {
  const d60 = [g3.Weak?.d60Median, g3.Medium?.d60Median, g3.Strong?.d60Median]
  const mae10 = [g3.Weak?.maeGe10Pct, g3.Medium?.maeGe10Pct, g3.Strong?.maeGe10Pct]
  const failN =
    failures.A_strong3_maeGe10.length +
    failures.B_strong3_d60LeNeg10.length +
    failures.C_strong4_maeGe10.length +
    failures.D_strong4_d60LeNeg10.length
  const weakBig = weakWinners.weak3_d60Ge10.length

  return {
    A_subdivide_3_4: {
      label: "3/4 강도 세분화 근거?",
      numbers: {
        d60Median_W_M_S: d60,
        maeGe10_W_M_S: mae10,
        q1: questions.q1_strongerImprovesMedianReturn.answer,
        q2: questions.q2_strongerReducesMae.answer,
      },
      note: "Observation only — no rule change applied.",
    },
    B_subdivide_4_4: {
      label: "4/4 강도 세분화 근거?",
      numbers: {
        maeGe10_W_M_S: [
          g4.Weak?.maeGe10Pct,
          g4.Medium?.maeGe10Pct,
          g4.Strong?.maeGe10Pct,
        ],
        d60Median_W_M_S: [g4.Weak?.d60Median, g4.Medium?.d60Median, g4.Strong?.d60Median],
        n: [g4.Weak?.n, g4.Medium?.n, g4.Strong?.n],
      },
      note: "Observation only — no rule change applied.",
    },
    C_etf_specific: {
      label: "특정 ETF에서만 의미?",
      numbers: {
        focus: etfByStrength
          .filter((e) => e.focus)
          .map((e) => ({
            symbol: e.symbol,
            weakN: e.groups.Weak.n,
            strongN: e.groups.Strong.n,
            weakD60: e.groups.Weak.d60Median,
            strongD60: e.groups.Strong.d60Median,
            sampleNote: e.groups.Weak.sampleNote || e.groups.Strong.sampleNote,
          })),
        q4: questions.q4_etfHeterogeneity.answer,
      },
    },
    D_keep_as_is_sufficient: {
      label: "현행 조건 유지로도 충분한가?",
      numbers: {
        pool_d60_expectancy_context: "see prior P/L study",
        weak_also_has_large_winners: weakBig,
        strong_still_has_failures: failN,
      },
      note: "Not a recommendation — counts only.",
    },
    E_subdivision_may_not_fix_tails: {
      label: "강도 세분화가 대형 손실 해결책이 아닐 가능성?",
      numbers: {
        strongFailureCount: failN,
        strong3_maeGe10: failures.A_strong3_maeGe10.length,
        strong4_maeGe10: failures.C_strong4_maeGe10.length,
        q3: questions.q3_largeLossesRemainInStrong.answer,
      },
      note: "If strong failures persist, finer thresholds alone may not address tail risk.",
    },
  }
}
