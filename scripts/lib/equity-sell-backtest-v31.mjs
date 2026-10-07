/**
 * US single-stock T+5 sell then re-entry study v31 (research only).
 *
 * Policy C stays fixed: hold RECOVERING and sell every other state. The six
 * re-entry scenarios are fixed before the sample is scored. They are not
 * combined, and the study does not pick the scenario with the highest mean.
 * Loss limits remain evaluation cuts. They are not policy inputs. v1–v30
 * files are not modified. selectedStrategy stays null.
 *
 * The judgment is anchored to the Policy C portfolio at the window horizon,
 * against buy-and-hold of the same events. A scenario clears only when its
 * mean incremental return is positive, the 10,000-trial 95% interval sits
 * above 0, at least two chronological test splits with n>=10 have a positive
 * mean incremental, the -10% and -20% tail rates are not higher than
 * buy-and-hold, and leaving out one ticker does not flip the sign of the
 * incremental return or of either tail reduction.
 *
 * Strong support needs look-ahead violations of 0 and at least four of the
 * six scenarios clearing. Evidence against needs four scenarios whose mean
 * incremental is negative, whose interval sits below 0, and whose test
 * splits are negative on at least two of three. Partial support, when those
 * two fail, needs two scenarios with a positive full-sample mean and two
 * positive test splits. Otherwise the re-entry comparison is not supported.
 * No scenario is named as the re-entry rule.
 */

import { mean, median } from "./equity-sell-backtest-v2.mjs"
import { chronologicalSplit, SPLIT_FRACTIONS } from "./equity-sell-backtest-v18.mjs"
import { SELECTED_STRATEGY as V23_SELECTED_STRATEGY } from "./equity-sell-backtest-v23.mjs"
import { SELECTED_STRATEGY as V27_SELECTED_STRATEGY } from "./equity-sell-backtest-v27.mjs"
import { SELECTED_STRATEGY as V28_SELECTED_STRATEGY, bootstrapMean } from "./equity-sell-backtest-v28.mjs"
import { SELECTED_STRATEGY as V29_SELECTED_STRATEGY } from "./equity-sell-backtest-v29.mjs"
import {
  SELECTED_STRATEGY as V30_SELECTED_STRATEGY,
  assertBaseline,
  assertEventList,
  assertV18Split,
  attachEarly,
  attachForward,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  auditDecisionLookAhead,
  dateIndex,
  loadOhlcv,
  policyAction,
  selectMildEvents,
} from "./equity-sell-backtest-v30.mjs"

export {
  SPLIT_FRACTIONS,
  assertBaseline,
  assertEventList,
  assertV18Split,
  attachEarly,
  attachForward,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  auditDecisionLookAhead,
  chronologicalSplit,
  dateIndex,
  loadOhlcv,
  policyAction,
  selectMildEvents,
}

export const SELECTED_STRATEGY = null
export const BOOTSTRAP = 10000
export const METHODS = ["t10", "t20", "t40", "entry", "low5", "low10"]
const HORIZONS = ["t10", "t20", "t40", "window"]
const RECOVERY = ["entry", "low5", "low10"]
const LIMITS = [0.05, 0.1, 0.15, 0.2]
const COSTS = [0, 0.001, 0.0025, 0.005]
const TOLERANCE = 1e-10
const SEED = 20261030

function finite(value) {
  return Number.isFinite(value)
}

function round2(value) {
  return finite(value) ? Math.round(value * 100) / 100 : null
}

function round4(value) {
  return finite(value) ? Math.round(value * 10000) / 10000 : null
}

function pct(value) {
  return finite(value) ? round2(value * 100) : null
}

function conclusion(n) {
  if (n < 10) return "결론 금지"
  if (n < 20) return "수치만"
  return "제한적"
}

function share(flags) {
  if (!flags.length) return null
  return round2((flags.filter(Boolean).length / flags.length) * 100)
}

function quantile(values, p) {
  const xs = values.filter(finite).sort((a, b) => a - b)
  if (!xs.length) return null
  const index = (xs.length - 1) * p
  const lo = Math.floor(index)
  const hi = Math.ceil(index)
  if (lo === hi) return xs[lo]
  return xs[lo] * (hi - index) + xs[hi] * (index - lo)
}

function isTail(value, level) {
  return finite(value) && value <= -level + 1e-12
}

export function portfolioAction(event) {
  return policyAction("C", event)
}

export function locateReentry(series, t0Idx, windowIdx, method) {
  const t5Idx = t0Idx + 5
  const last = series.closes.length - 1
  if (method === "t10" || method === "t20" || method === "t40") {
    const offset = method === "t10" ? 10 : method === "t20" ? 20 : 40
    const idx = t0Idx + offset
    if (idx > last || !(series.closes[idx] > 0)) return { reentryIdx: null, failed: false, missingBar: true }
    return { reentryIdx: idx, failed: false, missingBar: false }
  }
  const end = Math.min(windowIdx, last)
  const t5Close = series.closes[t5Idx]
  if (!(t5Close > 0) || !(end >= t5Idx + 1)) return { reentryIdx: null, failed: true, missingBar: false }
  if (method === "entry") {
    for (let k = t5Idx + 1; k <= end; k += 1) {
      if (series.closes[k] >= t5Close - 1e-12) return { reentryIdx: k, failed: false, missingBar: false }
    }
    return { reentryIdx: null, failed: true, missingBar: false }
  }
  const bump = method === "low5" ? 1.05 : 1.1
  let runLow = Infinity
  for (let k = t5Idx + 1; k <= end; k += 1) {
    const low = series.lows[k]
    if (low > 0 && low < runLow) runLow = low
    if (runLow < Infinity && series.closes[k] >= runLow * bump - 1e-12) {
      return { reentryIdx: k, failed: false, missingBar: false }
    }
  }
  return { reentryIdx: null, failed: true, missingBar: false }
}

export function markHorizon(spec) {
  const cost = spec.cost ?? 0
  const priceOk = spec.t5Close > 0 && finite(spec.horizonIdx) && spec.horizonClose > 0 && spec.horizonIdx >= spec.t5Idx
  const bh = priceOk ? spec.horizonClose / spec.t5Close - 1 : null
  const empty = { status: "unavailable", cash: false, bh, strategy: null, incremental: null, avoided: null, missed: null }
  if (!priceOk || (spec.action !== "hold" && spec.action !== "sell")) return empty
  if (spec.action === "hold") return packed("hold", false, bh, bh)
  const inTime = finite(spec.reentryIdx) && spec.reentryIdx <= spec.horizonIdx && spec.reentryClose > 0
  if (inTime) {
    const ratio = spec.horizonClose / spec.reentryClose
    const strategy = cost === 0 ? ratio - 1 : (1 - cost) * (1 - cost) * ratio - 1
    return packed("reentered", false, bh, strategy)
  }
  if (spec.failed && spec.horizon === "window") {
    const strategy = cost === 0 ? 0 : (1 - cost) - 1
    return packed("cash", true, bh, strategy)
  }
  return empty
}

function packed(status, cash, bh, strategy) {
  const incremental = strategy - bh
  return {
    status,
    cash,
    bh,
    strategy,
    incremental,
    avoided: Math.max(0, strategy - bh),
    missed: Math.max(0, bh - strategy),
  }
}

function dist(values) {
  const xs = values.filter(finite)
  const n = xs.length
  const rate = (level) => (n ? xs.filter((value) => isTail(value, level)).length / n : null)
  return {
    n,
    mean: pct(n ? mean(xs) : null),
    rawMean: n ? mean(xs) : null,
    median: pct(n ? median(xs) : null),
    win: share(xs.map((value) => value > 0)),
    p5: pct(n ? quantile(xs, 0.05) : null),
    p25: pct(n ? quantile(xs, 0.25) : null),
    p75: pct(n ? quantile(xs, 0.75) : null),
    p95: pct(n ? quantile(xs, 0.95) : null),
    worst: n ? pct(Math.min(...xs)) : null,
    tail5: pct(rate(0.05)),
    tail10: pct(rate(0.1)),
    tail15: pct(rate(0.15)),
    tail20: pct(rate(0.2)),
    rawTail10: rate(0.1),
    rawTail20: rate(0.2),
  }
}

function block(rows) {
  const ready = rows.filter((row) => finite(row.strategy) && finite(row.bh) && finite(row.incremental))
  const cashRows = ready.filter((row) => row.status === "cash")
  return {
    n: ready.length,
    conclusion: conclusion(ready.length),
    unavailable: rows.filter((row) => row.status === "unavailable").length,
    cash: rows.filter((row) => row.status === "cash").length,
    reentered: rows.filter((row) => row.status === "reentered").length,
    held: rows.filter((row) => row.status === "hold").length,
    strategy: dist(ready.map((row) => row.strategy)),
    buyHold: dist(ready.map((row) => row.bh)),
    incremental: dist(ready.map((row) => row.incremental)),
    avoidedMean: pct(ready.length ? mean(ready.map((row) => row.avoided)) : null),
    missedMean: pct(ready.length ? mean(ready.map((row) => row.missed)) : null),
    rawIncremental: ready.length ? mean(ready.map((row) => row.incremental)) : null,
    cashMissedMean: pct(cashRows.length ? mean(cashRows.map((row) => row.missed)) : null),
    cashConclusion: conclusion(cashRows.length),
  }
}

function quotesForEvent(event, series, cost, action) {
  const t0Idx = dateIndex(series.dates, event.t0Date)
  const t5Idx = t0Idx + 5
  const windowIdx = event.hold?.windowIdx
  if (t0Idx < 0 || !finite(windowIdx) || !(series.closes[t5Idx] > 0)) throw new Error(`re-entry path missing ${event.eventId}`)
  const horizonIdx = { t10: t0Idx + 10, t20: t0Idx + 20, t40: t0Idx + 40, window: windowIdx }
  const rows = []
  for (const method of METHODS) {
    const located = locateReentry(series, t0Idx, windowIdx, method)
    const reentryClose = located.reentryIdx == null ? null : series.closes[located.reentryIdx]
    for (const horizon of HORIZONS) {
      const idx = horizonIdx[horizon]
      const horizonClose = finite(idx) && idx >= 0 && idx < series.closes.length ? series.closes[idx] : null
      const marked = markHorizon({
        action,
        horizon,
        t5Idx,
        t5Close: series.closes[t5Idx],
        horizonIdx: idx,
        horizonClose,
        reentryIdx: located.reentryIdx,
        reentryClose,
        failed: located.failed,
        cost,
      })
      rows.push({
        eventId: event.eventId,
        ticker: event.ticker,
        state: event.early.stateT5,
        atrBand: event.atrBand,
        leadershipGroup: event.leadershipGroup,
        method,
        horizon,
        failed: located.failed,
        reentryIdx: located.reentryIdx,
        forward: event.forward?.[horizon] ?? null,
        ...marked,
      })
    }
  }
  return rows
}

function flatQuotes(events, seriesBySymbol, cost, actionOf) {
  const rows = []
  for (const event of events) {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`re-entry series missing ${event.eventId}`)
    rows.push(...quotesForEvent(event, series, cost, actionOf(event)))
  }
  return rows
}

function ready(rows, method, horizon) {
  return rows.filter((row) => row.method === method && row.horizon === horizon)
}

export function assertReentryIdentities(rows) {
  let checked = 0
  let maxAbsError = 0
  const methods = new Set()
  for (const row of rows) {
    methods.add(row.method)
    if (row.method === "best" || row.horizon === "best") throw new Error("re-entry scenarios were combined")
    if (finite(row.bh) && finite(row.forward)) {
      maxAbsError = Math.max(maxAbsError, Math.abs(row.bh - row.forward))
      checked += 1
    }
    if (row.status === "unavailable") {
      if (row.strategy != null || row.cash) throw new Error(`unavailable re-entry was filled ${row.eventId}`)
      continue
    }
    if (!finite(row.strategy) || !finite(row.bh)) throw new Error(`priced re-entry missing ${row.eventId}`)
    maxAbsError = Math.max(maxAbsError, Math.abs(row.incremental - (row.strategy - row.bh)))
    maxAbsError = Math.max(maxAbsError, Math.abs(row.incremental - (row.avoided - row.missed)))
    checked += 2
    if (row.status === "hold" && row.strategy !== row.bh) throw new Error(`hold drifted ${row.eventId}`)
    if (row.status === "cash") {
      if (!row.cash || row.horizon !== "window" || row.strategy !== 0) throw new Error(`cash state drifted ${row.eventId}`)
    } else if (row.cash) throw new Error(`cash flag drifted ${row.eventId}`)
    if (row.status === "reentered" && finite(row.reentryIdx)) checked += 1
  }
  if (methods.size !== METHODS.length) throw new Error("a re-entry scenario is missing")
  return { ok: maxAbsError <= TOLERANCE, checked, maxAbsError }
}

function failureOf(events, seriesBySymbol) {
  const sells = events.filter((event) => portfolioAction(event) === "sell")
  let eligible = 0
  const failed = { entry: 0, low5: 0, low10: 0 }
  const beyond = { t10: 0, t20: 0, t40: 0 }
  for (const event of sells) {
    const series = seriesBySymbol.get(event.ticker)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    const windowIdx = event.hold.windowIdx
    if (!finite(windowIdx) || windowIdx < t0Idx + 5) continue
    eligible += 1
    for (const method of RECOVERY) {
      if (locateReentry(series, t0Idx, windowIdx, method).failed) failed[method] += 1
    }
    for (const method of ["t10", "t20", "t40"]) {
      const located = locateReentry(series, t0Idx, windowIdx, method)
      if (finite(located.reentryIdx) && located.reentryIdx > windowIdx) beyond[method] += 1
    }
  }
  const rate = (count) => ({
    failed: count,
    eligible,
    rate: eligible ? round2((count / eligible) * 100) : null,
    conclusion: conclusion(eligible),
  })
  return {
    entry: rate(failed.entry),
    low5: rate(failed.low5),
    low10: rate(failed.low10),
    fixedBeyondWindow: beyond,
    eligible,
  }
}

function grid(rows) {
  const out = {}
  for (const method of METHODS) {
    out[method] = {}
    for (const horizon of HORIZONS) out[method][horizon] = block(ready(rows, method, horizon))
  }
  return out
}

function leaveOne(rows, method, pick) {
  const base = ready(rows, method, "window").filter((row) => finite(row.incremental))
  const baseline = pick(base)
  const tickers = [...new Set(base.map((row) => row.ticker))]
  const values = []
  for (const ticker of tickers) {
    const value = pick(base.filter((row) => row.ticker !== ticker))
    if (finite(value)) values.push({ ticker, value })
  }
  const flips = values.filter((row) => finite(baseline) && baseline !== 0 && row.value !== 0 && Math.sign(row.value) !== Math.sign(baseline))
  const show = (value) => (finite(value) ? round4(value * 100) : null)
  return {
    baseline: show(baseline),
    min: values.length ? show(Math.min(...values.map((row) => row.value))) : null,
    max: values.length ? show(Math.max(...values.map((row) => row.value))) : null,
    signFlips: flips.length,
    withinStock: "결론 금지",
  }
}

function meanInc(rows) {
  return rows.length ? mean(rows.map((row) => row.incremental)) : null
}

function tailReduction(rows, level) {
  if (!rows.length) return null
  const hold = rows.filter((row) => isTail(row.bh, level)).length / rows.length
  const strategy = rows.filter((row) => isTail(row.strategy, level)).length / rows.length
  return hold - strategy
}

function oosDetail(events, seriesBySymbol, rowsOf) {
  const out = {}
  for (const [name, fraction] of SPLIT_FRACTIONS) {
    const split = chronologicalSplit(events, fraction)
    const testRows = rowsOf(split.test)
    out[name] = { test: split.test.length, horizons: {} }
    for (const horizon of ["window", "t20"]) {
      out[name].horizons[horizon] = {}
      for (const method of METHODS) {
        const sample = ready(testRows, method, horizon).filter((row) => finite(row.incremental))
        const view = block(sample)
        out[name].horizons[horizon][method] = {
          n: view.n,
          conclusion: view.conclusion,
          mean: view.strategy.mean,
          median: view.strategy.median,
          win: view.strategy.win,
          tail10: view.strategy.tail10,
          tail20: view.strategy.tail20,
          buyHoldMean: view.buyHold.mean,
          buyHoldTail10: view.buyHold.tail10,
          incremental: view.incremental.mean,
          rawIncremental: view.rawIncremental,
        }
      }
    }
  }
  return out
}

function oosCount(detail, method, sign) {
  let count = 0
  for (const name of Object.keys(detail)) {
    const row = detail[name].horizons.window[method]
    if (row.n >= 10 && finite(row.rawIncremental) && Math.sign(row.rawIncremental) === sign) count += 1
  }
  return count
}

export function judgeReentry(input) {
  if (input.lookAheadViolations !== 0) throw new Error("look-ahead violation blocks the re-entry judgment")
  const clear = (card) => card.n >= 20
    && card.incremental > 0
    && card.ciLow > 0
    && card.oosPositive >= 2
    && card.tail10Strategy <= card.tail10Hold
    && card.tail20Strategy <= card.tail20Hold
    && card.looFlip === false
  const against = (card) => card.n >= 20
    && card.incremental < 0
    && card.ciHigh < 0
    && card.oosNegative >= 2
  const partial = (card) => card.n >= 10 && card.incremental > 0 && card.oosPositive >= 2
  const cleared = input.cards.filter(clear).length
  const opposed = input.cards.filter(against).length
  const partials = input.cards.filter(partial).length
  let label = "지지 부족"
  if (cleared >= 4) label = "강한 지지"
  else if (opposed >= 4) label = "반대 증거"
  else if (partials >= 2) label = "부분 지지"
  return { label, cleared, opposed, partials, anchoredBook: "policy C portfolio", anchoredHorizon: "window" }
}

export function auditReentryLookAhead(events, seriesBySymbol) {
  let checked = 0
  for (const event of events) {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`re-entry look-ahead series missing ${event.eventId}`)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    const windowIdx = event.hold?.windowIdx
    if (t0Idx < 0 || !finite(windowIdx)) throw new Error(`re-entry look-ahead path missing ${event.eventId}`)
    const base = {}
    for (const method of METHODS) base[method] = locateReentry(series, t0Idx, windowIdx, method).reentryIdx
    const poisoned = { dates: series.dates, closes: series.closes.slice(), lows: series.lows.slice() }
    const spike = windowIdx + 1
    const t5Close = series.closes[t0Idx + 5]
    if (spike < poisoned.closes.length) {
      poisoned.closes[spike] = t5Close * 5
      poisoned.lows[spike] = t5Close * 0.01
    } else {
      poisoned.closes.push(t5Close * 5)
      poisoned.lows.push(t5Close * 0.01)
    }
    for (const method of METHODS) {
      const again = locateReentry(poisoned, t0Idx, windowIdx, method).reentryIdx
      if (again !== base[method]) throw new Error(`post-window bar changed re-entry ${event.eventId} ${method}`)
    }
    for (const method of METHODS) {
      const hit = base[method]
      if (!finite(hit) || hit >= windowIdx || hit + 1 >= series.closes.length) continue
      const later = { dates: series.dates, closes: series.closes.slice(), lows: series.lows.slice() }
      later.closes[hit + 1] = t5Close * 5
      later.lows[hit + 1] = t5Close * 0.01
      if (locateReentry(later, t0Idx, windowIdx, method).reentryIdx !== hit) {
        throw new Error(`bar after re-entry changed the first hit ${event.eventId} ${method}`)
      }
    }
    if (portfolioAction(event) !== policyAction("C", { ...event, forward: { window: -1, t10: -1, t20: -1, t40: -1 } })) {
      throw new Error(`future forward changed the sell decision ${event.eventId}`)
    }
    checked += 1
  }
  return { ok: true, checked, violations: 0, reentryLastBar: "window close for recovery signals", sellUses: "T+5 state only" }
}

export function study(events, seriesBySymbol, options = {}) {
  if (
    V23_SELECTED_STRATEGY !== null
    || V27_SELECTED_STRATEGY !== null
    || V28_SELECTED_STRATEGY !== null
    || V29_SELECTED_STRATEGY !== null
    || V30_SELECTED_STRATEGY !== null
    || SELECTED_STRATEGY !== null
  ) throw new Error("selectedStrategy must stay null")
  if (!seriesBySymbol) throw new Error("re-entry study needs price series")
  assertBaseline(events)
  assertV18Split(events)
  assertEventList(events)
  const stateCounts = {
    RECOVERING: events.filter((event) => event.early.stateT5 === "RECOVERING").length,
    STABILIZING: events.filter((event) => event.early.stateT5 === "STABILIZING").length,
    STILL_FALLING: events.filter((event) => event.early.stateT5 === "STILL_FALLING").length,
  }
  if (stateCounts.RECOVERING !== 53 || stateCounts.STABILIZING !== 4 || stateCounts.STILL_FALLING !== 46) {
    throw new Error("T+5 state counts drifted")
  }
  const sellCount = events.filter((event) => portfolioAction(event) === "sell").length
  if (sellCount !== stateCounts.STABILIZING + stateCounts.STILL_FALLING) throw new Error("Policy C sell set drifted")
  const maxEvents = Math.max(...events.reduce((map, event) => map.set(event.ticker, (map.get(event.ticker) ?? 0) + 1), new Map()).values())
  if (maxEvents > 9) throw new Error("within-stock event count drifted")
  const decisionAudit = auditDecisionLookAhead(events, seriesBySymbol)
  const reentryAudit = auditReentryLookAhead(events, seriesBySymbol)
  const lookAheadViolations = (options.lookAheadViolations ?? 0) + decisionAudit.violations + reentryAudit.violations
  if (lookAheadViolations !== 0) throw new Error("look-ahead audit failed")
  const rows = flatQuotes(events, seriesBySymbol, 0, portfolioAction)
  const forcedRows = flatQuotes(
    events.filter((event) => event.early.stateT5 === "RECOVERING"),
    seriesBySymbol,
    0,
    () => "sell",
  )
  const portfolioIdentities = assertReentryIdentities(rows)
  const forcedIdentities = assertReentryIdentities(forcedRows)
  if (!portfolioIdentities.ok || !forcedIdentities.ok) throw new Error("re-entry identities failed")
  const identities = {
    ok: true,
    checked: portfolioIdentities.checked + forcedIdentities.checked,
    maxAbsError: Math.max(portfolioIdentities.maxAbsError, forcedIdentities.maxAbsError),
  }
  const windowEvents = events.filter((event) => finite(event.forward?.window)).length
  for (const method of RECOVERY) {
    if (block(ready(rows, method, "window")).n !== windowEvents) throw new Error(`recovery cash fill drifted ${method}`)
  }
  const portfolio = grid(rows)
  const sellBook = grid(rows.filter((row) => row.state !== "RECOVERING"))
  const stillFalling = grid(rows.filter((row) => row.state === "STILL_FALLING"))
  const recoveringHeld = grid(rows.filter((row) => row.state === "RECOVERING"))
  const recoveringForced = grid(forcedRows)
  const failure = failureOf(events, seriesBySymbol)
  const trials = options.bootstrap ?? BOOTSTRAP
  const fullBoot = trials >= BOOTSTRAP
  const books = { portfolio: rows, sellBook: rows.filter((row) => row.state !== "RECOVERING") }
  const bootstrap = { fullSample: fullBoot, seed: SEED }
  let cursor = 0
  for (const book of Object.keys(books)) {
    bootstrap[book] = {}
    for (const method of METHODS) {
      bootstrap[book][method] = {}
      for (const horizon of HORIZONS) {
        const sample = ready(books[book], method, horizon).filter((row) => finite(row.incremental))
        const pack = (values) => (fullBoot ? bootstrapMean(values, trials, SEED + cursor) : null)
        const incremental = pack(sample.map((row) => row.incremental))
        cursor += 1
        const tail10 = pack(sample.map((row) => (isTail(row.bh, 0.1) ? 1 : 0) - (isTail(row.strategy, 0.1) ? 1 : 0)))
        cursor += 1
        const tail20 = pack(sample.map((row) => (isTail(row.bh, 0.2) ? 1 : 0) - (isTail(row.strategy, 0.2) ? 1 : 0)))
        cursor += 1
        bootstrap[book][method][horizon] = { incremental, tail10, tail20 }
      }
    }
  }
  const oos = oosDetail(events, seriesBySymbol, (sample) => flatQuotes(sample, seriesBySymbol, 0, portfolioAction))
  const ticker = {}
  for (const method of METHODS) {
    ticker[method] = {
      incremental: leaveOne(rows, method, meanInc),
      tail10: leaveOne(rows, method, (sample) => tailReduction(sample, 0.1)),
      tail20: leaveOne(rows, method, (sample) => tailReduction(sample, 0.2)),
      maxEvents,
      withinStock: "결론 금지",
    }
  }
  const costs = {}
  for (const cost of COSTS) {
    const priced = cost === 0 ? rows : flatQuotes(events, seriesBySymbol, cost, portfolioAction)
    costs[String(cost)] = {}
    for (const method of METHODS) {
      const windowRows = ready(priced, method, "window")
      costs[String(cost)][method] = {
        portfolio: {
          mean: block(windowRows).strategy.mean,
          incremental: block(windowRows).incremental.mean,
          tail10: block(windowRows).strategy.tail10,
          tail20: block(windowRows).strategy.tail20,
        },
        sellBook: {
          mean: block(windowRows.filter((row) => row.state !== "RECOVERING")).strategy.mean,
          incremental: block(windowRows.filter((row) => row.state !== "RECOVERING")).incremental.mean,
        },
      }
    }
  }
  const cross = {}
  for (const [name, key, labels] of [["atr", "atrBand", ["LOW", "MID", "HIGH"]], ["leadership", "leadershipGroup", ["HIGH", "MID", "LOW"]]]) {
    cross[name] = {}
    for (const label of labels) {
      const subset = rows.filter((row) => row[key] === label && row.horizon === "window")
      cross[name][label] = { n: new Set(subset.map((row) => row.eventId)).size, methods: {} }
      for (const method of METHODS) {
        const view = block(subset.filter((row) => row.method === method))
        cross[name][label].methods[method] = {
          n: view.n,
          conclusion: view.conclusion,
          mean: view.strategy.mean,
          median: view.strategy.median,
          tail10: view.strategy.tail10,
          tail20: view.strategy.tail20,
          buyHoldMean: view.buyHold.mean,
          buyHoldTail10: view.buyHold.tail10,
          incremental: view.incremental.mean,
        }
      }
    }
  }
  const cards = METHODS.map((method) => {
    const view = portfolio[method].window
    const boot = bootstrap.portfolio[method].window
    const flips = ticker[method].incremental.signFlips
      + ticker[method].tail10.signFlips
      + ticker[method].tail20.signFlips
    return {
      method,
      n: view.n,
      incremental: view.rawIncremental,
      ciLow: fullBoot ? boot.incremental?.ci95?.[0] ?? null : null,
      ciHigh: fullBoot ? boot.incremental?.ci95?.[1] ?? null : null,
      oosPositive: oosCount(oos, method, 1),
      oosNegative: oosCount(oos, method, -1),
      tail10Strategy: view.strategy.rawTail10,
      tail10Hold: view.buyHold.rawTail10,
      tail20Strategy: view.strategy.rawTail20,
      tail20Hold: view.buyHold.rawTail20,
      looFlip: flips > 0,
    }
  })
  const judgment = judgeReentry({ lookAheadViolations, cards })
  const line = (book, method, horizon) => {
    const view = book[method][horizon]
    return {
      mean: view.strategy.mean,
      median: view.strategy.median,
      win: view.strategy.win,
      worst: view.strategy.worst,
      p5: view.strategy.p5,
      tail5: view.strategy.tail5,
      tail10: view.strategy.tail10,
      tail15: view.strategy.tail15,
      tail20: view.strategy.tail20,
      incremental: view.incremental.mean,
      n: view.n,
      conclusion: view.conclusion,
    }
  }
  return {
    selectedStrategy: SELECTED_STRATEGY,
    note: "Six fixed re-entry scenarios are scored separately against buy and hold. They are not combined and they are not a sell rule.",
    rules: {
      policy: "C",
      noBestScenario: true,
      noRefit: true,
      anchoredBook: "policy C portfolio",
      anchoredHorizon: "window",
      stabilizing: "결론 금지",
      limitsAreCuts: true,
      costLegs: "listed rate on the T+5 sale and again on the re-entry buy",
    },
    states: stateCounts,
    identities,
    lookAhead: { decision: decisionAudit, reentry: reentryAudit, violations: lookAheadViolations },
    failure,
    portfolio,
    sellBook,
    stillFalling,
    recoveringHeld,
    recoveringForced,
    bootstrap,
    oos,
    ticker,
    costs,
    atr: cross.atr,
    leadership: cross.leadership,
    cards,
    summary: {
      portfolio: Object.fromEntries(METHODS.map((method) => [method, Object.fromEntries(HORIZONS.map((horizon) => [horizon, line(portfolio, method, horizon)]))])),
      sellBook: Object.fromEntries(METHODS.map((method) => [method, Object.fromEntries(HORIZONS.map((horizon) => [horizon, line(sellBook, method, horizon)]))])),
    },
    judgment,
    limits: LIMITS,
  }
}
