/**
 * Research only. Describes the 10-session path after a v1 3/4 window.
 * The type uses prices after the signal, so it is not a same-day buy rule.
 * Thresholds below were copied from the existing 5% path bars before this run.
 * They are not adjusted to the outcome of this file.
 */

import { conditionFlags } from "./daily-bottom-buy-validation-core.mjs"
import { FROZEN_THRESHOLDS } from "./daily-bottom-split-buy-sim.mjs"
import { HORIZONS, measureFromOpen } from "./buy-signal-repeat-confirm-v1.mjs"

export const SELECTED_STRATEGY = null
export const PATH_RULES = {
  window: 10,
  earlyWindow: 5,
  rebound: 0.05,
  dip: -0.05,
  source: "v38 early-rise and dip bars of 5%, fixed on a 10-session window before the v3 run",
}
export const PREDICT_PRIOR_DAYS = 5
export const PREDICT_PRIOR_DROP = -0.05
export const TRAIN_FRACTION = 0.7

export function thresholdsMatchRequest(th = FROZEN_THRESHOLDS) {
  return th.rsiMax === 36 && th.stochKMax === 15.4 && th.bbPctBMax === 0.01 && th.ma20DevMax === -4.2
}

export function countSignalDays(rows, th = FROZEN_THRESHOLDS) {
  return rows.filter((row) => conditionFlags(row, th).count >= 3).length
}

function finite(value) {
  return Number.isFinite(value)
}

export function pathSnapshot(rows, index, rules = PATH_RULES) {
  const baseBar = rows[index]
  const base = baseBar?.close
  const available = rows.length - index - 1
  if (!(base > 0) || !baseBar) return { complete10: false, available }
  if (available < rules.window) return { complete10: false, available }
  let minLow = Infinity
  let minLowDay = null
  let maxHigh = -Infinity
  let maxCloseEarly = -Infinity
  let minClose = Infinity
  let firstDipDay = null
  let daysToRecover = null
  const closeReturn = {}
  for (let step = 1; step <= rules.window; step += 1) {
    const bar = rows[index + step]
    const ret = bar.close / base - 1
    if (step === 1 || step === 3 || step === 5 || step === 10) closeReturn[step] = ret
    if (finite(bar.low) && bar.low < minLow) {
      minLow = bar.low
      minLowDay = step
    }
    if (finite(bar.high) && bar.high > maxHigh) maxHigh = bar.high
    if (bar.close < minClose) minClose = bar.close
    if (step <= rules.earlyWindow && ret > maxCloseEarly) maxCloseEarly = ret
    if (firstDipDay == null && step <= rules.earlyWindow && ret <= rules.dip) firstDipDay = step
    if (daysToRecover == null && bar.close >= base) daysToRecover = step
  }
  let recoveredAfterDip = false
  if (firstDipDay != null) {
    for (let step = firstDipDay + 1; step <= rules.window; step += 1) {
      if (rows[index + step].close >= base) {
        recoveredAfterDip = true
        break
      }
    }
  }
  const lowThrough = (days) => {
    let value = Infinity
    for (let step = 1; step <= days; step += 1) {
      if (finite(rows[index + step].low)) value = Math.min(value, rows[index + step].low)
    }
    return value
  }
  const signalLow = baseBar.low
  const newLow5 = finite(signalLow) ? lowThrough(rules.earlyWindow) < signalLow : null
  const newLow10 = finite(signalLow) ? minLow < signalLow : null
  return {
    complete10: true,
    available,
    closeReturn,
    maxAdverseLow: minLow / base - 1,
    maxFavorableHigh: maxHigh / base - 1,
    daysToLow: minLowDay,
    daysToRecover,
    minClose10: minClose / base - 1,
    maxCloseEarly,
    firstDipDay,
    recoveredAfterDip,
    newLow5,
    newLow10,
    volumeChange: volumeRatio(rows, index, rules.earlyWindow),
  }
}

function meanOf(values) {
  const ready = values.filter((value) => finite(value) && value > 0)
  if (!ready.length) return null
  return ready.reduce((sum, value) => sum + value, 0) / ready.length
}

function volumeRatio(rows, index, days) {
  const before = []
  const after = []
  for (let step = 1; step <= days; step += 1) {
    if (index - step >= 0) before.push(rows[index - step].volume)
    after.push(rows[index + step].volume)
  }
  const left = meanOf(before)
  const right = meanOf(after)
  if (left == null || right == null) return null
  return right / left - 1
}

export function classifyPath(snapshot, rules = PATH_RULES) {
  if (!snapshot?.complete10) return "INCOMPLETE"
  if (snapshot.maxCloseEarly >= rules.rebound && snapshot.minClose10 > rules.dip) return "C"
  if (snapshot.firstDipDay != null && snapshot.recoveredAfterDip) return "A"
  if (snapshot.newLow10 === true && snapshot.daysToRecover == null) return "B"
  return "D"
}

export function priorFeatures(rows, index) {
  const close = rows[index].close
  const priorReturn = {}
  for (const days of [1, 3, 5, 10]) {
    const previous = index - days
    priorReturn[days] = previous >= 0 && rows[previous].close > 0 ? close / rows[previous].close - 1 : null
  }
  const newLow = (days) => {
    if (index < days || !finite(rows[index].low)) return null
    let floor = Infinity
    for (let cursor = index - days; cursor < index; cursor += 1) {
      if (finite(rows[cursor].low)) floor = Math.min(floor, rows[cursor].low)
    }
    if (!finite(floor)) return null
    return rows[index].low < floor
  }
  let volumeChange = null
  if (index >= PREDICT_PRIOR_DAYS) {
    const history = []
    for (let cursor = index - PREDICT_PRIOR_DAYS; cursor < index; cursor += 1) history.push(rows[cursor].volume)
    const base = meanOf(history)
    if (base != null && finite(rows[index].volume) && rows[index].volume > 0) volumeChange = rows[index].volume / base - 1
  }
  return {
    priorReturn,
    priorNewLow5: newLow(5),
    priorNewLow10: newLow(10),
    volumeChange,
    rsi14: finite(rows[index].rsi14) ? rows[index].rsi14 : null,
    ma20DevPct: finite(rows[index].ma20DevPct) ? rows[index].ma20DevPct : null,
  }
}

export function predictContinuedDecline(features) {
  const prior = features?.priorReturn?.[PREDICT_PRIOR_DAYS]
  return prior != null && prior <= PREDICT_PRIOR_DROP && features.priorNewLow5 === true
}

export function signalCloseOutcome(rows, index) {
  const base = rows[index].close
  const horizons = {}
  for (const horizon of HORIZONS) {
    const exit = index + horizon
    if (exit >= rows.length || !(base > 0)) {
      horizons[horizon] = { complete: false, return: null, mdd: null }
      continue
    }
    let mdd = 0
    for (let cursor = index; cursor <= exit; cursor += 1) {
      const change = rows[cursor].close / base - 1
      if (change < mdd) mdd = change
    }
    horizons[horizon] = { complete: true, return: rows[exit].close / base - 1, mdd }
  }
  return horizons
}

export function nextOpenOutcome(rows, index) {
  const fill = index + 1
  if (fill >= rows.length || !(rows[fill].open > 0)) return null
  return measureFromOpen(rows, fill, rows[fill].open)
}

export function residualAfterClassWindow(rows, index, rules = PATH_RULES) {
  const anchor = index + rules.window
  const base = rows[anchor]?.close
  const horizons = {}
  for (const horizon of HORIZONS) {
    const exit = index + horizon
    if (exit >= rows.length || anchor >= rows.length || !(base > 0) || exit <= anchor) {
      horizons[horizon] = null
      continue
    }
    horizons[horizon] = rows[exit].close / base - 1
  }
  return horizons
}

function mean(values) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

export function summarizeValues(values) {
  const ready = values.filter((value) => finite(value))
  return {
    n: ready.length,
    mean: mean(ready),
    median: median(ready),
    winRate: ready.length ? ready.filter((value) => value > 0).length / ready.length : null,
  }
}

export function outcomeSummary(entries, field) {
  const horizons = {}
  for (const horizon of HORIZONS) {
    const ready = entries.filter((entry) => entry[field]?.[horizon]?.complete)
    horizons[horizon] = {
      ...summarizeValues(ready.map((entry) => entry[field][horizon].return)),
      mddMean: mean(ready.map((entry) => entry[field][horizon].mdd)),
      mddMedian: median(ready.map((entry) => entry[field][horizon].mdd)),
      incomplete: entries.length - ready.length,
    }
  }
  return horizons
}

export function chronologicalSplit(events, fraction = TRAIN_FRACTION) {
  const sorted = [...events].sort((left, right) => left.date.localeCompare(right.date) || left.symbol.localeCompare(right.symbol))
  const cut = Math.floor(sorted.length * fraction)
  return {
    train: sorted.slice(0, cut),
    test: sorted.slice(cut),
    cutDate: sorted[cut]?.date ?? null,
  }
}

export function predictionScore(events) {
  const flagged = events.filter((event) => event.predictDecline)
  const hits = flagged.filter((event) => event.pathType === "B")
  const actual = events.filter((event) => event.pathType === "B")
  return {
    n: events.length,
    predicted: flagged.length,
    actualB: actual.length,
    precision: flagged.length ? hits.length / flagged.length : null,
    recall: actual.length ? hits.length / actual.length : null,
    baseRate: events.length ? actual.length / events.length : null,
  }
}
