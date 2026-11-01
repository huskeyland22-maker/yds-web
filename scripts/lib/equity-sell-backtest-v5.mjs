/**
 * US single-stock study v5 (research only).
 *
 * Uses the v4 T0 < 0% events only. Does not recompute T0, leadership,
 * or path outcomes, and does not select a sell rule.
 */

import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./equity-sell-research-universe.mjs"
import { eventIdentity, mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { olsTwo, summarizeSlice } from "./equity-sell-backtest-v4.mjs"

export { EQUITY_SELL_RESEARCH_UNIVERSE }

export const SELECTED_STRATEGY = null
export const LOCKED_LT0_EVENTS = 112
export const LOCKED_LT0_GROUPS = { HIGH: 17, MID: 60, LOW: 35, unclassified: 0 }
export const V4_LT0_LOCKED = {
  highT20: 14.34,
  lowT20: 2.88,
  t20Diff: 11.46,
  highWindow: 23.82,
  lowWindow: 5.69,
  windowDiff: 18.13,
  highAdditional: 4.52,
  lowAdditional: 6.84,
  additionalDiff: -2.32,
  highRebound: 32.11,
  lowRebound: 14.19,
  reboundDiff: 17.92,
  highEntry: 100,
  lowEntry: 88.57,
  stockWindowDiff: 13.84,
}
export const INNER_BUCKETS = [
  { id: "lt-10", label: "T0 < -10%" },
  { id: "m10", label: "-10% ≤ T0 < -5%" },
  { id: "m5", label: "-5% ≤ T0 < 0%" },
]
const WITHIN_MIN = 10
const CAUTION_SHARE = 0.5

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

function eventIdOf(event) {
  return event.eventId || eventIdentity(event).join("|")
}

export function innerBucket(t0) {
  if (!Number.isFinite(t0) || t0 >= 0) return null
  if (t0 < -0.1) return "lt-10"
  if (t0 < -0.05) return "m10"
  return "m5"
}

export function interpretationStatus(highN, lowN) {
  const high = highN || 0
  const low = lowN || 0
  if (high < 5 || low < 5) return "비교 불가"
  if (high < 10 || low < 10) return "표본 부족"
  return "제한적 해석 가능"
}

function indexById(events, label) {
  const map = new Map()
  for (const event of events) {
    const id = eventIdOf(event)
    if (map.has(id)) throw new Error(`duplicate ${label} event ${id}`)
    map.set(id, event)
  }
  return map
}

function finiteEqual(left, right) {
  if (left == null && right == null) return true
  if (!Number.isFinite(left) || !Number.isFinite(right)) return left === right
  return Math.abs(left - right) <= 1e-8
}

export function selectLt0Events(v4Events, v3Events, v2Events) {
  const listed = v4Events.filter((event) => event.bucket === "lt0")
  if (listed.length !== LOCKED_LT0_EVENTS) {
    throw new Error(`v4 T0 < 0% events ${listed.length} !== ${LOCKED_LT0_EVENTS}`)
  }
  const v3 = indexById(v3Events, "v3")
  const v2 = indexById(v2Events, "v2")
  const seen = new Set()
  const events = listed.map((row) => {
    const id = eventIdOf(row)
    if (seen.has(id)) throw new Error(`duplicate v4 event ${id}`)
    seen.add(id)
    const path = v3.get(id)
    const prior = v2.get(id)
    if (!path) throw new Error(`v3 missing ${id}`)
    if (!prior) throw new Error(`v2 missing ${id}`)
    if (row.ticker !== path.ticker || row.ticker !== prior.ticker) throw new Error(`ticker mismatch ${id}`)
    if (row.t0Date !== path.t0Date || row.t0Date !== prior.t0Date) throw new Error(`correction date mismatch ${id}`)
    if (row.episodeStart !== path.episodeStart) throw new Error(`episode start mismatch ${id}`)
    if (row.leadershipScore !== path.leadershipScore || row.leadershipScore !== prior.leadershipScore) {
      throw new Error(`leadership score mismatch ${id}`)
    }
    if (row.leadershipGroup !== path.leadershipGroup || row.leadershipGroup !== prior.leadershipGroup) {
      throw new Error(`leadership group mismatch ${id}`)
    }
    if (!finiteEqual(row.t0, path.t0)) throw new Error(`T0 mismatch ${id}`)
    if (!(row.t0 < 0)) throw new Error(`event is not T0 < 0% ${id}`)
    return {
      eventId: id,
      ticker: row.ticker,
      episodeStart: row.episodeStart,
      plus10Date: row.plus10Date,
      t0Date: row.t0Date,
      t0Close: path.t0Close,
      leadershipScore: row.leadershipScore,
      leadershipGroup: row.leadershipGroup,
      t0: row.t0,
      t1: path.t1,
      t3: path.t3,
      t5: path.t5,
      t7: path.t7,
      t10: path.t10,
      t15: path.t15,
      t20: path.t20,
      t30: path.t30,
      t40: path.t40,
      windowEnd: path.windowEnd,
      recovered: path.recovered === true,
      peakRecovered: prior.peakRecovered === true,
      additionalDrawdown: path.additionalDrawdown,
      reboundFromLow: path.reboundFromLow,
      daysToLow: path.daysToLow,
      innerBucket: innerBucket(row.t0),
    }
  })
  const counts = groupCounts(events)
  for (const key of Object.keys(LOCKED_LT0_GROUPS)) {
    if (counts[key] !== LOCKED_LT0_GROUPS[key]) {
      throw new Error(`${key} ${counts[key]} !== ${LOCKED_LT0_GROUPS[key]}`)
    }
  }
  assertV4Path(events)
  return events
}

function groupCounts(events) {
  const counts = { HIGH: 0, MID: 0, LOW: 0, unclassified: 0 }
  for (const event of events) {
    if (event.leadershipGroup === "HIGH" || event.leadershipGroup === "MID" || event.leadershipGroup === "LOW") {
      counts[event.leadershipGroup] += 1
    } else counts.unclassified += 1
  }
  return counts
}

function assertV4Path(events) {
  const summary = summarizeSlice(events)
  const eventGap = summary.highMinusLow.event
  const checks = [
    ["highT20", summary.event.HIGH.t20.avg, V4_LT0_LOCKED.highT20],
    ["lowT20", summary.event.LOW.t20.avg, V4_LT0_LOCKED.lowT20],
    ["t20Diff", eventGap.t20.diff, V4_LT0_LOCKED.t20Diff],
    ["highWindow", summary.event.HIGH.windowEnd.avg, V4_LT0_LOCKED.highWindow],
    ["lowWindow", summary.event.LOW.windowEnd.avg, V4_LT0_LOCKED.lowWindow],
    ["windowDiff", eventGap.windowEnd.diff, V4_LT0_LOCKED.windowDiff],
    ["highAdditional", summary.event.HIGH.additionalDrawdown.avg, V4_LT0_LOCKED.highAdditional],
    ["lowAdditional", summary.event.LOW.additionalDrawdown.avg, V4_LT0_LOCKED.lowAdditional],
    ["highRebound", summary.event.HIGH.reboundFromLow.avg, V4_LT0_LOCKED.highRebound],
    ["lowRebound", summary.event.LOW.reboundFromLow.avg, V4_LT0_LOCKED.lowRebound],
    ["stockWindowDiff", summary.highMinusLow.stock.windowEnd.diff, V4_LT0_LOCKED.stockWindowDiff],
  ]
  const mismatches = checks.filter((row) => row[1] !== row[2]).map((row) => `${row[0]} ${row[1]} !== ${row[2]}`)
  if (mismatches.length) throw new Error(`v4 T0 < 0% values differ:\n${mismatches.join("\n")}`)
}

function numberStats(values, scale = 1) {
  const xs = values.filter((value) => Number.isFinite(value))
  return {
    n: xs.length,
    avg: round2(mean(xs) == null ? null : mean(xs) * scale),
    median: round2(median(xs) == null ? null : median(xs) * scale),
  }
}

function rateStats(events, key) {
  return {
    n: events.length,
    avg: events.length ? round2((events.filter((event) => event[key] === true).length / events.length) * 100) : null,
  }
}

function outcomeStats(events) {
  return {
    n: events.length,
    t0: numberStats(events.map((event) => event.t0), 100),
    t1: numberStats(events.map((event) => event.t1), 100),
    t3: numberStats(events.map((event) => event.t3), 100),
    t5: numberStats(events.map((event) => event.t5), 100),
    t10: numberStats(events.map((event) => event.t10), 100),
    t20: numberStats(events.map((event) => event.t20), 100),
    t40: numberStats(events.map((event) => event.t40), 100),
    windowEnd: numberStats(events.map((event) => event.windowEnd), 100),
    additionalDrawdown: numberStats(events.map((event) => event.additionalDrawdown), 100),
    entryRecovery: rateStats(events, "recovered"),
    peakRecovery: rateStats(events, "peakRecovered"),
    daysToLow: numberStats(events.map((event) => event.daysToLow), 1),
    reboundFromLow: numberStats(events.map((event) => event.reboundFromLow), 100),
  }
}

function groupSlice(events, group) {
  return events.filter((event) => event.leadershipGroup === group)
}

function gap(high, low, key) {
  const highAvg = high[key].avg
  const lowAvg = low[key].avg
  return {
    highN: high[key].n,
    lowN: low[key].n,
    highAvg,
    lowAvg,
    diff: highAvg == null || lowAvg == null ? null : round2(highAvg - lowAvg),
  }
}

export function tickerReports(events, universe = EQUITY_SELL_RESEARCH_UNIVERSE) {
  const symbols = universe.map((row) => row.symbol)
  if (new Set(symbols).size !== symbols.length) throw new Error("duplicate ticker in the study universe")
  const rows = symbols.map((ticker) => {
    const mine = events.filter((event) => event.ticker === ticker)
    const scores = mine.map((event) => event.leadershipScore).filter((value) => Number.isFinite(value))
    const high = outcomeStats(groupSlice(mine, "HIGH"))
    const mid = outcomeStats(groupSlice(mine, "MID"))
    const low = outcomeStats(groupSlice(mine, "LOW"))
    return {
      ticker,
      total: mine.length,
      high: high.n,
      mid: mid.n,
      low: low.n,
      unclassified: mine.filter((event) => !["HIGH", "MID", "LOW"].includes(event.leadershipGroup)).length,
      leadershipScore: { n: scores.length, avg: round2(mean(scores)), median: round2(median(scores)) },
      t0: numberStats(mine.map((event) => event.t0), 100),
      all: outcomeStats(mine),
      HIGH: high,
      MID: mid,
      LOW: low,
      highMinusLow: {
        t20: gap(high, low, "t20"),
        windowEnd: gap(high, low, "windowEnd"),
        additionalDrawdown: gap(high, low, "additionalDrawdown"),
        entryRecovery: gap(high, low, "entryRecovery"),
        reboundFromLow: gap(high, low, "reboundFromLow"),
        daysToLow: gap(high, low, "daysToLow"),
        peakRecovery: gap(high, low, "peakRecovery"),
      },
      status: interpretationStatus(high.n, low.n),
    }
  })
  rows.sort((a, b) => b.total - a.total || a.ticker.localeCompare(b.ticker))
  if (rows.reduce((sum, row) => sum + row.total, 0) !== events.length) {
    throw new Error("ticker event counts do not add up to the study sample")
  }
  return rows
}

export function comparisonTable(reports) {
  return reports.map((row) => ({
    ticker: row.ticker,
    total: row.total,
    high: row.high,
    low: row.low,
    highT20: row.HIGH.t20.avg,
    lowT20: row.LOW.t20.avg,
    t20Diff: row.highMinusLow.t20.diff,
    highWindow: row.HIGH.windowEnd.avg,
    lowWindow: row.LOW.windowEnd.avg,
    windowDiff: row.highMinusLow.windowEnd.diff,
    highAdditional: row.HIGH.additionalDrawdown.avg,
    lowAdditional: row.LOW.additionalDrawdown.avg,
    additionalDiff: row.highMinusLow.additionalDrawdown.diff,
    highRebound: row.HIGH.reboundFromLow.avg,
    lowRebound: row.LOW.reboundFromLow.avg,
    reboundDiff: row.highMinusLow.reboundFromLow.diff,
    status: row.status,
  }))
}

function pooledGaps(events) {
  const summary = summarizeSlice(events)
  const eventGap = summary.highMinusLow.event
  const stockGap = summary.highMinusLow.stock
  return {
    high: summary.high,
    low: summary.low,
    event: {
      t20: eventGap.t20.diff,
      windowEnd: eventGap.windowEnd.diff,
      reboundFromLow: eventGap.reboundFromLow.diff,
      additionalDrawdown: eventGap.additionalDrawdown.diff,
      judgment: eventGap.windowEnd.judgment,
    },
    stock: {
      highN: stockGap.windowEnd.highN,
      lowN: stockGap.windowEnd.lowN,
      t20: stockGap.t20.diff,
      windowEnd: stockGap.windowEnd.diff,
      reboundFromLow: stockGap.reboundFromLow.diff,
      additionalDrawdown: stockGap.additionalDrawdown.diff,
      judgment: stockGap.windowEnd.judgment,
    },
  }
}

export function leaveOneTickerOut(events, universe = EQUITY_SELL_RESEARCH_UNIVERSE) {
  const baseline = pooledGaps(events)
  const rows = universe.map((item) => {
    const ticker = item.symbol
    const removed = events.filter((event) => event.ticker === ticker)
    const kept = events.filter((event) => event.ticker !== ticker)
    const next = pooledGaps(kept)
    return {
      ticker,
      removed: removed.length,
      remaining: kept.length,
      highRemaining: next.high,
      lowRemaining: next.low,
      t20Diff: next.event.t20,
      windowDiff: next.event.windowEnd,
      reboundDiff: next.event.reboundFromLow,
      t20Change: round2(next.event.t20 - baseline.event.t20),
      windowChange: round2(next.event.windowEnd - baseline.event.windowEnd),
      reboundChange: round2(next.event.reboundFromLow - baseline.event.reboundFromLow),
    }
  })
  if (rows.reduce((sum, row) => sum + row.removed, 0) !== events.length) {
    throw new Error("leave-one-ticker-out removals do not add up to the study sample")
  }
  const ranked = rows
    .filter((row) => row.removed > 0)
    .slice()
    .sort((a, b) => Math.abs(b.windowChange) - Math.abs(a.windowChange) || b.removed - a.removed || a.ticker.localeCompare(b.ticker))
  return {
    baseline: baseline.event,
    rows,
    largestWindowImpact: ranked[0] || null,
  }
}

function composition(events, group) {
  const mine = events.filter((event) => event.leadershipGroup === group)
  const byTicker = new Map()
  for (const event of mine) {
    if (!byTicker.has(event.ticker)) byTicker.set(event.ticker, [])
    byTicker.get(event.ticker).push(event)
  }
  const rows = [...byTicker.entries()]
    .map(([ticker, rowsForTicker]) => {
      const stats = outcomeStats(rowsForTicker)
      return {
        ticker,
        events: rowsForTicker.length,
        share: round4(rowsForTicker.length / mine.length),
        leadershipAvg: round2(mean(rowsForTicker.map((event) => event.leadershipScore))),
        t0Avg: stats.t0.avg,
        t20Avg: stats.t20.avg,
        windowAvg: stats.windowEnd.avg,
      }
    })
    .sort((a, b) => b.events - a.events || a.ticker.localeCompare(b.ticker))
  const maxShare = rows.length ? rows[0].share : 0
  return {
    group,
    events: mine.length,
    tickers: rows.length,
    maxShare,
    caution: maxShare > CAUTION_SHARE,
    rows,
  }
}

export function groupCompositions(events) {
  return {
    HIGH: composition(events, "HIGH"),
    LOW: composition(events, "LOW"),
  }
}

export function withinStockComparison(reports) {
  const included = reports.filter((row) => row.high >= WITHIN_MIN && row.low >= WITHIN_MIN)
  const excluded = reports.filter((row) => row.high < WITHIN_MIN || row.low < WITHIN_MIN)
  function avgDiff(key) {
    const values = included.map((row) => row.highMinusLow[key].diff).filter((value) => Number.isFinite(value))
    return { n: values.length, avg: round2(mean(values)) }
  }
  return {
    rule: "A ticker is included only when both HIGH and LOW have n >= 10.",
    includedTickers: included.map((row) => row.ticker),
    excludedTickers: excluded.map((row) => row.ticker),
    includedCount: included.length,
    excludedCount: excluded.length,
    t20: avgDiff("t20"),
    windowEnd: avgDiff("windowEnd"),
    additionalDrawdown: avgDiff("additionalDrawdown"),
    reboundFromLow: avgDiff("reboundFromLow"),
  }
}

export function analyzeInnerBuckets(events) {
  const buckets = INNER_BUCKETS.map((bucket) => {
    const rows = events.filter((event) => event.innerBucket === bucket.id)
    const high = outcomeStats(groupSlice(rows, "HIGH"))
    const low = outcomeStats(groupSlice(rows, "LOW"))
    return {
      id: bucket.id,
      label: bucket.label,
      n: rows.length,
      high: high.n,
      mid: groupSlice(rows, "MID").length,
      low: low.n,
      t20: { ...gap(high, low, "t20"), status: interpretationStatus(high.n, low.n) },
      windowEnd: { ...gap(high, low, "windowEnd"), status: interpretationStatus(high.n, low.n) },
      additionalDrawdown: gap(high, low, "additionalDrawdown"),
      reboundFromLow: gap(high, low, "reboundFromLow"),
      status: interpretationStatus(high.n, low.n),
    }
  })
  if (buckets.reduce((sum, bucket) => sum + bucket.n, 0) !== events.length) {
    throw new Error("inner T0 buckets do not add up to the study sample")
  }
  return buckets
}

function demean(events, outcomeKey) {
  const byTicker = new Map()
  for (const event of events) {
    if (!Number.isFinite(event.leadershipScore) || !Number.isFinite(event.t0) || !Number.isFinite(event[outcomeKey])) continue
    if (!byTicker.has(event.ticker)) byTicker.set(event.ticker, [])
    byTicker.get(event.ticker).push(event)
  }
  const rows = []
  let tickers = 0
  for (const [ticker, mine] of byTicker) {
    if (mine.length < 2) continue
    tickers += 1
    const scoreMean = mean(mine.map((event) => event.leadershipScore))
    const t0Mean = mean(mine.map((event) => event.t0))
    const yMean = mean(mine.map((event) => event[outcomeKey]))
    for (const event of mine) {
      rows.push({
        ticker,
        leadership: event.leadershipScore - scoreMean,
        t0: (event.t0 - t0Mean) * 100,
        y: (event[outcomeKey] - yMean) * 100,
      })
    }
  }
  return { rows, tickers, events: rows.length }
}

export function tickerControlledAssociation(events) {
  function fit(outcomeKey) {
    const sample = demean(events, outcomeKey)
    const association = spearman(sample.rows.map((row) => ({ x: row.leadership, y: row.y })))
    const fitRows = olsTwo(sample.rows)
    return {
      outcome: outcomeKey,
      events: sample.events,
      tickers: sample.tickers,
      withinSpearman: association,
      withinRegression: fitRows,
      note: "Ticker means are removed before the association. Ordinary least squares still treats the remaining events as independent, so the p-value is not used as a finding.",
    }
  }
  const bothSides = tickerReports(events).filter((row) => row.high > 0 && row.low > 0)
  return {
    t20: fit("t20"),
    windowEnd: fit("windowEnd"),
    bothSides: {
      tickers: bothSides.length,
      positiveWindow: bothSides.filter((row) => row.highMinusLow.windowEnd.diff > 0).length,
      negativeWindow: bothSides.filter((row) => row.highMinusLow.windowEnd.diff < 0).length,
      rows: bothSides.map((row) => ({
        ticker: row.ticker,
        high: row.high,
        low: row.low,
        windowDiff: row.highMinusLow.windowEnd.diff,
        t20Diff: row.highMinusLow.t20.diff,
        status: row.status,
      })),
    },
  }
}

export function directionComparison(events, reports) {
  const pooled = pooledGaps(events)
  const within = withinStockComparison(reports)
  const eventSign = Math.sign(pooled.event.windowEnd || 0)
  const stockSign = Math.sign(pooled.stock.windowEnd || 0)
  const withinSign = within.windowEnd.avg == null ? null : Math.sign(within.windowEnd.avg)
  return {
    eventWeighted: pooled.event,
    stockWeighted: pooled.stock,
    withinStock: within,
    windowDirection: {
      event: eventSign > 0 ? "HIGH higher" : eventSign < 0 ? "LOW higher" : "flat",
      stock: stockSign > 0 ? "HIGH higher" : stockSign < 0 ? "LOW higher" : "flat",
      within: withinSign == null ? "not available" : withinSign > 0 ? "HIGH higher" : withinSign < 0 ? "LOW higher" : "flat",
      eventAndStockSame: eventSign === stockSign && eventSign !== 0,
    },
  }
}
