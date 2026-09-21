/**
 * Daily Bottom Buy — split-buy (DCA) episode simulation (research only).
 *
 * Episode rule (documented, not return-tuned):
 * 1) Open on rising edge of conditionCount >= 3 (Test period only).
 * 2) Deploy tranche1 (w3) at that close.
 * 3) Within the same episode window, if count reaches 4, deploy tranche2 (w4) once.
 * 4) Episode ends at the earlier of:
 *    - first day count stays < 2 after having been active (cluster cool-down), or
 *    - maxWindow trading days after open (default 20).
 * 5) No overlapping episodes on the same ETF (no daily re-buy spam).
 *
 * Allocation schemes A/B/C are compared as-is — not optimized for max return.
 * Panic Index is not involved.
 */

import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import {
  TRAIN_RATIO,
  conditionFlags,
  summarizeNumeric,
  timeSplitBars,
} from "./daily-bottom-buy-validation-core.mjs"

/** Frozen from Train/Test study — do not retune on Test */
export const FROZEN_THRESHOLDS = {
  rsiMax: 36,
  stochKMax: 15.4,
  bbPctBMax: 0.01,
  ma20DevMax: -4.2,
  source: "Train/Test freeze (RSI≤36, Stoch≤15.4, BB%B≤0.01, MA20≤-4.2)",
}

export const SPLIT_SCHEMES = [
  { id: "A", label: "A 50/50", w3: 0.5, w4: 0.5 },
  { id: "B", label: "B 40/60", w3: 0.4, w4: 0.6 },
  { id: "C", label: "C 30/70", w3: 0.3, w4: 0.7 },
]

export const BASELINE_SCHEMES = [
  { id: "ALL3", label: "100% at 3-signal", w3: 1, w4: 0, mode: "all3" },
  { id: "WAIT4", label: "100% wait for 4 only", w3: 0, w4: 1, mode: "wait4" },
]

export const EPISODE_DEF = {
  maxWindow: 20,
  coolBelow: 2,
  description:
    "Rising-edge count≥3 opens episode; optional single count=4 add-on within 20d or until count<2; no overlap",
}

/**
 * Build chronological episodes for one ETF on [fromIdx, toIdx).
 * @param {ReturnType<typeof enrichBarsWithIndicators>} enriched
 * @param {{rsiMax:number, stochKMax:number, bbPctBMax:number, ma20DevMax:number}} th
 * @param {{ fromIdx: number, toIdx: number }} range
 * @param {typeof EPISODE_DEF} [def]
 */
export function buildSplitBuyEpisodes(enriched, th, range, def = EPISODE_DEF) {
  const { fromIdx, toIdx } = range
  const episodes = []
  let i = Math.max(fromIdx, 0)
  let prevCount = 0
  if (i > 0) {
    prevCount = conditionFlags(enriched[i - 1], th).count
  }

  while (i < toIdx && i < enriched.length) {
    const count = conditionFlags(enriched[i], th).count
    const risingGe3 = count >= 3 && prevCount < 3

    if (!risingGe3) {
      prevCount = count
      i++
      continue
    }

    // Need room for forward stats later; still record episode structure
    const openIdx = i
    const openPrice = enriched[openIdx].close
    let fill4Idx = null
    let fill4Price = null
    let endIdx = openIdx
    let cooled = false

    for (let j = openIdx; j < Math.min(enriched.length, openIdx + def.maxWindow + 1); j++) {
      endIdx = j
      const cj = conditionFlags(enriched[j], th).count
      if (j > openIdx && fill4Idx == null && cj >= 4) {
        fill4Idx = j
        fill4Price = enriched[j].close
      }
      if (j > openIdx && cj < def.coolBelow) {
        cooled = true
        break
      }
    }

    const reached4 = fill4Idx != null
    // Max adverse after open (on price path)
    let minAfterOpen = openPrice
    let minAfter4 = fill4Price
    const scanEnd = Math.min(enriched.length - 1, openIdx + 20)
    for (let j = openIdx + 1; j <= scanEnd; j++) {
      if (enriched[j].close < minAfterOpen) minAfterOpen = enriched[j].close
    }
    if (reached4) {
      minAfter4 = fill4Price
      const scan4 = Math.min(enriched.length - 1, fill4Idx + 20)
      for (let j = fill4Idx + 1; j <= scan4; j++) {
        if (enriched[j].close < minAfter4) minAfter4 = enriched[j].close
      }
    }

    const maeAfterOpenPct =
      openPrice > 0 ? round2(((openPrice - minAfterOpen) / openPrice) * 100) : null
    const maeAfter4Pct =
      reached4 && fill4Price > 0
        ? round2(((fill4Price - minAfter4) / fill4Price) * 100)
        : null

    episodes.push({
      openIdx,
      openDate: enriched[openIdx].date,
      openPrice,
      openCount: count,
      fill4Idx,
      fill4Date: reached4 ? enriched[fill4Idx].date : null,
      fill4Price,
      endIdx,
      endDate: enriched[endIdx].date,
      cooled,
      reached4,
      daysTo4: reached4 ? fill4Idx - openIdx : null,
      no4Rebound: !reached4,
      maeAfterOpenPct,
      maeAfter4Pct,
      deeperAfter4_5: reached4 && maeAfter4Pct != null && maeAfter4Pct >= 5,
      deeperAfter4_8: reached4 && maeAfter4Pct != null && maeAfter4Pct >= 8,
    })

    // Skip past episode end so we do not double-count daily buys
    prevCount = conditionFlags(enriched[endIdx], th).count
    i = endIdx + 1
  }

  return episodes
}

/**
 * Simulate one scheme on episodes. Budget = 100 per episode.
 * Mark-to-market from openIdx + horizon using shares bought + leftover cash.
 *
 * @param {ReturnType<typeof enrichBarsWithIndicators>} enriched
 * @param {ReturnType<typeof buildSplitBuyEpisodes>} episodes
 * @param {{ id: string, label: string, w3: number, w4: number, mode?: string }} scheme
 */
export function simulateSchemeOnEpisodes(enriched, episodes, scheme) {
  const mode = scheme.mode || "split"
  const rows = []

  for (const ep of episodes) {
    // Incomplete forward from open → skip performance but keep structure counts separately
    if (ep.openIdx + 20 >= enriched.length) continue

    let shares = 0
    let cash = 100
    let deployed3 = false
    let deployed4 = false
    let entry3 = null
    let entry4 = null

    if (mode === "wait4") {
      if (!ep.reached4 || ep.fill4Idx == null) {
        rows.push({
          ...episodeMeta(ep),
          path: "skipped_no4",
          deployed3: false,
          deployed4: false,
          d5: null,
          d10: null,
          d20: null,
          mae20: null,
          avgCost: null,
        })
        continue
      }
      const px = ep.fill4Price
      shares = 100 / px
      cash = 0
      deployed4 = true
      entry4 = { idx: ep.fill4Idx, price: px }
      // Horizons from fill4 for wait4 baseline
      const fwd = forwardFrom(enriched, ep.fill4Idx, shares, cash)
      if (!fwd) continue
      rows.push({
        ...episodeMeta(ep),
        path: "wait4_only",
        deployed3: false,
        deployed4: true,
        avgCost: px,
        ...fwd,
        mae20: maeOnShares(enriched, ep.fill4Idx, shares, cash),
      })
      continue
    }

    // all3 or split: always buy tranche at open with w3 (all3 uses w3=1)
    const w3 = mode === "all3" ? 1 : scheme.w3
    const w4 = mode === "all3" ? 0 : scheme.w4
    const spend3 = 100 * w3
    shares += spend3 / ep.openPrice
    cash -= spend3
    deployed3 = true
    entry3 = { idx: ep.openIdx, price: ep.openPrice }

    if (mode === "split" && ep.reached4 && ep.fill4Idx != null && w4 > 0) {
      const spend4 = 100 * w4
      shares += spend4 / ep.fill4Price
      cash -= spend4
      deployed4 = true
      entry4 = { idx: ep.fill4Idx, price: ep.fill4Price }
    }

    const invested = 100 - cash
    const avgCost = shares > 0 ? invested / shares : null
    const fwd = forwardFrom(enriched, ep.openIdx, shares, cash)
    if (!fwd) continue

    rows.push({
      ...episodeMeta(ep),
      path: deployed4 ? "split_3_then_4" : "three_only_no4",
      deployed3,
      deployed4,
      w3,
      w4: deployed4 ? w4 : 0,
      avgCost: avgCost != null ? round2(avgCost) : null,
      entry3,
      entry4,
      ...fwd,
      mae20: maeOnShares(enriched, ep.openIdx, shares, cash),
      maeAfter4Pct: ep.maeAfter4Pct,
      deeperAfter4_5: ep.deeperAfter4_5,
    })
  }

  return summarizeSimulation(rows, episodes)
}

function episodeMeta(ep) {
  return {
    openDate: ep.openDate,
    fill4Date: ep.fill4Date,
    reached4: ep.reached4,
    no4Rebound: ep.no4Rebound,
    daysTo4: ep.daysTo4,
    maeAfterOpenPct: ep.maeAfterOpenPct,
    maeAfter4Pct: ep.maeAfter4Pct,
  }
}

function forwardFrom(enriched, baseIdx, shares, cash) {
  if (baseIdx + 20 >= enriched.length) return null
  const nav = (j) => shares * enriched[j].close + cash
  const base = nav(baseIdx)
  if (!(base > 0)) return null
  return {
    d5: round2(((nav(baseIdx + 5) - base) / base) * 100),
    d10: round2(((nav(baseIdx + 10) - base) / base) * 100),
    d20: round2(((nav(baseIdx + 20) - base) / base) * 100),
  }
}

function maeOnShares(enriched, baseIdx, shares, cash) {
  const nav = (j) => shares * enriched[j].close + cash
  const base = nav(baseIdx)
  if (!(base > 0)) return null
  let worst = 0
  const end = Math.min(enriched.length - 1, baseIdx + 20)
  for (let j = baseIdx + 1; j <= end; j++) {
    const dd = ((base - nav(j)) / base) * 100
    if (dd > worst) worst = dd
  }
  return round2(worst)
}

/**
 * @param {any[]} rows completed simulation rows
 * @param {any[]} allEpisodes including those skipped for forward incompleteness
 */
export function summarizeSimulation(rows, allEpisodes) {
  const complete = rows.filter((r) => r.path !== "skipped_no4")
  const waitSkipped = rows.filter((r) => r.path === "skipped_no4")
  const withPerf = complete.filter((r) => r.d20 != null)
  const threeOnly = withPerf.filter((r) => r.path === "three_only_no4")
  const split34 = withPerf.filter((r) => r.path === "split_3_then_4")
  const wait4 = withPerf.filter((r) => r.path === "wait4_only")

  const episodeCount = allEpisodes.length
  const reached4Count = allEpisodes.filter((e) => e.reached4).length
  const no4Count = allEpisodes.filter((e) => e.no4Rebound).length

  return {
    episodeCount,
    reached4Count,
    no4ReboundCount: no4Count,
    reached4Pct: episodeCount ? round2((reached4Count / episodeCount) * 100) : null,
    no4ReboundPct: episodeCount ? round2((no4Count / episodeCount) * 100) : null,
    wait4SkippedCount: waitSkipped.length,
    nPerf: withPerf.length,
    paths: {
      threeOnly: threeOnly.length,
      split34: split34.length,
      wait4: wait4.length,
    },
    forward: {
      d5: summarizeNumeric(withPerf.map((r) => r.d5)),
      d10: summarizeNumeric(withPerf.map((r) => r.d10)),
      d20: summarizeNumeric(withPerf.map((r) => r.d20)),
      mae20: summarizeNumeric(withPerf.map((r) => r.mae20)),
    },
    maeAfterOpen: summarizeNumeric(allEpisodes.map((e) => e.maeAfterOpenPct)),
    maeAfter4: summarizeNumeric(
      allEpisodes.filter((e) => e.reached4).map((e) => e.maeAfter4Pct),
    ),
    deeperAfter4Pct5: (() => {
      const xs = allEpisodes.filter((e) => e.reached4)
      if (!xs.length) return null
      return round2((xs.filter((e) => e.deeperAfter4_5).length / xs.length) * 100)
    })(),
    deeperAfter4Pct8: (() => {
      const xs = allEpisodes.filter((e) => e.reached4)
      if (!xs.length) return null
      return round2((xs.filter((e) => e.deeperAfter4_8).length / xs.length) * 100)
    })(),
    threeOnlyForward: {
      n: threeOnly.length,
      d20: summarizeNumeric(threeOnly.map((r) => r.d20)),
      mae20: summarizeNumeric(threeOnly.map((r) => r.mae20)),
    },
    split34Forward: {
      n: split34.length,
      d20: summarizeNumeric(split34.map((r) => r.d20)),
      mae20: summarizeNumeric(split34.map((r) => r.mae20)),
    },
    sampleRows: withPerf.slice(0, 15),
  }
}

/**
 * Full Test-period DCA study for one ETF.
 * @param {{symbol:string, theme:string}} meta
 * @param {import('./daily-bottom-indicators.mjs').Bar[]} bars
 * @param {{rsiMax:number, stochKMax:number, bbPctBMax:number, ma20DevMax:number}} [th]
 * @param {number} [trainRatio]
 */
export function analyzeEtfSplitBuy(meta, bars, th = FROZEN_THRESHOLDS, trainRatio = TRAIN_RATIO) {
  const enriched = enrichBarsWithIndicators(bars)
  const split = timeSplitBars(enriched, trainRatio)
  const episodes = buildSplitBuyEpisodes(enriched, th, {
    fromIdx: split.splitIdx,
    toIdx: enriched.length,
  })

  /** @type {Record<string, any>} */
  const schemes = {}
  for (const s of [...SPLIT_SCHEMES, ...BASELINE_SCHEMES]) {
    schemes[s.id] = {
      ...s,
      ...simulateSchemeOnEpisodes(enriched, episodes, s),
    }
  }

  return {
    symbol: meta.symbol,
    theme: meta.theme,
    split,
    thresholds: th,
    episodeDef: EPISODE_DEF,
    episodeCount: episodes.length,
    reached4Count: episodes.filter((e) => e.reached4).length,
    no4ReboundCount: episodes.filter((e) => e.no4Rebound).length,
    episodes: episodes.map((e) => ({
      openDate: e.openDate,
      fill4Date: e.fill4Date,
      reached4: e.reached4,
      daysTo4: e.daysTo4,
      maeAfterOpenPct: e.maeAfterOpenPct,
      maeAfter4Pct: e.maeAfter4Pct,
      deeperAfter4_5: e.deeperAfter4_5,
    })),
    schemes,
  }
}

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}
