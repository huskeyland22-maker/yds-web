/**
 * v38 independent check of the frozen BUY episodes. Research only.
 * Thresholds, the 3-of-4 rule, and episode overlap stay unchanged.
 * No new buy rule, no sell rule, selectedStrategy stays null.
 *
 * Gates below were locked before the first full run.
 * A requires every one of these, at both T+60 and T+120:
 * - n >= 10 for BUY and the seeded random days
 * - higher mean, higher median, and higher win rate than random
 * - higher +10% reach within 60 trading days
 * - ticker-block bootstrap 95% CI for the mean gap and the median gap above 0
 * - within-ticker permutation p < 0.05 for the mean gap
 * - at least 10 tickers with n >= 10, and at least 70% of them ahead of random at both horizons
 * - average MDD not worse than random by more than 3 percentage points
 * B is a positive T+60 and T+120 mean and median when A fails.
 * C is everything else.
 * None of the three labels changes a threshold.
 */

import { createHash } from "node:crypto"

import { conditionFlags } from "./daily-bottom-buy-validation-core.mjs"
import { FROZEN_THRESHOLDS, buildSplitBuyEpisodes } from "./daily-bottom-split-buy-sim.mjs"
import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import {
  EQUITY_SELL_RESEARCH_SELECTED_STRATEGY,
  EQUITY_SELL_RESEARCH_UNIVERSE,
} from "./equity-sell-research-universe.mjs"
import {
  SELECTED_STRATEGY as TECHNICAL_SELECTED_STRATEGY,
  existingBuyIndexes,
} from "./equity-technical-sell-v1.mjs"

if (EQUITY_SELL_RESEARCH_SELECTED_STRATEGY !== null || TECHNICAL_SELECTED_STRATEGY !== null) {
  throw new Error("selectedStrategy must stay null")
}

export const SELECTED_STRATEGY = null
export const TICKERS = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
export const FOCUS_TICKERS = ["NVDA", "AMD", "AVGO", "CRWD", "PLTR", "TSLA"]
export const HORIZONS = [1, 3, 5, 10, 20, 40, 60, 120]
export const MDD_HORIZONS = [20, 60, 120]
export const REACH_TARGETS = [0.03, 0.05, 0.1, 0.15, 0.2]
export const EXPECTED_EPISODES = 1380
export const RANDOM_SEED = 38
export const BOOTSTRAP_REPS = 1000
export const PERMUTATION_REPS = 1000
export const BOOTSTRAP_SEED = 38001
export const PERMUTATION_SEED = 38002
export const REGIME_UP = 0.05
export const REGIME_DOWN = -0.05
export const MDD_TOLERANCE = 0.03
export const BREADTH_MIN = 0.7
export const BREADTH_TICKERS = 10
export const EPISODE_LOOKAHEAD_BARS = 20
export const SELL_RESEARCH = "재개하지 않음"
export const PRODUCTION_CHANGE = "변경 없음"

const FLAG_KEYS = ["rsi", "stoch", "bb", "ma"]
const PAIRS = [
  ["rsi", "stoch"],
  ["rsi", "bb"],
  ["rsi", "ma"],
  ["stoch", "bb"],
  ["stoch", "ma"],
  ["bb", "ma"],
]
const TRIOS = [
  ["rsi", "stoch", "bb"],
  ["rsi", "stoch", "ma"],
  ["rsi", "bb", "ma"],
  ["stoch", "bb", "ma"],
]
const PATHS = ["EARLY_RISE", "DIP_THEN_RISE", "SIDEWAYS", "FAILED", "OTHER"]

export function sampleJudgment(n) {
  if (n < 5) return "결론 금지"
  if (n < 10) return "결론 보류"
  return "제한적 해석"
}

export function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function sampleIndexes(eligible, count, seed) {
  return takeSample(eligible, count, mulberry32(seed))
}

function takeSample(eligible, count, rng) {
  const copy = eligible.slice()
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const swap = copy[i]
    copy[i] = copy[j]
    copy[j] = swap
  }
  return copy.slice(0, Math.min(count, copy.length)).sort((a, b) => a - b)
}

export function classifyRegime(spy60) {
  if (spy60 == null || Number.isNaN(spy60)) return null
  if (spy60 >= REGIME_UP) return "강세"
  if (spy60 <= REGIME_DOWN) return "약세"
  return "중립"
}

export function classifyPath(closes, index) {
  if (index + 60 >= closes.length || !(closes[index] > 0)) return null
  const relative = []
  for (let step = 1; step <= 60; step += 1) relative.push(closes[index + step] / closes[index] - 1)
  const earlyRise = relative.slice(0, 5).some((value) => value >= 0.05)
  const noDip = relative.every((value) => value > -0.05)
  if (earlyRise && noDip) return "EARLY_RISE"
  const dipAt = relative.findIndex((value) => value <= -0.05)
  if (dipAt >= 0 && relative.slice(dipAt + 1).some((value) => value >= 0.1)) return "DIP_THEN_RISE"
  const reached10 = relative.some((value) => value >= 0.1)
  const lost10 = relative.some((value) => value <= -0.1)
  if (lost10 && !reached10) return "FAILED"
  if (!reached10 && !lost10) return "SIDEWAYS"
  return "OTHER"
}

function mean(values) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values) {
  return quantile(values, 0.5)
}

export function quantile(values, q) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * q
  const low = Math.floor(position)
  const high = Math.ceil(position)
  if (low === high) return sorted[low]
  return sorted[low] * (high - position) + sorted[high] * (position - low)
}

function winRate(values) {
  if (!values.length) return null
  return values.filter((value) => value > 0).length / values.length
}

function rate(flags) {
  if (!flags.length) return null
  return flags.filter(Boolean).length / flags.length
}

export function reachDay(closes, index, target, horizon = 60) {
  if (index + horizon >= closes.length || !(closes[index] > 0)) return null
  for (let step = 1; step <= horizon; step += 1) {
    if (closes[index + step] / closes[index] - 1 >= target) return step
  }
  return 0
}

export function forwardReturn(closes, index, horizon) {
  const end = index + horizon
  if (end >= closes.length || !(closes[index] > 0)) return null
  return closes[end] / closes[index] - 1
}

export function forwardDrawdown(closes, index, horizon) {
  const end = index + horizon
  if (end >= closes.length || !(closes[index] > 0)) return null
  let mdd = 0
  for (let cursor = index; cursor <= end; cursor += 1) {
    const change = closes[cursor] / closes[index] - 1
    if (change < mdd) mdd = change
  }
  return {
    mdd,
    hit5: mdd <= -0.05,
    hit10: mdd <= -0.1,
    hit20: mdd <= -0.2,
  }
}

function summarizeValues(values) {
  return {
    n: values.length,
    mean: mean(values),
    median: median(values),
    winRate: winRate(values),
    q25: quantile(values, 0.25),
    q75: quantile(values, 0.75),
    sample: sampleJudgment(values.length),
    filledWithWindowEnd: false,
  }
}

function drawdownSummary(rows) {
  const present = rows.filter(Boolean)
  return {
    n: present.length,
    mean: mean(present.map((row) => row.mdd)),
    median: median(present.map((row) => row.mdd)),
    hit5: rate(present.map((row) => row.hit5)),
    hit10: rate(present.map((row) => row.hit10)),
    hit20: rate(present.map((row) => row.hit20)),
    sample: sampleJudgment(present.length),
    filledWithWindowEnd: false,
  }
}

function outcome(closes, index) {
  const returns = {}
  for (const horizon of HORIZONS) returns[horizon] = forwardReturn(closes, index, horizon)
  const drawdowns = {}
  for (const horizon of MDD_HORIZONS) drawdowns[horizon] = forwardDrawdown(closes, index, horizon)
  const reach = {}
  for (const target of REACH_TARGETS) reach[target] = reachDay(closes, index, target, 60)
  let trough = null
  if (index + 60 < closes.length && closes[index] > 0) {
    let extra = Infinity
    let day = null
    for (let step = 1; step <= 60; step += 1) {
      const change = closes[index + step] / closes[index] - 1
      if (change < extra) {
        extra = change
        day = step
      }
    }
    let rebound = closes[index + day]
    for (let step = day; step <= 60; step += 1) rebound = Math.max(rebound, closes[index + step])
    let trailing = closes[index]
    for (let step = Math.max(0, index - 60); step <= index; step += 1) trailing = Math.min(trailing, closes[step])
    trough = {
      extra,
      day,
      recoveryFromBuy: rebound / closes[index] - 1,
      recoveryFromLow: rebound / closes[index + day] - 1,
      gapToFutureLow: closes[index] / closes[index + day] - 1,
      gapToTrailingLow: closes[index] / trailing - 1,
    }
  }
  return { returns, drawdowns, reach, trough, path: classifyPath(closes, index) }
}

function poolOutcomes(rows) {
  const performance = {}
  for (const horizon of HORIZONS) {
    performance[horizon] = summarizeValues(rows.map((row) => row.returns[horizon]).filter((value) => value != null))
  }
  const drawdowns = {}
  for (const horizon of MDD_HORIZONS) {
    drawdowns[horizon] = drawdownSummary(rows.map((row) => row.drawdowns[horizon]))
  }
  const reach = {}
  for (const target of REACH_TARGETS) {
    const known = rows.map((row) => row.reach[target]).filter((value) => value != null)
    const hits = known.filter((value) => value > 0)
    reach[target] = {
      n: known.length,
      rate: known.length ? hits.length / known.length : null,
      meanDay: mean(hits),
      medianDay: median(hits),
      sample: sampleJudgment(known.length),
    }
  }
  const troughs = rows.map((row) => row.trough).filter(Boolean)
  const paths = Object.fromEntries(PATHS.map((name) => [name, 0]))
  let classified = 0
  for (const row of rows) {
    if (!row.path) continue
    classified += 1
    paths[row.path] += 1
  }
  return {
    performance,
    drawdowns,
    reach,
    trough: {
      n: troughs.length,
      extraMean: mean(troughs.map((row) => row.extra)),
      extraMedian: median(troughs.map((row) => row.extra)),
      noFurtherLowRate: rate(troughs.map((row) => row.extra >= 0)),
      dayMean: mean(troughs.map((row) => row.day)),
      dayMedian: median(troughs.map((row) => row.day)),
      recoveryFromBuyMean: mean(troughs.map((row) => row.recoveryFromBuy)),
      recoveryFromBuyMedian: median(troughs.map((row) => row.recoveryFromBuy)),
      recoveryFromLowMean: mean(troughs.map((row) => row.recoveryFromLow)),
      recoveryFromLowMedian: median(troughs.map((row) => row.recoveryFromLow)),
      gapToFutureLowMean: mean(troughs.map((row) => row.gapToFutureLow)),
      gapToFutureLowMedian: median(troughs.map((row) => row.gapToFutureLow)),
      gapToTrailingLowMean: mean(troughs.map((row) => row.gapToTrailingLow)),
      gapToTrailingLowMedian: median(troughs.map((row) => row.gapToTrailingLow)),
    },
    paths: {
      classified,
      unclassified: rows.length - classified,
      counts: paths,
      share: Object.fromEntries(PATHS.map((name) => [name, classified ? paths[name] / classified : null])),
    },
  }
}

function ready(cell) {
  return Boolean(cell && cell.n >= 10 && cell.mean != null && cell.median != null && cell.winRate != null)
}

function bounce(buy) {
  return ready(buy[60]) && ready(buy[120])
    && buy[60].mean > 0 && buy[60].median > 0
    && buy[120].mean > 0 && buy[120].median > 0
}

export function judgeBuy(input) {
  const buy = input.buy
  const random = input.random
  const edge = (horizon) => ready(buy[horizon]) && ready(random[horizon])
    && buy[horizon].mean > random[horizon].mean
    && buy[horizon].median > random[horizon].median
    && buy[horizon].winRate > random[horizon].winRate
  const mddOk = (horizon) => buy[horizon]?.mdd != null && random[horizon]?.mdd != null
    && buy[horizon].mdd >= random[horizon].mdd - MDD_TOLERANCE
  const ciOk = (horizon) => input.ci?.[horizon]
    && input.ci[horizon].meanLow > 0
    && input.ci[horizon].medianLow > 0
  const permOk = (horizon) => input.permutation?.[horizon] && input.permutation[horizon].p < 0.05
  const reachOk = input.reach10 != null && input.randomReach10 != null && input.reach10 > input.randomReach10
  const broad = input.breadth && input.breadth.qualified >= BREADTH_TICKERS
    && input.breadth.better / input.breadth.qualified >= BREADTH_MIN
  const confirmed = edge(60) && edge(120) && mddOk(60) && mddOk(120) && ciOk(60) && ciOk(120)
    && permOk(60) && permOk(120) && reachOk && broad
  let label = "C. BUY 신호의 성능이 불충분하다."
  if (confirmed) label = "A. BUY 신호가 실제로 유효한 저점 포착 신호다."
  else if (bounce(buy)) label = "B. BUY 신호는 평균 반등은 있지만 독립적인 우위가 약하다."
  return {
    label,
    improvement: label.startsWith("C.") ? "성능은 불충분하나 조건을 변경하지 않음" : "변경하지 않음",
    sellResearch: SELL_RESEARCH,
    production: PRODUCTION_CHANGE,
    selectedStrategy: null,
    flags: {
      edge60: edge(60),
      edge120: edge(120),
      mdd60: mddOk(60),
      mdd120: mddOk(120),
      ci60: ciOk(60),
      ci120: ciOk(120),
      perm60: permOk(60),
      perm120: permOk(120),
      reachOk,
      broad: Boolean(broad),
      bounce: bounce(buy),
    },
  }
}

function assertThresholds() {
  if (
    FROZEN_THRESHOLDS.rsiMax !== 36
    || FROZEN_THRESHOLDS.stochKMax !== 15.4
    || FROZEN_THRESHOLDS.bbPctBMax !== 0.01
    || FROZEN_THRESHOLDS.ma20DevMax !== -4.2
  ) {
    throw new Error("BUY thresholds changed")
  }
}

export function assertEpisodeIdentity(foundCounts, expectedCounts) {
  const lines = []
  let foundTotal = 0
  let expectedTotal = 0
  for (const symbol of TICKERS) {
    const found = foundCounts[symbol] ?? 0
    const expected = expectedCounts?.[symbol]
    foundTotal += found
    if (expected == null) lines.push(`${symbol} missing from the stored episode counts`)
    else {
      expectedTotal += expected
      if (found !== expected) lines.push(`${symbol} found ${found} stored ${expected}`)
    }
  }
  if (expectedCounts && expectedTotal !== EXPECTED_EPISODES) lines.push(`stored total ${expectedTotal} !== ${EXPECTED_EPISODES}`)
  if (foundTotal !== EXPECTED_EPISODES) lines.push(`found total ${foundTotal} !== ${EXPECTED_EPISODES}`)
  if (lines.length) {
    const error = new Error("episode identity mismatch")
    error.lines = lines
    throw error
  }
}

export function auditBuyLookAhead(bars) {
  const full = existingBuyIndexes(bars)
  const violations = []
  const cuts = []
  if (bars.length > 120) {
    cuts.push(Math.floor(bars.length * 0.5), Math.floor(bars.length * 0.8), bars.length - 1)
  }
  for (const cut of cuts) {
    const prefix = existingBuyIndexes(bars.slice(0, cut))
    const fullStable = full.filter((index) => index + EPISODE_LOOKAHEAD_BARS < cut)
    const prefixStable = prefix.filter((index) => index + EPISODE_LOOKAHEAD_BARS < cut)
    if (fullStable.join() !== prefixStable.join()) {
      violations.push({
        cut,
        reason: "a resolved BUY changed when later bars were removed",
        full: fullStable.length,
        prefix: prefixStable.length,
      })
      return violations
    }
  }
  if (bars.length > 40) {
    const mutated = bars.map((bar) => ({ ...bar }))
    const at = mutated.length - 1
    mutated[at] = {
      ...mutated[at],
      open: mutated[at].open * 7 + 250,
      high: mutated[at].high * 7 + 250,
      low: Math.max(0.01, mutated[at].low * 0.2),
      close: mutated[at].close * 7 + 250,
    }
    const again = existingBuyIndexes(mutated)
    const fullStable = full.filter((index) => index + EPISODE_LOOKAHEAD_BARS < at)
    const againStable = again.filter((index) => index + EPISODE_LOOKAHEAD_BARS < at)
    if (fullStable.join() !== againStable.join()) {
      violations.push({ reason: "a future close changed a resolved BUY", index: at })
    }
  }
  return violations
}

function spyMap(spyBars) {
  const out = new Map()
  if (!spyBars?.length) return out
  for (let i = 0; i < spyBars.length; i += 1) {
    const close = spyBars[i].close
    out.set(spyBars[i].date, {
      r20: i >= 20 && spyBars[i - 20].close > 0 ? close / spyBars[i - 20].close - 1 : null,
      r60: i >= 60 && spyBars[i - 60].close > 0 ? close / spyBars[i - 60].close - 1 : null,
    })
  }
  return out
}

function exactTrio(flags) {
  if (flags.count !== 3) return null
  return TRIOS.find((keys) => keys.every((key) => flags[key])) ?? null
}

function groupStats(rows) {
  const pooled = poolOutcomes(rows)
  return {
    n: rows.length,
    sample: sampleJudgment(rows.length),
    t20: pooled.performance[20],
    t60: pooled.performance[60],
    t120: pooled.performance[120],
    mdd60: pooled.drawdowns[60],
    reach10: pooled.reach[0.1],
  }
}

function compareCells(left, right) {
  if (!left || !right || left.mean == null || right.mean == null) return null
  return {
    mean: left.mean - right.mean,
    median: left.median - right.median,
    winRate: left.winRate - right.winRate,
    leftN: left.n,
    rightN: right.n,
  }
}

function blockBootstrap(byTicker, reps, rng) {
  const symbols = TICKERS.filter((symbol) => byTicker[symbol])
  const out = {}
  for (const horizon of [60, 120]) {
    const meanDiffs = []
    const medianDiffs = []
    for (let rep = 0; rep < reps; rep += 1) {
      const buyValues = []
      const randomValues = []
      for (let draw = 0; draw < symbols.length; draw += 1) {
        const symbol = symbols[Math.floor(rng() * symbols.length)]
        for (const value of byTicker[symbol].buy[horizon]) if (value != null) buyValues.push(value)
        for (const value of byTicker[symbol].random[horizon]) if (value != null) randomValues.push(value)
      }
      if (!buyValues.length || !randomValues.length) continue
      meanDiffs.push(mean(buyValues) - mean(randomValues))
      medianDiffs.push(median(buyValues) - median(randomValues))
    }
    out[horizon] = {
      reps: meanDiffs.length,
      meanLow: quantile(meanDiffs, 0.025),
      meanHigh: quantile(meanDiffs, 0.975),
      medianLow: quantile(medianDiffs, 0.025),
      medianHigh: quantile(medianDiffs, 0.975),
    }
  }
  return out
}

function permutationTest(byTicker, reps, rng) {
  const out = {}
  for (const horizon of [60, 120]) {
    const observedBuy = []
    const observedRandom = []
    const groups = []
    for (const symbol of TICKERS) {
      const bucket = byTicker[symbol]
      if (!bucket) continue
      const buyValues = bucket.buy[horizon].filter((value) => value != null)
      const randomValues = bucket.random[horizon].filter((value) => value != null)
      observedBuy.push(...buyValues)
      observedRandom.push(...randomValues)
      groups.push({ buy: buyValues.length, pool: buyValues.concat(randomValues) })
    }
    const observed = mean(observedBuy) - mean(observedRandom)
    let extreme = 0
    for (let rep = 0; rep < reps; rep += 1) {
      const buyValues = []
      const randomValues = []
      for (const group of groups) {
        const pool = group.pool.slice()
        for (let i = pool.length - 1; i > 0; i -= 1) {
          const j = Math.floor(rng() * (i + 1))
          const swap = pool[i]
          pool[i] = pool[j]
          pool[j] = swap
        }
        buyValues.push(...pool.slice(0, group.buy))
        randomValues.push(...pool.slice(group.buy))
      }
      const diff = mean(buyValues) - mean(randomValues)
      if (Math.abs(diff) >= Math.abs(observed) - 1e-15) extreme += 1
    }
    out[horizon] = { observed, p: reps ? extreme / reps : null, reps }
  }
  return out
}

function publicTicker(symbol, buyRows, randomRows) {
  const buy = poolOutcomes(buyRows)
  const random = poolOutcomes(randomRows)
  return {
    symbol,
    episodes: buyRows.length,
    sample: sampleJudgment(buy.performance[60]?.n ?? 0),
    t20: buy.performance[20],
    t60: buy.performance[60],
    t120: buy.performance[120],
    reach10: buy.reach[0.1],
    extraMedian: buy.trough.extraMedian,
    extraMean: buy.trough.extraMean,
    randomT60: random.performance[60],
    randomT120: random.performance[120],
  }
}

export function runStudy(seriesByTicker, expectedCounts, spyBars = null) {
  assertThresholds()
  if (TICKERS.length !== 31) throw new Error("universe size changed")
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  const missing = TICKERS.filter((symbol) => !seriesByTicker[symbol]?.length)
  if (missing.length) throw new Error(`missing bars: ${missing.join(",")}`)

  const violations = []
  for (const symbol of TICKERS) {
    const found = auditBuyLookAhead(seriesByTicker[symbol])
    if (found.length) {
      violations.push(...found.map((row) => ({ symbol, ...row })))
      const error = new Error("lookaheadViolations")
      error.violations = violations
      throw error
    }
  }

  const market = spyMap(spyBars)
  const rng = mulberry32(RANDOM_SEED)
  const byTicker = {}
  const buyRows = []
  const randomRows = []
  const identity = []
  const counts = {}

  for (const symbol of TICKERS) {
    const bars = seriesByTicker[symbol]
    const enriched = enrichBarsWithIndicators(bars)
    const episodes = buildSplitBuyEpisodes(enriched, FROZEN_THRESHOLDS, { fromIdx: 0, toIdx: enriched.length })
    const viaExisting = existingBuyIndexes(bars)
    if (episodes.map((episode) => episode.openIdx).join() !== viaExisting.join()) {
      throw new Error(`${symbol} episode indexes diverged from existingBuyIndexes`)
    }
    for (let i = 1; i < episodes.length; i += 1) {
      if (episodes[i].openIdx <= episodes[i - 1].endIdx) {
        throw new Error(`${symbol} overlapping episode at ${episodes[i].openDate}`)
      }
    }
    const closes = bars.map((bar) => bar.close)
    const opens = new Set(episodes.map((episode) => episode.openIdx))
    const tickerBuys = episodes.map((episode) => {
      const flags = conditionFlags(enriched[episode.openIdx], FROZEN_THRESHOLDS)
      const spy = market.get(episode.openDate) ?? null
      const row = {
        symbol,
        date: episode.openDate,
        index: episode.openIdx,
        count: flags.count,
        flags,
        trio: exactTrio(flags)?.join("+") ?? null,
        regime: classifyRegime(spy?.r60 ?? null),
        spy20: spy?.r20 ?? null,
        spy60: spy?.r60 ?? null,
        ...outcome(closes, episode.openIdx),
      }
      identity.push({ symbol, date: episode.openDate })
      return row
    })
    const eligible = []
    for (let i = 0; i < enriched.length; i += 1) {
      if (opens.has(i)) continue
      const flags = conditionFlags(enriched[i], FROZEN_THRESHOLDS)
      const indicatorsReady = ["rsi", "stoch", "bb", "ma"].every((key) => flags[key] === true || flags[key] === false)
        && enriched[i].rsi14 != null && enriched[i].stochK != null && enriched[i].bbPctB != null && enriched[i].ma20DevPct != null
      if (indicatorsReady) eligible.push(i)
    }
    const picked = takeSample(eligible, tickerBuys.length, rng)
    if (picked.length !== tickerBuys.length) {
      throw new Error(`${symbol} random sample ${picked.length} !== episodes ${tickerBuys.length}`)
    }
    const tickerRandom = picked.map((index) => ({ symbol, date: bars[index].date, index, ...outcome(closes, index) }))
    counts[symbol] = tickerBuys.length
    byTicker[symbol] = {
      buy: { 60: tickerBuys.map((row) => row.returns[60]), 120: tickerBuys.map((row) => row.returns[120]) },
      random: { 60: tickerRandom.map((row) => row.returns[60]), 120: tickerRandom.map((row) => row.returns[120]) },
    }
    buyRows.push(...tickerBuys)
    randomRows.push(...tickerRandom)
  }

  assertEpisodeIdentity(counts, expectedCounts)
  const buy = poolOutcomes(buyRows)
  const random = poolOutcomes(randomRows)
  const ci = blockBootstrap(byTicker, BOOTSTRAP_REPS, mulberry32(BOOTSTRAP_SEED))
  const permutation = permutationTest(byTicker, PERMUTATION_REPS, mulberry32(PERMUTATION_SEED))
  const tickerViews = TICKERS.map((symbol) => publicTicker(
    symbol,
    buyRows.filter((row) => row.symbol === symbol),
    randomRows.filter((row) => row.symbol === symbol),
  ))
  const breadthRows = tickerViews.filter((ticker) => ready(ticker.t60) && ready(ticker.randomT60) && ready(ticker.t120) && ready(ticker.randomT120))
  const breadth = {
    qualified: breadthRows.length,
    better: breadthRows.filter((ticker) => ticker.t60.mean > ticker.randomT60.mean && ticker.t120.mean > ticker.randomT120.mean).length,
  }
  const judgment = judgeBuy({
    buy: {
      60: { ...buy.performance[60], mdd: buy.drawdowns[60].mean },
      120: { ...buy.performance[120], mdd: buy.drawdowns[120].mean },
    },
    random: {
      60: { ...random.performance[60], mdd: random.drawdowns[60].mean },
      120: { ...random.performance[120], mdd: random.drawdowns[120].mean },
    },
    ci,
    permutation,
    reach10: buy.reach[0.1].rate,
    randomReach10: random.reach[0.1].rate,
    breadth,
  })

  const countGroups = {}
  for (const count of [3, 4]) countGroups[count] = groupStats(buyRows.filter((row) => row.count === count))
  const flagStats = {}
  for (const key of FLAG_KEYS) {
    const rows = buyRows.filter((row) => row.flags[key])
    flagStats[key] = {
      present: rows.length,
      share: buyRows.length ? rows.length / buyRows.length : null,
      ...groupStats(rows),
    }
  }
  const pairs = PAIRS.map((keys) => {
    const matched = buyRows.filter((row) => keys.every((key) => row.flags[key]))
    return { keys: keys.join("+"), n: matched.length, share: buyRows.length ? matched.length / buyRows.length : null }
  })
  const trios = TRIOS.map((keys) => {
    const name = keys.join("+")
    return { keys: name, ...groupStats(buyRows.filter((row) => row.trio === name)) }
  })
  const regimes = {}
  for (const name of ["강세", "중립", "약세"]) regimes[name] = groupStats(buyRows.filter((row) => row.regime === name))
  const dates = TICKERS.flatMap((symbol) => {
    const bars = seriesByTicker[symbol]
    return [bars[0]?.date, bars[bars.length - 1]?.date]
  }).filter(Boolean).sort()

  return {
    version: "v38",
    selectedStrategy: null,
    sellResearch: SELL_RESEARCH,
    productionChanged: false,
    buyChanged: false,
    optimized: false,
    filledWithWindowEnd: false,
    universe: TICKERS,
    thresholds: {
      rsiMax: FROZEN_THRESHOLDS.rsiMax,
      stochKMax: FROZEN_THRESHOLDS.stochKMax,
      bbPctBMax: FROZEN_THRESHOLDS.bbPctBMax,
      ma20DevMax: FROZEN_THRESHOLDS.ma20DevMax,
    },
    random: { seed: RANDOM_SEED, bootstrapReps: BOOTSTRAP_REPS, permutationReps: PERMUTATION_REPS },
    lookAhead: { violations: 0 },
    integrity: {
      tickers: TICKERS.length,
      from: dates[0] ?? null,
      to: dates[dates.length - 1] ?? null,
      episodes: buyRows.length,
      counts,
      overlap: 0,
      fingerprint: createHash("sha256").update(identity.map((row) => `${row.symbol}|${row.date}`).join("\n")).digest("hex"),
      dependence: "같은 종목의 episode는 서로 독립이 아니다.",
    },
    buy,
    randomSample: random,
    comparison: {
      20: compareCells(buy.performance[20], random.performance[20]),
      60: compareCells(buy.performance[60], random.performance[60]),
      120: compareCells(buy.performance[120], random.performance[120]),
      reach10: buy.reach[0.1].rate == null || random.reach[0.1].rate == null ? null : buy.reach[0.1].rate - random.reach[0.1].rate,
      mdd60: buy.drawdowns[60].mean == null || random.drawdowns[60].mean == null ? null : buy.drawdowns[60].mean - random.drawdowns[60].mean,
      mdd120: buy.drawdowns[120].mean == null || random.drawdowns[120].mean == null ? null : buy.drawdowns[120].mean - random.drawdowns[120].mean,
    },
    ci,
    permutation,
    breadth,
    countGroups,
    flagStats,
    pairs,
    trios,
    regimes,
    regimeContext: {
      spy20Mean: mean(buyRows.map((row) => row.spy20).filter((value) => value != null)),
      spy60Mean: mean(buyRows.map((row) => row.spy60).filter((value) => value != null)),
      missing: buyRows.filter((row) => row.regime == null).length,
    },
    tickers: tickerViews,
    focus: FOCUS_TICKERS.map((symbol) => tickerViews.find((ticker) => ticker.symbol === symbol)),
    judgment,
    episodes: identity,
  }
}
