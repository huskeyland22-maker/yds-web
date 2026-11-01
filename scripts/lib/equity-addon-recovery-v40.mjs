/**
 * v40 recovery study after one equal-cash add. Research only.
 * BUY episodes, the -5% add, and the -10% add stay exactly as in v39.
 * No new threshold, add size, or sell is tested. selectedStrategy stays null.
 *
 * Horizons are trading days after the add close. The add close is the first
 * later close at or below the threshold, inside the same 120-day buy window
 * v39 used. A missing later bar stays missing.
 *
 * Depth buckets describe the realized low after the add. They are not a
 * signal that could have been traded at the add. lookaheadViolations counts
 * only the buy audit and the first-touch add check.
 *
 * Judgment is locked before the run. A requires both ADD5 and ADD10, on the
 * episodes whose post-add low is -20% or worse and that have a full T+120
 * window after the add:
 * n >= 10, T+120 mean and median from the add price above 0, win rate >= 60%,
 * back to the add price after that low >= 80%, back to average cost after
 * that low >= 70%, back to the original buy after that low >= 50%, and the
 * share still -10% or worse at T+120 <= 25%. If the -30% group also has
 * n >= 10, its T+120 mean must be positive and its post-low add-price
 * recovery at least 60%.
 * A first print back above the add price before the low is reported separately.
 * It does not count as recovery from the deep decline.
 * C requires both add rules to miss a weaker bar on that -20% group:
 * mean <= 0, or win rate < 50%, or add-price recovery < 50%, with n >= 10.
 * Anything between is B. A does not adopt a buy, add, or sell rule.
 */

import { FROZEN_THRESHOLDS, buildSplitBuyEpisodes } from "./daily-bottom-split-buy-sim.mjs"
import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import { EQUITY_SELL_RESEARCH_SELECTED_STRATEGY } from "./equity-sell-research-universe.mjs"
import { SELECTED_STRATEGY as TECHNICAL_SELECTED_STRATEGY, existingBuyIndexes } from "./equity-technical-sell-v1.mjs"
import {
  EXPECTED_EPISODES,
  FOCUS_TICKERS,
  TICKERS,
  auditBuyLookAhead,
  mulberry32,
  quantile,
} from "./equity-buy-validation-v38.mjs"
import {
  SELECTED_STRATEGY,
  assertStoredEpisodes,
  averageCost,
  firstBreachIndex,
} from "./equity-addon-buy-v39.mjs"

if (EQUITY_SELL_RESEARCH_SELECTED_STRATEGY !== null || TECHNICAL_SELECTED_STRATEGY !== null || SELECTED_STRATEGY !== null) {
  throw new Error("selectedStrategy must stay null")
}

export const STUDY_SELECTED_STRATEGY = null
export const POST_HORIZONS = [5, 10, 20, 40, 60, 120]
export const RECOVERY_HORIZONS = [20, 40, 60, 120]
export const BUCKETS = ["A", "B", "C", "D", "E", "F"]
export const DEEP_LEVELS = [0.1, 0.2, 0.3, 0.4]
export const TIMING_BINS = ["D0", "D1_5", "D6_10", "D11_20", "D21_40", "D41_60", "D61_120"]
export const BOOTSTRAP_REPS = 1000
export const PERMUTATION_REPS = 1000
export const BOOTSTRAP_SEED = 40001
export const PERMUTATION_SEED = 40002
export { EXPECTED_EPISODES, FOCUS_TICKERS, TICKERS, averageCost, firstBreachIndex }

const RULES = [
  ["ADD5", -0.05],
  ["ADD10", -0.1],
]

export function sampleLabel(n) {
  if (n < 5) return "해석 금지"
  if (n < 10) return "결론 금지"
  return "제한적 해석"
}

export function bucketOf(minReturn) {
  if (minReturn > -0.05) return "A"
  if (minReturn > -0.1) return "B"
  if (minReturn > -0.2) return "C"
  if (minReturn > -0.3) return "D"
  if (minReturn > -0.4) return "E"
  return "F"
}

export function timingBin(day) {
  if (day <= 0) return "D0"
  if (day <= 5) return "D1_5"
  if (day <= 10) return "D6_10"
  if (day <= 20) return "D11_20"
  if (day <= 40) return "D21_40"
  if (day <= 60) return "D41_60"
  return "D61_120"
}

function mean(values) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values) {
  return quantile(values, 0.5)
}

function winRate(values) {
  if (!values.length) return null
  return values.filter((value) => value > 0).length / values.length
}

function rate(flags) {
  if (!flags.length) return null
  return flags.filter(Boolean).length / flags.length
}

export function recoveryAfter(closes, startIdx, endIdx, level) {
  for (let cursor = startIdx + 1; cursor <= endIdx; cursor += 1) {
    if (closes[cursor] + 1e-9 >= level) return cursor - startIdx
  }
  return null
}

export function recoveryDay(closes, addIdx, endIdx, level, skipAddDay) {
  const start = skipAddDay ? addIdx + 1 : addIdx
  for (let cursor = start; cursor <= endIdx; cursor += 1) {
    if (closes[cursor] + 1e-9 >= level) return cursor - addIdx
  }
  return null
}

export function postAddPath(closes, addIdx, horizon) {
  const end = addIdx + horizon
  if (end >= closes.length || !(closes[addIdx] > 0)) return null
  const addPrice = closes[addIdx]
  let minReturn = 0
  let maxReturn = 0
  let lowDay = 0
  for (let step = 1; step <= horizon; step += 1) {
    const change = closes[addIdx + step] / addPrice - 1
    if (change < minReturn) {
      minReturn = change
      lowDay = step
    }
    if (change > maxReturn) maxReturn = change
  }
  return {
    minReturn,
    maxReturn,
    lowDay,
    ret: closes[end] / addPrice - 1,
    mdd: minReturn,
  }
}

function summarize(values) {
  return {
    n: values.length,
    mean: mean(values),
    median: median(values),
    winRate: winRate(values),
    q25: quantile(values, 0.25),
    q75: quantile(values, 0.75),
    sample: sampleLabel(values.length),
  }
}

function recoveryPack(days, horizon) {
  const known = days.filter((value) => value !== undefined)
  const hits = known.filter((value) => value != null && value <= horizon)
  const hitDays = hits.filter((value) => value != null)
  return {
    n: known.length,
    rate: known.length ? hits.length / known.length : null,
    medianDay: median(hitDays),
    meanDay: mean(hitDays),
    unrecovered: known.length ? (known.length - hits.length) / known.length : null,
  }
}

function groupStats(rows, horizon) {
  const available = rows.filter((row) => row.horizons[horizon])
  const values = available.map((row) => row.horizons[horizon].ret)
  return {
    ...summarize(values),
    minMean: mean(available.map((row) => row.horizons[horizon].minReturn)),
    minMedian: median(available.map((row) => row.horizons[horizon].minReturn)),
    maxMean: mean(available.map((row) => row.horizons[horizon].maxReturn)),
    mddMean: mean(available.map((row) => row.horizons[horizon].mdd)),
    loss10: rate(values.map((value) => value <= -0.1)),
    loss20: rate(values.map((value) => value <= -0.2)),
    add: recoveryPack(available.map((row) => row.horizons[horizon].addDay), horizon),
    average: recoveryPack(available.map((row) => row.horizons[horizon].avgDay), horizon),
    buy: recoveryPack(available.map((row) => row.horizons[horizon].buyDay), horizon),
    addAfterLow: recoveryPack(available.map((row) => row.horizons[horizon].addAfterLow), horizon),
    averageAfterLow: recoveryPack(available.map((row) => row.horizons[horizon].avgDayAfterLow), horizon),
    buyAfterLow: recoveryPack(available.map((row) => row.horizons[horizon].buyAfterLow), horizon),
    incremental: summarize(available.map((row) => row.horizons[horizon].incremental)),
    original: summarize(available.map((row) => row.horizons[horizon].original)),
    blended: summarize(available.map((row) => row.horizons[horizon].blended)),
  }
}

function emptyRule() {
  return { rows: [] }
}

export function judgeRecovery(input) {
  const labels = {
    A: "A. 추가매수 후 깊은 하락에서도 회복력이 충분히 확인됨",
    B: "B. 특정 구간에서는 회복하지만 범용적으로 보기 어려움",
    C: "C. 깊은 하락에서 회복 신뢰도가 부족함",
  }
  const view = (group) => {
    if (!group || group.n < 10) {
      return { enough: false, pass: false, fail: false, checks: { n: false } }
    }
    const checks = {
      n: true,
      mean: group.mean > 0,
      median: group.median > 0,
      win: group.win >= 0.6,
      add: group.addRecovery >= 0.8,
      average: group.avgRecovery >= 0.7,
      buy: group.buyRecovery >= 0.5,
      tail: group.loss10 <= 0.25,
      deep30: group.deep30n < 10 || (group.deep30Mean > 0 && group.deep30Add >= 0.6),
    }
    const fail = group.mean <= 0 || group.win < 0.5 || group.addRecovery < 0.5
    return { enough: true, pass: Object.values(checks).every(Boolean), fail, checks }
  }
  const verdicts = Object.fromEntries(["ADD5", "ADD10"].map((name) => [name, view(input?.[name])]))
  const confirmed = Object.values(verdicts).every((row) => row.pass)
  const failed = Object.values(verdicts).every((row) => row.fail)
  let label = labels.B
  if (confirmed) label = labels.A
  else if (failed) label = labels.C
  return {
    label,
    verdicts,
    production: "없음",
    buyChanged: false,
    sellChanged: false,
    addChanged: false,
    selectedStrategy: null,
  }
}

function blockDiff(deepBy, shallowBy, reps, rng) {
  const symbols = TICKERS.filter((symbol) => deepBy[symbol]?.length || shallowBy[symbol]?.length)
  const meanDiffs = []
  const medianDiffs = []
  for (let rep = 0; rep < reps; rep += 1) {
    const deep = []
    const shallow = []
    for (let draw = 0; draw < symbols.length; draw += 1) {
      const symbol = symbols[Math.floor(rng() * symbols.length)]
      deep.push(...(deepBy[symbol] ?? []))
      shallow.push(...(shallowBy[symbol] ?? []))
    }
    if (!deep.length || !shallow.length) continue
    meanDiffs.push(mean(deep) - mean(shallow))
    medianDiffs.push(median(deep) - median(shallow))
  }
  return {
    reps: meanDiffs.length,
    meanLow: quantile(meanDiffs, 0.025),
    meanHigh: quantile(meanDiffs, 0.975),
    medianLow: quantile(medianDiffs, 0.025),
    medianHigh: quantile(medianDiffs, 0.975),
  }
}

function permuteDiff(deepBy, shallowBy, reps, rng) {
  const deepAll = TICKERS.flatMap((symbol) => deepBy[symbol] ?? [])
  const shallowAll = TICKERS.flatMap((symbol) => shallowBy[symbol] ?? [])
  if (!deepAll.length || !shallowAll.length) return { observed: null, p: null, reps: 0 }
  const observed = mean(deepAll) - mean(shallowAll)
  let extreme = 0
  for (let rep = 0; rep < reps; rep += 1) {
    const deep = []
    const shallow = []
    for (const symbol of TICKERS) {
      const left = deepBy[symbol] ?? []
      const right = shallowBy[symbol] ?? []
      if (!left.length || !right.length) {
        deep.push(...left)
        shallow.push(...right)
        continue
      }
      const pool = [...left, ...right]
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1))
        const swap = pool[i]
        pool[i] = pool[j]
        pool[j] = swap
      }
      deep.push(...pool.slice(0, left.length))
      shallow.push(...pool.slice(left.length))
    }
    const diff = mean(deep) - mean(shallow)
    if (Math.abs(diff) + 1e-15 >= Math.abs(observed)) extreme += 1
  }
  return { observed, p: reps ? extreme / reps : null, reps }
}

export function runRecoveryStudy(seriesByTicker, storedEpisodes, expectedAdds) {
  if (FROZEN_THRESHOLDS.rsiMax !== 36 || FROZEN_THRESHOLDS.stochKMax !== 15.4 || FROZEN_THRESHOLDS.bbPctBMax !== 0.01 || FROZEN_THRESHOLDS.ma20DevMax !== -4.2) {
    throw new Error("BUY thresholds changed")
  }
  if (STUDY_SELECTED_STRATEGY !== null || TICKERS.length !== 31) throw new Error("universe or strategy changed")
  const missing = TICKERS.filter((symbol) => !seriesByTicker[symbol]?.length)
  if (missing.length) throw new Error(`missing bars: ${missing.join(",")}`)

  const found = []
  const rules = Object.fromEntries(RULES.map(([name]) => [name, emptyRule()]))
  let lookahead = 0

  for (const symbol of TICKERS) {
    const bars = seriesByTicker[symbol]
    const violations = auditBuyLookAhead(bars)
    if (violations.length) {
      const error = new Error("lookaheadViolations")
      error.violations = violations.map((row) => ({ symbol, ...row }))
      throw error
    }
    const enriched = enrichBarsWithIndicators(bars)
    const episodes = buildSplitBuyEpisodes(enriched, FROZEN_THRESHOLDS, { fromIdx: 0, toIdx: enriched.length })
    if (episodes.map((episode) => episode.openIdx).join() !== existingBuyIndexes(bars).join()) {
      throw new Error(`${symbol} episode indexes diverged`)
    }
    for (let i = 1; i < episodes.length; i += 1) {
      if (episodes[i].openIdx <= episodes[i - 1].endIdx) throw new Error(`${symbol} overlapping episode`)
    }
    const closes = bars.map((bar) => bar.close)
    for (const episode of episodes) {
      const buyPrice = closes[episode.openIdx]
      if (bars[episode.openIdx].date !== episode.openDate || buyPrice !== episode.openPrice) {
        throw new Error(`${symbol} buy price mismatch at ${episode.openDate}`)
      }
      found.push({ symbol, date: episode.openDate })
      if (episode.openIdx + 120 >= closes.length) continue
      for (const [name, threshold] of RULES) {
        const addIdx = firstBreachIndex(closes, episode.openIdx, threshold, 120)
        if (addIdx == null) continue
        for (let step = 1; step < addIdx - episode.openIdx; step += 1) {
          if (closes[episode.openIdx + step] / buyPrice - 1 <= threshold + 1e-9) lookahead += 1
        }
        const addPrice = closes[addIdx]
        const avg = averageCost(buyPrice, addPrice)
        const horizons = {}
        for (const horizon of POST_HORIZONS) {
          const path = postAddPath(closes, addIdx, horizon)
          if (!path) continue
          const end = addIdx + horizon
          const endClose = closes[end]
          horizons[horizon] = {
            ...path,
            incremental: path.ret,
            original: endClose / buyPrice - 1,
            blended: ((1 / buyPrice + 1 / addPrice) * endClose) / 2 - 1,
            addDay: recoveryDay(closes, addIdx, end, addPrice, true),
            avgDay: recoveryDay(closes, addIdx, end, avg, false),
            buyDay: recoveryDay(closes, addIdx, end, buyPrice, false),
            addAfterLow: recoveryAfter(closes, addIdx + path.lowDay, end, addPrice),
            avgDayAfterLow: recoveryAfter(closes, addIdx + path.lowDay, end, avg),
            buyAfterLow: recoveryAfter(closes, addIdx + path.lowDay, end, buyPrice),
          }
        }
        rules[name].rows.push({
          symbol,
          addPrice,
          buyPrice,
          avg,
          delay: addIdx - episode.openIdx,
          horizons,
        })
      }
    }
  }

  if (lookahead > 0) {
    const error = new Error("lookaheadViolations")
    error.violations = [{ lookahead }]
    throw error
  }
  const fingerprint = assertStoredEpisodes(found, storedEpisodes)
  if (expectedAdds && (rules.ADD5.rows.length !== expectedAdds.add5 || rules.ADD10.rows.length !== expectedAdds.add10)) {
    const error = new Error("add counts diverged from v39")
    error.lines = [
      `ADD5 ${rules.ADD5.rows.length} !== ${expectedAdds.add5}`,
      `ADD10 ${rules.ADD10.rows.length} !== ${expectedAdds.add10}`,
    ]
    throw error
  }

  const strategies = {}
  const judgmentInput = {}
  for (const [name] of RULES) {
    const rows = rules[name].rows
    const full = rows.filter((row) => row.horizons[120])
    const byBucket = Object.fromEntries(BUCKETS.map((bucket) => [bucket, []]))
    const byTiming = Object.fromEntries(TIMING_BINS.map((bin) => [bin, []]))
    for (const row of full) {
      byBucket[bucketOf(row.horizons[120].minReturn)].push(row)
      byTiming[timingBin(row.horizons[120].lowDay)].push(row)
    }
    const bucketStats = {}
    for (const bucket of BUCKETS) {
      const group = byBucket[bucket]
      bucketStats[bucket] = {
        n: group.length,
        sample: sampleLabel(group.length),
        lowDayMedian: median(group.map((row) => row.horizons[120].lowDay)),
        horizons: Object.fromEntries(RECOVERY_HORIZONS.map((horizon) => [horizon, groupStats(group, horizon)])),
      }
    }
    const timing = {}
    for (const bin of TIMING_BINS) {
      const group = byTiming[bin]
      timing[bin] = {
        n: group.length,
        sample: sampleLabel(group.length),
        minMean: mean(group.map((row) => row.horizons[120].minReturn)),
        minMedian: median(group.map((row) => row.horizons[120].minReturn)),
      }
    }
    const deep = {}
    for (const level of DEEP_LEVELS) {
      const group = full.filter((row) => row.horizons[120].minReturn <= -level + 1e-9)
      deep[level] = {
        n: group.length,
        sample: sampleLabel(group.length),
        t20: groupStats(group, 20),
        t60: groupStats(group, 60),
        t120: groupStats(group, 120),
      }
    }
    const shallowRows = full.filter((row) => row.horizons[120].minReturn > -0.2)
    const deepRows = full.filter((row) => row.horizons[120].minReturn <= -0.2 + 1e-9)
    const split = (source) => ({
      t60: groupStats(source, 60),
      t120: groupStats(source, 120),
      n: source.length,
      sample: sampleLabel(source.length),
    })
    const deepBy = { 60: {}, 120: {} }
    const shallowBy = { 60: {}, 120: {} }
    for (const symbol of TICKERS) {
      for (const horizon of [60, 120]) {
        deepBy[horizon][symbol] = deepRows.filter((row) => row.symbol === symbol).map((row) => row.horizons[horizon].ret)
        shallowBy[horizon][symbol] = shallowRows.filter((row) => row.symbol === symbol).map((row) => row.horizons[horizon].ret)
      }
    }
    const contrast = {}
    for (const horizon of [60, 120]) {
      contrast[horizon] = {
        ...blockDiff(deepBy[horizon], shallowBy[horizon], BOOTSTRAP_REPS, mulberry32(BOOTSTRAP_SEED + horizon)),
        permutation: permuteDiff(deepBy[horizon], shallowBy[horizon], PERMUTATION_REPS, mulberry32(PERMUTATION_SEED + horizon)),
      }
    }
    const tickers = TICKERS.map((symbol) => {
      const mine = full.filter((row) => row.symbol === symbol)
      const cell = groupStats(mine, 120)
      const cell60 = groupStats(mine, 60)
      return {
        symbol,
        addN: rows.filter((row) => row.symbol === symbol).length,
        n: mine.length,
        sample: sampleLabel(mine.length),
        minMedian: median(mine.map((row) => row.horizons[120].minReturn)),
        t60: cell60.mean,
        t120: cell.mean,
        buyRecovery: cell.buy.rate,
        addRecovery: cell.add.rate,
        avgRecovery: cell.average.rate,
      }
    })
    const d20 = deep[0.2].t120
    const d30 = deep[0.3].t120
    judgmentInput[name] = {
      n: deep[0.2].n,
      mean: d20.mean,
      median: d20.median,
      win: d20.winRate,
      addRecovery: d20.addAfterLow.rate,
      avgRecovery: d20.averageAfterLow.rate,
      buyRecovery: d20.buyAfterLow.rate,
      loss10: d20.loss10,
      deep30n: deep[0.3].n,
      deep30Mean: d30.mean,
      deep30Add: d30.addAfterLow.rate,
    }
    strategies[name] = {
      adds: rows.length,
      full: full.length,
      overall: Object.fromEntries(POST_HORIZONS.map((horizon) => [horizon, groupStats(rows, horizon)])),
      buckets: bucketStats,
      timing,
      deep,
      shallow: split(shallowRows),
      deep20: split(deepRows),
      contrast,
      tickers,
    }
  }

  return {
    version: "v40",
    selectedStrategy: null,
    productionChanged: false,
    buyChanged: false,
    sellChanged: false,
    addChanged: false,
    universe: TICKERS,
    lookAhead: { violations: lookahead },
    integrity: {
      tickers: 31,
      episodes: found.length,
      overlap: 0,
      fingerprint,
      add5: rules.ADD5.rows.length,
      add10: rules.ADD10.rows.length,
      add5Full: strategies.ADD5.full,
      add10Full: strategies.ADD10.full,
      thresholds: { rsiMax: 36, stochKMax: 15.4, bbPctBMax: 0.01, ma20DevMax: -4.2 },
    },
    strategies,
    judgment: judgeRecovery(judgmentInput),
  }
}
