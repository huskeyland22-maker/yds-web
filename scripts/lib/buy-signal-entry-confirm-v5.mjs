/**
 * Research only. After a v1 3/4 window, compare the next-open entry
 * with a five-session low hold and an SMA20 reclaim.
 * The low hold is known only after all five sessions. Nothing here
 * changes production rules or earlier result files.
 */

import { FEE_ROUND_TRIP, HORIZONS, measureFromOpen } from "./buy-signal-repeat-confirm-v1.mjs"
import { summarizeValues } from "./buy-signal-price-path-v3.mjs"

export const SELECTED_STRATEGY = null
export const CONFIRM_DAYS = 5
export const BOOTSTRAP_REPS = 1000
export const BOOTSTRAP_SEED = 52
export const MIN_PAIRED = 30

function finite(value) {
  return Number.isFinite(value)
}

function finishEntry(rows, confirm, start) {
  const fill = confirm + 1
  if (fill >= rows.length) return { status: "incomplete", reason: "no_next_bar", confirm }
  const entryPrice = rows[fill].open
  if (!finite(entryPrice) || !(entryPrice > 0)) return { status: "incomplete", reason: "open_missing", confirm, fill }
  return {
    status: "entered",
    reason: "entered",
    confirm,
    fill,
    entryPrice,
    waitDays: fill - start,
    horizons: measureFromOpen(rows, fill, entryPrice),
  }
}

export function planFirst(rows, start) {
  return finishEntry(rows, start, start)
}

export function planLowHold(rows, start, days = CONFIRM_DAYS) {
  const reference = rows[start]?.low
  if (!finite(reference)) return { status: "incomplete", reason: "low_missing" }
  for (let step = 1; step <= days; step += 1) {
    const index = start + step
    if (index >= rows.length) return { status: "incomplete", reason: "window_short" }
    const low = rows[index].low
    if (!finite(low)) return { status: "incomplete", reason: "low_missing" }
    if (low < reference) return { status: "failed", reason: "broke_low", confirm: index }
  }
  return finishEntry(rows, start + days, start)
}

export function planSmaRecovery(rows, start, days = CONFIRM_DAYS) {
  for (let step = 1; step <= days; step += 1) {
    const index = start + step
    if (index >= rows.length) return { status: "incomplete", reason: "window_short" }
    const average = rows[index].ma20
    if (finite(average) && average > 0 && rows[index].close > average) return finishEntry(rows, index, start)
  }
  return { status: "no_entry", reason: "no_recovery" }
}

export function planBoth(rows, start, days = CONFIRM_DAYS) {
  const reference = rows[start]?.low
  if (!finite(reference)) return { status: "incomplete", reason: "low_missing" }
  let recovered = false
  for (let step = 1; step <= days; step += 1) {
    const index = start + step
    if (index >= rows.length) return { status: "incomplete", reason: "window_short" }
    const low = rows[index].low
    if (!finite(low)) return { status: "incomplete", reason: "low_missing" }
    if (low < reference) return { status: "failed", reason: "broke_low", confirm: index }
    const average = rows[index].ma20
    if (!recovered && finite(average) && average > 0 && rows[index].close > average) recovered = true
  }
  if (!recovered) return { status: "no_entry", reason: "no_recovery" }
  return finishEntry(rows, start + days, start)
}

export function entryPlans(rows, start) {
  return {
    A: planFirst(rows, start),
    B: planLowHold(rows, start),
    C: planSmaRecovery(rows, start),
    D: planBoth(rows, start),
  }
}

function marked(rows, plan, exit) {
  if (plan?.status !== "entered" || exit < plan.fill || exit >= rows.length || !(plan.entryPrice > 0)) return null
  return rows[exit].close / plan.entryPrice - 1
}

export function pairView(rows, plans) {
  const first = plans.A
  const out = {}
  for (const id of ["B", "C", "D"]) {
    const other = plans[id]
    if (first.status !== "entered" || other.status !== "entered") {
      out[id] = null
      continue
    }
    const horizons = {}
    for (const horizon of HORIZONS) {
      const holdA = first.horizons[horizon].complete ? first.horizons[horizon].return : null
      const holdOther = other.horizons[horizon].complete ? other.horizons[horizon].return : null
      const otherAtA = marked(rows, other, first.fill + horizon)
      const firstAtOther = marked(rows, first, other.fill + horizon)
      horizons[horizon] = {
        sameHoldGap: holdA != null && holdOther != null ? holdOther - holdA : null,
        sameExitAsA: otherAtA != null && holdA != null ? otherAtA - holdA : null,
        sameExitAsOther: holdOther != null && firstAtOther != null ? holdOther - firstAtOther : null,
      }
    }
    out[id] = {
      horizons,
      entryGap: other.entryPrice / first.entryPrice - 1,
      waitGap: other.waitDays - first.waitDays,
    }
  }
  return out
}

function median(values) {
  return summarizeValues(values).median
}

function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function clusterMedianInterval(rows, reps = BOOTSTRAP_REPS, seed = BOOTSTRAP_SEED) {
  const ready = rows.filter((row) => finite(row.gap))
  const point = median(ready.map((row) => row.gap))
  const bySymbol = new Map()
  for (const row of ready) {
    if (!bySymbol.has(row.symbol)) bySymbol.set(row.symbol, [])
    bySymbol.get(row.symbol).push(row.gap)
  }
  const symbols = [...bySymbol.keys()]
  if (symbols.length < 2 || !ready.length) {
    return { n: ready.length, tickers: symbols.length, median: point, p025: null, p975: null }
  }
  const rng = mulberry32(seed)
  const samples = []
  for (let rep = 0; rep < reps; rep += 1) {
    const pooled = []
    for (let pick = 0; pick < symbols.length; pick += 1) {
      pooled.push(...bySymbol.get(symbols[Math.floor(rng() * symbols.length)]))
    }
    samples.push(median(pooled))
  }
  samples.sort((left, right) => left - right)
  return {
    n: ready.length,
    tickers: symbols.length,
    median: point,
    p025: samples[Math.floor(0.025 * (reps - 1))],
    p975: samples[Math.floor(0.975 * (reps - 1))],
  }
}

function horizonBlock(plans, horizon) {
  const ready = plans.filter((plan) => plan.horizons?.[horizon]?.complete)
  const returns = ready.map((plan) => plan.horizons[horizon].return)
  const drawdowns = ready.map((plan) => plan.horizons[horizon].mdd)
  const net = summarizeValues(returns.map((value) => value - FEE_ROUND_TRIP))
  return {
    ...summarizeValues(returns),
    mddMean: summarizeValues(drawdowns).mean,
    mddMedian: summarizeValues(drawdowns).median,
    incomplete: plans.length - ready.length,
    netMedian: net.median,
    netWinRate: net.winRate,
  }
}

export function strategySummary(plans) {
  const entered = plans.filter((plan) => plan.status === "entered")
  const reasons = {}
  for (const plan of plans) reasons[plan.reason || plan.status] = (reasons[plan.reason || plan.status] || 0) + 1
  const horizons = {}
  for (const horizon of HORIZONS) horizons[horizon] = horizonBlock(entered, horizon)
  return {
    windows: plans.length,
    entered: entered.length,
    notEntered: plans.length - entered.length,
    reasons,
    wait: summarizeValues(entered.map((plan) => plan.waitDays)),
    horizons,
  }
}

export function passesOperatingBar(block) {
  const paired = block?.paired?.[60]
  const excluded = block?.excluded?.[60]
  const pairedA = block?.pairedA?.[60]
  const interval = block?.bootstrap?.sameExitAsA
  if (!paired || paired.sameExitAsA.n < MIN_PAIRED) return false
  if (!(paired.sameExitAsA.median > 0)) return false
  if (excluded?.median == null || pairedA?.median == null) return false
  if (!(excluded.median <= pairedA.median)) return false
  if (!(interval?.p025 > 0)) return false
  return true
}
