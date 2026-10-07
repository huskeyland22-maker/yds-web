/**
 * US single-stock T+5 sell-value study v29 (research only).
 *
 * Selling at the T+5 close locks 0 before costs. Holding earns the later
 * close divided by the T+5 close, minus 1. Avoided loss is the positive
 * part of the subsequent decline. Missed gain is the positive part of the
 * subsequent rise. Net decision value is avoided loss minus missed gain.
 * That net equals the negative of the hold return. It is an accounting
 * identity, not a claim that selling is better.
 *
 * Policy C holds only RECOVERING and sells every other state, including
 * STABILIZING. A positive hold inside RECOVERING is a gain Policy C keeps.
 * A positive hold inside STILL_FALLING is a gain Policy C gives up.
 * These policies are research comparisons. They are not a sell rule.
 * v1–v28 files are not modified. Return and depth medians used out of
 * sample come from the train side of that split.
 *
 * Strong support, fixed before the sample is scored, needs all of:
 * look-ahead violations are 0; both state groups have n≥20; on Window and
 * on T+20 the Policy C sell book has mean avoided loss above mean missed
 * gain; the 10,000-trial interval for the portfolio gap (Policy C return
 * minus hold-all return, which equals attributed avoided loss minus
 * attributed missed gain) sits above 0 on Window; the interval for the
 * Window ≤ -10% rate reduction versus hold-all sits above 0; at least two
 * of the three chronological splits have a positive sell-book net on both
 * Window and T+20, with that sign agreeing on at least two splits; and at
 * least two splits on both targets have a lower ≤ -10% rate than hold-all.
 * Partial support, when strong support fails, needs look-ahead violations
 * of 0, both groups at n≥10, a lower full-sample Window ≤ -10% rate than
 * hold-all, and the same tail reduction on at least two splits of Window
 * or of T+20. A large missed-gain sacrifice stays inside partial support
 * when that tail reduction is present. Otherwise the sell decision value
 * is not confirmed.
 */

import { mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { leaveOneCorrelation } from "./equity-sell-backtest-v7.mjs"
import { chronologicalSplit } from "./equity-sell-backtest-v18.mjs"
import { SPLIT_FRACTIONS } from "./equity-sell-backtest-v19.mjs"
import { recoveryState } from "./equity-sell-backtest-v24.mjs"
import { SELECTED_STRATEGY as V23_SELECTED_STRATEGY } from "./equity-sell-backtest-v23.mjs"
import { SELECTED_STRATEGY as V27_SELECTED_STRATEGY } from "./equity-sell-backtest-v27.mjs"
import {
  SELECTED_STRATEGY as V28_SELECTED_STRATEGY,
  assertBaseline,
  assertEventList,
  assertV18Split,
  attachEarly,
  attachForward,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  bootstrapMean,
  dateIndex,
  decisionReturn,
  loadOhlcv,
  measureCheckpoint,
  recoveryPoint,
  selectMildEvents,
} from "./equity-sell-backtest-v28.mjs"

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
  chronologicalSplit,
  dateIndex,
  decisionReturn,
  loadOhlcv,
  measureCheckpoint,
  recoveryPoint,
  recoveryState,
  selectMildEvents,
}

export const SELECTED_STRATEGY = null
export const BOOTSTRAP = 10000
const HORIZONS = ["t10", "t20", "t40", "window"]
const FOCUS = ["t20", "window"]
const COSTS = [0, 0.001, 0.0025, 0.005]
const LOSS_LEVELS = [0.03, 0.05, 0.1, 0.15, 0.2]
const GAIN_LEVELS = [0.03, 0.05, 0.1, 0.15, 0.2]
const PAIRED = [0.05, 0.1, 0.15, 0.2]
const POLICIES = ["A", "B", "C", "P1", "P2", "P3", "P4"]
const STATE_ORDER = ["RECOVERING", "STABILIZING", "STILL_FALLING"]
const TOLERANCE = 1e-10

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

function closeEnough(left, right) {
  if (left == null && right == null) return true
  return finite(left) && finite(right) && Math.abs(left - right) <= TOLERANCE
}

export function sellValue(holdReturn) {
  if (!finite(holdReturn)) return null
  const avoidedLoss = Math.max(0, -holdReturn)
  const missedGain = Math.max(0, holdReturn)
  return { avoidedLoss, missedGain, net: avoidedLoss - missedGain }
}

export function eventGap(holdReturn, action, cost = 0) {
  const parts = sellValue(holdReturn)
  const policyReturn = decisionReturn(holdReturn, action, cost)
  if (!parts || !finite(policyReturn)) return null
  const sold = action === "sell"
  return {
    policyReturn,
    allHoldReturn: holdReturn,
    allSellReturn: decisionReturn(holdReturn, "sell", cost),
    gap: policyReturn - holdReturn,
    avoidedLoss: parts.avoidedLoss,
    missedGain: parts.missedGain,
    net: parts.net,
    attributedAvoided: sold ? parts.avoidedLoss : 0,
    attributedMissed: sold ? parts.missedGain : 0,
    attributedNet: sold ? parts.net - cost : 0,
  }
}

export function policyAction(policy, event, medians = null) {
  const state = event.early?.stateT5
  if (policy === "A") return "hold"
  if (policy === "B") return "sell"
  if (policy === "C") return state === "RECOVERING" ? "hold" : "sell"
  if (policy === "D") return state === "STILL_FALLING" ? "hold" : "sell"
  const ret = event.early?.t5?.return
  const depth = event.early?.t5?.depth
  if (policy === "P1") return finite(ret) && ret > 0 ? "hold" : "sell"
  if (policy === "P2") return finite(ret) && finite(medians?.return) && ret > medians.return ? "hold" : "sell"
  if (policy === "P3") return finite(depth) && finite(medians?.depth) && depth < medians.depth ? "hold" : "sell"
  if (policy === "P4") {
    return finite(ret) && finite(depth) && finite(medians?.return) && finite(medians?.depth) && ret > medians.return && depth < medians.depth
      ? "hold"
      : "sell"
  }
  return null
}

function capture(avoidedMean, missedMean) {
  const total = avoidedMean + missedMean
  if (!(total > 0)) return { lossCapture: null, gainSacrifice: null }
  const lossCapture = round4(avoidedMean / total)
  return { lossCapture, gainSacrifice: round4(1 - lossCapture) }
}

function side(values) {
  const xs = values.filter(finite)
  const avg = xs.length ? mean(xs) : null
  return {
    n: xs.length,
    conclusion: conclusion(xs.length),
    mean: pct(avg),
    median: pct(xs.length ? median(xs) : null),
    p25: pct(quantile(xs, 0.25)),
    p75: pct(quantile(xs, 0.75)),
    p95: pct(quantile(xs, 0.95)),
    max: xs.length ? pct(Math.max(...xs)) : null,
    occurrence: share(xs.map((value) => value > TOLERANCE)),
    rawMean: avg,
  }
}

function netSide(values) {
  const xs = values.filter(finite)
  return {
    n: xs.length,
    conclusion: conclusion(xs.length),
    mean: pct(xs.length ? mean(xs) : null),
    median: pct(xs.length ? median(xs) : null),
    winRate: share(xs.map((value) => value > TOLERANCE)),
    positiveRate: share(xs.map((value) => value > TOLERANCE)),
    p5: pct(quantile(xs, 0.05)),
    p25: pct(quantile(xs, 0.25)),
    p75: pct(quantile(xs, 0.75)),
    p95: pct(quantile(xs, 0.95)),
  }
}

function returnSide(values) {
  const xs = values.filter(finite)
  return {
    n: xs.length,
    conclusion: conclusion(xs.length),
    mean: pct(xs.length ? mean(xs) : null),
    median: pct(xs.length ? median(xs) : null),
    winRate: share(xs.map((value) => value > TOLERANCE)),
    p5: pct(quantile(xs, 0.05)),
    worst: xs.length ? pct(Math.min(...xs)) : null,
    tail5: share(xs.map((value) => value <= -0.05)),
    tail10: share(xs.map((value) => value <= -0.1)),
    gain5: share(xs.map((value) => value >= 0.05)),
    gain10: share(xs.map((value) => value >= 0.1)),
  }
}

function bookFromParts(parts) {
  const avoided = side(parts.map((part) => part.avoidedLoss))
  const missed = side(parts.map((part) => part.missedGain))
  const ratio = capture(avoided.rawMean ?? 0, missed.rawMean ?? 0)
  if (!(avoided.n > 0)) ratio.lossCapture = null
  return {
    n: parts.length,
    conclusion: conclusion(parts.length),
    avoided: publicSide(avoided),
    missed: publicSide(missed),
    net: netSide(parts.map((part) => part.net)),
    capture: ratio,
    avoidedExceedsMissed: finite(avoided.rawMean) && finite(missed.rawMean) ? avoided.rawMean > missed.rawMean : null,
  }
}

function publicSide(row) {
  const copy = { ...row }
  delete copy.rawMean
  return copy
}

function pathBook(events, horizon) {
  const parts = []
  for (const event of events) {
    const hold = event.forward?.[horizon]
    if (!finite(hold)) continue
    parts.push(sellValue(hold))
  }
  return bookFromParts(parts)
}

function outcomeRates(events, horizon) {
  const holds = events.map((event) => event.forward?.[horizon]).filter(finite)
  return {
    n: holds.length,
    conclusion: conclusion(holds.length),
    lt0: share(holds.map((value) => value < -TOLERANCE)),
    le5: share(holds.map((value) => value <= -0.05)),
    le10: share(holds.map((value) => value <= -0.1)),
    ge5: share(holds.map((value) => value >= 0.05)),
    ge10: share(holds.map((value) => value >= 0.1)),
  }
}

function rowsOf(events, horizon, policy, medians, cost = 0) {
  const rows = []
  for (const event of events) {
    const hold = event.forward?.[horizon]
    if (!finite(hold)) continue
    const action = policyAction(policy, event, medians)
    const gap = eventGap(hold, action, cost)
    if (!gap) continue
    rows.push({ event, hold, action, ...gap })
  }
  return rows
}

function policyPack(events, horizon, policy, medians, cost = 0) {
  const rows = rowsOf(events, horizon, policy, medians, cost)
  const sold = rows.filter((row) => row.action === "sell")
  const held = rows.length - sold.length
  const avoided = side(rows.map((row) => row.attributedAvoided))
  const missed = side(rows.map((row) => row.attributedMissed))
  const ratio = capture(avoided.rawMean ?? 0, missed.rawMean ?? 0)
  if (!(rows.length > 0) || (avoided.rawMean === 0 && missed.rawMean === 0)) {
    ratio.lossCapture = rows.length && avoided.rawMean === 0 && missed.rawMean === 0 ? null : ratio.lossCapture
  }
  const sellParts = sold.map((row) => sellValue(row.hold))
  return {
    ...returnSide(rows.map((row) => row.policyReturn)),
    held,
    holdRate: rows.length ? round2((held / rows.length) * 100) : null,
    sellRate: rows.length ? round2((sold.length / rows.length) * 100) : null,
    avoided: publicSide(avoided),
    missed: publicSide(missed),
    net: netSide(rows.map((row) => row.attributedNet)),
    capture: ratio,
    sellBook: bookFromParts(sellParts),
  }
}

function bucket(events, horizon, accept, amount) {
  const priced = events.filter((event) => finite(event.forward?.[horizon]))
  const chosen = priced.filter((event) => accept(event, event.forward[horizon]))
  const amounts = chosen.map((event) => amount(event.forward[horizon])).filter(finite)
  return {
    n: chosen.length,
    priced: priced.length,
    conclusion: conclusion(chosen.length),
    rate: priced.length ? round2((chosen.length / priced.length) * 100) : null,
    mean: pct(amounts.length ? mean(amounts) : null),
    median: pct(amounts.length ? median(amounts) : null),
    p5: pct(quantile(amounts, 0.05)),
    p95: pct(quantile(amounts, 0.95)),
    sum: amounts.length ? pct(amounts.reduce((total, value) => total + value, 0)) : null,
  }
}

function decomposition(events, horizon) {
  return {
    correctSell: bucket(events, horizon, (event, hold) => event.early.stateT5 === "STILL_FALLING" && hold < -TOLERANCE, (hold) => -hold),
    soldWinner: bucket(events, horizon, (event, hold) => event.early.stateT5 === "STILL_FALLING" && hold > TOLERANCE, (hold) => hold),
    capturedHold: bucket(events, horizon, (event, hold) => event.early.stateT5 === "RECOVERING" && hold > TOLERANCE, (hold) => hold),
    retainedLoss: bucket(events, horizon, (event, hold) => event.early.stateT5 === "RECOVERING" && hold < -TOLERANCE, (hold) => -hold),
    accounting: "Policy C holds RECOVERING and sells STILL_FALLING. capturedHold is kept. soldWinner is the opportunity cost.",
  }
}

function groupRate(events, horizon, test) {
  const holds = events.map((event) => event.forward?.[horizon]).filter(finite)
  return {
    n: holds.length,
    conclusion: conclusion(holds.length),
    rate: share(holds.map(test)),
  }
}

function criticalBlock(events, horizon) {
  const loss = {}
  for (const level of LOSS_LEVELS) {
    const test = (hold) => hold <= -level + TOLERANCE
    const sold = events.filter((event) => finite(event.forward?.[horizon]) && policyAction("C", event) === "sell" && test(event.forward[horizon]))
    const amounts = sold.map((event) => -event.forward[horizon])
    loss[String(Math.round(level * 100))] = {
      all: groupRate(events, horizon, test),
      RECOVERING: groupRate(events.filter((event) => event.early.stateT5 === "RECOVERING"), horizon, test),
      STILL_FALLING: groupRate(events.filter((event) => event.early.stateT5 === "STILL_FALLING"), horizon, test),
      cAvoidedCount: sold.length,
      cAvoidedMean: pct(amounts.length ? mean(amounts) : null),
      cAvoidedConclusion: conclusion(sold.length),
    }
  }
  const gain = {}
  for (const level of GAIN_LEVELS) {
    const test = (hold) => hold >= level - TOLERANCE
    const sold = events.filter((event) => finite(event.forward?.[horizon]) && policyAction("C", event) === "sell" && test(event.forward[horizon]))
    const amounts = sold.map((event) => event.forward[horizon])
    gain[String(Math.round(level * 100))] = {
      all: groupRate(events, horizon, test),
      RECOVERING: groupRate(events.filter((event) => event.early.stateT5 === "RECOVERING"), horizon, test),
      STILL_FALLING: groupRate(events.filter((event) => event.early.stateT5 === "STILL_FALLING"), horizon, test),
      cMissedCount: sold.length,
      cMissedMean: pct(amounts.length ? mean(amounts) : null),
      cMissedConclusion: conclusion(sold.length),
    }
  }
  return { loss, gain }
}

function evidence(net) {
  if (!finite(net) || net === 0) return "해당 임계의 평균 기여가 같음"
  return net > 0 ? "해당 임계의 평균 기여는 피한 손실이 더 큼" : "해당 임계의 평균 기여는 놓친 상승이 더 큼"
}

function frontier(events, horizon, policy) {
  const holds = []
  for (const event of events) {
    const hold = event.forward?.[horizon]
    if (!finite(hold)) continue
    const sold = policy === "sell-all" || policyAction(policy, event) === "sell"
    holds.push(sold ? hold : null)
  }
  const priced = holds.length
  const contribution = (accept, amount) => {
    const values = holds.map((hold) => (finite(hold) && accept(hold) ? amount(hold) : 0))
    return values.length ? mean(values) : null
  }
  const paired = PAIRED.map((level) => {
    const avoided = contribution((hold) => hold <= -level + TOLERANCE, (hold) => -hold)
    const missed = contribution((hold) => hold >= level - TOLERANCE, (hold) => hold)
    const net = finite(avoided) && finite(missed) ? avoided - missed : null
    return {
      magnitude: Math.round(level * 100),
      avoided: pct(avoided),
      missed: pct(missed),
      net: pct(net),
      evidence: evidence(net),
      conclusion: conclusion(priced),
    }
  })
  return { n: priced, conclusion: conclusion(priced), paired }
}

function mediansOf(events) {
  return {
    return: median(events.map((event) => event.early?.t5?.return).filter(finite)),
    depth: median(events.map((event) => event.early?.t5?.depth).filter(finite)),
  }
}

function checkpoint(closes, t0Idx, offset) {
  const measured = measureCheckpoint(closes, t0Idx, offset)
  return recoveryPoint(measured)
}

export function auditDecisionLookAhead(events, seriesBySymbol) {
  let checked = 0
  const medians = mediansOf(events)
  for (const event of events) {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`look-ahead series missing ${event.eventId}`)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    if (t0Idx < 0 || t0Idx + 5 >= series.closes.length) throw new Error(`look-ahead date missing ${event.eventId}`)
    const storedT5 = checkpoint(series.closes, t0Idx, 5)
    const storedT3 = checkpoint(series.closes, t0Idx, 3)
    if (recoveryState(storedT3, storedT5) !== event.early.stateT5) throw new Error(`look-ahead state mismatch ${event.eventId}`)
    if (!closeEnough(storedT5?.return, event.early.t5.return) || !closeEnough(storedT5?.depth, event.early.t5.depth)) {
      throw new Error(`look-ahead T+5 field mismatch ${event.eventId}`)
    }
    const poisoned = series.closes.slice()
    const future = t0Idx + 6
    if (future < poisoned.length) poisoned[future] = poisoned[t0Idx] * 0.5
    else poisoned.push(poisoned[t0Idx] * 0.5)
    const againT5 = checkpoint(poisoned, t0Idx, 5)
    const againT3 = checkpoint(poisoned, t0Idx, 3)
    if (recoveryState(againT3, againT5) !== event.early.stateT5) throw new Error(`look-ahead future bar changed state ${event.eventId}`)
    if (!closeEnough(againT5?.return, event.early.t5.return) || !closeEnough(againT5?.depth, event.early.t5.depth)) {
      throw new Error(`look-ahead future bar changed T+5 ${event.eventId}`)
    }
    const replay = {
      ...event,
      early: { ...event.early, stateT5: recoveryState(againT3, againT5), t5: { ...event.early.t5, return: againT5.return, depth: againT5.depth } },
      forward: { t10: -1, t20: -1, t40: -1, window: -1 },
    }
    for (const policy of ["A", "B", "C", "P1"]) {
      if (policyAction(policy, replay) !== policyAction(policy, event)) throw new Error(`look-ahead policy changed ${event.eventId} ${policy}`)
    }
    for (const policy of ["P2", "P3", "P4"]) {
      if (policyAction(policy, replay, medians) !== policyAction(policy, event, medians)) {
        throw new Error(`look-ahead threshold policy changed ${event.eventId} ${policy}`)
      }
    }
    checked += 1
  }
  return { ok: true, checked, violations: 0, t5LastBar: "T+5 close", thresholds: "T+5 return and depth only" }
}

export function assertSellIdentities(events) {
  let maxAbsError = 0
  let checked = 0
  for (const event of events) {
    for (const horizon of HORIZONS) {
      const hold = event.forward?.[horizon]
      if (!finite(hold)) continue
      for (const action of ["hold", "sell"]) {
        const gap = eventGap(hold, action, 0)
        const drift = [
          gap.avoidedLoss + gap.missedGain - Math.abs(hold),
          gap.net - (gap.avoidedLoss - gap.missedGain),
          gap.net + hold,
          gap.gap - gap.attributedNet,
          gap.attributedNet - (gap.attributedAvoided - gap.attributedMissed),
          gap.allSellReturn,
        ]
        if (action === "sell" && hold < -TOLERANCE) drift.push(gap.gap - gap.avoidedLoss)
        if (action === "sell" && hold > TOLERANCE) drift.push(gap.gap + gap.missedGain)
        if (action === "hold") drift.push(gap.gap)
        for (const item of drift) maxAbsError = Math.max(maxAbsError, Math.abs(item))
        checked += 1
      }
      const policy = eventGap(hold, policyAction("C", event), 0)
      maxAbsError = Math.max(maxAbsError, Math.abs(policy.gap - (policy.attributedAvoided - policy.attributedMissed)))
    }
  }
  if (!(maxAbsError <= TOLERANCE)) throw new Error(`sell identity drifted ${maxAbsError}`)
  return { ok: true, checked, maxAbsError, tolerance: TOLERANCE }
}

function crossBlock(events, key, labels) {
  const out = {}
  for (const label of labels) {
    const rows = events.filter((event) => event[key] === label)
    const pack = policyPack(rows, "window", "C", null, 0)
    out[label] = {
      n: rows.length,
      conclusion: conclusion(rows.length),
      mean: pack.mean,
      avoided: pack.avoided.mean,
      missed: pack.missed.mean,
      net: pack.net.mean,
      tail10: pack.tail10,
      gain10: pack.gain10,
      capture: pack.capture,
      sellBook: {
        n: pack.sellBook.n,
        conclusion: pack.sellBook.conclusion,
        avoided: pack.sellBook.avoided.mean,
        missed: pack.sellBook.missed.mean,
        net: pack.sellBook.net.mean,
      },
    }
  }
  return out
}

function tickerLink(events, readX, readY) {
  const usable = events.filter((event) => finite(readX(event)) && finite(readY(event)))
  const eventLink = spearman(usable.map((event) => ({ x: readX(event), y: readY(event) })))
  const groups = new Map()
  for (const event of usable) {
    const group = groups.get(event.ticker) ?? { x: [], y: [] }
    group.x.push(readX(event))
    group.y.push(readY(event))
    groups.set(event.ticker, group)
  }
  const byTicker = spearman([...groups].map(([, group]) => ({ x: mean(group.x), y: mean(group.y) })))
  const leave = groups.size ? leaveOneCorrelation(usable, readX, readY) : null
  return {
    eventWeighted: { n: eventLink.n, spearman: eventLink.rho },
    tickerWeighted: { tickers: groups.size, spearman: byTicker.rho },
    leaveOneTicker: leave ? { baseline: leave.baseline.rho, min: leave.min, max: leave.max, median: leave.median, signFlips: leave.signFlips } : null,
    withinStock: "결론 금지",
  }
}

function leaveOneGap(events, horizon) {
  const tickers = [...new Set(events.map((event) => event.ticker))]
  const score = (rows) => {
    const gaps = rowsOf(rows, horizon, "C", null, 0).map((row) => row.gap)
    return gaps.length ? mean(gaps) : null
  }
  const baseline = score(events)
  const rows = tickers.map((ticker) => ({ ticker, rho: score(events.filter((event) => event.ticker !== ticker)) })).filter((row) => finite(row.rho))
  const flips = rows.filter((row) => finite(baseline) && Math.sign(row.rho) !== Math.sign(baseline) && row.rho !== 0 && baseline !== 0)
  return {
    baseline: pct(baseline),
    min: rows.length ? pct(Math.min(...rows.map((row) => row.rho))) : null,
    max: rows.length ? pct(Math.max(...rows.map((row) => row.rho))) : null,
    median: rows.length ? pct(median(rows.map((row) => row.rho))) : null,
    signFlips: flips.map((row) => row.ticker),
    withinStock: "결론 금지",
  }
}

function sellBookNet(events, horizon) {
  const parts = rowsOf(events, horizon, "C", null, 0).filter((row) => row.action === "sell").map((row) => sellValue(row.hold))
  if (!parts.length) return null
  return mean(parts.map((part) => part.net))
}

export function judgeSellValue(input) {
  const strong = input.lookAheadViolations === 0
    && input.recoverN >= 20
    && input.fallN >= 20
    && input.windowSellNetPositive === true
    && input.t20SellNetPositive === true
    && finite(input.windowNetCiLow) && input.windowNetCiLow > 0
    && finite(input.windowTailCiLow) && input.windowTailCiLow > 0
    && input.windowNetPositive >= 2
    && input.t20NetPositive >= 2
    && input.windowNetDirection >= 2
    && input.t20NetDirection >= 2
    && input.windowTailReduced >= 2
    && input.t20TailReduced >= 2
  if (strong) return { label: "매도 의사결정 가치 강하게 지지" }
  const partial = input.lookAheadViolations === 0
    && input.recoverN >= 10
    && input.fallN >= 10
    && input.fullTailReduced === true
    && (input.windowTailReduced >= 2 || input.t20TailReduced >= 2)
  if (partial) return { label: "부분적으로 지지" }
  return { label: "매도 의사결정 가치 확인 실패" }
}

export function study(events, options = {}) {
  if (V23_SELECTED_STRATEGY !== null || V27_SELECTED_STRATEGY !== null || V28_SELECTED_STRATEGY !== null || SELECTED_STRATEGY !== null) {
    throw new Error("selectedStrategy must stay null")
  }
  assertBaseline(events)
  assertV18Split(events)
  assertEventList(events)
  if (events.some((event) => !event.forward || !event.early?.stateT5 || !event.early?.t5)) throw new Error("T+5 decision path missing")
  const stateCounts = Object.fromEntries(STATE_ORDER.map((state) => [state, events.filter((event) => event.early.stateT5 === state).length]))
  if (stateCounts.RECOVERING !== 53 || stateCounts.STABILIZING !== 4 || stateCounts.STILL_FALLING !== 46) {
    throw new Error("T+5 state counts drifted from v28")
  }
  const countsByTicker = events.reduce((map, event) => map.set(event.ticker, (map.get(event.ticker) ?? 0) + 1), new Map())
  const maxEvents = Math.max(...countsByTicker.values())
  if (maxEvents > 9) throw new Error("within-stock event count drifted")
  const identities = assertSellIdentities(events)
  const trials = options.bootstrap ?? BOOTSTRAP
  const fullBoot = trials >= BOOTSTRAP
  const seed = 20261029
  const path = {}
  const byState = {}
  for (const state of STATE_ORDER) byState[state] = { n: stateCounts[state], conclusion: conclusion(stateCounts[state]), horizons: {} }
  const outcomes = {}
  const pieces = {}
  const critical = {}
  const frontiers = { sellAll: {}, policyC: {} }
  for (const horizon of HORIZONS) {
    path[horizon] = pathBook(events, horizon)
    for (const state of STATE_ORDER) {
      const rows = events.filter((event) => event.early.stateT5 === state)
      byState[state].horizons[horizon] = pathBook(rows, horizon)
    }
    outcomes[horizon] = {
      all: outcomeRates(events, horizon),
      RECOVERING: outcomeRates(events.filter((event) => event.early.stateT5 === "RECOVERING"), horizon),
      STILL_FALLING: outcomeRates(events.filter((event) => event.early.stateT5 === "STILL_FALLING"), horizon),
    }
    pieces[horizon] = decomposition(events, horizon)
    critical[horizon] = criticalBlock(events, horizon)
    frontiers.sellAll[horizon] = frontier(events, horizon, "sell-all")
    frontiers.policyC[horizon] = frontier(events, horizon, "C")
  }
  const sampleMedians = mediansOf(events)
  const policies = {}
  for (const horizon of HORIZONS) {
    policies[horizon] = {}
    for (const policy of ["A", "B", "C"]) policies[horizon][policy] = policyPack(events, horizon, policy, null, 0)
    if (FOCUS.includes(horizon)) {
      for (const policy of ["P1", "P2", "P3", "P4"]) policies[horizon][policy] = policyPack(events, horizon, policy, sampleMedians, 0)
    }
  }
  const costs = {}
  for (const horizon of FOCUS) {
    costs[horizon] = {}
    for (const cost of COSTS) {
      const holdAll = policyPack(events, horizon, "A", null, cost)
      const policy = policyPack(events, horizon, "C", null, cost)
      costs[horizon][String(cost)] = {
        A: holdAll.mean,
        C: policy.mean,
        gap: finite(policy.mean) && finite(holdAll.mean) ? round2(policy.mean - holdAll.mean) : null,
      }
    }
  }
  const oos = {}
  for (const [name, fraction] of SPLIT_FRACTIONS) {
    const split = chronologicalSplit(events, fraction)
    const trainMedians = mediansOf(split.train)
    oos[name] = {
      train: split.train.length,
      test: split.test.length,
      trainMedians: { return: round4(trainMedians.return), depth: round4(trainMedians.depth) },
    }
    for (const horizon of FOCUS) {
      const block = {}
      for (const policy of POLICIES) {
        const medians = policy === "P2" || policy === "P3" || policy === "P4" ? trainMedians : null
        block[policy] = policyPack(split.test, horizon, policy, medians, 0)
      }
      const net = sellBookNet(split.test, horizon)
      block.sellBookNet = pct(net)
      block.sellBookNetSign = finite(net) && net !== 0 ? Math.sign(net) : 0
      block.tailReduced = finite(block.C.tail10) && finite(block.A.tail10) && block.C.tail10 < block.A.tail10
      block.returnSacrifice = finite(block.A.mean) && finite(block.C.mean) ? round2(block.A.mean - block.C.mean) : null
      oos[name][horizon] = block
    }
  }
  const signCount = (horizon) => {
    const signs = ["50", "60", "70"].map((split) => oos[split][horizon].sellBookNetSign)
    return Math.max(signs.filter((sign) => sign > 0).length, signs.filter((sign) => sign < 0).length)
  }
  const positiveCount = (horizon) => ["50", "60", "70"].filter((split) => oos[split][horizon].sellBookNetSign > 0).length
  const tailCount = (horizon) => ["50", "60", "70"].filter((split) => oos[split][horizon].tailReduced).length
  const counts = {
    windowNetPositive: positiveCount("window"),
    t20NetPositive: positiveCount("t20"),
    windowNetDirection: signCount("window"),
    t20NetDirection: signCount("t20"),
    windowTailReduced: tailCount("window"),
    t20TailReduced: tailCount("t20"),
  }
  const gapSeries = (horizon) => rowsOf(events, horizon, "C", null, 0).map((row) => row.gap)
  const avoidedSeries = (horizon) => rowsOf(events, horizon, "C", null, 0).map((row) => row.attributedAvoided)
  const missedSeries = (horizon) => rowsOf(events, horizon, "C", null, 0).map((row) => row.attributedMissed)
  const versusSell = (horizon) => rowsOf(events, horizon, "C", null, 0).map((row) => row.policyReturn)
  const netVersusSell = (horizon) => rowsOf(events, horizon, "C", null, 0).map((row) => row.attributedNet - sellValue(row.hold).net)
  const tailSeries = (horizon) => rowsOf(events, horizon, "C", null, 0).map((row) => (row.hold <= -0.1 ? 1 : 0) - (row.policyReturn <= -0.1 ? 1 : 0))
  const policyBootstrap = {
    windowNet: bootstrapMean(gapSeries("window"), trials, seed),
    windowAvoided: bootstrapMean(avoidedSeries("window"), trials, seed),
    windowMissed: bootstrapMean(missedSeries("window"), trials, seed),
    windowReturn: bootstrapMean(gapSeries("window"), trials, seed + 1),
    windowVersusSellReturn: bootstrapMean(versusSell("window"), trials, seed + 2),
    windowVersusSellNet: bootstrapMean(netVersusSell("window"), trials, seed + 3),
    windowTailReduction: bootstrapMean(tailSeries("window"), trials, seed + 4),
    t20Net: bootstrapMean(gapSeries("t20"), trials, seed + 5),
    t20Avoided: bootstrapMean(avoidedSeries("t20"), trials, seed + 6),
    t20Missed: bootstrapMean(missedSeries("t20"), trials, seed + 7),
    t20Return: bootstrapMean(gapSeries("t20"), trials, seed + 8),
    t20VersusSellReturn: bootstrapMean(versusSell("t20"), trials, seed + 9),
    t20VersusSellNet: bootstrapMean(netVersusSell("t20"), trials, seed + 10),
    t20TailReduction: bootstrapMean(tailSeries("t20"), trials, seed + 11),
    fullSample: fullBoot,
  }
  const ciLow = (row) => (fullBoot ? row?.ci95?.[0] ?? null : null)
  const judgment = judgeSellValue({
    lookAheadViolations: options.lookAheadViolations,
    recoverN: stateCounts.RECOVERING,
    fallN: stateCounts.STILL_FALLING,
    windowSellNetPositive: policies.window.C.sellBook.avoidedExceedsMissed === true,
    t20SellNetPositive: policies.t20.C.sellBook.avoidedExceedsMissed === true,
    windowNetCiLow: ciLow(policyBootstrap.windowNet),
    windowTailCiLow: ciLow(policyBootstrap.windowTailReduction),
    ...counts,
    fullTailReduced: finite(policies.window.C.tail10) && finite(policies.window.A.tail10) && policies.window.C.tail10 < policies.window.A.tail10,
  })
  const timeProfile = Object.fromEntries(HORIZONS.map((horizon) => [horizon, {
    sellAll: {
      avoided: path[horizon].avoided.mean,
      missed: path[horizon].missed.mean,
      net: path[horizon].net.mean,
      capture: path[horizon].capture,
    },
    policyC: {
      avoided: policies[horizon].C.avoided.mean,
      missed: policies[horizon].C.missed.mean,
      net: policies[horizon].C.net.mean,
      capture: policies[horizon].C.capture,
    },
  }]))
  return {
    selectedStrategy: SELECTED_STRATEGY,
    note: "T+5 sell locks 0 before costs. Avoided loss and missed gain split that counterfactual. Policy C is a research comparison, not a sell rule.",
    rules: {
      stabilizingInC: "sell",
      strong: "sell-book avoided loss exceeds missed gain, OOS agrees, and both bootstrap intervals sit above 0",
      partial: "tail versus hold-all is lower even when missed gain exceeds avoided loss",
      costOn: "T+5 sell only",
      accounting: "Policy C holds RECOVERING. A positive RECOVERING path is captured. A positive STILL_FALLING path is missed.",
    },
    states: stateCounts,
    identities,
    path,
    byState,
    outcomes,
    pieces,
    critical,
    frontiers,
    descriptiveMedian: { return: round4(sampleMedians.return), depth: round4(sampleMedians.depth), use: "full-sample description only" },
    policies,
    costs,
    oos,
    counts,
    policyBootstrap,
    timeProfile,
    atr: crossBlock(events, "atrBand", ["LOW", "MID", "HIGH"]),
    leadership: crossBlock(events, "leadershipGroup", ["HIGH", "MID", "LOW"]),
    ticker: {
      stateNet: tickerLink(
        events,
        (event) => (event.early.stateT5 === "RECOVERING" ? 1 : 0),
        (event) => (finite(event.forward.window) ? sellValue(event.forward.window).net : null),
      ),
      policyGap: leaveOneGap(events, "window"),
      maxEvents,
      withinStock: "결론 금지",
    },
    judgment,
  }
}
