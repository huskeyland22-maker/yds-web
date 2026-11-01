/**
 * US single-stock leadership study v2 (research only).
 *
 * Reuses the v1 +10/-10 events. Leadership uses only closes before the
 * correction date, ranked against the other research names that day.
 * No sell rule is selected.
 */

import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./equity-sell-research-universe.mjs"

export { EQUITY_SELL_RESEARCH_UNIVERSE }

export const SELECTED_STRATEGY = null
export const LOCKED_DEEP_EVENTS = 494
export const FEATURE_KEYS = ["ret60", "ret120", "upDay60", "position60"]
export const HIGH_MIN = 70
export const MID_MIN = 30

export function sampleJudgment(n) {
  if (n < 5) return "no_conclusion"
  if (n < 10) return "withhold"
  return "limited"
}

export function comparisonJudgment(left, right) {
  if (left < 5 || right < 5) return "no_conclusion"
  if (left < 10 || right < 10) return "withhold"
  return "limited"
}

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function round4(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 10000) / 10000
}

function pct(fraction) {
  if (fraction == null || !Number.isFinite(fraction)) return null
  return round2(fraction * 100)
}

export function mean(values) {
  const xs = values.filter((value) => Number.isFinite(value))
  if (!xs.length) return null
  return xs.reduce((sum, value) => sum + value, 0) / xs.length
}

export function median(values) {
  const xs = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (!xs.length) return null
  const mid = Math.floor(xs.length / 2)
  if (xs.length % 2) return xs[mid]
  return (xs[mid - 1] + xs[mid]) / 2
}

function share(flags) {
  if (!flags.length) return null
  return (flags.filter(Boolean).length / flags.length) * 100
}

export function indexBefore(dates, correctionDate) {
  let lo = 0
  let hi = dates.length - 1
  let answer = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (dates[mid] < correctionDate) {
      answer = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return answer
}

export function hasExactDate(dates, date) {
  let lo = 0
  let hi = dates.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (dates[mid] === date) return true
    if (dates[mid] < date) lo = mid + 1
    else hi = mid - 1
  }
  return false
}

/**
 * Closes strictly before the correction bar.
 * ret60 = close[entry-1] / close[entry-61] - 1
 * ret120 = close[entry-1] / close[entry-121] - 1
 */
export function featurePack(closes, prev) {
  if (prev < 0) return { ret60: null, ret120: null, upDay60: null, position60: null }
  const ret60 = prev >= 60 ? closes[prev] / closes[prev - 60] - 1 : null
  const ret120 = prev >= 120 ? closes[prev] / closes[prev - 120] - 1 : null
  let upDay60 = null
  if (prev >= 60) {
    let up = 0
    for (let i = prev - 59; i <= prev; i++) {
      if (closes[i] / closes[i - 1] - 1 > 0) up += 1
    }
    upDay60 = up / 60
  }
  let position60 = null
  if (prev >= 59) {
    let hi = closes[prev - 59]
    let lo = closes[prev - 59]
    for (let i = prev - 58; i <= prev; i++) {
      if (closes[i] > hi) hi = closes[i]
      if (closes[i] < lo) lo = closes[i]
    }
    position60 = hi === lo ? null : (closes[prev] - lo) / (hi - lo)
  }
  return { ret60, ret120, upDay60, position60 }
}

export function percentileRank(value, values) {
  if (!Number.isFinite(value)) return null
  const xs = values.filter((item) => Number.isFinite(item))
  if (xs.length < 2) return null
  let below = 0
  let equal = 0
  for (const item of xs) {
    if (item < value) below += 1
    else if (item === value) equal += 1
  }
  const rank = below + (equal - 1) / 2
  return (rank / (xs.length - 1)) * 100
}

export function leadershipFromPercentiles(percentiles) {
  const available = percentiles.filter((value) => Number.isFinite(value))
  if (available.length < 2) return null
  return available.reduce((sum, value) => sum + value, 0) / available.length
}

export function leadershipGroup(score) {
  if (!Number.isFinite(score)) return null
  if (score >= HIGH_MIN) return "HIGH"
  if (score >= MID_MIN) return "MID"
  return "LOW"
}

export function prepareSeries(bars) {
  const dates = []
  const closes = []
  for (const bar of bars ?? []) {
    if (!bar?.date || !(bar.close > 0)) continue
    dates.push(bar.date)
    closes.push(bar.close)
  }
  return { dates, closes }
}

function crossSection(seriesBySymbol, date) {
  const symbols = [...seriesBySymbol.keys()]
  const features = new Map()
  for (const symbol of symbols) {
    const series = seriesBySymbol.get(symbol)
    const prev = indexBefore(series.dates, date)
    features.set(symbol, featurePack(series.closes, prev))
  }
  const percentiles = new Map()
  const peerCounts = {}
  for (const key of FEATURE_KEYS) {
    const values = symbols.map((symbol) => features.get(symbol)[key]).filter((value) => Number.isFinite(value))
    peerCounts[key] = values.length
    const row = new Map()
    for (const symbol of symbols) row.set(symbol, percentileRank(features.get(symbol)[key], values))
    percentiles.set(key, row)
  }
  return { features, percentiles, peerCounts }
}

export function eventIdentity(event) {
  return [event.ticker, event.plus10Date, event.t0Date, event.t0Close, event.episodeStart]
}

export function assertV1Events(events) {
  const deep = events.filter((event) => event.correctionDepth === 0.1)
  if (deep.length !== LOCKED_DEEP_EVENTS) {
    throw new Error(`+10/-10 events ${deep.length} !== ${LOCKED_DEEP_EVENTS}`)
  }
  const keys = deep.map((event) => eventIdentity(event).join("|"))
  if (new Set(keys).size !== deep.length) throw new Error("duplicate +10/-10 event identity")
  return deep
}

export function attachLeadership(events, seriesBySymbol) {
  const deep = assertV1Events(events)
  const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
  if (symbols.length !== 31 || new Set(symbols).size !== 31) throw new Error("research universe is not 31 names")
  for (const symbol of symbols) {
    if (!seriesBySymbol.has(symbol)) throw new Error(`missing price series ${symbol}`)
  }
  const cache = new Map()
  const sectionFor = (date) => {
    if (!cache.has(date)) cache.set(date, crossSection(seriesBySymbol, date))
    return cache.get(date)
  }
  return deep.map((event) => {
    if (!hasExactDate(seriesBySymbol.get(event.ticker).dates, event.t0Date)) {
      throw new Error(`${event.ticker} has no bar on correction date ${event.t0Date}`)
    }
    const section = sectionFor(event.t0Date)
    const raw = section.features.get(event.ticker)
    const percentiles = FEATURE_KEYS.map((key) => section.percentiles.get(key).get(event.ticker))
    const score = leadershipFromPercentiles(percentiles)
    return {
      ticker: event.ticker,
      themes: event.themes,
      episodeStart: event.episodeStart,
      plus10Date: event.plus10Date,
      t0Date: event.t0Date,
      t0Close: event.t0Close,
      entryPrice: event.entryPrice,
      correctionDepth: event.correctionDepth,
      t5: event.t5,
      t10: event.t10,
      t20: event.t20,
      t40: event.t40,
      windowEnd: event.windowEnd,
      entryRecovered: event.entryRecovered,
      peakRecovered: event.peakRecovered,
      additionalDrawdown: event.additionalDrawdown,
      maxDrawdown: event.maxDrawdown,
      ret60: raw.ret60,
      ret120: raw.ret120,
      upDay60: raw.upDay60,
      position60: raw.position60,
      pctRet60: percentiles[0],
      pctRet120: percentiles[1],
      pctUpDay60: percentiles[2],
      pctPosition60: percentiles[3],
      peerCounts: section.peerCounts,
      leadershipScore: score,
      leadershipGroup: leadershipGroup(score),
    }
  })
}

function horizonStats(events, key) {
  const values = events.map((event) => event[key]?.vsEntry).filter((value) => Number.isFinite(value))
  return {
    n: values.length,
    avg: pct(mean(values)),
    median: pct(median(values)),
    winRate: round2(share(values.map((value) => value > 0))),
    judgment: sampleJudgment(values.length),
  }
}

function drawdownStats(events, key) {
  const values = events.map((event) => event[key]).filter((value) => Number.isFinite(value))
  return {
    n: values.length,
    avg: pct(mean(values)),
    median: pct(median(values)),
  }
}

function gap(avg, mid) {
  if (avg == null || mid == null) return null
  return round2(avg - mid)
}

export function summarizeEvents(events) {
  const t5 = horizonStats(events, "t5")
  const t10 = horizonStats(events, "t10")
  const t20 = horizonStats(events, "t20")
  const t40 = horizonStats(events, "t40")
  const windowEnd = horizonStats(events, "windowEnd")
  const additional = drawdownStats(events, "additionalDrawdown")
  const maxDrawdown = drawdownStats(events, "maxDrawdown")
  return {
    n: events.length,
    judgment: sampleJudgment(events.length),
    t5,
    t10,
    t20,
    t40,
    windowEnd,
    entryRecovery: round2(share(events.map((event) => event.entryRecovered === true))),
    peakRecovery: round2(share(events.map((event) => event.peakRecovered === true))),
    additionalDrawdown: additional,
    maxDrawdown,
    meanMedianGap: {
      t20: gap(t20.avg, t20.median),
      windowEnd: gap(windowEnd.avg, windowEnd.median),
    },
  }
}

function byTicker(events) {
  const groups = new Map()
  for (const event of events) {
    if (!groups.has(event.ticker)) groups.set(event.ticker, [])
    groups.get(event.ticker).push(event)
  }
  return groups
}

function stockHorizon(events, key) {
  const means = []
  const medians = []
  const wins = []
  for (const rows of byTicker(events).values()) {
    const values = rows.map((event) => event[key]?.vsEntry).filter((value) => Number.isFinite(value))
    if (!values.length) continue
    means.push(mean(values))
    medians.push(median(values))
    wins.push(values.filter((value) => value > 0).length / values.length)
  }
  return {
    stocks: means.length,
    avg: pct(mean(means)),
    median: pct(median(medians)),
    winRate: round2(mean(wins) == null ? null : mean(wins) * 100),
    judgment: sampleJudgment(means.length),
  }
}

function stockRate(events, key) {
  const rates = []
  for (const rows of byTicker(events).values()) {
    if (!rows.length) continue
    rates.push(rows.filter((event) => event[key] === true).length / rows.length)
  }
  return {
    stocks: rates.length,
    avg: round2(mean(rates) == null ? null : mean(rates) * 100),
    median: round2(median(rates) == null ? null : median(rates) * 100),
  }
}

function stockDrawdown(events, key) {
  const means = []
  const medians = []
  for (const rows of byTicker(events).values()) {
    const values = rows.map((event) => event[key]).filter((value) => Number.isFinite(value))
    if (!values.length) continue
    means.push(mean(values))
    medians.push(median(values))
  }
  return {
    stocks: means.length,
    avg: pct(mean(means)),
    median: pct(median(medians)),
  }
}

export function summarizeStockWeighted(events) {
  const t5 = stockHorizon(events, "t5")
  const t10 = stockHorizon(events, "t10")
  const t20 = stockHorizon(events, "t20")
  const t40 = stockHorizon(events, "t40")
  const windowEnd = stockHorizon(events, "windowEnd")
  return {
    n: events.length,
    stocks: new Set(events.map((event) => event.ticker)).size,
    judgment: sampleJudgment(new Set(events.map((event) => event.ticker)).size),
    t5,
    t10,
    t20,
    t40,
    windowEnd,
    entryRecovery: stockRate(events, "entryRecovered"),
    peakRecovery: stockRate(events, "peakRecovered"),
    additionalDrawdown: stockDrawdown(events, "additionalDrawdown"),
    maxDrawdown: stockDrawdown(events, "maxDrawdown"),
    meanMedianGap: {
      t20: gap(t20.avg, t20.median),
      windowEnd: gap(windowEnd.avg, windowEnd.median),
    },
  }
}

function diffNum(left, right) {
  if (left == null || right == null || !Number.isFinite(left) || !Number.isFinite(right)) return null
  return round2(left - right)
}

export function highMinusLow(high, low, weighting) {
  const t20N = weighting === "stock" ? [high.t20.stocks, low.t20.stocks] : [high.t20.n, low.t20.n]
  const endN = weighting === "stock" ? [high.windowEnd.stocks, low.windowEnd.stocks] : [high.windowEnd.n, low.windowEnd.n]
  return {
    weighting,
    t20Judgment: comparisonJudgment(t20N[0], t20N[1]),
    windowJudgment: comparisonJudgment(endN[0], endN[1]),
    t20Avg: diffNum(high.t20.avg, low.t20.avg),
    t20Median: diffNum(high.t20.median, low.t20.median),
    t20WinRate: diffNum(high.t20.winRate, low.t20.winRate),
    windowEndAvg: diffNum(high.windowEnd.avg, low.windowEnd.avg),
    windowEndMedian: diffNum(high.windowEnd.median, low.windowEnd.median),
    windowEndWinRate: diffNum(high.windowEnd.winRate, low.windowEnd.winRate),
    entryRecovery: diffNum(high.entryRecovery?.avg ?? high.entryRecovery, low.entryRecovery?.avg ?? low.entryRecovery),
    peakRecovery: diffNum(high.peakRecovery?.avg ?? high.peakRecovery, low.peakRecovery?.avg ?? low.peakRecovery),
    additionalDrawdownAvg: diffNum(high.additionalDrawdown.avg, low.additionalDrawdown.avg),
    additionalDrawdownMedian: diffNum(high.additionalDrawdown.median, low.additionalDrawdown.median),
  }
}

function averageRanks(values) {
  const indexed = values.map((value, index) => ({ value, index })).filter((row) => Number.isFinite(row.value))
  indexed.sort((a, b) => a.value - b.value)
  const ranks = new Array(values.length).fill(null)
  for (let i = 0; i < indexed.length; ) {
    let j = i
    while (j + 1 < indexed.length && indexed[j + 1].value === indexed[i].value) j += 1
    const rank = (i + 1 + (j + 1)) / 2
    for (let k = i; k <= j; k++) ranks[indexed[k].index] = rank
    i = j + 1
  }
  return ranks
}

function pearson(xs, ys) {
  const n = xs.length
  if (n < 2) return null
  const mx = mean(xs)
  const my = mean(ys)
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx
    const b = ys[i] - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  if (dx === 0 || dy === 0) return null
  return num / Math.sqrt(dx * dy)
}

export function spearman(pairs) {
  const usable = pairs.filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y))
  if (usable.length < 2) return { n: usable.length, rho: null, judgment: sampleJudgment(usable.length) }
  const rx = averageRanks(usable.map((pair) => pair.x))
  const ry = averageRanks(usable.map((pair) => pair.y))
  return {
    n: usable.length,
    rho: round4(pearson(rx, ry)),
    judgment: sampleJudgment(usable.length),
  }
}

export function correlateLeadership(events) {
  const scored = events.filter((event) => Number.isFinite(event.leadershipScore))
  const outcome = (key) =>
    spearman(
      scored
        .filter((event) => Number.isFinite(event[key]?.vsEntry))
        .map((event) => ({ x: event.leadershipScore, y: event[key].vsEntry })),
    )
  const flag = (key) =>
    spearman(scored.map((event) => ({ x: event.leadershipScore, y: event[key] === true ? 1 : 0 })))
  const drawdown = (key) =>
    spearman(
      scored
        .filter((event) => Number.isFinite(event[key]))
        .map((event) => ({ x: event.leadershipScore, y: event[key] })),
    )
  return {
    t20: outcome("t20"),
    windowEnd: outcome("windowEnd"),
    entryRecovery: flag("entryRecovered"),
    peakRecovery: flag("peakRecovered"),
    additionalDrawdown: drawdown("additionalDrawdown"),
  }
}

export function variableStats(events) {
  const stat = (key, scale = 1) => {
    const values = events.map((event) => event[key]).filter((value) => Number.isFinite(value))
    return {
      n: values.length,
      missing: events.length - values.length,
      avg: round2(mean(values) * scale),
      median: round2(median(values) * scale),
    }
  }
  const scores = events.map((event) => event.leadershipScore).filter((value) => Number.isFinite(value))
  return {
    ret60: stat("ret60", 100),
    ret120: stat("ret120", 100),
    upDay60: stat("upDay60", 100),
    position60: stat("position60", 100),
    leadershipScore: {
      n: scores.length,
      missing: events.length - scores.length,
      avg: round2(mean(scores)),
      median: round2(median(scores)),
      min: round2(scores.length ? Math.min(...scores) : null),
      max: round2(scores.length ? Math.max(...scores) : null),
    },
  }
}

export function topTickersByEvents(events, count) {
  const counts = new Map()
  for (const event of events) counts.set(event.ticker, (counts.get(event.ticker) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([ticker, n]) => ({ ticker, n }))
}

function groupBundle(events) {
  const scored = events.filter((event) => event.leadershipGroup)
  const buckets = {
    HIGH: scored.filter((event) => event.leadershipGroup === "HIGH"),
    MID: scored.filter((event) => event.leadershipGroup === "MID"),
    LOW: scored.filter((event) => event.leadershipGroup === "LOW"),
  }
  return { scored, buckets }
}

export function analyzeGroups(events) {
  const { scored, buckets } = groupBundle(events)
  const eventWeighted = {
    HIGH: summarizeEvents(buckets.HIGH),
    MID: summarizeEvents(buckets.MID),
    LOW: summarizeEvents(buckets.LOW),
  }
  const stockWeighted = {
    HIGH: summarizeStockWeighted(buckets.HIGH),
    MID: summarizeStockWeighted(buckets.MID),
    LOW: summarizeStockWeighted(buckets.LOW),
  }
  return {
    scored: scored.length,
    unscored: events.length - scored.length,
    counts: {
      HIGH: buckets.HIGH.length,
      MID: buckets.MID.length,
      LOW: buckets.LOW.length,
    },
    eventWeighted,
    stockWeighted,
    highMinusLow: {
      event: highMinusLow(eventWeighted.HIGH, eventWeighted.LOW, "event"),
      stock: highMinusLow(stockWeighted.HIGH, stockWeighted.LOW, "stock"),
    },
  }
}

export function summarizeBySymbol(events) {
  return EQUITY_SELL_RESEARCH_UNIVERSE.map((meta) => {
    const rows = events.filter((event) => event.ticker === meta.symbol)
    const groups = {
      HIGH: summarizeEvents(rows.filter((event) => event.leadershipGroup === "HIGH")),
      MID: summarizeEvents(rows.filter((event) => event.leadershipGroup === "MID")),
      LOW: summarizeEvents(rows.filter((event) => event.leadershipGroup === "LOW")),
    }
    const scores = rows.map((event) => event.leadershipScore).filter((value) => Number.isFinite(value))
    return {
      ticker: meta.symbol,
      n: rows.length,
      high: groups.HIGH.n,
      mid: groups.MID.n,
      low: groups.LOW.n,
      unscored: rows.length - groups.HIGH.n - groups.MID.n - groups.LOW.n,
      avgLeadershipScore: round2(mean(scores)),
      overall: summarizeEvents(rows),
      groups,
    }
  })
}

export function sensitivityWithout(events, dropCount) {
  const dropped = topTickersByEvents(events, dropCount)
  const banned = new Set(dropped.map((row) => row.ticker))
  const kept = events.filter((event) => !banned.has(event.ticker))
  const groups = analyzeGroups(kept)
  return {
    label: `drop top ${dropCount} by event count`,
    dropped,
    remainingEvents: kept.length,
    counts: groups.counts,
    highMinusLow: groups.highMinusLow,
    eventWeighted: {
      HIGH: groups.eventWeighted.HIGH,
      MID: groups.eventWeighted.MID,
      LOW: groups.eventWeighted.LOW,
    },
  }
}
