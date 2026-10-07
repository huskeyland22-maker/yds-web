/**
 * US single-stock T+5 sell study by loss limit v30 (research only).
 *
 * Policy C stays fixed: hold RECOVERING and sell every other state.
 * The loss limits -5%, -10%, -15%, and -20% are evaluation cuts. They are
 * not refit, and the study does not search for the cut with the best result.
 * A T+5 sale locks 0 before costs. These cuts are a sensitivity grid, not
 * an investor's optimal risk limit and not a sell rule. v1–v29 files are
 * not modified.
 *
 * The judgment is anchored to the -10% cut, the same tail already used in
 * v29, so a later look at the grid cannot pick the winner.
 *
 * Strong support, fixed before the sample is scored, needs all of:
 * look-ahead violations are 0; both state groups have n≥20; the -10% tail
 * rate falls versus hold-all on Window and on T+20; at least two of the
 * three chronological splits show that fall on both horizons; the 10,000-trial
 * Window interval for the -10% tail reduction sits above 0; Window precision
 * and recall at -10% are both at least 50%; the Window return given up per
 * 1 percentage point of that tail reduction is above 0 and below 0.5; and
 * the Window break-even loss penalty λ is above 0 and at most 1.
 * Partial support, when strong support fails, needs look-ahead violations
 * of 0, both groups at n≥10, a lower full-sample Window -10% tail rate than
 * hold-all, and the same fall on at least two Window splits. A large false
 * defensive sell share or a large missed gain stays inside partial support
 * when that tail fall is present. Otherwise the loss-limit sell value is
 * not confirmed.
 */

import { mean } from "./equity-sell-backtest-v2.mjs"
import { chronologicalSplit } from "./equity-sell-backtest-v18.mjs"
import { SPLIT_FRACTIONS } from "./equity-sell-backtest-v19.mjs"
import { SELECTED_STRATEGY as V23_SELECTED_STRATEGY } from "./equity-sell-backtest-v23.mjs"
import { SELECTED_STRATEGY as V27_SELECTED_STRATEGY } from "./equity-sell-backtest-v27.mjs"
import { SELECTED_STRATEGY as V28_SELECTED_STRATEGY, bootstrapMean } from "./equity-sell-backtest-v28.mjs"
import {
  SELECTED_STRATEGY as V29_SELECTED_STRATEGY,
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
  decisionReturn,
  eventGap,
  loadOhlcv,
  measureCheckpoint,
  policyAction,
  recoveryPoint,
  recoveryState,
  selectMildEvents,
} from "./equity-sell-backtest-v29.mjs"

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
  decisionReturn,
  loadOhlcv,
  measureCheckpoint,
  policyAction,
  recoveryPoint,
  recoveryState,
  selectMildEvents,
}

export const SELECTED_STRATEGY = null
export const BOOTSTRAP = 10000
const HORIZONS = ["t10", "t20", "t40", "window"]
const FOCUS = ["t20", "window"]
const LIMITS = [0.05, 0.1, 0.15, 0.2]
const PENALTIES = [0, 0.5, 1, 2, 3]
const COSTS = [0, 0.001, 0.0025, 0.005]
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

function limitKey(level) {
  return String(Math.round(level * 100))
}

function isTail(value, level) {
  return finite(value) && value <= -level + TOLERANCE
}

export function utilityOf(value, lambda) {
  if (!finite(value) || !finite(lambda)) return null
  return value - lambda * Math.max(0, -value)
}

export function breakEvenLambda(rows) {
  let avoided = 0
  let missed = 0
  for (const row of rows) {
    if (row.action !== "sell") continue
    if (row.hold < -TOLERANCE) avoided += -row.hold
    else if (row.hold > TOLERANCE) missed += row.hold
  }
  if (!(avoided > TOLERANCE)) {
    return { lambda: null, status: missed > TOLERANCE ? "해를 두지 않음" : "차이가 0" }
  }
  return { lambda: missed / avoided - 1, status: missed / avoided - 1 < -TOLERANCE ? "음수 해" : "양수 해" }
}

function rowsOf(events, horizon, cost = 0) {
  const rows = []
  for (const event of events) {
    const hold = event.forward?.[horizon]
    if (!finite(hold)) continue
    const action = policyAction("C", event)
    const gap = eventGap(hold, action, cost)
    const sold = eventGap(hold, "sell", cost)
    if (!gap || !sold) continue
    rows.push({
      event,
      hold,
      action,
      policyReturn: gap.policyReturn,
      sellAllReturn: sold.allSellReturn,
      attributedNet: gap.attributedNet,
    })
  }
  return rows
}

export function classifySells(rows, level) {
  const n = rows.length
  let holdTails = 0
  let policyTails = 0
  let sells = 0
  let trueSell = 0
  let falseSell = 0
  let trueLoss = 0
  let pathLoss = 0
  let missedCount = 0
  let missedSum = 0
  let insideLossCount = 0
  let insideLossSum = 0
  for (const row of rows) {
    const tail = isTail(row.hold, level)
    if (tail) {
      holdTails += 1
      pathLoss += -row.hold
    }
    if (isTail(row.policyReturn, level)) policyTails += 1
    if (row.action !== "sell") continue
    sells += 1
    if (tail) {
      trueSell += 1
      trueLoss += -row.hold
    } else {
      falseSell += 1
      if (row.hold > TOLERANCE) {
        missedCount += 1
        missedSum += row.hold
      } else if (row.hold < -TOLERANCE) {
        insideLossCount += 1
        insideLossSum += -row.hold
      }
    }
  }
  const holdTailPp = n ? round2((holdTails / n) * 100) : null
  const policyTailPp = n ? round2((policyTails / n) * 100) : null
  const reductionPp = finite(holdTailPp) && finite(policyTailPp) ? round2(holdTailPp - policyTailPp) : null
  return {
    n,
    conclusion: conclusion(n),
    holdTail: holdTailPp,
    policyTail: policyTailPp,
    reductionPp,
    relativeReduction: holdTailPp > 0 && finite(reductionPp) ? round2((reductionPp / holdTailPp) * 100) : null,
    rawReductionPp: n ? ((holdTails - policyTails) / n) * 100 : null,
    sells,
    trueCount: trueSell,
    falseCount: falseSell,
    trueConclusion: conclusion(trueSell),
    falseConclusion: conclusion(falseSell),
    precision: sells ? round2((trueSell / sells) * 100) : null,
    rawPrecision: sells ? (trueSell / sells) * 100 : null,
    precisionConclusion: conclusion(sells),
    recall: holdTails ? round2((trueSell / holdTails) * 100) : null,
    rawRecall: holdTails ? (trueSell / holdTails) * 100 : null,
    recallConclusion: conclusion(holdTails),
    falseSellRate: sells ? round2((falseSell / sells) * 100) : null,
    pathConditional: holdTails ? pct(pathLoss / holdTails) : null,
    pathContribution: n ? pct(pathLoss / n) : null,
    trueAvoidedMean: trueSell ? pct(trueLoss / trueSell) : null,
    trueAvoidedSum: trueSell ? pct(trueLoss) : null,
    trueContribution: n ? pct(trueLoss / n) : null,
    missedCount,
    missedMean: missedCount ? pct(missedSum / missedCount) : null,
    missedSum: missedCount ? pct(missedSum) : null,
    missedConclusion: conclusion(missedCount),
    insideLossCount,
    insideLossMean: insideLossCount ? pct(insideLossSum / insideLossCount) : null,
    insideLossConclusion: conclusion(insideLossCount),
    counts: { holdTails, policyTails, trueSell, falseSell, sells, n },
  }
}

function opportunityOf(rows) {
  if (!rows.length) return null
  const holdMean = pct(mean(rows.map((row) => row.hold)))
  const policyMean = pct(mean(rows.map((row) => row.policyReturn)))
  if (!finite(holdMean) || !finite(policyMean)) return null
  return round2(holdMean - policyMean)
}

function priced(rows) {
  if (!rows.length) return null
  return {
    n: rows.length,
    conclusion: conclusion(rows.length),
    allHold: pct(mean(rows.map((row) => row.hold))),
    allSell: pct(mean(rows.map((row) => row.sellAllReturn))),
    policyC: pct(mean(rows.map((row) => row.policyReturn))),
    opportunityCost: opportunityOf(rows),
  }
}

function withTradeoff(block, opportunityCost) {
  return {
    ...block,
    opportunityCost,
    costPerPp: finite(opportunityCost) && finite(block.reductionPp) && block.reductionPp > 0
      ? round4(opportunityCost / block.reductionPp)
      : null,
  }
}

function limitGrid(rows) {
  const opportunityCost = opportunityOf(rows)
  const out = {}
  for (const level of LIMITS) out[limitKey(level)] = withTradeoff(classifySells(rows, level), opportunityCost)
  return out
}

function utilityGrid(rows) {
  const out = {}
  for (const lambda of PENALTIES) {
    const key = String(lambda)
    out[key] = {
      allHold: pct(mean(rows.map((row) => utilityOf(row.hold, lambda)))),
      allSell: pct(mean(rows.map((row) => utilityOf(row.sellAllReturn, lambda)))),
      policyC: pct(mean(rows.map((row) => utilityOf(row.policyReturn, lambda)))),
    }
  }
  return out
}

function stateNote(state) {
  if (state === "STILL_FALLING") {
    return "Policy C sells every STILL_FALLING event, so recall inside this state is definitional. Precision is the share of this state that breaches the limit."
  }
  return "Policy C holds RECOVERING, so this state has no defensive sells. Tail events in this state remain inside the held book."
}

function crossGrid(events, horizon, key, labels) {
  const out = {}
  for (const label of labels) {
    const rows = rowsOf(events.filter((event) => event[key] === label), horizon, 0)
    out[label] = {
      n: rows.length,
      conclusion: conclusion(rows.length),
      limits: limitGrid(rows),
    }
  }
  return out
}

function leaveOne(events, horizon, score, display) {
  const tickers = [...new Set(events.map((event) => event.ticker))]
  const baseline = score(events)
  const values = []
  for (const ticker of tickers) {
    const value = score(events.filter((event) => event.ticker !== ticker))
    if (finite(value)) values.push({ ticker, value })
  }
  const flips = values.filter((row) => finite(baseline) && Math.sign(row.value) !== Math.sign(baseline) && row.value !== 0 && baseline !== 0)
  return {
    baseline: display(baseline),
    min: values.length ? display(Math.min(...values.map((row) => row.value))) : null,
    max: values.length ? display(Math.max(...values.map((row) => row.value))) : null,
    signFlips: flips.map((row) => row.ticker),
    withinStock: "결론 금지",
  }
}

function returnGap(events, horizon) {
  const rows = rowsOf(events, horizon, 0)
  return rows.length ? mean(rows.map((row) => row.policyReturn - row.hold)) : null
}

function tailGap(events, horizon, level) {
  const rows = rowsOf(events, horizon, 0)
  if (!rows.length) return null
  const holdRate = rows.filter((row) => isTail(row.hold, level)).length / rows.length
  const policyRate = rows.filter((row) => isTail(row.policyReturn, level)).length / rows.length
  return holdRate - policyRate
}

export function judgeRiskBudget(input) {
  const strong = input.lookAheadViolations === 0
    && input.recoverN >= 20
    && input.fallN >= 20
    && finite(input.windowReduction10) && input.windowReduction10 > 0
    && finite(input.t20Reduction10) && input.t20Reduction10 > 0
    && input.windowOos10 >= 2
    && input.t20Oos10 >= 2
    && finite(input.windowTailCiLow10) && input.windowTailCiLow10 > 0
    && finite(input.windowPrecision10) && input.windowPrecision10 >= 50
    && finite(input.windowRecall10) && input.windowRecall10 >= 50
    && finite(input.windowCostPerPp10) && input.windowCostPerPp10 > 0 && input.windowCostPerPp10 < 0.5
    && finite(input.windowLambda) && input.windowLambda > 0 && input.windowLambda <= 1
  if (strong) return { label: "위험한도 기반 매도 가치 강하게 지지", anchor: "-10%" }
  const partial = input.lookAheadViolations === 0
    && input.recoverN >= 10
    && input.fallN >= 10
    && finite(input.windowReduction10) && input.windowReduction10 > 0
    && input.windowOos10 >= 2
  if (partial) return { label: "위험한도 기반 매도 가치 부분적으로 지지", anchor: "-10%" }
  return { label: "위험한도 기반 매도 가치 확인 실패", anchor: "-10%" }
}

export function assertRiskIdentities(events) {
  let maxAbsError = 0
  let checked = 0
  const bump = (value) => {
    maxAbsError = Math.max(maxAbsError, Math.abs(value))
    checked += 1
  }
  for (const horizon of HORIZONS) {
    const rows = rowsOf(events, horizon, 0)
    if (!rows.length) continue
    bump(mean(rows.map((row) => row.sellAllReturn)))
    bump(mean(rows.map((row) => utilityOf(row.policyReturn, 0))) - mean(rows.map((row) => row.policyReturn)))
    bump(mean(rows.map((row) => utilityOf(row.hold, 0))) - mean(rows.map((row) => row.hold)))
    for (const row of rows) {
      const gap = eventGap(row.hold, row.action, 0)
      bump(gap.gap - gap.attributedNet)
      bump(gap.avoidedLoss + gap.missedGain - Math.abs(row.hold))
      bump(gap.net - (gap.avoidedLoss - gap.missedGain))
    }
    const solved = breakEvenLambda(rows)
    if (finite(solved.lambda)) {
      bump(mean(rows.map((row) => utilityOf(row.policyReturn, solved.lambda) - utilityOf(row.hold, solved.lambda))))
    }
    for (const level of LIMITS) {
      const block = classifySells(rows, level)
      bump(block.counts.trueSell + block.counts.falseSell - block.counts.sells)
      bump(block.counts.holdTails - block.counts.policyTails - block.counts.trueSell)
      if (block.counts.holdTails > 0) {
        bump(block.counts.trueSell / block.counts.holdTails - (block.counts.holdTails - block.counts.policyTails) / block.counts.holdTails)
      }
    }
  }
  if (!(maxAbsError <= TOLERANCE)) throw new Error(`risk-limit identity drifted ${maxAbsError}`)
  return { ok: true, checked, maxAbsError, tolerance: TOLERANCE }
}

function reductionCount(oos, horizon, key) {
  return ["50", "60", "70"].filter((split) => finite(oos[split][horizon].limits[key].rawReductionPp) && oos[split][horizon].limits[key].rawReductionPp > 0).length
}

export function study(events, options = {}) {
  if (V23_SELECTED_STRATEGY !== null || V27_SELECTED_STRATEGY !== null || V28_SELECTED_STRATEGY !== null || V29_SELECTED_STRATEGY !== null || SELECTED_STRATEGY !== null) {
    throw new Error("selectedStrategy must stay null")
  }
  assertBaseline(events)
  assertV18Split(events)
  assertEventList(events)
  if (events.some((event) => !event.forward || !event.early?.stateT5)) throw new Error("T+5 decision path missing")
  const stateCounts = {
    RECOVERING: events.filter((event) => event.early.stateT5 === "RECOVERING").length,
    STABILIZING: events.filter((event) => event.early.stateT5 === "STABILIZING").length,
    STILL_FALLING: events.filter((event) => event.early.stateT5 === "STILL_FALLING").length,
  }
  if (stateCounts.RECOVERING !== 53 || stateCounts.STABILIZING !== 4 || stateCounts.STILL_FALLING !== 46) {
    throw new Error("T+5 state counts drifted from v29")
  }
  const maxEvents = Math.max(...events.reduce((map, event) => map.set(event.ticker, (map.get(event.ticker) ?? 0) + 1), new Map()).values())
  if (maxEvents > 9) throw new Error("within-stock event count drifted")
  const identities = assertRiskIdentities(events)
  const trials = options.bootstrap ?? BOOTSTRAP
  const fullBoot = trials >= BOOTSTRAP
  const seed = 20261030
  const matrix = {}
  const prices = {}
  const utilities = {}
  const breakEven = {}
  for (const horizon of HORIZONS) {
    const rows = rowsOf(events, horizon, 0)
    prices[horizon] = priced(rows)
    matrix[horizon] = limitGrid(rows)
    utilities[horizon] = utilityGrid(rows)
    const solved = breakEvenLambda(rows)
    const gap = finite(solved.lambda)
      ? mean(rows.map((row) => utilityOf(row.policyReturn, solved.lambda) - utilityOf(row.hold, solved.lambda)))
      : null
    breakEven[horizon] = {
      lambda: round4(solved.lambda),
      rawLambda: finite(solved.lambda) ? solved.lambda : null,
      status: solved.status,
      utilityGap: finite(gap) ? gap : null,
      n: rows.length,
      conclusion: conclusion(rows.length),
    }
  }
  const byState = {}
  for (const state of ["RECOVERING", "STILL_FALLING"]) {
    byState[state] = { n: stateCounts[state], conclusion: conclusion(stateCounts[state]), note: stateNote(state), horizons: {} }
    for (const horizon of HORIZONS) {
      byState[state].horizons[horizon] = limitGrid(rowsOf(events.filter((event) => event.early.stateT5 === state), horizon, 0))
    }
  }
  const costs = {}
  for (const horizon of FOCUS) {
    costs[horizon] = {}
    for (const cost of COSTS) {
      const rows = rowsOf(events, horizon, cost)
      const tails = {}
      for (const level of LIMITS) {
        const block = classifySells(rows, level)
        tails[limitKey(level)] = { holdTail: block.holdTail, policyTail: block.policyTail, reductionPp: block.reductionPp }
      }
      costs[horizon][String(cost)] = {
        allHold: pct(mean(rows.map((row) => row.hold))),
        policyC: pct(mean(rows.map((row) => row.policyReturn))),
        opportunityCost: opportunityOf(rows),
        utility: {
          0: pct(mean(rows.map((row) => utilityOf(row.policyReturn, 0)))),
          1: pct(mean(rows.map((row) => utilityOf(row.policyReturn, 1)))),
          2: pct(mean(rows.map((row) => utilityOf(row.policyReturn, 2)))),
        },
        holdUtility: {
          0: pct(mean(rows.map((row) => utilityOf(row.hold, 0)))),
          1: pct(mean(rows.map((row) => utilityOf(row.hold, 1)))),
          2: pct(mean(rows.map((row) => utilityOf(row.hold, 2)))),
        },
        tails,
      }
    }
  }
  const oos = {}
  for (const [name, fraction] of SPLIT_FRACTIONS) {
    const split = chronologicalSplit(events, fraction)
    oos[name] = { train: split.train.length, test: split.test.length }
    for (const horizon of FOCUS) {
      const rows = rowsOf(split.test, horizon, 0)
      oos[name][horizon] = { ...priced(rows), limits: limitGrid(rows) }
    }
  }
  const counts = {
    window10: reductionCount(oos, "window", "10"),
    t2010: reductionCount(oos, "t20", "10"),
    window5: reductionCount(oos, "window", "5"),
    window15: reductionCount(oos, "window", "15"),
    window20: reductionCount(oos, "window", "20"),
  }
  const bootRows = {
    window: rowsOf(events, "window", 0),
    t20: rowsOf(events, "t20", 0),
  }
  const policyBootstrap = { fullSample: fullBoot }
  let cursor = 0
  for (const horizon of FOCUS) {
    const rows = bootRows[horizon]
    const ret = bootstrapMean(rows.map((row) => row.policyReturn - row.hold), trials, seed + cursor)
    cursor += 1
    policyBootstrap[horizon] = { returnDiff: ret, tail: {}, utility: { 0: ret } }
    for (const lambda of PENALTIES) {
      if (lambda === 0) continue
      policyBootstrap[horizon].utility[String(lambda)] = bootstrapMean(
        rows.map((row) => utilityOf(row.policyReturn, lambda) - utilityOf(row.hold, lambda)),
        trials,
        seed + cursor,
      )
      cursor += 1
    }
    for (const level of LIMITS) {
      policyBootstrap[horizon].tail[limitKey(level)] = bootstrapMean(
        rows.map((row) => (isTail(row.hold, level) ? 1 : 0) - (isTail(row.policyReturn, level) ? 1 : 0)),
        trials,
        seed + cursor,
      )
      cursor += 1
    }
  }
  const ciLow = (row) => (fullBoot ? row?.ci95?.[0] ?? null : null)
  const judgment = judgeRiskBudget({
    lookAheadViolations: options.lookAheadViolations,
    recoverN: stateCounts.RECOVERING,
    fallN: stateCounts.STILL_FALLING,
    windowReduction10: matrix.window["10"].rawReductionPp,
    t20Reduction10: matrix.t20["10"].rawReductionPp,
    windowOos10: counts.window10,
    t20Oos10: counts.t2010,
    windowTailCiLow10: ciLow(policyBootstrap.window.tail["10"]),
    windowPrecision10: matrix.window["10"].rawPrecision,
    windowRecall10: matrix.window["10"].rawRecall,
    windowCostPerPp10: matrix.window["10"].costPerPp,
    windowLambda: breakEven.window.rawLambda,
  })
  return {
    selectedStrategy: SELECTED_STRATEGY,
    note: "Loss limits score a fixed T+5 policy. They are not refit and they are not a sell rule. Policy C holds RECOVERING and sells every other state.",
    rules: {
      anchoredLimit: "-10%",
      noRefit: true,
      stabilizingInC: "sell",
      strong: "anchored -10% tail fall, precision and recall both >= 50, cost per 1pp below 0.5, and break-even lambda at most 1",
      partial: "anchored -10% tail fall is present even when false defensive sells or missed gains are large",
      costOn: "T+5 sell only",
      relativeReduction: "At zero cost, relative tail reduction equals recall, because a sale sets the return to 0 and does not create a new tail.",
    },
    states: stateCounts,
    identities,
    prices,
    matrix,
    utilities,
    breakEven,
    byState,
    costs,
    oos,
    counts,
    policyBootstrap,
    atr: {
      window: crossGrid(events, "window", "atrBand", ["LOW", "MID", "HIGH"]),
      t20: crossGrid(events, "t20", "atrBand", ["LOW", "MID", "HIGH"]),
    },
    leadership: {
      window: crossGrid(events, "window", "leadershipGroup", ["HIGH", "MID", "LOW"]),
      t20: crossGrid(events, "t20", "leadershipGroup", ["HIGH", "MID", "LOW"]),
    },
    ticker: {
      returnGap: leaveOne(events, "window", (sample) => returnGap(sample, "window"), pct),
      tail10: leaveOne(events, "window", (sample) => tailGap(sample, "window", 0.1), pct),
      tail15: leaveOne(events, "window", (sample) => tailGap(sample, "window", 0.15), pct),
      maxEvents,
      withinStock: "결론 금지",
    },
    judgment,
  }
}
