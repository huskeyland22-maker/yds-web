/**
 * US single-stock T+5 hold-versus-sell study v28 (research only).
 *
 * The decision is the close of T+5. Selling then locks 0 before costs.
 * Holding earns the later close divided by the T+5 close, minus 1.
 * Recovery is not treated as a separate sell signal. State policies are
 * research comparisons. v1–v27 files are not modified.
 *
 * Policy C holds only RECOVERING and sells every other state, including
 * STABILIZING. Policy D holds only STILL_FALLING. No threshold is fit on
 * the test. Return and depth medians used out of sample come from the
 * train side of that split.
 *
 * Strong support, fixed before the sample is scored, needs all of:
 * on at least two of the three chronological splits, for both Window and
 * T+20, Policy C has a positive mean and a lower ≤ -10% rate than hold-all;
 * the sign of (Policy C mean − hold-all mean) agrees on at least two splits
 * for both targets; the 10,000-trial interval for Policy C minus sell-all
 * on Window sits above 0; the interval for the Window ≤ -10% rate reduction
 * versus hold-all sits above 0; both state groups have n≥20; look-ahead
 * violations are 0.
 * Partial support needs a positive full-sample Policy C mean with both
 * groups at n≥10, or a lower full-sample ≤ -10% rate than hold-all, or
 * support on at least one Window or T+20 split.
 * These policies are not a sell rule.
 */

import { mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { leaveOneCorrelation } from "./equity-sell-backtest-v7.mjs"
import { chronologicalSplit } from "./equity-sell-backtest-v18.mjs"
import { SPLIT_FRACTIONS } from "./equity-sell-backtest-v19.mjs"
import { SELECTED_STRATEGY as V23_SELECTED_STRATEGY } from "./equity-sell-backtest-v23.mjs"
import {
  SELECTED_STRATEGY as V27_SELECTED_STRATEGY,
  assertBaseline,
  assertEventList,
  assertV18Split,
  attachEarly,
  attachForward,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  auditLookAhead,
  bootstrapDiff,
  dateIndex,
  loadOhlcv,
  measureCheckpoint,
  recoveryPoint,
  selectMildEvents,
} from "./equity-sell-backtest-v27.mjs"

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
  auditLookAhead,
  chronologicalSplit,
  dateIndex,
  loadOhlcv,
  measureCheckpoint,
  recoveryPoint,
  selectMildEvents,
}

export const SELECTED_STRATEGY = null
export const BOOTSTRAP = 10000
const HORIZONS = ["t10", "t20", "t40", "window"]
const COSTS = [0, 0.001, 0.0025, 0.005]
const UP = [["up1", 0.01], ["up3", 0.03], ["up5", 0.05], ["up10", 0.1]]
const DOWN = [["dn3", -0.03], ["dn5", -0.05], ["dn10", -0.1]]

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

export function decisionReturn(holdReturn, action, cost = 0) {
  if (!finite(holdReturn) || (action !== "hold" && action !== "sell")) return null
  if (action === "sell") return cost === 0 ? 0 : -cost
  return holdReturn
}

export function attachTiming(events, seriesBySymbol) {
  const out = events.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`timing series missing ${event.eventId}`)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    const baseIdx = t0Idx + 5
    const base = series.closes[baseIdx]
    if (t0Idx < 0 || !(base > 0)) throw new Error(`timing path missing ${event.eventId}`)
    const path = []
    for (let day = 1; day <= 40; day += 1) {
      const idx = baseIdx + day
      if (idx >= series.closes.length) break
      path.push(series.closes[idx] / base - 1)
    }
    const first = (test) => {
      const index = path.findIndex(test)
      return index < 0 ? null : index + 1
    }
    const timing = { bars: path.length }
    for (const [key, level] of UP) timing[key] = first((value) => value >= level - 1e-12)
    for (const [key, level] of DOWN) timing[key] = first((value) => value <= level + 1e-12)
    return { ...event, timing }
  })
  out.bandCounts = events.bandCounts
  return out
}

function dist(values) {
  const xs = values.filter(finite)
  return {
    n: xs.length,
    conclusion: conclusion(xs.length),
    mean: pct(xs.length ? mean(xs) : null),
    median: pct(xs.length ? median(xs) : null),
    winRate: share(xs.map((value) => value > 0)),
    p5: pct(quantile(xs, 0.05)),
    p10: pct(quantile(xs, 0.1)),
    p25: pct(quantile(xs, 0.25)),
    p75: pct(quantile(xs, 0.75)),
    p95: pct(quantile(xs, 0.95)),
    worst: xs.length ? pct(Math.min(...xs)) : null,
    tail5: share(xs.map((value) => value <= -0.05)),
    tail10: share(xs.map((value) => value <= -0.1)),
    tail15: share(xs.map((value) => value <= -0.15)),
    tail20: share(xs.map((value) => value <= -0.2)),
    gain5: share(xs.map((value) => value >= 0.05)),
    gain10: share(xs.map((value) => value >= 0.1)),
  }
}

function actionOf(policy, event) {
  const state = event.early.stateT5
  if (policy === "A") return "hold"
  if (policy === "B") return "sell"
  if (policy === "C") return state === "RECOVERING" ? "hold" : "sell"
  if (policy === "D") return state === "STILL_FALLING" ? "hold" : "sell"
  return null
}

function priceAction(policy, event, medians) {
  const ret = event.early.t5.return
  const depth = event.early.t5.depth
  if (policy === "P1") return finite(ret) && ret > 0 ? "hold" : "sell"
  if (policy === "P2") return finite(ret) && finite(medians.return) && ret > medians.return ? "hold" : "sell"
  if (policy === "P3") return finite(depth) && finite(medians.depth) && depth < medians.depth ? "hold" : "sell"
  if (policy === "P4") {
    return finite(ret) && finite(depth) && ret > medians.return && depth < medians.depth ? "hold" : "sell"
  }
  return "sell"
}

function policyValues(events, horizon, policy, cost, medians) {
  const values = []
  let held = 0
  for (const event of events) {
    const holdReturn = event.forward?.[horizon]
    if (!finite(holdReturn)) continue
    const action = medians ? priceAction(policy, event, medians) : actionOf(policy, event)
    const value = decisionReturn(holdReturn, action, cost)
    if (!finite(value)) continue
    values.push(value)
    if (action === "hold") held += 1
  }
  return { ...dist(values), held, holdRate: values.length ? round2((held / values.length) * 100) : null }
}

function utility(value, penalty) {
  if (!finite(value)) return null
  return value - penalty * Math.max(0, -value)
}

function timingBlock(rows) {
  const block = { n: rows.length, conclusion: conclusion(rows.length) }
  for (const [key] of [...UP, ...DOWN]) {
    const eligible = rows.filter((event) => event.timing.bars > 0)
    const days = eligible.map((event) => event.timing[key]).filter(finite)
    block[key] = {
      eligible: eligible.length,
      reached: days.length,
      hitRate: eligible.length ? round2((days.length / eligible.length) * 100) : null,
      medianDays: days.length ? round2(median(days)) : null,
      p75Days: days.length ? round2(quantile(days, 0.75)) : null,
      conclusion: conclusion(eligible.length),
      daysConclusion: conclusion(days.length),
    }
  }
  return block
}

function cell(rows, horizon) {
  const values = rows.map((event) => event.forward?.[horizon]).filter(finite)
  const summary = dist(values)
  return {
    n: rows.length,
    priced: summary.n,
    conclusion: conclusion(rows.length),
    mean: summary.mean,
    median: summary.median,
    p5: summary.p5,
    tail10: summary.tail10,
    gain10: summary.gain10,
    winRate: summary.winRate,
  }
}

function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function resample(values, random) {
  const out = []
  for (let i = 0; i < values.length; i += 1) out.push(values[Math.floor(random() * values.length)])
  return out
}

export function bootstrapMean(values, trials, seed) {
  const xs = values.filter(finite)
  if (xs.length < 2) return null
  const actual = mean(xs)
  const random = mulberry32(seed)
  const boots = []
  for (let trial = 0; trial < trials; trial += 1) boots.push(mean(resample(xs, random)))
  boots.sort((a, b) => a - b)
  let extreme = 0
  for (let trial = 0; trial < trials; trial += 1) {
    let sum = 0
    for (const value of xs) sum += random() < 0.5 ? -value : value
    if (Math.abs(sum / xs.length) >= Math.abs(actual)) extreme += 1
  }
  return {
    n: xs.length,
    meanDiff: pct(actual),
    ci95: [pct(boots[Math.floor(0.025 * trials)]), pct(boots[Math.ceil(0.975 * trials) - 1])],
    permutationTail: round4(extreme / trials),
  }
}

function pairedDiffs(events, horizon, left, right) {
  const diffs = []
  for (const event of events) {
    const holdReturn = event.forward?.[horizon]
    if (!finite(holdReturn)) continue
    const a = decisionReturn(holdReturn, actionOf(left, event), 0)
    const b = decisionReturn(holdReturn, actionOf(right, event), 0)
    if (finite(a) && finite(b)) diffs.push(a - b)
  }
  return diffs
}

function tailDiffs(events, horizon) {
  const diffs = []
  for (const event of events) {
    const holdReturn = event.forward?.[horizon]
    if (!finite(holdReturn)) continue
    const holdTail = holdReturn <= -0.1 ? 1 : 0
    const policy = decisionReturn(holdReturn, actionOf("C", event), 0)
    const policyTail = policy <= -0.1 ? 1 : 0
    diffs.push(holdTail - policyTail)
  }
  return diffs
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
  const maxEvents = groups.size ? Math.max(...[...groups].map(([, group]) => group.y.length)) : 0
  return {
    eventWeighted: { n: eventLink.n, spearman: eventLink.rho },
    tickerWeighted: { tickers: groups.size, spearman: byTicker.rho, maxEvents },
    leaveOneTicker: leave ? { baseline: leave.baseline.rho, min: leave.min, max: leave.max, median: leave.median, signFlips: leave.signFlips } : null,
    withinStock: "결론 금지",
  }
}

function leaveOnePolicy(events, horizon) {
  const tickers = [...new Set(events.map((event) => event.ticker))]
  const score = (rows) => {
    const diffs = pairedDiffs(rows, horizon, "C", "A")
    return diffs.length ? mean(diffs) : null
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

function mediansOf(events) {
  return {
    return: median(events.map((event) => event.early.t5.return).filter(finite)),
    depth: median(events.map((event) => event.early.t5.depth).filter(finite)),
  }
}

function twoByTwo(events, medians) {
  const retCut = medians.return
  const depthCut = medians.depth
  const pick = (returnHigh, depthShallow) => events.filter((event) => {
    const ret = event.early.t5.return
    const depth = event.early.t5.depth
    if (!finite(ret) || !finite(depth)) return false
    return (ret > retCut) === returnHigh && (depth < depthCut) === depthShallow
  })
  return {
    returnCut: round4(retCut),
    depthCut: round4(depthCut),
    descriptive: true,
    highReturnShallow: cell(pick(true, true), "window"),
    highReturnDeep: cell(pick(true, false), "window"),
    lowReturnShallow: cell(pick(false, true), "window"),
    lowReturnDeep: cell(pick(false, false), "window"),
  }
}

function supports(block) {
  return finite(block?.C?.mean) && finite(block?.A?.tail10) && block.C.mean > 0 && block.C.tail10 < block.A.tail10
}

function signOf(block) {
  if (!finite(block?.C?.mean) || !finite(block?.A?.mean) || block.C.mean === block.A.mean) return 0
  return Math.sign(block.C.mean - block.A.mean)
}

export function judgeHoldSell(input) {
  const strong = input.lookAheadViolations === 0
    && input.windowSupport >= 2
    && input.t20Support >= 2
    && input.windowDirection >= 2
    && input.t20Direction >= 2
    && finite(input.cMinusSellCiLow) && input.cMinusSellCiLow > 0
    && finite(input.tailReductionCiLow) && input.tailReductionCiLow > 0
    && input.recoverN >= 20
    && input.fallN >= 20
  if (strong) return { label: "T+5 상태 기반 Hold/Sell 의사결정 가치 강하게 지지" }
  const partial = (finite(input.fullMean) && input.fullMean > 0 && input.recoverN >= 10 && input.fallN >= 10)
    || input.fullTailReduced === true
    || input.windowSupport >= 1
    || input.t20Support >= 1
  if (partial) return { label: "T+5 상태 기반 Hold/Sell 의사결정 가치 부분적으로 지지" }
  return { label: "실제 의사결정 가치 확인 실패" }
}

export function study(events, options = {}) {
  if (V23_SELECTED_STRATEGY !== null || V27_SELECTED_STRATEGY !== null || SELECTED_STRATEGY !== null) {
    throw new Error("selectedStrategy must stay null")
  }
  assertBaseline(events)
  assertV18Split(events)
  assertEventList(events)
  if (events.some((event) => !event.forward || !event.timing || !event.early?.stateT5)) throw new Error("T+5 decision path missing")
  const maxEvents = Math.max(...[...events.reduce((map, event) => map.set(event.ticker, (map.get(event.ticker) ?? 0) + 1), new Map()).values()])
  if (maxEvents > 9) throw new Error("within-stock event count drifted")
  const trials = options.bootstrap ?? BOOTSTRAP
  const fullBoot = trials >= BOOTSTRAP
  const byState = {}
  for (const state of ["RECOVERING", "STABILIZING", "STILL_FALLING"]) {
    const rows = events.filter((event) => event.early.stateT5 === state)
    byState[state] = {
      n: rows.length,
      conclusion: conclusion(rows.length),
      horizons: Object.fromEntries(HORIZONS.map((horizon) => [horizon, dist(rows.map((event) => event.forward[horizon]))])),
      badHold: {
        n: rows.filter((event) => finite(event.forward.mae)).length,
        conclusion: conclusion(rows.filter((event) => finite(event.forward.mae)).length),
        le5: share(rows.filter((event) => finite(event.forward.mae)).map((event) => event.forward.mae <= -0.05)),
        le10: share(rows.filter((event) => finite(event.forward.mae)).map((event) => event.forward.mae <= -0.1)),
        le15: share(rows.filter((event) => finite(event.forward.mae)).map((event) => event.forward.mae <= -0.15)),
        le20: share(rows.filter((event) => finite(event.forward.mae)).map((event) => event.forward.mae <= -0.2)),
      },
      timing: timingBlock(rows),
    }
  }
  const unconditional = Object.fromEntries(HORIZONS.map((horizon) => [horizon, dist(events.map((event) => event.forward[horizon]))]))
  const seed = 20261028
  const stateGap = {}
  HORIZONS.forEach((horizon, index) => {
    const left = events.filter((event) => event.early.stateT5 === "RECOVERING").map((event) => event.forward[horizon]).filter(finite)
    const right = events.filter((event) => event.early.stateT5 === "STILL_FALLING").map((event) => event.forward[horizon]).filter(finite)
    stateGap[horizon] = bootstrapDiff(left, right, trials, seed + index)
  })
  const badGap = {}
  ;["le5", "le10", "le15", "le20"].forEach((key, index) => {
    const level = { le5: -0.05, le10: -0.1, le15: -0.15, le20: -0.2 }[key]
    const read = (event) => (finite(event.forward.mae) && event.forward.mae <= level ? 1 : 0)
    const left = events.filter((event) => event.early.stateT5 === "RECOVERING" && finite(event.forward.mae)).map(read)
    const right = events.filter((event) => event.early.stateT5 === "STILL_FALLING" && finite(event.forward.mae)).map(read)
    badGap[key] = bootstrapDiff(left, right, trials, seed + 10 + index)
  })
  const policies = {}
  for (const horizon of HORIZONS) {
    policies[horizon] = {}
    for (const policy of ["A", "B", "C", "D"]) policies[horizon][policy] = policyValues(events, horizon, policy, 0, null)
  }
  const utilities = {}
  for (const horizon of HORIZONS) {
    utilities[horizon] = {}
    for (const state of ["RECOVERING", "STILL_FALLING"]) {
      const values = events.filter((event) => event.early.stateT5 === state).map((event) => event.forward[horizon]).filter(finite)
      utilities[horizon][state] = {
        n: values.length,
        conclusion: conclusion(values.length),
        u1: pct(values.length ? mean(values.map((value) => utility(value, 0))) : null),
        u2: pct(values.length ? mean(values.map((value) => utility(value, 0.5))) : null),
        u3: pct(values.length ? mean(values.map((value) => utility(value, 1))) : null),
        u4: pct(values.length ? mean(values.map((value) => utility(value, 2))) : null),
      }
    }
  }
  const sampleMedians = mediansOf(events)
  const pricePolicies = {
    descriptiveMedian: { return: round4(sampleMedians.return), depth: round4(sampleMedians.depth) },
    fullSample: {},
    grid: twoByTwo(events, sampleMedians),
  }
  for (const horizon of ["t20", "window"]) {
    pricePolicies.fullSample[horizon] = {}
    for (const policy of ["P1", "P2", "P3", "P4"]) {
      pricePolicies.fullSample[horizon][policy] = policyValues(events, horizon, policy, 0, sampleMedians)
    }
  }
  const costs = {}
  for (const horizon of ["t20", "window"]) {
    costs[horizon] = {}
    for (const cost of COSTS) {
      costs[horizon][String(cost)] = {}
      for (const policy of ["A", "B", "C", "D"]) costs[horizon][String(cost)][policy] = policyValues(events, horizon, policy, cost, null).mean
    }
  }
  const oos = {}
  for (const [name, fraction] of SPLIT_FRACTIONS) {
    const split = chronologicalSplit(events, fraction)
    const trainMedians = mediansOf(split.train)
    oos[name] = { train: split.train.length, test: split.test.length, trainMedians: { return: round4(trainMedians.return), depth: round4(trainMedians.depth) } }
    for (const horizon of ["t20", "window"]) {
      const block = {}
      for (const policy of ["A", "B", "C", "D"]) block[policy] = policyValues(split.test, horizon, policy, 0, null)
      for (const policy of ["P1", "P2", "P3", "P4"]) block[policy] = policyValues(split.test, horizon, policy, 0, trainMedians)
      block.supportsC = supports(block)
      block.signCA = signOf(block)
      oos[name][horizon] = block
    }
  }
  const directionCount = (target) => {
    const signs = ["50", "60", "70"].map((split) => oos[split][target].signCA)
    return Math.max(signs.filter((sign) => sign > 0).length, signs.filter((sign) => sign < 0).length)
  }
  const counts = {
    windowSupport: ["50", "60", "70"].filter((split) => oos[split].window.supportsC).length,
    t20Support: ["50", "60", "70"].filter((split) => oos[split].t20.supportsC).length,
    windowDirection: directionCount("window"),
    t20Direction: directionCount("t20"),
  }
  const policyBootstrap = {
    windowCMinusA: bootstrapMean(pairedDiffs(events, "window", "C", "A"), trials, seed + 20),
    windowCMinusB: bootstrapMean(pairedDiffs(events, "window", "C", "B"), trials, seed + 21),
    t20CMinusA: bootstrapMean(pairedDiffs(events, "t20", "C", "A"), trials, seed + 22),
    t20CMinusB: bootstrapMean(pairedDiffs(events, "t20", "C", "B"), trials, seed + 23),
    windowTailReduction: bootstrapMean(tailDiffs(events, "window"), trials, seed + 24),
    t20TailReduction: bootstrapMean(tailDiffs(events, "t20"), trials, seed + 25),
    fullSample: fullBoot,
  }
  const cross = (key, labels) => {
    const out = {}
    for (const label of labels) {
      const base = events.filter((event) => event[key] === label)
      out[label] = {
        RECOVERING: cell(base.filter((event) => event.early.stateT5 === "RECOVERING"), "window"),
        STILL_FALLING: cell(base.filter((event) => event.early.stateT5 === "STILL_FALLING"), "window"),
        t20: {
          RECOVERING: cell(base.filter((event) => event.early.stateT5 === "RECOVERING"), "t20"),
          STILL_FALLING: cell(base.filter((event) => event.early.stateT5 === "STILL_FALLING"), "t20"),
        },
      }
    }
    return out
  }
  const ciLow = (row) => (fullBoot ? row?.ci95?.[0] ?? null : null)
  const judgment = judgeHoldSell({
    windowSupport: counts.windowSupport,
    t20Support: counts.t20Support,
    windowDirection: counts.windowDirection,
    t20Direction: counts.t20Direction,
    cMinusSellCiLow: ciLow(policyBootstrap.windowCMinusB),
    tailReductionCiLow: ciLow(policyBootstrap.windowTailReduction),
    recoverN: byState.RECOVERING.n,
    fallN: byState.STILL_FALLING.n,
    fullMean: policies.window.C.mean,
    fullTailReduced: finite(policies.window.C.tail10) && finite(policies.window.A.tail10) && policies.window.C.tail10 < policies.window.A.tail10,
    lookAheadViolations: options.lookAheadViolations,
  })
  return {
    selectedStrategy: SELECTED_STRATEGY,
    note: "T+5 sell locks 0 before costs. Hold is the later close relative to the T+5 close. State policies are research comparisons, not a sell rule. Recovery is not treated as an independent sell signal.",
    rules: {
      stabilizingInC: "sell",
      stabilizingInD: "sell",
      support: "Policy C mean > 0 and Policy C ≤ -10% rate < hold-all",
      costOn: "T+5 sell only",
    },
    unconditional,
    byState,
    stateGap,
    badGap,
    policies,
    utilities,
    pricePolicies,
    costs,
    timing: {
      all: timingBlock(events),
      RECOVERING: byState.RECOVERING.timing,
      STILL_FALLING: byState.STILL_FALLING.timing,
    },
    oos,
    counts,
    policyBootstrap,
    atrCross: cross("atrBand", ["LOW", "HIGH", "MID"]),
    leadershipCross: cross("leadershipGroup", ["HIGH", "MID", "LOW"]),
    ticker: {
      stateWindow: tickerLink(events, (event) => (event.early.stateT5 === "RECOVERING" ? 1 : 0), (event) => event.forward.window),
      stateT20: tickerLink(events, (event) => (event.early.stateT5 === "RECOVERING" ? 1 : 0), (event) => event.forward.t20),
      policyCMinusHold: leaveOnePolicy(events, "window"),
      maxEvents,
      withinStock: "결론 금지",
    },
    judgment,
  }
}
