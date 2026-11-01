/**
 * ETF sell backtest v4 (research only).
 *
 * Same 3/4 episodes, quote close, and 60-session window as v1.
 * Profit-zone pullbacks reuse the v3 peak: max close from the entry day
 * through today, then the first later close that is the stated percent below
 * that peak. A state never steps down. No sell rule is selected.
 */

import { percentile } from "./daily-bottom-buy-validation-core.mjs"
import {
  DAILY_BOTTOM_BUY_ETFS,
  FORWARD_DAYS,
  buildSellEvents,
  median,
} from "./etf-sell-backtest.mjs"
import {
  RECOVERY_WINDOW,
  firstArmedPullback,
  measurePullback,
  summarizePullbacks,
} from "./etf-sell-backtest-v3.mjs"

export {
  DAILY_BOTTOM_BUY_ETFS,
  FORWARD_DAYS,
  RECOVERY_WINDOW,
  buildSellEvents,
  firstArmedPullback,
  measurePullback,
  summarizePullbacks,
}

const EPS = 1e-9
const LOSS_EPS = 1e-12
const LOSS_LEVELS = [0.05, 0.1, 0.15, 0.2]
const ARMS = [0.1, 0.15, 0.2]
const DRAWDOWNS = [0.03, 0.05, 0.07, 0.1]
export const SMALL_SAMPLE = 10

const STATE_RANK = { p10: 1, p15: 2, p20: 3 }

export const STATE_MACHINES = [
  { id: "E1", label: "E1 10/15/20 at -5/-5/-5", p10: 0.05, p15: 0.05, p20: 0.05 },
  { id: "E2", label: "E2 10/15/20 at -7/-5/-5", p10: 0.07, p15: 0.05, p20: 0.05 },
  { id: "E3", label: "E3 10/15/20 at -7/-7/-5", p10: 0.07, p15: 0.07, p20: 0.05 },
  { id: "E4", label: "E4 10/15/20 at -7/-5/-7", p10: 0.07, p15: 0.05, p20: 0.07 },
  { id: "E5", label: "E5 10/15/20 at -5/-7/-7", p10: 0.05, p15: 0.07, p20: 0.07 },
  { id: "E6", label: "E6 10/15/20 at -7/-7/-7", p10: 0.07, p15: 0.07, p20: 0.07 },
  { id: "E7", label: "E7 10/15/20 at -5/-5/-7", p10: 0.05, p15: 0.05, p20: 0.07 },
  { id: "E8", label: "E8 10/15/20 at -5/-7/-10", p10: 0.05, p15: 0.07, p20: 0.1 },
]

export const SAME_DAY_ORDER =
  "update the close-peak through today; raise the profit state if today's close qualifies; then exit only if that state's drawdown is met. A new high has no drawdown, so it cannot exit on the same day."

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

function raiseState(state, close, entry) {
  let next = state
  if (profitReached(close, entry, 0.2)) next = "p20"
  else if (profitReached(close, entry, 0.15) && next !== "p20") next = "p15"
  else if (profitReached(close, entry, 0.1) && next == null) next = "p10"
  if (state != null && STATE_RANK[next] < STATE_RANK[state]) return state
  return next
}

export function thresholdsOf(spec) {
  return { p10: spec.p10, p15: spec.p15, p20: spec.p20 }
}

/**
 * Highest profit state only. Exit is a close below the running peak by the
 * current state's threshold. Unfinished paths are marked at day 60.
 */
export function simulateStateMachine(closes, entryIdx, horizon, thresholds) {
  const entry = closes[entryIdx]
  const end = Math.min(closes.length - 1, entryIdx + horizon)
  let peak = entry
  let state = null
  for (let j = entryIdx + 1; j <= end; j++) {
    if (closes[j] > peak) peak = closes[j]
    state = raiseState(state, closes[j], entry)
    const dd = state == null ? null : thresholds[state]
    if (dd != null && pullbackReached(peak, closes[j], dd)) {
      const price = closes[j]
      let maxAfter = price
      for (let k = j + 1; k <= end; k++) {
        if (closes[k] > maxAfter) maxAfter = closes[k]
      }
      return {
        exited: true,
        completed: true,
        state,
        total: (price - entry) / entry,
        holdDays: j - entryIdx,
        missedUpside: Math.max(0, (maxAfter - price) / entry),
        openWeight: 0,
        peak,
      }
    }
  }
  return {
    exited: false,
    completed: false,
    state,
    total: (closes[end] - entry) / entry,
    holdDays: horizon,
    missedUpside: null,
    openWeight: 1,
    peak,
  }
}

function lossFlags(closes, entryIdx, horizon) {
  const entry = closes[entryIdx]
  const end = Math.min(closes.length - 1, entryIdx + horizon)
  const hit = { loss5: false, loss10: false, loss15: false, loss20: false }
  const keys = ["loss5", "loss10", "loss15", "loss20"]
  for (let j = entryIdx + 1; j <= end; j++) {
    LOSS_LEVELS.forEach((level, index) => {
      if (!hit[keys[index]] && lossReached(closes[j], entry, level)) hit[keys[index]] = true
    })
  }
  return hit
}

function summarizeNumbers(values, asPercent) {
  const avg = mean(values)
  const mid = median(values)
  return {
    avg: asPercent ? pct(avg) : round2(avg),
    median: asPercent ? pct(mid) : round2(mid),
  }
}

export function summarizePathGroup(label, rows, total) {
  const n = rows.length
  const d20 = summarizeNumbers(rows.map((row) => row.d20), true)
  const d40 = summarizeNumbers(rows.map((row) => row.d40), true)
  const d60 = summarizeNumbers(rows.map((row) => row.d60), true)
  const mae = summarizeNumbers(rows.map((row) => row.mae), true)
  return {
    label,
    n,
    rate: total > 0 ? round2((n / total) * 100) : null,
    avgMae: mae.avg,
    medianMae: mae.median,
    avgD20: d20.avg,
    medianD20: d20.median,
    avgD40: d40.avg,
    medianD40: d40.median,
    avgD60: d60.avg,
    medianD60: d60.median,
    loss5Rate: round2(share(rows.map((row) => row.loss5))),
    loss10Rate: round2(share(rows.map((row) => row.loss10))),
    loss15Rate: round2(share(rows.map((row) => row.loss15))),
    loss20Rate: round2(share(rows.map((row) => row.loss20))),
    sampleNote: n < SMALL_SAMPLE ? "표본 부족" : null,
  }
}

export function extendPullback(closes, entryIdx, horizon, arm, dd) {
  const row = measurePullback(closes, entryIdx, horizon, arm, dd)
  if (!row.pullback) return row
  const found = firstArmedPullback(closes, entryIdx, horizon, arm, dd)
  let maxAfter = found.pullbackClose
  let minAfter = found.pullbackClose
  for (let k = found.pullbackIdx + 1; k <= found.end; k++) {
    if (closes[k] > maxAfter) maxAfter = closes[k]
    if (closes[k] < minAfter) minAfter = closes[k]
  }
  return {
    ...row,
    extraUpVsPeak: found.peak > 0 ? (maxAfter - found.peak) / found.peak : null,
    extraDownVsPeak: found.peak > 0 ? (found.peak - minAfter) / found.peak : null,
  }
}

export function summarizeArm(arm, dd, rows) {
  const base = summarizePullbacks(arm, dd, rows)
  const eligible = rows.filter((row) => row.pullback && row.eligible20)
  const recovered = eligible.filter((row) => row.reclaimedWithin20 === true)
  const failed = eligible.filter((row) => row.reclaimedWithin20 === false)
  const pulls = rows.filter((row) => row.pullback)
  const finalD60 = summarizeNumbers(pulls.map((row) => row.d60), true)
  return {
    ...base,
    avgFinalD60: finalD60.avg,
    medianFinalD60: finalD60.median,
    aMedianRecoveryDays: round2(median(recovered.map((row) => row.daysToReclaim))),
    aAvgExtraUpVsPeak: pct(mean(recovered.map((row) => row.extraUpVsPeak))),
    bAvgExtraDownVsPeak: pct(mean(failed.map((row) => row.extraDownVsPeak))),
    sampleNote: base.eligible20 < SMALL_SAMPLE ? "표본 부족" : null,
  }
}

export function summarizeMachine(spec, pairs) {
  const outcomes = pairs.map((pair) => pair.outcome)
  const exits = outcomes.filter((row) => row.exited)
  const opens = outcomes.filter((row) => !row.exited)
  const armedOpens = opens.filter((row) => row.state != null)
  const neverArmed = opens.filter((row) => row.state == null)
  const book = outcomes.map((row) => row.total)
  const exitTotals = exits.map((row) => row.total)
  const openTotals = opens.map((row) => row.total)
  const mix = {}
  for (const state of ["p10", "p15", "p20"]) {
    const count = exits.filter((row) => row.state === state).length
    mix[state] = {
      n: count,
      share: exits.length ? round2((count / exits.length) * 100) : null,
    }
  }
  return {
    id: spec.id,
    label: spec.label,
    p10: Math.round(spec.p10 * 100),
    p15: Math.round(spec.p15 * 100),
    p20: Math.round(spec.p20 * 100),
    events: outcomes.length,
    exits: exits.length,
    exitRate: round2(share(outcomes.map((row) => row.exited))),
    exitAvg: pct(mean(exitTotals)),
    exitMedian: pct(median(exitTotals)),
    exitWinRate: round2(share(exitTotals.map((value) => value > 0))),
    exitAvgDays: round2(mean(exits.map((row) => row.holdDays))),
    exitMedianDays: round2(median(exits.map((row) => row.holdDays))),
    exitAvgMissed: pct(mean(exits.map((row) => row.missedUpside))),
    exitMedianMissed: pct(median(exits.map((row) => row.missedUpside))),
    exitMaxLoss: pct(exitTotals.length ? Math.min(...exitTotals) : null),
    openCount: opens.length,
    openNeverArmed: neverArmed.length,
    openArmed: armedOpens.length,
    openAvg: pct(mean(openTotals)),
    openMedian: pct(median(openTotals)),
    bookAvg: pct(mean(book)),
    bookMedian: pct(median(book)),
    bookWinRate: round2(share(book.map((value) => value > 0))),
    bookMaxLoss: pct(book.length ? Math.min(...book) : null),
    bookAvgDays: round2(mean(outcomes.map((row) => row.holdDays))),
    bookP25: pct(percentile(book, 25)),
    bookP75: pct(percentile(book, 75)),
    exitMix: mix,
  }
}

export function analyzeSymbolV4(symbol, rows, horizon = FORWARD_DAYS) {
  const built = buildSellEvents(rows, horizon)
  for (const event of built.events) event.etf = symbol
  const closes = rows.map((row) => row.close)
  const paths = built.events.map((event) => ({
    ...event,
    ...lossFlags(closes, event.entryIdx, horizon),
  }))
  const arms = {}
  for (const arm of ARMS) {
    for (const dd of DRAWDOWNS) {
      const id = `p${Math.round(arm * 100)}-d${Math.round(dd * 100)}`
      arms[id] = paths.map((event) => ({
        ...extendPullback(closes, event.entryIdx, horizon, arm, dd),
        d60: event.d60,
      }))
    }
  }
  const machines = {}
  for (const spec of STATE_MACHINES) {
    machines[spec.id] = paths.map((event) =>
      simulateStateMachine(closes, event.entryIdx, horizon, thresholdsOf(spec)),
    )
  }
  return {
    symbol,
    episodeCount: built.episodes.length,
    incomplete: built.incomplete,
    events: paths,
    arms,
    machines,
  }
}

function pairsFor(parts, id) {
  return parts.flatMap((part) =>
    part.events.map((event, index) => ({ event, outcome: part.machines[id][index] })),
  )
}

export function poolV4(parts) {
  const events = parts.flatMap((part) => part.events)
  const total = events.length
  const preProfit = {
    reached5: events.filter((row) => row.hit5).length,
    reached10: events.filter((row) => row.hit10).length,
    reached15: events.filter((row) => row.hit15).length,
    reached20: events.filter((row) => row.hit20).length,
    groups: [
      summarizePathGroup("miss10", events.filter((row) => !row.hit10), total),
      summarizePathGroup("hit10", events.filter((row) => row.hit10), total),
      summarizePathGroup("hit15", events.filter((row) => row.hit15), total),
      summarizePathGroup("hit20", events.filter((row) => row.hit20), total),
    ],
  }
  const arms = []
  for (const arm of ARMS) {
    for (const dd of DRAWDOWNS) {
      const id = `p${Math.round(arm * 100)}-d${Math.round(dd * 100)}`
      const rows = parts.flatMap((part) => part.arms[id])
      arms.push(summarizeArm(arm, dd, rows))
    }
  }
  const machines = STATE_MACHINES.map((spec) => summarizeMachine(spec, pairsFor(parts, spec.id)))
  const etfs = DAILY_BOTTOM_BUY_ETFS.map((meta) => {
    const mine = events.filter((row) => row.etf === meta.symbol)
    const part = parts.find((row) => row.symbol === meta.symbol)
    const recovery = {}
    for (const id of ["p10-d5", "p15-d5", "p20-d5"]) {
      const [armText, ddText] = id.slice(1).split("-d")
      recovery[id] = summarizeArm(Number(armText) / 100, Number(ddText) / 100, part?.arms[id] ?? [])
    }
    return {
      etf: meta.symbol,
      events: mine.length,
      sampleNote: mine.length < SMALL_SAMPLE ? "표본 부족" : null,
      hit10Rate: mine.length ? round2((mine.filter((row) => row.hit10).length / mine.length) * 100) : null,
      hit15Rate: mine.length ? round2((mine.filter((row) => row.hit15).length / mine.length) * 100) : null,
      hit20Rate: mine.length ? round2((mine.filter((row) => row.hit20).length / mine.length) * 100) : null,
      hit20Count: mine.filter((row) => row.hit20).length,
      hit20Note: mine.filter((row) => row.hit20).length < SMALL_SAMPLE ? "표본 부족" : null,
      machines: STATE_MACHINES.map((spec) => {
        const summary = summarizeMachine(
          spec,
          mine.map((event, index) => ({ event, outcome: part.machines[spec.id][index] })),
        )
        return {
          id: spec.id,
          bookAvg: summary.bookAvg,
          exitAvg: summary.exitAvg,
          exitRate: summary.exitRate,
          exits: summary.exits,
          openCount: summary.openCount,
          bookMaxLoss: summary.bookMaxLoss,
          exitAvgMissed: summary.exitAvgMissed,
        }
      }),
      recovery,
    }
  })
  const dates = events.map((event) => event.signalDate).filter(Boolean).sort()
  return {
    events,
    preProfit,
    arms,
    machines,
    etfs,
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

export function formatPathTable(rows) {
  const header = [
    pad("Group", 8),
    pad("N", 5),
    pad("Rate", 7),
    pad("MAE", 7),
    pad("D20", 7),
    pad("D40", 7),
    pad("D60", 7),
    pad("-5%", 7),
    pad("-10%", 7),
    pad("-15%", 7),
    pad("-20%", 7),
  ].join(" ")
  const lines = [header]
  for (const row of rows) {
    lines.push(
      [
        pad(row.label, 8),
        pad(row.n, 5),
        pad(row.rate, 7),
        pad(row.avgMae, 7),
        pad(row.avgD20, 7),
        pad(row.avgD40, 7),
        pad(row.avgD60, 7),
        pad(row.loss5Rate, 7),
        pad(row.loss10Rate, 7),
        pad(row.loss15Rate, 7),
        pad(row.loss20Rate, 7),
      ].join(" "),
    )
  }
  return lines.join("\n")
}

export function formatArmTable(rows) {
  const header = [
    pad("Arm", 5),
    pad("DD", 4),
    pad("Reach", 6),
    pad("Pull", 6),
    pad("Elig", 5),
    pad("A%", 7),
    pad("Rec", 6),
    pad("MedR", 6),
    pad("UpPk", 7),
    pad("DnPk", 7),
    pad("UpV3", 7),
    pad("DnV3", 7),
    pad("D60", 7),
  ].join(" ")
  const lines = [header]
  for (const row of rows) {
    lines.push(
      [
        pad(`+${row.arm}`, 5),
        pad(`-${row.dd}`, 4),
        pad(row.reached, 6),
        pad(row.pullbacks, 6),
        pad(row.eligible20, 5),
        pad(row.aRate, 7),
        pad(row.aAvgRecoveryDays, 6),
        pad(row.aMedianRecoveryDays, 6),
        pad(row.aAvgExtraUpVsPeak, 7),
        pad(row.bAvgExtraDownVsPeak, 7),
        pad(row.aAvgExtraUp, 7),
        pad(row.bAvgExtraDown, 7),
        pad(row.avgFinalD60, 7),
      ].join(" "),
    )
  }
  return lines.join("\n")
}

export function formatMachineTable(rows) {
  const header = [
    pad("Rule", 28),
    pad("N", 5),
    pad("Exit", 5),
    pad("Ex%", 7),
    pad("ExAvg", 7),
    pad("ExMed", 7),
    pad("OpAvg", 7),
    pad("Book", 7),
    pad("BkMed", 7),
    pad("Win", 7),
    pad("MaxL", 8),
    pad("Days", 6),
    pad("Miss", 6),
    pad("10", 6),
    pad("15", 6),
    pad("20", 6),
  ].join(" ")
  const lines = [header]
  for (const row of rows) {
    lines.push(
      [
        pad(row.label, 28),
        pad(row.events, 5),
        pad(row.exits, 5),
        pad(row.exitRate, 7),
        pad(row.exitAvg, 7),
        pad(row.exitMedian, 7),
        pad(row.openAvg, 7),
        pad(row.bookAvg, 7),
        pad(row.bookMedian, 7),
        pad(row.bookWinRate, 7),
        pad(row.bookMaxLoss, 8),
        pad(row.exitAvgDays, 6),
        pad(row.exitAvgMissed, 6),
        pad(row.exitMix.p10.share, 6),
        pad(row.exitMix.p15.share, 6),
        pad(row.exitMix.p20.share, 6),
      ].join(" "),
    )
  }
  return lines.join("\n")
}

export function formatEtfTable(rows) {
  const header = [
    pad("ETF", 6),
    pad("N", 4),
    pad("+10", 6),
    pad("+15", 6),
    pad("+20", 6),
    pad("E1", 6),
    pad("E2", 6),
    pad("E3", 6),
    pad("E4", 6),
    pad("E5", 6),
    pad("E6", 6),
    pad("E7", 6),
    pad("E8", 6),
    pad("R10", 6),
    pad("R15", 6),
    pad("R20", 6),
  ].join(" ")
  const lines = [header]
  for (const row of rows) {
    const machine = (id) => row.machines.find((item) => item.id === id)?.bookAvg
    lines.push(
      [
        pad(row.etf, 6),
        pad(row.events, 4),
        pad(row.hit10Rate, 6),
        pad(row.hit15Rate, 6),
        pad(row.hit20Rate, 6),
        pad(machine("E1"), 6),
        pad(machine("E2"), 6),
        pad(machine("E3"), 6),
        pad(machine("E4"), 6),
        pad(machine("E5"), 6),
        pad(machine("E6"), 6),
        pad(machine("E7"), 6),
        pad(machine("E8"), 6),
        pad(row.recovery["p10-d5"].aRate, 6),
        pad(row.recovery["p15-d5"].aRate, 6),
        pad(row.recovery["p20-d5"].aRate, 6),
      ].join(" "),
    )
  }
  return lines.join("\n")
}
