/**
 * Research only. Splits the v1 repeat-confirmation result into
 * the move before entry and the move after entry, and tracks windows
 * that B or C did not take. Does not change v1 or production rules.
 *
 * A return from the first signal close is a comparison base, not a fill.
 * At one shared exit date, the gap between two entry prices is arithmetic.
 * It is not described here as a causal effect.
 */

import { HORIZONS, horizonStats } from "./buy-signal-repeat-confirm-v1.mjs"

export const SELECTED_STRATEGY = null
export const OVERLAP_GAP = 120

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

export function summarizeNumbers(values) {
  const ready = values.filter((value) => Number.isFinite(value))
  return {
    n: ready.length,
    mean: mean(ready),
    median: median(ready),
    winRate: ready.length ? ready.filter((value) => value > 0).length / ready.length : null,
  }
}

export function entryDecomposition(rows, window, entry) {
  if (!entry?.entered) return null
  const signalClose = rows[window.start].close
  if (!(signalClose > 0)) return null
  const preEntry = entry.entryPrice / signalClose - 1
  const horizons = {}
  for (const horizon of HORIZONS) {
    const own = entry.horizons[horizon]
    const exit = entry.fill + horizon
    const fromSignalClose = own?.complete ? rows[exit].close / signalClose - 1 : null
    horizons[horizon] = {
      complete: Boolean(own?.complete),
      fromEntry: own?.complete ? own.return : null,
      mdd: own?.complete ? own.mdd : null,
      fromSignalClose,
      entryMinusSignalBase: own?.complete ? own.return - fromSignalClose : null,
      postMinusPreEntry: own?.complete ? own.return - preEntry : null,
    }
  }
  return {
    signalClose,
    entryPrice: entry.entryPrice,
    preEntry,
    fill: entry.fill,
    horizons,
  }
}

export function markedReturn(rows, entry, exit) {
  if (!entry?.entered || exit < entry.fill || exit >= rows.length || !(entry.entryPrice > 0)) return null
  return rows[exit].close / entry.entryPrice - 1
}

export function pairExitSplit(rows, window) {
  const a = window.strategies.A
  const out = {}
  for (const id of ["B", "C"]) {
    const other = window.strategies[id]
    if (!a?.entered || !other?.entered) {
      out[id] = null
      continue
    }
    const horizons = {}
    for (const horizon of HORIZONS) {
      const exitA = a.fill + horizon
      const exitOther = other.fill + horizon
      const holdA = a.horizons[horizon]?.complete ? a.horizons[horizon].return : null
      const holdOther = other.horizons[horizon]?.complete ? other.horizons[horizon].return : null
      const atA = markedReturn(rows, other, exitA)
      const aAtOther = markedReturn(rows, a, exitOther)
      horizons[horizon] = {
        sameHoldGap: holdA != null && holdOther != null ? holdOther - holdA : null,
        sameExitAsA: atA != null && holdA != null ? atA - holdA : null,
        sameExitAsOther: holdOther != null && aAtOther != null ? holdOther - aAtOther : null,
        laterWindowOnly: holdOther != null && aAtOther != null && holdA != null ? aAtOther - holdA : null,
      }
    }
    out[id] = horizons
  }
  return out
}

export function exclusionSets(windows, id) {
  const reasons = {}
  const excluded = []
  const kept = []
  let strategyWithoutA = 0
  for (const window of windows) {
    const other = window.strategies[id]
    const first = window.strategies.A
    if (other?.entered) {
      if (first?.entered) kept.push(window)
      else strategyWithoutA += 1
      continue
    }
    const reason = other?.reason || "not_entered"
    reasons[reason] = (reasons[reason] || 0) + 1
    if (first?.entered) excluded.push(window)
  }
  return { reasons, excluded, kept, strategyWithoutA }
}

export function counterfactualStats(windows) {
  const entries = windows.map((window) => window.strategies.A)
  return Object.fromEntries(HORIZONS.map((horizon) => [horizon, horizonStats(entries, horizon)]))
}

export function nonOverlappingWindows(windows, gap = OVERLAP_GAP) {
  const bySymbol = new Map()
  for (const window of windows) {
    if (!bySymbol.has(window.symbol)) bySymbol.set(window.symbol, [])
    bySymbol.get(window.symbol).push(window)
  }
  const kept = []
  for (const list of bySymbol.values()) {
    list.sort((left, right) => left.start - right.start)
    let next = -Infinity
    for (const window of list) {
      if (window.start < next) continue
      kept.push(window)
      next = window.start + gap
    }
  }
  return kept
}

export function summarizeDecompositions(rows) {
  const preEntry = summarizeNumbers(rows.map((row) => row.preEntry))
  const horizons = {}
  for (const horizon of HORIZONS) {
    const ready = rows.filter((row) => row.horizons[horizon].complete)
    horizons[horizon] = {
      fromEntry: summarizeNumbers(ready.map((row) => row.horizons[horizon].fromEntry)),
      fromSignalClose: summarizeNumbers(ready.map((row) => row.horizons[horizon].fromSignalClose)),
      entryMinusSignalBase: summarizeNumbers(ready.map((row) => row.horizons[horizon].entryMinusSignalBase)),
      postMinusPreEntry: summarizeNumbers(ready.map((row) => row.horizons[horizon].postMinusPreEntry)),
      mdd: summarizeNumbers(ready.map((row) => row.horizons[horizon].mdd)),
    }
  }
  return { n: rows.length, preEntry, horizons }
}

export function summarizePairSplit(pairs) {
  const horizons = {}
  for (const horizon of HORIZONS) {
    const rows = pairs.map((pair) => pair[horizon]).filter(Boolean)
    horizons[horizon] = {
      n: rows.filter((row) => row.sameHoldGap != null).length,
      sameHoldGap: summarizeNumbers(rows.map((row) => row.sameHoldGap)),
      sameExitAsA: summarizeNumbers(rows.map((row) => row.sameExitAsA)),
      sameExitAsOther: summarizeNumbers(rows.map((row) => row.sameExitAsOther)),
      laterWindowOnly: summarizeNumbers(rows.map((row) => row.laterWindowOnly)),
    }
  }
  return horizons
}

export function differenceOfStats(kept, excluded) {
  const horizons = {}
  for (const horizon of HORIZONS) {
    horizons[horizon] = {
      meanGap: kept[horizon].mean == null || excluded[horizon].mean == null ? null : kept[horizon].mean - excluded[horizon].mean,
      medianGap: kept[horizon].median == null || excluded[horizon].median == null ? null : kept[horizon].median - excluded[horizon].median,
    }
  }
  return horizons
}
