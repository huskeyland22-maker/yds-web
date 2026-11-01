/**
 * US single-stock rebound-path study v6 (research only).
 *
 * Uses the v5 events with -5% <= T0 < 0% only.
 * The post-T0 low stays the v3 definition. Rebound after that low is an
 * ex-post outcome, not a sell rule.
 */

import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./equity-sell-research-universe.mjs"
import { eventIdentity, mean, median, sampleJudgment, spearman } from "./equity-sell-backtest-v2.mjs"
import { EPS, dateIndex, measurePath } from "./equity-sell-backtest-v3.mjs"

export { EQUITY_SELL_RESEARCH_UNIVERSE }

export const SELECTED_STRATEGY = null
export const LOCKED_MILD_EVENTS = 103
export const LOCKED_MILD_GROUPS = { HIGH: 15, MID: 53, LOW: 35, unclassified: 0 }
export const V5_MILD_LOCKED = {
  highT20: 12.33,
  lowT20: 2.88,
  t20Diff: 9.45,
  highWindow: 20.29,
  lowWindow: 5.69,
  windowDiff: 14.6,
  highRebound: 28.3,
  lowRebound: 14.19,
  reboundDiff: 14.11,
}
export const HORIZONS = [
  ["t0", 0],
  ["t1", 1],
  ["t3", 3],
  ["t5", 5],
  ["t7", 7],
  ["t10", 10],
  ["t15", 15],
  ["t20", 20],
  ["t30", 30],
  ["t40", 40],
  ["windowEnd", null],
]
export const REBOUND_TARGETS = [0.03, 0.05, 0.1, 0.15, 0.2]
export const ENTRY_LEVELS = [0, 0.05, 0.1]
const HIT = 1e-12
const LOW_MARKS = [1, 3, 5, 7, 10, 15, 20]

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function pct(fraction) {
  if (fraction == null || !Number.isFinite(fraction)) return null
  return round2(fraction * 100)
}

function closeEnough(left, right) {
  if (left == null && right == null) return true
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false
  return Math.abs(left - right) <= 1e-8 + 1e-6 * Math.abs(right)
}

function eventIdOf(event) {
  return event.eventId || eventIdentity(event).join("|")
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

function expectedGroup(score) {
  if (!Number.isFinite(score)) return null
  if (score >= 70) return "HIGH"
  if (score >= 30) return "MID"
  return "LOW"
}

export function selectMildEvents(v5Events, v3Events) {
  const listed = v5Events.filter((event) => event.innerBucket === "m5")
  if (listed.length !== LOCKED_MILD_EVENTS) {
    throw new Error(`v5 mild events ${listed.length} !== ${LOCKED_MILD_EVENTS}`)
  }
  const v3 = indexById(v3Events, "v3")
  const seen = new Set()
  const events = listed.map((row) => {
    const id = eventIdOf(row)
    if (seen.has(id)) throw new Error(`duplicate v5 event ${id}`)
    seen.add(id)
    const path = v3.get(id)
    if (!path) throw new Error(`v3 missing ${id}`)
    if (row.ticker !== path.ticker) throw new Error(`ticker mismatch ${id}`)
    if (row.t0Date !== path.t0Date) throw new Error(`correction date mismatch ${id}`)
    if (row.episodeStart !== path.episodeStart) throw new Error(`episode start mismatch ${id}`)
    if (row.leadershipScore !== path.leadershipScore) throw new Error(`leadership score mismatch ${id}`)
    if (row.leadershipGroup !== path.leadershipGroup) throw new Error(`leadership group mismatch ${id}`)
    if (expectedGroup(row.leadershipScore) !== row.leadershipGroup) throw new Error(`group boundary mismatch ${id}`)
    if (!closeEnough(row.t0, path.t0)) throw new Error(`T0 mismatch ${id}`)
    if (!(row.t0 >= -0.05) || !(row.t0 < 0)) throw new Error(`T0 outside -5% to 0% ${id}`)
    return {
      eventId: id,
      ticker: row.ticker,
      episodeStart: row.episodeStart,
      plus10Date: path.plus10Date,
      t0Date: row.t0Date,
      t0Close: path.t0Close,
      entryPrice: path.entryPrice,
      leadershipScore: row.leadershipScore,
      leadershipGroup: row.leadershipGroup,
      t0: row.t0,
      stored: {
        t0: path.t0,
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
        daysToLow: path.daysToLow,
        lowVsEntry: path.lowVsEntry,
        reboundFromLow: path.reboundFromLow,
      },
    }
  })
  const counts = groupCounts(events)
  for (const key of Object.keys(LOCKED_MILD_GROUPS)) {
    if (counts[key] !== LOCKED_MILD_GROUPS[key]) throw new Error(`${key} ${counts[key]} !== ${LOCKED_MILD_GROUPS[key]}`)
  }
  assertStoredV5(events)
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

function storedAvg(events, group, key) {
  const values = events.filter((event) => event.leadershipGroup === group).map((event) => event.stored[key]).filter((value) => Number.isFinite(value))
  return pct(mean(values))
}

function assertStoredV5(events) {
  const checks = [
    ["highT20", storedAvg(events, "HIGH", "t20"), V5_MILD_LOCKED.highT20],
    ["lowT20", storedAvg(events, "LOW", "t20"), V5_MILD_LOCKED.lowT20],
    ["highWindow", storedAvg(events, "HIGH", "windowEnd"), V5_MILD_LOCKED.highWindow],
    ["lowWindow", storedAvg(events, "LOW", "windowEnd"), V5_MILD_LOCKED.lowWindow],
    ["highRebound", storedAvg(events, "HIGH", "reboundFromLow"), V5_MILD_LOCKED.highRebound],
    ["lowRebound", storedAvg(events, "LOW", "reboundFromLow"), V5_MILD_LOCKED.lowRebound],
  ]
  const mismatches = checks.filter((row) => row[1] !== row[2]).map((row) => `${row[0]} ${row[1]} !== ${row[2]}`)
  const t20Diff = round2(storedAvg(events, "HIGH", "t20") - storedAvg(events, "LOW", "t20"))
  const windowDiff = round2(storedAvg(events, "HIGH", "windowEnd") - storedAvg(events, "LOW", "windowEnd"))
  const reboundDiff = round2(storedAvg(events, "HIGH", "reboundFromLow") - storedAvg(events, "LOW", "reboundFromLow"))
  if (t20Diff !== V5_MILD_LOCKED.t20Diff) mismatches.push(`t20Diff ${t20Diff}`)
  if (windowDiff !== V5_MILD_LOCKED.windowDiff) mismatches.push(`windowDiff ${windowDiff}`)
  if (reboundDiff !== V5_MILD_LOCKED.reboundDiff) mismatches.push(`reboundDiff ${reboundDiff}`)
  if (mismatches.length) throw new Error(`v5 mild values differ:\n${mismatches.join("\n")}`)
}

function firstAtOrAbove(closes, startIdx, endIdx, price) {
  for (let k = startIdx; k <= endIdx; k++) {
    if (closes[k] + EPS >= price) return k - startIdx
  }
  return null
}

function firstRebound(closes, lowIdx, endIdx, lowClose, target) {
  for (let k = lowIdx; k <= endIdx; k++) {
    if ((closes[k] - lowClose) / lowClose + HIT >= target) return k - lowIdx
  }
  return null
}

export function describeRebound(closes, entryIdx, t0Idx, entryPrice) {
  if (!closeEnough(closes[entryIdx], entryPrice)) {
    throw new Error("episode-start close is not the stored entry price")
  }
  const measured = measurePath(closes, entryIdx, t0Idx, entryPrice)
  const endIdx = entryIdx + 60
  const lowDay = measured.daysToLow
  const lowIdx = lowDay == null ? null : t0Idx + lowDay
  const lowClose = lowIdx == null ? null : closes[lowIdx]
  const fromEntry = {}
  const fromEventualLow = {}
  const afterLowFormed = {}
  for (const [key, offset] of HORIZONS) {
    const idx = key === "windowEnd" ? endIdx : t0Idx + offset
    const entryReturn = idx <= endIdx ? closes[idx] / entryPrice - 1 : null
    fromEntry[key] = entryReturn
    if (lowClose == null || idx > endIdx) {
      fromEventualLow[key] = null
      afterLowFormed[key] = null
      continue
    }
    const fromLow = closes[idx] / lowClose - 1
    fromEventualLow[key] = fromLow
    const formed = key === "windowEnd" ? true : offset >= lowDay
    afterLowFormed[key] = formed ? fromLow : null
  }
  const rebound = {}
  for (const target of REBOUND_TARGETS) {
    const days = lowIdx == null ? null : firstRebound(closes, lowIdx, endIdx, lowClose, target)
    rebound[String(Math.round(target * 100))] = { reached: days != null, days }
  }
  const entryClock = {}
  for (const level of ENTRY_LEVELS) {
    const days = lowIdx == null ? null : firstAtOrAbove(closes, lowIdx, endIdx, entryPrice * (1 + level))
    entryClock[level === 0 ? "entry" : `plus${Math.round(level * 100)}`] = { reached: days != null, days }
  }
  return {
    lowDay,
    lowReturnFromEntry: measured.lowVsEntry,
    lowReturnFromEpisodeStart: lowClose == null ? null : lowClose / closes[entryIdx] - 1,
    lowToWindowReturn: measured.reboundFromLow,
    fromEntry,
    fromEventualLow,
    afterLowFormed,
    rebound,
    entryClock,
    measured,
  }
}

export function attachRebound(events, seriesBySymbol) {
  return events.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`missing series ${event.ticker}`)
    const entryIdx = dateIndex(series.dates, event.episodeStart)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    if (entryIdx < 0 || t0Idx < 0) throw new Error(`${event.ticker} missing ${event.episodeStart} or ${event.t0Date}`)
    const described = describeRebound(series.closes, entryIdx, t0Idx, event.entryPrice)
    const stored = event.stored
    if (described.lowDay !== stored.daysToLow) throw new Error(`lowDay mismatch ${event.eventId}`)
    if (!closeEnough(described.lowReturnFromEntry, stored.lowVsEntry)) throw new Error(`low return mismatch ${event.eventId}`)
    if (!closeEnough(described.lowToWindowReturn, stored.reboundFromLow)) throw new Error(`window rebound mismatch ${event.eventId}`)
    if (!closeEnough(described.fromEntry.t5, stored.t5) || !closeEnough(described.fromEntry.windowEnd, stored.windowEnd)) {
      throw new Error(`stored path mismatch ${event.eventId}`)
    }
    const { measured, ...rest } = described
    return { ...event, ...rest }
  })
}

function valuesOf(events, read) {
  return events.map(read).filter((value) => Number.isFinite(value))
}

function dayStats(events, read) {
  const values = valuesOf(events, read)
  const variance = values.length < 2 ? null : values.reduce((sum, value) => sum + (value - mean(values)) ** 2, 0) / (values.length - 1)
  return {
    n: values.length,
    groupN: events.length,
    avg: round2(mean(values)),
    median: round2(median(values)),
    stdev: variance == null ? null : round2(Math.sqrt(variance)),
    judgment: sampleJudgment(values.length),
  }
}

function returnStats(events, read) {
  const values = valuesOf(events, read)
  return {
    n: values.length,
    groupN: events.length,
    avg: pct(mean(values)),
    median: pct(median(values)),
    judgment: sampleJudgment(values.length),
  }
}

function milestoneStats(events, key) {
  const reached = events.filter((event) => event.rebound[key].reached)
  const days = reached.map((event) => event.rebound[key].days)
  return {
    total: events.length,
    reached: reached.length,
    censored: events.length - reached.length,
    label: `${reached.length}/${events.length}`,
    rate: events.length ? round2((reached.length / events.length) * 100) : null,
    avgDays: round2(mean(days)),
    medianDays: round2(median(days)),
    judgment: sampleJudgment(events.length),
    reachedJudgment: sampleJudgment(reached.length),
  }
}

function entryClockStats(events, key) {
  const reached = events.filter((event) => event.entryClock[key].reached)
  const days = reached.map((event) => event.entryClock[key].days)
  return {
    total: events.length,
    reached: reached.length,
    censored: events.length - reached.length,
    label: `${reached.length}/${events.length}`,
    rate: events.length ? round2((reached.length / events.length) * 100) : null,
    avgDays: round2(mean(days)),
    medianDays: round2(median(days)),
    judgment: sampleJudgment(events.length),
  }
}

function diff(left, right) {
  if (left == null || right == null || !Number.isFinite(left) || !Number.isFinite(right)) return null
  return round2(left - right)
}

export function lowTiming(events) {
  const stats = dayStats(events, (event) => event.lowDay)
  const finite = events.filter((event) => Number.isFinite(event.lowDay))
  const cumulative = LOW_MARKS.map((mark) => {
    const n = finite.filter((event) => event.lowDay <= mark).length
    return {
      by: mark,
      n,
      groupN: events.length,
      rate: events.length ? round2((n / events.length) * 100) : null,
    }
  })
  const bins = [
    { id: "t1", label: "T+1", test: (day) => day <= 1 },
    { id: "t3", label: "T+3", test: (day) => day > 1 && day <= 3 },
    { id: "t5", label: "T+5", test: (day) => day > 3 && day <= 5 },
    { id: "t7", label: "T+7", test: (day) => day > 5 && day <= 7 },
    { id: "t10", label: "T+10", test: (day) => day > 7 && day <= 10 },
    { id: "t15", label: "T+15", test: (day) => day > 10 && day <= 15 },
    { id: "t20", label: "T+20", test: (day) => day > 15 && day <= 20 },
    { id: "after20", label: "T+20 이후", test: (day) => day > 20 },
  ].map((bin) => {
    const n = finite.filter((event) => bin.test(event.lowDay)).length
    return { id: bin.id, label: bin.label, n, groupN: events.length, rate: events.length ? round2((n / events.length) * 100) : null }
  })
  return {
    ...stats,
    beforeT1: finite.filter((event) => event.lowDay < 1).length,
    cumulative,
    bins,
  }
}

function pathSeries(events, field) {
  return HORIZONS.map(([key, offset]) => {
    const stats = returnStats(events, (event) => event[field][key])
    return { key, offset: key === "windowEnd" ? "window" : offset, ...stats }
  })
}

function groupBlock(events) {
  return {
    n: events.length,
    judgment: sampleJudgment(events.length),
    lowTiming: lowTiming(events),
    lowReturnFromEntry: returnStats(events, (event) => event.lowReturnFromEntry),
    lowReturnFromEpisodeStart: returnStats(events, (event) => event.lowReturnFromEpisodeStart),
    lowToWindow: returnStats(events, (event) => event.lowToWindowReturn),
    pathFromEntry: pathSeries(events, "fromEntry"),
    pathFromEventualLow: pathSeries(events, "fromEventualLow"),
    reboundAfterLow: pathSeries(events, "afterLowFormed"),
    milestones: Object.fromEntries(REBOUND_TARGETS.map((target) => [String(Math.round(target * 100)), milestoneStats(events, String(Math.round(target * 100)))])),
    entryClock: {
      entry: entryClockStats(events, "entry"),
      plus5: entryClockStats(events, "plus5"),
      plus10: entryClockStats(events, "plus10"),
    },
  }
}

function byGroup(events) {
  return {
    HIGH: events.filter((event) => event.leadershipGroup === "HIGH"),
    MID: events.filter((event) => event.leadershipGroup === "MID"),
    LOW: events.filter((event) => event.leadershipGroup === "LOW"),
  }
}

export function summarizeGroups(events) {
  const groups = byGroup(events)
  const blocks = {
    HIGH: groupBlock(groups.HIGH),
    MID: groupBlock(groups.MID),
    LOW: groupBlock(groups.LOW),
  }
  const highLow = {
    lowDayAvg: diff(blocks.HIGH.lowTiming.avg, blocks.LOW.lowTiming.avg),
    lowDayMedian: diff(blocks.HIGH.lowTiming.median, blocks.LOW.lowTiming.median),
    lowDayStatus: blocks.HIGH.lowTiming.judgment === "limited" && blocks.LOW.lowTiming.judgment === "limited" ? "제한적 해석 가능" : "표본 부족",
  }
  return { blocks, highLow }
}

export function coreTables(summary) {
  const high = summary.blocks.HIGH
  const mid = summary.blocks.MID
  const low = summary.blocks.LOW
  const point = (block, field, key) => block[field].find((row) => row.key === key)
  return {
    rebound: [
      { label: "lowDay avg", high: high.lowTiming.avg, mid: mid.lowTiming.avg, low: low.lowTiming.avg, highN: high.lowTiming.n, lowN: low.lowTiming.n, highMinusLow: summary.highLow.lowDayAvg },
      { label: "lowDay median", high: high.lowTiming.median, mid: mid.lowTiming.median, low: low.lowTiming.median, highN: high.lowTiming.n, lowN: low.lowTiming.n, highMinusLow: summary.highLow.lowDayMedian },
      ...["t5", "t10", "t20", "t40", "windowEnd"].map((key) => {
        const h = point(high, "reboundAfterLow", key)
        const m = point(mid, "reboundAfterLow", key)
        const l = point(low, "reboundAfterLow", key)
        return { label: `${key} low rebound`, high: h.avg, mid: m.avg, low: l.avg, highN: h.n, midN: m.n, lowN: l.n, highMinusLow: diff(h.avg, l.avg) }
      }),
      ...["5", "10", "15", "20"].map((key) => ({
        label: `+${key}% rebound reach`,
        high: high.milestones[key].label,
        mid: mid.milestones[key].label,
        low: low.milestones[key].label,
        highRate: high.milestones[key].rate,
        midRate: mid.milestones[key].rate,
        lowRate: low.milestones[key].rate,
        highMinusLow: diff(high.milestones[key].rate, low.milestones[key].rate),
      })),
    ],
    entry: ["t5", "t10", "t20", "t40", "windowEnd"].map((key) => {
      const h = point(high, "pathFromEntry", key)
      const m = point(mid, "pathFromEntry", key)
      const l = point(low, "pathFromEntry", key)
      return { label: `${key} entry return`, high: h.avg, mid: m.avg, low: l.avg, highN: h.n, midN: m.n, lowN: l.n, highMinusLow: diff(h.avg, l.avg) }
    }),
  }
}

function tickerMeans(events, read) {
  const byTicker = new Map()
  for (const event of events) {
    const value = read(event)
    if (!Number.isFinite(value)) continue
    if (!byTicker.has(event.ticker)) byTicker.set(event.ticker, [])
    byTicker.get(event.ticker).push(value)
  }
  const means = [...byTicker.values()].map((rows) => mean(rows))
  return { tickers: means.length, avg: means.length ? mean(means) : null }
}

export function stockWeighted(events) {
  const groups = byGroup(events)
  const metrics = [
    ["lowDay", (event) => event.lowDay, 1],
    ["t10", (event) => event.afterLowFormed.t10, 100],
    ["t20", (event) => event.afterLowFormed.t20, 100],
    ["t40", (event) => event.afterLowFormed.t40, 100],
    ["windowEnd", (event) => event.afterLowFormed.windowEnd, 100],
  ]
  const out = {}
  for (const [name, read, scale] of metrics) {
    const high = tickerMeans(groups.HIGH, read)
    const low = tickerMeans(groups.LOW, read)
    out[name] = {
      highTickers: high.tickers,
      lowTickers: low.tickers,
      high: round2(high.avg == null ? null : high.avg * scale),
      low: round2(low.avg == null ? null : low.avg * scale),
      highMinusLow: diff(round2(high.avg == null ? null : high.avg * scale), round2(low.avg == null ? null : low.avg * scale)),
      judgment: sampleJudgment(Math.min(high.tickers, low.tickers)),
    }
  }
  return out
}

function eventGap(events) {
  const groups = byGroup(events)
  const avg = (rows, read, scale) => {
    const values = valuesOf(rows, read)
    return values.length ? mean(values) * scale : null
  }
  const highLow = (read, scale) => diff(round2(avg(groups.HIGH, read, scale)), round2(avg(groups.LOW, read, scale)))
  return {
    t20Rebound: highLow((event) => event.afterLowFormed.t20, 100),
    windowRebound: highLow((event) => event.afterLowFormed.windowEnd, 100),
    lowDay: highLow((event) => event.lowDay, 1),
  }
}

export function leaveOneTickerOut(events, universe = EQUITY_SELL_RESEARCH_UNIVERSE) {
  const baseline = eventGap(events)
  const rows = universe.map((item) => {
    const ticker = item.symbol || item
    const removed = events.filter((event) => event.ticker === ticker).length
    const next = eventGap(events.filter((event) => event.ticker !== ticker))
    return { ticker, removed, ...next }
  })
  if (rows.reduce((sum, row) => sum + row.removed, 0) !== events.length) {
    throw new Error("leave-one-ticker-out removals do not add up to the study sample")
  }
  function span(key) {
    const active = rows.filter((row) => row.removed > 0).map((row) => row[key]).filter((value) => Number.isFinite(value))
    const flips = rows.filter((row) => row.removed > 0 && Number.isFinite(row[key]) && Number.isFinite(baseline[key]) && Math.sign(row[key]) !== Math.sign(baseline[key]) && row[key] !== 0 && baseline[key] !== 0)
    return {
      min: active.length ? round2(Math.min(...active)) : null,
      max: active.length ? round2(Math.max(...active)) : null,
      median: round2(median(active)),
      signFlips: flips.map((row) => row.ticker),
    }
  }
  return { baseline, rows, t20Rebound: span("t20Rebound"), windowRebound: span("windowRebound"), lowDay: span("lowDay") }
}

export function correlateOutcomes(events) {
  const scored = events.filter((event) => Number.isFinite(event.leadershipScore))
  const pair = (xRead, yRead) => spearman(scored.map((event) => ({ x: xRead(event), y: yRead(event) })).filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y)))
  const outcomes = {
    lowDay: (event) => event.lowDay,
    t10: (event) => event.afterLowFormed.t10,
    t20: (event) => event.afterLowFormed.t20,
    t40: (event) => event.afterLowFormed.t40,
    windowEnd: (event) => event.afterLowFormed.windowEnd,
  }
  const leadership = {}
  const t0 = {}
  for (const [name, read] of Object.entries(outcomes)) {
    leadership[name] = pair((event) => event.leadershipScore, read)
    t0[name] = pair((event) => event.t0, read)
  }
  return { leadership, t0 }
}
