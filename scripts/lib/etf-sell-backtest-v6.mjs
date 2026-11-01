/**
 * ETF correction-path study v6 (research only).
 *
 * Same 3/4 episodes, quote close, and 60-session window as v1–v5.
 * A correction day is the first close that is the stated percent below the
 * running peak after a profit band, or the first loss from entry when +10
 * was never reached. Later sessions are used only when they sit inside that
 * window. No sell rule is selected.
 */

import {
  DAILY_BOTTOM_BUY_ETFS,
  FORWARD_DAYS,
  buildSellEvents,
  median,
} from "./etf-sell-backtest.mjs"
import { firstArmedPullback, measurePullback } from "./etf-sell-backtest-v3.mjs"

export { DAILY_BOTTOM_BUY_ETFS, FORWARD_DAYS, buildSellEvents, firstArmedPullback, measurePullback }

const EPS = 1e-9
const LOSS_EPS = 1e-12
export const SMALL_SAMPLE = 10
export const OFFSETS = [5, 10, 20, 40, 60]
export const BANDS = [0.1, 0.15, 0.2]
export const DEPTHS = [0.05, 0.07, 0.1, 0.15, 0.2]
export const REBOUND_LEVELS = [0.03, 0.05, 0.07, 0.1]
export const FOCUS_ETFS = ["SMH", "QQQ", "URA", "BOTZ"]

export const CLASS_RULE =
  "Ex-post description, not a sell rule. NORMAL_CORRECTION reclaimed the pre-correction peak inside the 60-day window. TREND_BREAK traded below the entry price and did not get back to it. DANGEROUS_CORRECTION did not reclaim the peak, while either staying above the entry price or regaining it."

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

function profitReached(close, entry, arm) {
  return entry > 0 && (close - entry) / entry + EPS >= arm
}

function pullbackReached(peak, close, dd) {
  return peak > close && (peak - close) / peak + EPS >= dd
}

function lossReached(close, entry, dd) {
  return entry > 0 && (entry - close) / entry + LOSS_EPS >= dd
}

export function locateProfitCorrection(closes, entryIdx, horizon, arm, dd) {
  const entry = closes[entryIdx]
  const end = Math.min(closes.length - 1, entryIdx + horizon)
  let peak = entry
  let peakIdx = entryIdx
  let armed = false
  let armIdx = null
  for (let j = entryIdx + 1; j <= end; j++) {
    if (closes[j] > peak) {
      peak = closes[j]
      peakIdx = j
    }
    if (!armed && profitReached(closes[j], entry, arm)) {
      armed = true
      armIdx = j
    }
    if (!armed) continue
    if (pullbackReached(peak, closes[j], dd)) {
      return {
        event: true,
        entry,
        entryIdx,
        end,
        peak,
        peakIdx,
        armIdx,
        t0: j,
        t0Price: closes[j],
      }
    }
  }
  return { event: false, entry, entryIdx, end }
}

export function locateLossCorrection(closes, entryIdx, horizon, dd) {
  const entry = closes[entryIdx]
  const end = Math.min(closes.length - 1, entryIdx + horizon)
  for (let j = entryIdx + 1; j <= end; j++) {
    if (!lossReached(closes[j], entry, dd)) continue
    let peak = entry
    let peakIdx = entryIdx
    for (let k = entryIdx; k <= j; k++) {
      if (closes[k] > peak) {
        peak = closes[k]
        peakIdx = k
      }
    }
    return {
      event: true,
      entry,
      entryIdx,
      end,
      peak,
      peakIdx,
      armIdx: entryIdx,
      t0: j,
      t0Price: closes[j],
    }
  }
  return { event: false, entry, entryIdx, end }
}

function quoteAt(closes, index, end, entry, t0Price) {
  if (index > end || index < 0 || index >= closes.length) return null
  const price = closes[index]
  return {
    vsEntry: (price - entry) / entry,
    vsT0: t0Price > 0 ? (price - t0Price) / t0Price : null,
  }
}

function firstAtOrAbove(closes, from, end, level) {
  for (let k = from; k <= end; k++) {
    if (closes[k] + EPS >= level) return k
  }
  return null
}

function runningReboundSignals(closes, t0, end, t0Price) {
  let runLow = t0Price
  let runLowIdx = t0
  const signals = {}
  for (let j = t0 + 1; j <= end; j++) {
    const rise = runLow > 0 ? (closes[j] - runLow) / runLow : null
    for (const level of REBOUND_LEVELS) {
      const key = `p${Math.round(level * 100)}`
      if (signals[key] || rise == null || rise + LOSS_EPS < level) continue
      signals[key] = { idx: j, low: runLow, lowIdx: runLowIdx, level }
    }
    if (closes[j] < runLow) {
      runLow = closes[j]
      runLowIdx = j
    }
  }
  return signals
}

export function describeCorrection(closes, located) {
  if (!located.event) return { event: false }
  const { entry, entryIdx, end, peak, peakIdx, armIdx, t0, t0Price } = located
  const horizons = {}
  for (const offset of OFFSETS) horizons[`t${offset}`] = quoteAt(closes, t0 + offset, end, entry, t0Price)
  horizons.windowEnd = quoteAt(closes, end, end, entry, t0Price)

  let minAfter = null
  let minAfterIdx = null
  let brokeEntry = t0Price + EPS < entry
  for (let k = t0 + 1; k <= end; k++) {
    if (minAfter == null || closes[k] < minAfter) {
      minAfter = closes[k]
      minAfterIdx = k
    }
    if (closes[k] + EPS < entry) brokeEntry = true
  }
  const hasAfter = minAfter != null
  const additionalDrawdown = hasAfter && t0Price > 0 ? Math.max(0, (t0Price - minAfter) / t0Price) : hasAfter ? null : null
  const newLow = hasAfter && minAfter < t0Price
  let reboundFromLow = null
  if (minAfterIdx != null && minAfterIdx < end && minAfter > 0) {
    let maxAfterLow = closes[minAfterIdx + 1]
    for (let k = minAfterIdx + 1; k <= end; k++) if (closes[k] > maxAfterLow) maxAfterLow = closes[k]
    reboundFromLow = (maxAfterLow - minAfter) / minAfter
  }

  const entryTouch = firstAtOrAbove(closes, t0 + 1, end, entry)
  const peakTouch = firstAtOrAbove(closes, t0 + 1, end, peak)
  const recoveredEntry = entryTouch != null || t0Price + EPS >= entry
  const recoveredEntryLater = entryTouch != null
  let recoveredAfterBreak = null
  if (brokeEntry) {
    const breakIdx = t0Price + EPS < entry ? t0 : firstBelow(closes, t0, end, entry)
    recoveredAfterBreak = breakIdx != null && firstAtOrAbove(closes, breakIdx + 1, end, entry) != null
  }

  let structureLow = closes[entryIdx]
  for (let k = entryIdx; k <= peakIdx; k++) if (closes[k] < structureLow) structureLow = closes[k]
  const brokeStructure = closes.slice(t0, end + 1).some((price) => price + EPS < structureLow)
  const structureTouch = brokeStructure ? firstAtOrAbove(closes, t0 + 1, end, structureLow) : null

  const reclaim20Eligible = t0 + 20 <= end
  let reclaimedWithin20 = null
  if (reclaim20Eligible) {
    reclaimedWithin20 = false
    for (let k = t0 + 1; k <= t0 + 20; k++) {
      if (closes[k] + EPS >= peak) {
        reclaimedWithin20 = true
        break
      }
    }
  }

  const reboundSignals = runningReboundSignals(closes, t0, end, t0Price)
  const reboundFollow = {}
  for (const [key, signal] of Object.entries(reboundSignals)) {
    let newLowAfter = false
    let entryAfter = false
    let peakAfter = false
    for (let k = signal.idx + 1; k <= end; k++) {
      if (closes[k] < signal.low) newLowAfter = true
      if (closes[k] + EPS >= entry) entryAfter = true
      if (closes[k] + EPS >= peak) peakAfter = true
    }
    reboundFollow[key] = {
      happened: true,
      daysFromT0: signal.idx - t0,
      entryAfter,
      peakAfter,
      newLowAfter,
    }
  }

  return {
    event: true,
    entry,
    entryIdx,
    end,
    peak,
    peakIdx,
    armIdx,
    t0,
    t0Price,
    speedDays: t0 - peakIdx,
    daysFromArm: armIdx == null ? null : t0 - armIdx,
    daysFromEntry: t0 - entryIdx,
    horizons,
    t0VsEntry: (t0Price - entry) / entry,
    aboveEntryAtT0: t0Price + EPS >= entry,
    brokeEntry,
    recoveredEntry,
    recoveredEntryLater,
    recoveredAfterBreak,
    daysToEntry: entryTouch == null ? null : entryTouch - t0,
    peakRecovered: peakTouch != null,
    daysToPeak: peakTouch == null ? null : peakTouch - t0,
    structureLow,
    brokeStructure,
    structureRecovered: brokeStructure ? structureTouch != null : null,
    daysToStructure: structureTouch == null ? null : structureTouch - t0,
    hasAfter,
    additionalDrawdown,
    further5: hasAfter && additionalDrawdown + LOSS_EPS >= 0.05,
    further10: hasAfter && additionalDrawdown + LOSS_EPS >= 0.1,
    further15: hasAfter && additionalDrawdown + LOSS_EPS >= 0.15,
    further20: hasAfter && additionalDrawdown + LOSS_EPS >= 0.2,
    newLow,
    reboundFromLow,
    reclaim20Eligible,
    reclaimedWithin20,
    reboundFollow,
    maxDrawdownFromPeak:
      hasAfter && peak > 0 ? Math.max(0, (peak - Math.min(t0Price, minAfter)) / peak) : (peak - t0Price) / peak,
  }
}

function firstBelow(closes, from, end, level) {
  for (let k = from; k <= end; k++) if (closes[k] + EPS < level) return k
  return null
}

export function speedCuts(days) {
  const xs = days.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (xs.length < SMALL_SAMPLE) return null
  const at = (p) => xs[Math.floor(p * (xs.length - 1))]
  let fastMax = at(1 / 3)
  let slowMin = at(2 / 3)
  if (slowMin <= fastMax) slowMin = fastMax + 1
  return { fastMax, slowMin, n: xs.length, min: xs[0], median: median(xs), max: xs[xs.length - 1] }
}

export function speedBucket(days, cuts) {
  if (!cuts || !Number.isFinite(days)) return null
  if (days <= cuts.fastMax) return "FAST"
  if (days >= cuts.slowMin) return "SLOW"
  return "NORMAL"
}

export function classifyPath(row) {
  if (!row?.event) return null
  if (row.peakRecovered) return "NORMAL_CORRECTION"
  if (row.brokeEntry && row.recoveredAfterBreak === false) return "TREND_BREAK"
  return "DANGEROUS_CORRECTION"
}

function horizonSummary(rows, key) {
  const present = rows.filter((row) => row.horizons?.[key])
  const values = present.map((row) => row.horizons[key].vsEntry)
  return {
    n: present.length,
    avgVsEntry: pct(mean(values)),
    medianVsEntry: pct(median(values)),
    avgVsT0: pct(mean(present.map((row) => row.horizons[key].vsT0))),
    medianVsT0: pct(median(present.map((row) => row.horizons[key].vsT0))),
    winRate: round2(share(values.map((value) => value > 0))),
    sampleNote: present.length < SMALL_SAMPLE ? "sample_small" : null,
  }
}

function recoverySummary(rows) {
  const entryDays = rows.filter((row) => row.daysToEntry != null).map((row) => row.daysToEntry)
  const peakDays = rows.filter((row) => row.daysToPeak != null).map((row) => row.daysToPeak)
  const eligible = rows.filter((row) => row.reclaim20Eligible)
  return {
    events: rows.length,
    sampleNote: rows.length < SMALL_SAMPLE ? "sample_small" : null,
    purchaseRecoveryRate: round2(share(rows.map((row) => row.recoveredEntryLater || row.aboveEntryAtT0))),
    laterEntryRate: round2(share(rows.map((row) => row.recoveredEntryLater))),
    entryBreakRate: round2(share(rows.map((row) => row.brokeEntry))),
    recoveryAfterBreakRate: round2(share(rows.filter((row) => row.brokeEntry).map((row) => row.recoveredAfterBreak === true))),
    priorPeakRecoveryRate: round2(share(rows.map((row) => row.peakRecovered))),
    priorLowBreakRate: round2(share(rows.map((row) => row.brokeStructure))),
    priorLowRecoveryRate: round2(
      share(rows.filter((row) => row.brokeStructure).map((row) => row.structureRecovered === true)),
    ),
    newLowRate: round2(share(rows.map((row) => row.newLow))),
    avgAdditionalDrawdown: pct(mean(rows.map((row) => row.additionalDrawdown))),
    medianAdditionalDrawdown: pct(median(rows.map((row) => row.additionalDrawdown))),
    avgReboundFromLow: pct(mean(rows.map((row) => row.reboundFromLow))),
    medianReboundFromLow: pct(median(rows.map((row) => row.reboundFromLow))),
    avgDaysToEntry: round2(mean(entryDays)),
    medianDaysToEntry: round2(median(entryDays)),
    avgDaysToPeak: round2(mean(peakDays)),
    medianDaysToPeak: round2(median(peakDays)),
    reclaim20Eligible: eligible.length,
    reclaim20Rate: round2(share(eligible.map((row) => row.reclaimedWithin20 === true))),
    reclaim20Note: eligible.length < SMALL_SAMPLE ? "sample_small" : null,
  }
}

export function summarizeRows(rows) {
  const events = rows.filter((row) => row.event)
  const recovery = recoverySummary(events)
  const cuts = speedCuts(events.map((row) => row.speedDays))
  const speeds = {}
  for (const name of ["FAST", "NORMAL", "SLOW"]) {
    const mine = events.filter((row) => speedBucket(row.speedDays, cuts) === name)
    const rec = recoverySummary(mine)
    speeds[name] = {
      n: mine.length,
      sampleNote: mine.length < SMALL_SAMPLE ? "sample_small" : null,
      priorPeakRecoveryRate: rec.priorPeakRecoveryRate,
      t20Avg: horizonSummary(mine, "t20").avgVsEntry,
      windowEndAvg: horizonSummary(mine, "windowEnd").avgVsEntry,
      avgAdditionalDrawdown: rec.avgAdditionalDrawdown,
      avgReboundFromLow: rec.avgReboundFromLow,
    }
  }
  const rebound = {}
  for (const level of REBOUND_LEVELS) {
    const key = `p${Math.round(level * 100)}`
    const hit = events.filter((row) => row.reboundFollow[key]?.happened)
    const miss = events.filter((row) => !row.reboundFollow[key]?.happened)
    rebound[key] = {
      n: hit.length,
      sampleNote: hit.length < SMALL_SAMPLE ? "sample_small" : null,
      missN: miss.length,
      entryAfterRate: round2(share(hit.map((row) => row.reboundFollow[key].entryAfter))),
      peakAfterRate: round2(share(hit.map((row) => row.reboundFollow[key].peakAfter))),
      newLowAfterRate: round2(share(hit.map((row) => row.reboundFollow[key].newLowAfter))),
      missPeakRate: round2(share(miss.map((row) => row.peakRecovered))),
    }
  }
  const classes = {}
  for (const name of ["NORMAL_CORRECTION", "DANGEROUS_CORRECTION", "TREND_BREAK"]) {
    const mine = events.filter((row) => classifyPath(row) === name)
    classes[name] = {
      n: mine.length,
      sampleNote: mine.length < SMALL_SAMPLE ? "sample_small" : null,
      medianSpeedDays: round2(median(mine.map((row) => row.speedDays))),
      avgAdditionalDrawdown: pct(mean(mine.map((row) => row.additionalDrawdown))),
      avgReboundFromLow: pct(mean(mine.map((row) => row.reboundFromLow))),
      t5AvgVsT0: horizonSummary(mine, "t5").avgVsT0,
      t20Avg: horizonSummary(mine, "t20").avgVsEntry,
      rebound5Rate: round2(share(mine.map((row) => row.reboundFollow.p5?.happened === true))),
    }
  }
  return {
    ...recovery,
    t0Avg: pct(mean(events.map((row) => row.t0VsEntry))),
    t0Median: pct(median(events.map((row) => row.t0VsEntry))),
    t5: horizonSummary(events, "t5"),
    t10: horizonSummary(events, "t10"),
    t20: horizonSummary(events, "t20"),
    t40: horizonSummary(events, "t40"),
    t60: horizonSummary(events, "t60"),
    windowEnd: horizonSummary(events, "windowEnd"),
    further5Rate: round2(share(events.map((row) => row.further5))),
    further10Rate: round2(share(events.map((row) => row.further10))),
    further15Rate: round2(share(events.map((row) => row.further15))),
    further20Rate: round2(share(events.map((row) => row.further20))),
    avgMaxDrawdownFromPeak: pct(mean(events.map((row) => row.maxDrawdownFromPeak))),
    medianMaxDrawdownFromPeak: pct(median(events.map((row) => row.maxDrawdownFromPeak))),
    speedCuts: cuts,
    speeds,
    rebound,
    classes,
  }
}

function bandLabel(arm) {
  return arm == null ? "no+10" : `+${Math.round(arm * 100)}`
}

function depthLabel(dd) {
  return `-${Math.round(dd * 100)}`
}

export function tableRow(summary, arm, dd) {
  return {
    entry_band: bandLabel(arm),
    correction_threshold: depthLabel(dd),
    events: summary.events,
    sample_small: summary.sampleNote,
    purchase_recovery_rate: summary.purchaseRecoveryRate,
    prior_peak_recovery_rate: summary.priorPeakRecoveryRate,
    new_low_rate: summary.newLowRate,
    avg_additional_drawdown: summary.avgAdditionalDrawdown,
    median_additional_drawdown: summary.medianAdditionalDrawdown,
    avg_rebound_from_low: summary.avgReboundFromLow,
    median_rebound_from_low: summary.medianReboundFromLow,
    T5_avg: summary.t5.avgVsEntry,
    T5_n: summary.t5.n,
    T10_avg: summary.t10.avgVsEntry,
    T10_n: summary.t10.n,
    T20_avg: summary.t20.avgVsEntry,
    T20_n: summary.t20.n,
    T40_avg: summary.t40.avgVsEntry,
    T40_n: summary.t40.n,
    T60_avg: summary.t60.avgVsEntry,
    T60_n: summary.t60.n,
    T60_note:
      summary.t60.n < SMALL_SAMPLE
        ? "T+60 is 60 sessions after the correction and is omitted when it falls outside the original 60-session entry window. It is not filled with the window-end close."
        : null,
    window_end_avg: summary.windowEnd.avgVsEntry,
    window_end_n: summary.windowEnd.n,
    T20_win_rate: summary.t20.winRate,
    T60_win_rate: summary.t60.winRate,
    window_end_win_rate: summary.windowEnd.winRate,
    recovered_to_entry_rate: summary.laterEntryRate,
    avg_days_to_entry_recovery: summary.avgDaysToEntry,
    median_days_to_entry_recovery: summary.medianDaysToEntry,
    recovered_to_peak_rate: summary.priorPeakRecoveryRate,
    avg_days_to_peak_recovery: summary.avgDaysToPeak,
    median_days_to_peak_recovery: summary.medianDaysToPeak,
    reclaim20_rate: summary.reclaim20Rate,
    reclaim20_eligible: summary.reclaim20Eligible,
    additional_5_rate: summary.further5Rate,
    additional_10_rate: summary.further10Rate,
    additional_15_rate: summary.further15Rate,
    additional_20_rate: summary.further20Rate,
    avg_max_drawdown: summary.avgMaxDrawdownFromPeak,
    median_max_drawdown: summary.medianMaxDrawdownFromPeak,
    entry_break_rate: summary.entryBreakRate,
    recovery_after_break_rate: summary.recoveryAfterBreakRate,
    speed_cuts: summary.speedCuts,
    speeds: summary.speeds,
    rebound: summary.rebound,
    classes: summary.classes,
  }
}

export function analyzeSymbolV6(symbol, rows, horizon = FORWARD_DAYS) {
  const built = buildSellEvents(rows, horizon)
  for (const event of built.events) event.etf = symbol
  const closes = rows.map((row) => row.close)
  const profit = {}
  for (const arm of BANDS) {
    for (const dd of DEPTHS) {
      const id = `p${Math.round(arm * 100)}-d${Math.round(dd * 100)}`
      profit[id] = built.events.map((event) => {
        const located = locateProfitCorrection(closes, event.entryIdx, horizon, arm, dd)
        return { ...describeCorrection(closes, located), etf: symbol, id }
      })
    }
  }
  const losses = {}
  const missed = built.events.filter((event) => !event.hit10)
  for (const dd of DEPTHS) {
    const id = `loss${Math.round(dd * 100)}`
    losses[id] = missed.map((event) => {
      const located = locateLossCorrection(closes, event.entryIdx, horizon, dd)
      return { ...describeCorrection(closes, located), etf: symbol, id }
    })
  }
  return {
    symbol,
    episodeCount: built.episodes.length,
    incomplete: built.incomplete,
    events: built.events,
    profit,
    losses,
    missed: missed.length,
  }
}

export function poolV6(parts) {
  const events = parts.flatMap((part) => part.events)
  const tables = []
  const focus = []
  for (const arm of BANDS) {
    for (const dd of DEPTHS) {
      const id = `p${Math.round(arm * 100)}-d${Math.round(dd * 100)}`
      const rows = parts.flatMap((part) => part.profit[id])
      const summary = summarizeRows(rows)
      const row = tableRow(summary, arm, dd)
      row.id = id
      row.etfs = DAILY_BOTTOM_BUY_ETFS.map((meta) => {
        const mine = summarizeRows(rows.filter((item) => item.etf === meta.symbol))
        return {
          etf: meta.symbol,
          events: mine.events,
          sample_small: mine.sampleNote,
          prior_peak_recovery_rate: mine.priorPeakRecoveryRate,
          reclaim20_rate: mine.reclaim20Rate,
          reclaim20_eligible: mine.reclaim20Eligible,
          avg_additional_drawdown: mine.avgAdditionalDrawdown,
          avg_rebound_from_low: mine.avgReboundFromLow,
          T20_avg: mine.t20.avgVsEntry,
          T20_n: mine.t20.n,
        }
      })
      tables.push(row)
      if ((arm === 0.1 || arm === 0.15) && (dd === 0.05 || dd === 0.07 || dd === 0.1)) focus.push(row)
    }
  }
  const missed = DEPTHS.map((dd) => {
    const id = `loss${Math.round(dd * 100)}`
    const rows = parts.flatMap((part) => part.losses[id])
    const summary = summarizeRows(rows)
    return { id, ...tableRow(summary, null, dd) }
  })
  const dates = events.map((event) => event.signalDate).filter(Boolean).sort()
  return {
    events,
    reached10: events.filter((row) => row.hit10).length,
    reached15: events.filter((row) => row.hit15).length,
    reached20: events.filter((row) => row.hit20).length,
    missed: events.filter((row) => !row.hit10).length,
    tables,
    focus,
    missedTables: missed,
    episodeCount: parts.reduce((sum, part) => sum + part.episodeCount, 0),
    incomplete: parts.reduce((sum, part) => sum + part.incomplete, 0),
    firstSignal: dates[0] ?? null,
    lastSignal: dates[dates.length - 1] ?? null,
  }
}

function pad(value, width) {
  const text = value == null || value === "" ? "—" : String(value)
  return text.length >= width ? text : text + " ".repeat(width - text.length)
}

export function formatTable(rows) {
  const header = [
    pad("Band", 6),
    pad("DD", 5),
    pad("N", 4),
    pad("Peak%", 7),
    pad("NewLo", 7),
    pad("AddDD", 7),
    pad("Reb", 7),
    pad("T20", 7),
    pad("n20", 4),
    pad("End", 7),
    pad("R20", 7),
    pad("Small", 6),
  ].join(" ")
  const lines = [header]
  for (const row of rows) {
    lines.push(
      [
        pad(row.entry_band, 6),
        pad(row.correction_threshold, 5),
        pad(row.events, 4),
        pad(row.prior_peak_recovery_rate, 7),
        pad(row.new_low_rate, 7),
        pad(row.avg_additional_drawdown, 7),
        pad(row.avg_rebound_from_low, 7),
        pad(row.T20_avg, 7),
        pad(row.T20_n, 4),
        pad(row.window_end_avg, 7),
        pad(row.reclaim20_rate, 7),
        pad(row.sample_small ? "yes" : "", 6),
      ].join(" "),
    )
  }
  return lines.join("\n")
}
