/**
 * ETF correction-path study v7 (research only).
 *
 * Reuses the v6 correction day, speed terciles, and running-low rebound.
 * Depth, speed, and rebound are the only grouping variables.
 * T+10 and T+20 are outcomes. They are not used to assign a group.
 * No sell rule is selected.
 *
 * Path labels below were fixed before the v7 result was read.
 * RECOVERY-LIKE requires every recovery condition.
 * RISK-LIKE requires every risk condition.
 * A cell whose T+20 and window-end clocks disagree stays MIXED.
 * Event count below 10, or T+20 count below 10, is not labeled.
 */

import { median } from "./etf-sell-backtest.mjs"
import {
  SMALL_SAMPLE,
  analyzeSymbolV6,
  speedBucket,
  speedCuts,
} from "./etf-sell-backtest-v6.mjs"

export { SMALL_SAMPLE, analyzeSymbolV6, speedBucket, speedCuts }

export const PATH_CLASS_RULE = Object.freeze({
  id: "v7-fixed-before-results",
  sellRule: false,
  minClassN: SMALL_SAMPLE,
  noConclusionN: 5,
  peakLowPct: 25,
  additionalHighPct: 5,
  recoveryLike:
    "T+20 average > 0, T+20 win rate >= 50, window-end average > 0, window-end win rate >= 50, and peak recovery >= 25. All are required.",
  riskLike:
    "T+20 average < 0, T+20 win rate < 50, window-end average < 0, window-end win rate < 50, peak recovery < 25, and average additional drawdown >= 5. All are required.",
  mixed: "A cell with both clocks observed is MIXED when either full conjunction is missed. Horizon disagreement cannot become RECOVERY-LIKE or RISK-LIKE.",
  small: "No label when the event count or the T+20 count is below 10. No conclusion when either count is below 5.",
})

const REBOUND_BUCKETS = ["LT5", "GE5", "GE10"]
const SPEED_NAMES = ["FAST", "NORMAL", "SLOW"]

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function pct(fraction) {
  if (fraction == null || !Number.isFinite(fraction)) return null
  return round2(fraction * 100)
}

function mean(values) {
  const xs = values.filter((value) => Number.isFinite(value))
  if (!xs.length) return null
  return xs.reduce((sum, value) => sum + value, 0) / xs.length
}

function share(flags) {
  if (!flags.length) return null
  return (flags.filter(Boolean).length / flags.length) * 100
}

function clock(rows, key) {
  const present = rows.filter((row) => row.horizons?.[key])
  const values = present.map((row) => row.horizons[key].vsEntry)
  return {
    n: present.length,
    avg: pct(mean(values)),
    win: round2(share(values.map((value) => value > 0))),
    entryHold: round2(share(values.map((value) => value >= 0))),
  }
}

export function classifyCell(metrics) {
  const n60 = metrics.n60 ?? 0
  const n20 = metrics.n20 ?? 0
  const sampleSmall = n60 < PATH_CLASS_RULE.minClassN || n20 < PATH_CLASS_RULE.minClassN
  const noConclusion = n60 < PATH_CLASS_RULE.noConclusionN || n20 < PATH_CLASS_RULE.noConclusionN
  if (sampleSmall) return { label: null, sample_small: true, no_conclusion: noConclusion }
  const recovery =
    metrics.t20Avg > 0 &&
    metrics.t20Win >= 50 &&
    metrics.windowEndAvg > 0 &&
    metrics.windowEndWin >= 50 &&
    metrics.peakRecovery >= PATH_CLASS_RULE.peakLowPct
  const risk =
    metrics.t20Avg < 0 &&
    metrics.t20Win < 50 &&
    metrics.windowEndAvg < 0 &&
    metrics.windowEndWin < 50 &&
    metrics.peakRecovery < PATH_CLASS_RULE.peakLowPct &&
    metrics.avgAdditional >= PATH_CLASS_RULE.additionalHighPct
  return {
    label: recovery ? "RECOVERY-LIKE" : risk ? "RISK-LIKE" : "MIXED",
    sample_small: false,
    no_conclusion: false,
  }
}

export function reboundStateBefore(row, limitIdx) {
  const known = (key) => {
    const signal = row.reboundFollow?.[key]
    if (!signal?.happened || !Number.isFinite(limitIdx)) return false
    return row.t0 + signal.daysFromT0 < limitIdx
  }
  if (known("p10")) return "GE10"
  if (known("p5")) return "GE5"
  return "LT5"
}

export function matchesRebound(state, bucket) {
  if (bucket === "LT5") return state === "LT5"
  if (bucket === "GE5") return state === "GE5" || state === "GE10"
  if (bucket === "GE10") return state === "GE10"
  return false
}

function pathStats(rows) {
  const t20 = clock(rows, "t20")
  const end = clock(rows, "windowEnd")
  return {
    n60: rows.length,
    n20: t20.n,
    peakRecovery: round2(share(rows.map((row) => row.peakRecovered))),
    entryRecovery: round2(share(rows.map((row) => row.recoveredEntryLater || row.aboveEntryAtT0))),
    avgAdditional: pct(mean(rows.map((row) => row.additionalDrawdown))),
    medianAdditional: pct(median(rows.map((row) => row.additionalDrawdown))),
    avgMaxDrawdown: pct(mean(rows.map((row) => row.maxDrawdownFromPeak))),
    avgRebound: pct(mean(rows.map((row) => row.reboundFromLow))),
    t5: clock(rows, "t5"),
    t10: clock(rows, "t10"),
    t20,
    windowEnd: end,
  }
}

function publish(stats, pathClass, extra = {}) {
  return {
    events: stats.n60,
    n60: stats.n60,
    n20: stats.n20,
    sample_small: pathClass.sample_small,
    no_conclusion: pathClass.no_conclusion,
    path_class: pathClass.label,
    peak_recovery_rate: stats.peakRecovery,
    entry_recovery_rate: stats.entryRecovery,
    avg_additional_drawdown: stats.avgAdditional,
    median_additional_drawdown: stats.medianAdditional,
    avg_max_drawdown: stats.avgMaxDrawdown,
    avg_rebound_from_low: stats.avgRebound,
    T5_avg: stats.t5.avg,
    T5_n: stats.t5.n,
    T10_avg: stats.t10.avg,
    T10_n: stats.t10.n,
    T10_entry_hold_rate: stats.t10.entryHold,
    T20_avg: stats.t20.avg,
    T20_n: stats.t20.n,
    T20_win_rate: stats.t20.win,
    T20_entry_hold_rate: stats.t20.entryHold,
    window_end_avg: stats.windowEnd.avg,
    window_end_n: stats.windowEnd.n,
    window_end_win_rate: stats.windowEnd.win,
    ...extra,
  }
}

function cellFromRows(rows) {
  const stats = pathStats(rows)
  const pathClass = classifyCell({
    n60: stats.n60,
    n20: stats.n20,
    t20Avg: stats.t20.avg,
    t20Win: stats.t20.win,
    windowEndAvg: stats.windowEnd.avg,
    windowEndWin: stats.windowEnd.win,
    peakRecovery: stats.peakRecovery,
    avgAdditional: stats.avgAdditional,
  })
  return publish(stats, pathClass)
}

function followRates(rows, key) {
  const followed = rows.filter((row) => row.reboundFollow?.[key]?.happened)
  return {
    follow_n: followed.length,
    peak_after_signal_rate: round2(share(followed.map((row) => row.reboundFollow[key].peakAfter))),
    entry_after_signal_rate: round2(share(followed.map((row) => row.reboundFollow[key].entryAfter))),
    new_low_after_signal_rate: round2(share(followed.map((row) => row.reboundFollow[key].newLowAfter))),
  }
}

function reboundCell(rows, bucket) {
  const select = (offset) =>
    rows.filter((row) => {
      const limit = offset == null ? row.end : row.t0 + offset
      return matchesRebound(reboundStateBefore(row, limit), bucket)
    })
  const t5Rows = select(5).filter((row) => row.horizons?.t5)
  const t10Rows = select(10).filter((row) => row.horizons?.t10)
  const t20Rows = select(20).filter((row) => row.horizons?.t20)
  const endRows = select(null)
  const endStats = pathStats(endRows)
  const t5 = clock(t5Rows, "t5")
  const t10 = clock(t10Rows, "t10")
  const t20 = clock(t20Rows, "t20")
  const pathClass = classifyCell({
    n60: endRows.length,
    n20: t20.n,
    t20Avg: t20.avg,
    t20Win: t20.win,
    windowEndAvg: endStats.windowEnd.avg,
    windowEndWin: endStats.windowEnd.win,
    peakRecovery: endStats.peakRecovery,
    avgAdditional: endStats.avgAdditional,
  })
  const followKey = bucket === "GE10" ? "p10" : bucket === "GE5" ? "p5" : null
  return publish(
    {
      ...endStats,
      n20: t20.n,
      t5,
      t10,
      t20,
    },
    pathClass,
    {
      rebound: bucket,
      rebound_nested: bucket === "GE10" ? "GE10 is included in GE5" : null,
      lookahead_guard:
        "A rebound counts only when its running-low signal is strictly before the outcome bar. T+5, T+10, T+20, and the window end each use their own known-before set.",
      ...(followKey ? followRates(endRows, followKey) : {
        follow_n: null,
        peak_after_signal_rate: null,
        entry_after_signal_rate: null,
        new_low_after_signal_rate: null,
      }),
    },
  )
}

function loadDepth(parts, arm, dd) {
  const id = `p${Math.round(arm * 100)}-d${Math.round(dd * 100)}`
  const rows = parts.flatMap((part) => part.profit[id]).filter((row) => row.event)
  const cuts = speedCuts(rows.map((row) => row.speedDays))
  return { id, arm, dd, rows, cuts }
}

function speedCells(block) {
  return SPEED_NAMES.map((name) => {
    const rows = block.rows.filter((row) => speedBucket(row.speedDays, block.cuts) === name)
    return { speed: name, ...cellFromRows(rows) }
  })
}

function hypothesis(tableA, tableB) {
  const bySpeed = Object.fromEntries(tableA.map((row) => [row.speed, row]))
  const byRebound = Object.fromEntries(tableB.map((row) => [row.rebound, row]))
  const fast = bySpeed.FAST
  const normal = bySpeed.NORMAL
  const slow = bySpeed.SLOW
  const weaker = (left, right, key) => left?.[key] != null && right?.[key] != null && left[key] < right[key]
  return {
    H3: {
      t20_slower_than_fast_and_normal: weaker(slow, fast, "T20_avg") && weaker(slow, normal, "T20_avg"),
      window_slower_than_fast_and_normal:
        weaker(slow, fast, "window_end_avg") && weaker(slow, normal, "window_end_avg"),
      slow_class: slow?.path_class ?? null,
      fast_class: fast?.path_class ?? null,
      normal_class: normal?.path_class ?? null,
    },
    H4: {
      ge5_t20_above_lt5: weaker(byRebound.LT5, byRebound.GE5, "T20_avg"),
      ge5_window_above_lt5: weaker(byRebound.LT5, byRebound.GE5, "window_end_avg"),
      ge10_t20_above_lt5: weaker(byRebound.LT5, byRebound.GE10, "T20_avg"),
      ge10_window_above_lt5: weaker(byRebound.LT5, byRebound.GE10, "window_end_avg"),
      classes: {
        LT5: byRebound.LT5?.path_class ?? null,
        GE5: byRebound.GE5?.path_class ?? null,
        GE10: byRebound.GE10?.path_class ?? null,
      },
      sample_small: {
        LT5: byRebound.LT5?.sample_small ?? true,
        GE5: byRebound.GE5?.sample_small ?? true,
        GE10: byRebound.GE10?.sample_small ?? true,
      },
    },
    H5: {
      weak_rebound_class: byRebound.LT5?.path_class ?? null,
      no_conclusion: byRebound.LT5?.no_conclusion ?? true,
    },
  }
}

export function buildV7(parts) {
  const shallow5 = loadDepth(parts, 0.1, 0.05)
  const shallow7 = loadDepth(parts, 0.1, 0.07)
  const deep = loadDepth(parts, 0.1, 0.1)
  const plus15 = [0.05, 0.07, 0.1].map((dd) => loadDepth(parts, 0.15, dd))
  const tableA = speedCells(deep)
  const tableB = REBOUND_BUCKETS.map((bucket) => {
    const slowRows = deep.rows.filter((row) => speedBucket(row.speedDays, deep.cuts) === "SLOW")
    return { speed: "SLOW", ...reboundCell(slowRows, bucket) }
  })
  const tableC = SPEED_NAMES.flatMap((name) => {
    const rows = deep.rows.filter((row) => speedBucket(row.speedDays, deep.cuts) === name)
    return REBOUND_BUCKETS.map((bucket) => ({ speed: name, ...reboundCell(rows, bucket) }))
  })
  const partition = SPEED_NAMES.flatMap((name) => {
    const rows = deep.rows.filter((row) => speedBucket(row.speedDays, deep.cuts) === name)
    return ["LT5", "GE5_ONLY", "GE10"].map((bucket) => {
      const endRows = rows.filter((row) => {
        const state = reboundStateBefore(row, row.end)
        if (bucket === "GE5_ONLY") return state === "GE5"
        return state === (bucket === "LT5" ? "LT5" : "GE10")
      })
      return { speed: name, rebound: bucket, n60: endRows.length }
    })
  })
  return {
    selectedStrategy: null,
    classRule: PATH_CLASS_RULE,
    depth: [
      { depth: "SHALLOW", threshold: "-5", speed_cuts: shallow5.cuts, ...cellFromRows(shallow5.rows) },
      { depth: "SHALLOW", threshold: "-7", speed_cuts: shallow7.cuts, ...cellFromRows(shallow7.rows) },
      { depth: "DEEP", threshold: "-10", speed_cuts: deep.cuts, ...cellFromRows(deep.rows) },
    ],
    tableA,
    tableB,
    tableC,
    partition,
    deepCuts: deep.cuts,
    deepEvents: deep.rows.length,
    plus15: plus15.map((block) => ({
      threshold: `-${Math.round(block.dd * 100)}`,
      depth: block.dd === 0.1 ? "DEEP" : "SHALLOW",
      speed_cuts: block.cuts,
      overall: cellFromRows(block.rows),
      speeds: speedCells(block),
    })),
    hypotheses: null,
  }
}

export function finishV7(study) {
  const hypotheses = hypothesis(study.tableA, study.tableB)
  const shallow = study.depth.filter((row) => row.depth === "SHALLOW")
  const deep = study.depth.find((row) => row.depth === "DEEP")
  hypotheses.H1 = {
    shallow_peak: shallow.map((row) => ({ threshold: row.threshold, peak: row.peak_recovery_rate, class: row.path_class })),
    deep_peak: deep?.peak_recovery_rate ?? null,
    deep_class: deep?.path_class ?? null,
    peak_cut_splits_shallow5_from_deep:
      shallow[0]?.peak_recovery_rate >= PATH_CLASS_RULE.peakLowPct && deep?.peak_recovery_rate < PATH_CLASS_RULE.peakLowPct,
  }
  const fast = study.tableA.find((row) => row.speed === "FAST")
  const slow = study.tableA.find((row) => row.speed === "SLOW")
  hypotheses.H2 = {
    classes: study.tableA.map((row) => ({ speed: row.speed, class: row.path_class, sample_small: row.sample_small })),
    t20_sign_splits_fast_and_slow:
      fast?.T20_avg != null &&
      slow?.T20_avg != null &&
      Math.sign(fast.T20_avg) !== 0 &&
      Math.sign(fast.T20_avg) !== Math.sign(slow.T20_avg),
    window_sign_splits_fast_and_slow:
      fast?.window_end_avg != null &&
      slow?.window_end_avg != null &&
      Math.sign(fast.window_end_avg) !== 0 &&
      Math.sign(fast.window_end_avg) !== Math.sign(slow.window_end_avg),
  }
  return { ...study, hypotheses }
}
