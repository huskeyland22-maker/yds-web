/**
 * v39 equal-cash add-on study. Research only.
 * The frozen BUY episodes stay fixed. The only add rules are one extra 1.0
 * at the first close at or below -5%, and one extra 1.0 at the first close
 * at or below -10%. No other threshold, multiple, or add count is tested.
 * selectedStrategy stays null. This does not adopt a production rule.
 *
 * Equal cash invested at a lower price raises the capital-weighted return at
 * every later positive price. That gap, and the percentage drawdown that
 * goes with it, is arithmetic. It is reported, and it is not the adoption test.
 *
 * A strategy is worth further research only when all of these hold for the
 * extra 1.0 and the deep-dip path:
 * extra-dollar mean and median through T+120 are positive,
 * the ticker-block bootstrap 95% CI of that mean is above 0,
 * at most 20% of adds are still down at T+120,
 * the -20% or deeper price-dip group has n>=10, a positive T+120 mean,
 * and a win rate above 50%,
 * and the median further drop after the add is not worse than -5%.
 * A profitable extra dollar without those recovery checks is reference only.
 * A non-positive extra dollar ends the line. Neither label changes production.
 */

import { createHash } from "node:crypto"

import { FROZEN_THRESHOLDS, buildSplitBuyEpisodes } from "./daily-bottom-split-buy-sim.mjs"
import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import {
  EQUITY_SELL_RESEARCH_SELECTED_STRATEGY,
} from "./equity-sell-research-universe.mjs"
import { SELECTED_STRATEGY as TECHNICAL_SELECTED_STRATEGY, existingBuyIndexes } from "./equity-technical-sell-v1.mjs"
import {
  EXPECTED_EPISODES,
  FOCUS_TICKERS,
  TICKERS,
  auditBuyLookAhead,
  mulberry32,
  quantile,
  sampleJudgment,
} from "./equity-buy-validation-v38.mjs"

if (EQUITY_SELL_RESEARCH_SELECTED_STRATEGY !== null || TECHNICAL_SELECTED_STRATEGY !== null) {
  throw new Error("selectedStrategy must stay null")
}

export const SELECTED_STRATEGY = null
export const HORIZONS = [20, 60, 120]
export const STRATEGIES = ["BUY_AND_HOLD", "BUY_PLUS_5", "BUY_PLUS_10"]
export const ADD_THRESHOLD = { BUY_AND_HOLD: null, BUY_PLUS_5: -0.05, BUY_PLUS_10: -0.1 }
export const BOOTSTRAP_REPS = 1000
export const PERMUTATION_REPS = 1000
export const BOOTSTRAP_SEED = 39001
export const PERMUTATION_SEED = 39002
export { EXPECTED_EPISODES, FOCUS_TICKERS, TICKERS }

const DIP_GROUPS = ["NO_DIP", "DIP_5_10", "DIP_10_20", "DIP_20_PLUS"]

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

export function averageCost(buyPrice, addPrice) {
  return (2 * buyPrice * addPrice) / (buyPrice + addPrice)
}

export function firstBreachIndex(closes, openIdx, threshold, horizon) {
  const end = openIdx + horizon
  if (threshold == null || end >= closes.length || !(closes[openIdx] > 0)) return null
  for (let step = 1; step <= horizon; step += 1) {
    if (closes[openIdx + step] / closes[openIdx] - 1 <= threshold + 1e-9) return openIdx + step
  }
  return null
}

export function simulateAddon(closes, openIdx, horizon, threshold) {
  const end = openIdx + horizon
  if (end >= closes.length || !(closes[openIdx] > 0)) return null
  const buyPrice = closes[openIdx]
  const addIdx = firstBreachIndex(closes, openIdx, threshold, horizon)
  let shares = 1 / buyPrice
  let invested = 1
  let addPrice = null
  let pathMin = 0
  let minFromAdd = null
  for (let step = 0; step <= horizon; step += 1) {
    const cursor = openIdx + step
    if (addIdx != null && cursor === addIdx) {
      addPrice = closes[cursor]
      shares += 1 / addPrice
      invested = 2
    }
    const capitalReturn = shares * closes[cursor] / invested - 1
    if (capitalReturn < pathMin) pathMin = capitalReturn
    if (addPrice != null) {
      const fromAdd = closes[cursor] / addPrice - 1
      if (minFromAdd == null || fromAdd < minFromAdd) minFromAdd = fromAdd
    }
  }
  const endClose = closes[end]
  const value = shares * endClose
  const avgCost = addPrice == null ? buyPrice : averageCost(buyPrice, addPrice)
  return {
    capitalReturn: value / invested - 1,
    initialStakeReturn: value - 1,
    priceReturn: endClose / buyPrice - 1,
    added: addIdx != null,
    addDelay: addIdx == null ? null : addIdx - openIdx,
    addPrice,
    avgCost,
    avgImprovement: addPrice == null ? null : avgCost / buyPrice - 1,
    mdd: pathMin,
    extraProfit: addPrice == null ? 0 : endClose / addPrice - 1,
    minFromAdd,
    invested,
  }
}

function daysUntil(closes, fromIdx, endIdx, level) {
  for (let cursor = fromIdx; cursor <= endIdx; cursor += 1) {
    if (closes[cursor] >= level) return cursor - fromIdx
  }
  return null
}

function dipClass(minReturn) {
  if (minReturn > -0.05) return "NO_DIP"
  if (minReturn > -0.1) return "DIP_5_10"
  if (minReturn > -0.2) return "DIP_10_20"
  return "DIP_20_PLUS"
}

function summarize(values) {
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

function tailSummary(drawdowns) {
  return {
    n: drawdowns.length,
    mean: mean(drawdowns),
    median: median(drawdowns),
    tail5: rate(drawdowns.map((value) => value <= -0.05)),
    tail10: rate(drawdowns.map((value) => value <= -0.1)),
    tail20: rate(drawdowns.map((value) => value <= -0.2)),
    tail30: rate(drawdowns.map((value) => value <= -0.3)),
    tail40: rate(drawdowns.map((value) => value <= -0.4)),
  }
}

function dollarVerdict(dollar) {
  const positive = Boolean(dollar && dollar.mean > 0 && dollar.median > 0 && dollar.ciLow > 0)
  const recovered = Boolean(dollar && dollar.loss120 != null && dollar.loss120 <= 0.2)
  const deep = Boolean(dollar && dollar.deepN >= 10 && dollar.deepMean > 0 && dollar.deepWin > 0.5)
  const timing = Boolean(dollar && dollar.furtherMedian != null && dollar.furtherMedian >= -0.05)
  return { positive, recovered, deep, timing, confirmed: positive && recovered && deep && timing }
}

export function judgeAddon(input) {
  const labels = {
    A: "A. 추가매수 연구를 더 진행할 가치가 있다.",
    B: "B. 특정 추가매수 방식은 참고 가치가 있지만 범용 규칙으로 채택할 정도는 아니다.",
    C: "C. 추가매수도 B&H보다 명확한 우위가 없어 연구를 종료한다.",
  }
  const names = ["BUY_PLUS_5", "BUY_PLUS_10"]
  const verdicts = Object.fromEntries(names.map((name) => [name, dollarVerdict(input.extraDollar?.[name])]))
  const confirmed = names.filter((name) => verdicts[name].confirmed)
  const positive = names.filter((name) => verdicts[name].positive)
  let label = labels.C
  if (confirmed.length) label = labels.A
  else if (positive.length) label = labels.B
  return {
    label,
    verdicts,
    confirmed,
    production: "변경 없음",
    selectedStrategy: null,
    sellResearch: "재개하지 않음",
  }
}

export function assertStoredEpisodes(found, stored) {
  const list = Array.isArray(stored) ? stored : stored?.episodes
  const lines = []
  if (!list?.length) lines.push("stored v38 episodes are missing")
  if (found.length !== EXPECTED_EPISODES) lines.push(`found ${found.length} !== ${EXPECTED_EPISODES}`)
  if (list && list.length !== EXPECTED_EPISODES) lines.push(`stored ${list.length} !== ${EXPECTED_EPISODES}`)
  const limit = Math.min(found.length, list?.length ?? 0)
  for (let i = 0; i < limit; i += 1) {
    if (found[i].symbol !== list[i].symbol || found[i].date !== list[i].date) {
      lines.push(`#${i} ${found[i].symbol} ${found[i].date} !== ${list[i].symbol} ${list[i].date}`)
    }
    if (lines.length > 12) break
  }
  const fingerprint = createHash("sha256").update(found.map((row) => `${row.symbol}|${row.date}`).join("\n")).digest("hex")
  if (stored?.fingerprint && stored.fingerprint !== fingerprint) lines.push(`fingerprint ${fingerprint} !== ${stored.fingerprint}`)
  if (lines.length) {
    const error = new Error("episode identity mismatch")
    error.lines = lines
    throw error
  }
  return fingerprint
}

function blockInterval(diffsByTicker, reps, rng) {
  const symbols = TICKERS.filter((symbol) => diffsByTicker[symbol]?.length)
  const meanDiffs = []
  const medianDiffs = []
  for (let rep = 0; rep < reps; rep += 1) {
    const values = []
    for (let draw = 0; draw < symbols.length; draw += 1) {
      values.push(...diffsByTicker[symbols[Math.floor(rng() * symbols.length)]])
    }
    if (!values.length) continue
    meanDiffs.push(mean(values))
    medianDiffs.push(median(values))
  }
  return {
    reps: meanDiffs.length,
    meanLow: quantile(meanDiffs, 0.025),
    meanHigh: quantile(meanDiffs, 0.975),
    medianLow: quantile(medianDiffs, 0.025),
    medianHigh: quantile(medianDiffs, 0.975),
  }
}

function signFlip(diffsByTicker, reps, rng) {
  const observedValues = TICKERS.flatMap((symbol) => diffsByTicker[symbol] ?? [])
  const observed = mean(observedValues)
  let extreme = 0
  for (let rep = 0; rep < reps; rep += 1) {
    const flipped = []
    for (const symbol of TICKERS) {
      for (const value of diffsByTicker[symbol] ?? []) flipped.push(rng() < 0.5 ? -value : value)
    }
    if (Math.abs(mean(flipped)) + 1e-15 >= Math.abs(observed)) extreme += 1
  }
  return { observed, p: reps ? extreme / reps : null, reps }
}

function blankBuckets() {
  return Object.fromEntries(HORIZONS.map((horizon) => [horizon, []]))
}

function consume(buckets, row) {
  for (const horizon of HORIZONS) {
    const outcome = row[horizon]
    if (!outcome) continue
    buckets[horizon].push(outcome)
  }
}

function publish(buckets) {
  const out = {}
  for (const horizon of HORIZONS) {
    const rows = buckets[horizon]
    const drawdowns = rows.map((row) => row.mdd)
    const tails = tailSummary(drawdowns)
    out[horizon] = {
      ...summarize(rows.map((row) => row.capitalReturn)),
      initialStake: summarize(rows.map((row) => row.initialStakeReturn)),
      price: summarize(rows.map((row) => row.priceReturn)),
      mdd: tails.mean,
      mddMedian: tails.median,
      tail5: tails.tail5,
      tail10: tails.tail10,
      tail20: tails.tail20,
      tail30: tails.tail30,
      tail40: tails.tail40,
      addRate: rate(rows.map((row) => row.added)),
      addN: rows.filter((row) => row.added).length,
    }
  }
  return out
}

export function runStudy(seriesByTicker, storedEpisodes) {
  if (FROZEN_THRESHOLDS.rsiMax !== 36 || FROZEN_THRESHOLDS.stochKMax !== 15.4 || FROZEN_THRESHOLDS.bbPctBMax !== 0.01 || FROZEN_THRESHOLDS.ma20DevMax !== -4.2) {
    throw new Error("BUY thresholds changed")
  }
  if (SELECTED_STRATEGY !== null || TICKERS.length !== 31) throw new Error("universe or strategy changed")
  const missing = TICKERS.filter((symbol) => !seriesByTicker[symbol]?.length)
  if (missing.length) throw new Error(`missing bars: ${missing.join(",")}`)
  for (const symbol of TICKERS) {
    const violations = auditBuyLookAhead(seriesByTicker[symbol])
    if (violations.length) {
      const error = new Error("lookaheadViolations")
      error.violations = violations.map((row) => ({ symbol, ...row }))
      throw error
    }
  }

  const found = []
  const perTicker = {}
  const pooled = Object.fromEntries(STRATEGIES.map((name) => [name, blankBuckets()]))
  const addedOnly = {
    BUY_PLUS_5: blankBuckets(),
    BUY_PLUS_10: blankBuckets(),
  }
  const dips = Object.fromEntries(DIP_GROUPS.map((name) => [name, []]))
  const recovery = { BUY_PLUS_5: [], BUY_PLUS_10: [] }

  for (const symbol of TICKERS) {
    const bars = seriesByTicker[symbol]
    const enriched = enrichBarsWithIndicators(bars)
    const episodes = buildSplitBuyEpisodes(enriched, FROZEN_THRESHOLDS, { fromIdx: 0, toIdx: enriched.length })
    if (episodes.map((episode) => episode.openIdx).join() !== existingBuyIndexes(bars).join()) {
      throw new Error(`${symbol} episode indexes diverged`)
    }
    for (let i = 1; i < episodes.length; i += 1) {
      if (episodes[i].openIdx <= episodes[i - 1].endIdx) throw new Error(`${symbol} overlapping episode`)
    }
    const closes = bars.map((bar) => bar.close)
    perTicker[symbol] = []
    for (const episode of episodes) {
      const price = closes[episode.openIdx]
      if (bars[episode.openIdx].date !== episode.openDate || price !== episode.openPrice) {
        throw new Error(`${symbol} buy price mismatch at ${episode.openDate}`)
      }
      found.push({ symbol, date: episode.openDate, price })
      const outcomes = {}
      for (const name of STRATEGIES) {
        outcomes[name] = {}
        for (const horizon of HORIZONS) {
          outcomes[name][horizon] = simulateAddon(closes, episode.openIdx, horizon, ADD_THRESHOLD[name])
        }
      }
      for (const name of STRATEGIES) consume(pooled[name], outcomes[name])
      for (const name of ["BUY_PLUS_5", "BUY_PLUS_10"]) {
        const conditional = {}
        for (const horizon of HORIZONS) conditional[horizon] = outcomes[name][horizon]?.added ? outcomes[name][horizon] : null
        consume(addedOnly[name], conditional)
      }
      const full = outcomes.BUY_AND_HOLD[120]
      if (full) {
        let minReturn = 0
        let day = 0
        for (let step = 1; step <= 120; step += 1) {
          const change = closes[episode.openIdx + step] / price - 1
          if (change < minReturn) {
            minReturn = change
            day = step
          }
        }
        dips[dipClass(minReturn)].push({
          t60: outcomes.BUY_AND_HOLD[60]?.capitalReturn ?? null,
          t120: full.capitalReturn,
          day,
        })
      }
      for (const name of ["BUY_PLUS_5", "BUY_PLUS_10"]) {
        const outcome = outcomes[name][120]
        if (!outcome?.added) continue
        const addIdx = episode.openIdx + outcome.addDelay
        const end = episode.openIdx + 120
        const bases = {
          add: outcome.addPrice,
          average: outcome.avgCost,
          buy: price,
        }
        const record = { minFromAdd: outcome.minFromAdd }
        for (const [baseName, base] of Object.entries(bases)) {
          for (const target of [0, 0.05, 0.1]) {
            record[`${baseName}_${target}`] = daysUntil(closes, addIdx, end, base * (1 + target))
          }
        }
        for (const target of [0.05, 0.1, 0.2]) {
          record[`rise_${target}`] = daysUntil(closes, addIdx, end, outcome.addPrice * (1 + target))
        }
        recovery[name].push(record)
      }
      perTicker[symbol].push(outcomes)
    }
  }

  const fingerprint = assertStoredEpisodes(found, storedEpisodes)
  const strategyStats = Object.fromEntries(STRATEGIES.map((name) => [name, publish(pooled[name])]))
  const conditionalStats = Object.fromEntries(["BUY_PLUS_5", "BUY_PLUS_10"].map((name) => [name, publish(addedOnly[name])]))
  const diffs = { BUY_PLUS_5: { 60: {}, 120: {} }, BUY_PLUS_10: { 60: {}, 120: {} } }
  for (const symbol of TICKERS) {
    for (const name of ["BUY_PLUS_5", "BUY_PLUS_10"]) {
      for (const horizon of [60, 120]) {
        diffs[name][horizon][symbol] = perTicker[symbol]
          .map((row) => (row[name][horizon] && row.BUY_AND_HOLD[horizon]
            ? row[name][horizon].capitalReturn - row.BUY_AND_HOLD[horizon].capitalReturn
            : null))
          .filter((value) => value != null)
      }
    }
  }
  const ci = {}
  const permutation = {}
  for (const name of ["BUY_PLUS_5", "BUY_PLUS_10"]) {
    ci[name] = {}
    permutation[name] = {}
    for (const horizon of [60, 120]) {
      ci[name][horizon] = blockInterval(diffs[name][horizon], BOOTSTRAP_REPS, mulberry32(BOOTSTRAP_SEED + horizon))
      permutation[name][horizon] = signFlip(diffs[name][horizon], PERMUTATION_REPS, mulberry32(PERMUTATION_SEED + horizon))
    }
  }

  const tickers = TICKERS.map((symbol) => {
    const rows = perTicker[symbol]
    const cell = (name, horizon) => summarize(rows.map((row) => row[name][horizon]?.capitalReturn).filter((value) => value != null))
    const draw = (name, horizon) => mean(rows.map((row) => row[name][horizon]?.mdd).filter((value) => value != null))
    const addRate = (name) => rate(rows.map((row) => row[name][120]?.added).filter((value) => value != null))
    return {
      symbol,
      episodes: rows.length,
      sample: sampleJudgment(cell("BUY_AND_HOLD", 120).n),
      addRate5: addRate("BUY_PLUS_5"),
      addRate10: addRate("BUY_PLUS_10"),
      BUY_AND_HOLD: { 60: cell("BUY_AND_HOLD", 60), 120: cell("BUY_AND_HOLD", 120), mdd120: draw("BUY_AND_HOLD", 120) },
      BUY_PLUS_5: { 60: cell("BUY_PLUS_5", 60), 120: cell("BUY_PLUS_5", 120), mdd120: draw("BUY_PLUS_5", 120) },
      BUY_PLUS_10: { 60: cell("BUY_PLUS_10", 60), 120: cell("BUY_PLUS_10", 120), mdd120: draw("BUY_PLUS_10", 120) },
    }
  })
  const breadthFor = (name) => {
    const qualified = tickers.filter((ticker) => ticker.BUY_AND_HOLD[120].n >= 10 && ticker[name][120].n >= 10 && ticker.BUY_AND_HOLD[60].n >= 10)
    return {
      qualified: qualified.length,
      better: qualified.filter((ticker) => ticker[name][60].mean > ticker.BUY_AND_HOLD[60].mean && ticker[name][120].mean > ticker.BUY_AND_HOLD[120].mean).length,
      better60: qualified.filter((ticker) => ticker[name][60].mean > ticker.BUY_AND_HOLD[60].mean).length,
      better120: qualified.filter((ticker) => ticker[name][120].mean > ticker.BUY_AND_HOLD[120].mean).length,
    }
  }
  const extraByTicker = { BUY_PLUS_5: {}, BUY_PLUS_10: {} }
  for (const symbol of TICKERS) {
    for (const name of ["BUY_PLUS_5", "BUY_PLUS_10"]) {
      extraByTicker[name][symbol] = perTicker[symbol]
        .map((row) => (row[name][120]?.added ? row[name][120].extraProfit : null))
        .filter((value) => value != null)
    }
  }
  const extraCi = {
    BUY_PLUS_5: blockInterval(extraByTicker.BUY_PLUS_5, BOOTSTRAP_REPS, mulberry32(BOOTSTRAP_SEED + 7)),
    BUY_PLUS_10: blockInterval(extraByTicker.BUY_PLUS_10, BOOTSTRAP_REPS, mulberry32(BOOTSTRAP_SEED + 11)),
  }
  const extraDollar = {}
  for (const name of ["BUY_PLUS_5", "BUY_PLUS_10"]) {
    extraDollar[name] = {
      mean: null,
      median: null,
      ciLow: extraCi[name].meanLow,
      loss120: null,
      deepN: null,
      deepMean: null,
      deepWin: null,
      furtherMedian: null,
    }
  }
  const judgmentInput = { extraDollar }
  const cost = {}
  for (const name of ["BUY_PLUS_5", "BUY_PLUS_10"]) {
    const rows = []
    for (const symbol of TICKERS) {
      for (const item of perTicker[symbol]) {
        const outcome = item[name][120]
        if (outcome?.added) rows.push(outcome)
      }
    }
    cost[name] = {
      n: rows.length,
      avgImprovementMean: mean(rows.map((row) => row.avgImprovement)),
      avgImprovementMedian: median(rows.map((row) => row.avgImprovement)),
      extraProfitMean: mean(rows.map((row) => row.extraProfit)),
      extraProfitMedian: median(rows.map((row) => row.extraProfit)),
      minFromAddMean: mean(rows.map((row) => row.minFromAdd)),
      minFromAddMedian: median(rows.map((row) => row.minFromAdd)),
      extraCi: extraCi[name],
    }
    extraDollar[name].mean = cost[name].extraProfitMean
    extraDollar[name].median = cost[name].extraProfitMedian
    extraDollar[name].furtherMedian = cost[name].minFromAddMedian
  }
  const recoveryStats = {}
  for (const name of ["BUY_PLUS_5", "BUY_PLUS_10"]) {
    const rows = recovery[name]
    const pack = (key) => {
      const known = rows.map((row) => row[key])
      const hits = known.filter((value) => value != null)
      return { n: known.length, rate: known.length ? hits.length / known.length : null, meanDay: mean(hits), medianDay: median(hits) }
    }
    recoveryStats[name] = {}
    for (const base of ["add", "average", "buy"]) {
      for (const target of [0, 0.05, 0.1]) recoveryStats[name][`${base}_${target}`] = pack(`${base}_${target}`)
    }
    for (const target of [0.05, 0.1, 0.2]) recoveryStats[name][`rise_${target}`] = pack(`rise_${target}`)
    recoveryStats[name].deeper5 = rate(rows.map((row) => row.minFromAdd <= -0.05))
    recoveryStats[name].deeper10 = rate(rows.map((row) => row.minFromAdd <= -0.1))
    recoveryStats[name].deeper20 = rate(rows.map((row) => row.minFromAdd <= -0.2))
    recoveryStats[name].deeper30 = rate(rows.map((row) => row.minFromAdd <= -0.3))
    recoveryStats[name].deeper40 = rate(rows.map((row) => row.minFromAdd <= -0.4))
  }
  const dipStats = {}
  for (const name of DIP_GROUPS) {
    const rows = dips[name]
    dipStats[name] = {
      n: rows.length,
      sample: sampleJudgment(rows.length),
      t60: summarize(rows.map((row) => row.t60).filter((value) => value != null)),
      t120: summarize(rows.map((row) => row.t120)),
      dayMean: mean(rows.map((row) => row.day)),
      dayMedian: median(rows.map((row) => row.day)),
    }
  }
  for (const name of ["BUY_PLUS_5", "BUY_PLUS_10"]) {
    extraDollar[name].deepN = dipStats.DIP_20_PLUS.n
    extraDollar[name].deepMean = dipStats.DIP_20_PLUS.t120.mean
    extraDollar[name].deepWin = dipStats.DIP_20_PLUS.t120.winRate
  }
  const loss = {}
  for (const name of ["BUY_PLUS_5", "BUY_PLUS_10"]) {
    loss[name] = {}
    for (const horizon of [60, 120]) {
      const rows = []
      for (const symbol of TICKERS) {
        for (const item of perTicker[symbol]) {
          const outcome = item[name][horizon]
          if (outcome?.added) rows.push(outcome.capitalReturn)
        }
      }
      loss[name][horizon] = {
        n: rows.length,
        loss: rate(rows.map((value) => value < 0)),
        loss10: horizon === 120 ? rate(rows.map((value) => value <= -0.1)) : null,
        loss20: horizon === 120 ? rate(rows.map((value) => value <= -0.2)) : null,
      }
    }
    extraDollar[name].loss120 = loss[name][120].loss
  }
  const judgment = judgeAddon(judgmentInput)

  return {
    version: "v39",
    selectedStrategy: null,
    productionChanged: false,
    buyChanged: false,
    optimized: false,
    filledWithWindowEnd: false,
    universe: TICKERS,
    lookAhead: { violations: 0 },
    integrity: {
      tickers: 31,
      episodes: found.length,
      overlap: 0,
      fingerprint,
      thresholds: {
        rsiMax: 36,
        stochKMax: 15.4,
        bbPctBMax: 0.01,
        ma20DevMax: -4.2,
      },
    },
    strategies: strategyStats,
    conditional: conditionalStats,
    cost,
    recovery: recoveryStats,
    dips: dipStats,
    loss,
    ci,
    permutation,
    breadth: { BUY_PLUS_5: breadthFor("BUY_PLUS_5"), BUY_PLUS_10: breadthFor("BUY_PLUS_10") },
    focus: FOCUS_TICKERS.map((symbol) => tickers.find((ticker) => ticker.symbol === symbol)),
    tickers,
    judgment,
  }
}
