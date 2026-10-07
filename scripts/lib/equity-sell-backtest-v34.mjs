/**
 * Final synthesis of the US growth-stock correction studies v1–v33.
 *
 * This module reads stored research JSON. It does not refit a model, search
 * a threshold, or combine outcomes into a new statistic. D and E below are
 * stored findings, not strategies. selectedStrategy stays null.
 *
 * A sell rule can be adopted only when six stored facts are true together:
 * the window Policy C mean exceeds buy-and-hold, the -10% tail rate falls,
 * the -20% true-sell count is at least 10 and every v32 return-bar predictor
 * also clears its -20% bar, every fixed v31 re-entry has a positive window
 * increment whose interval sits above 0 on the stored card, at least two
 * chronological splits are positive for every re-entry card, and the v30
 * ticker leave-one-out return gap is positive with no sign flip. Missing any
 * one of them forbids adoption.
 *
 * When adoption fails, the stored re-entry judgment is opposite evidence, and
 * the stored v33 independence count is 0, the pre-specified sell questions in
 * this line are closed. The synthesis then ends the line and keeps
 * buy-and-hold as the default. It does not open a new hypothesis.
 */

import { SELECTED_STRATEGY as V30_SELECTED_STRATEGY } from "./equity-sell-backtest-v30.mjs"
import { SELECTED_STRATEGY as V31_SELECTED_STRATEGY } from "./equity-sell-backtest-v31.mjs"
import { SELECTED_STRATEGY as V32_SELECTED_STRATEGY } from "./equity-sell-backtest-v32.mjs"
import { SELECTED_STRATEGY as V33_SELECTED_STRATEGY } from "./equity-sell-backtest-v33.mjs"

export const SELECTED_STRATEGY = null

const KEEP_HOLD = "연구 종료 — 현재 Buy & Hold 기준을 유지"
const KEEP_SELL = "연구 종료 — 매도 규칙 채택"
const CONTINUE = "연구 계속 — 새로운 가설 필요"

function violationsOf(doc) {
  if (!doc || doc.lookAhead == null) return null
  if (typeof doc.lookAhead.violations === "number") return doc.lookAhead.violations
  return null
}

function assertNullStrategy(doc, name) {
  if (!doc || !Object.prototype.hasOwnProperty.call(doc, "selectedStrategy")) return
  if (doc.selectedStrategy !== null) throw new Error(`${name} selectedStrategy is not null`)
}

function sameNumber(left, right) {
  return typeof left === "number" && typeof right === "number" && left === right
}

export function quoteBaseline(v30, v32, v33) {
  const rows = [
    ["windowMean", v30?.prices?.window?.allHold, v32?.levels?.window?.mean, v33?.levels?.window?.mean],
    ["windowN", v30?.prices?.window?.n, v32?.levels?.window?.n, v33?.levels?.window?.n],
    ["windowTail10", v30?.matrix?.window?.["10"]?.holdTail, v32?.levels?.window?.tail10, v33?.levels?.window?.tail10],
    ["windowTail20", v30?.matrix?.window?.["20"]?.holdTail, v32?.levels?.window?.tail20, v33?.levels?.window?.tail20],
    ["t20Mean", v30?.prices?.t20?.allHold, v32?.levels?.t20?.mean, null],
    ["t40Mean", v30?.prices?.t40?.allHold, v32?.levels?.t40?.mean, null],
  ]
  const conflicts = []
  for (const [field, ...values] of rows) {
    const present = values.filter((value) => typeof value === "number")
    if (present.length >= 2 && present.some((value) => value !== present[0])) {
      conflicts.push({ field, values })
    }
  }
  return {
    conflicts,
    window: v32?.levels?.window ?? null,
    t20: v32?.levels?.t20 ?? null,
    t40: v32?.levels?.t40 ?? null,
    v30Window: v30?.prices?.window ?? null,
    v33WindowStored: Boolean(v33?.levels?.window),
    v33OmitsFullT20: v33?.levels?.t20?.mean == null,
  }
}

function cardById(doc, id) {
  return (doc?.cards ?? []).find((card) => card.id === id) ?? null
}

export function adoptionGates(input) {
  const windowPrice = input.v30.prices.window
  const tail10 = input.v30.matrix.window["10"]
  const tail20 = input.v30.matrix.window["20"]
  const reentry = input.v31.cards
  const holdCards = ["t0", "eventAtr", "spyAtr"].map((id) => cardById(input.v32, id))
  const ticker = input.v30.ticker.returnGap
  return {
    meanAdvantage: windowPrice.policyC > windowPrice.allHold,
    tail10Improved: tail10.policyTail < tail10.holdTail,
    tail20Stable: tail20.trueCount >= 10 && holdCards.every((card) => card?.tailClear === true),
    reentryOvercome: reentry.length === 6 && reentry.every((card) => card.incremental > 0 && card.ciLow > 0),
    oosAdvantage: reentry.length === 6 && reentry.every((card) => card.oosPositive >= 2),
    tickerRobust: ticker.baseline > 0 && ticker.signFlips.length === 0,
  }
}

export function judgeSynthesis(input) {
  if ([V30_SELECTED_STRATEGY, V31_SELECTED_STRATEGY, V32_SELECTED_STRATEGY, V33_SELECTED_STRATEGY, SELECTED_STRATEGY].some((value) => value !== null)) {
    throw new Error("selectedStrategy must stay null")
  }
  if (input.lookAheadViolations !== 0) throw new Error("look-ahead violation blocks the final synthesis")
  if (input.conflicts.length) throw new Error("stored baselines disagree; synthesis will not average them")
  const gates = input.gates
  const adopt = Object.values(gates).every(Boolean)
  let recommendation = CONTINUE
  if (adopt) recommendation = KEEP_SELL
  else if (input.v31Label === "반대 증거" && input.v33Cleared === 0 && gates.meanAdvantage === false) recommendation = KEEP_HOLD
  const sellEdge = gates.meanAdvantage || gates.reentryOvercome ? "부분 증거" : "반대 증거"
  const holdSignal = input.v32Label === "부분적인 보유 확신 신호" && input.v33Cleared === 0 ? "부분 증거" : "증거 부족"
  const riskControl = gates.tail20Stable ? "강한 증거" : "증거 부족"
  return {
    recommendation,
    adopt,
    sellEdge,
    holdSignal,
    riskControl,
    sentence: adopt
      ? "현재 연구 범위에서는 T+5 매도 전략의 채택 조건이 모두 저장되어 있다."
      : "현재 연구 범위에서는 T+5 매도 전략을 Buy & Hold보다 우수한 전략으로 채택할 충분한 증거가 없다.",
    philosophy: recommendation === KEEP_HOLD
      ? "약 -20%까지 감내하는 장기 투자 관점에서 현재 데이터는 조정 시 기계적으로 매도하기보다 Buy & Hold를 기본 전략으로 유지하는 쪽을 지지한다."
      : null,
  }
}

export function synthesize(docs) {
  for (const name of ["v30", "v31", "v32", "v33", "v29", "v28"]) assertNullStrategy(docs[name], name)
  const engines = [V30_SELECTED_STRATEGY, V31_SELECTED_STRATEGY, V32_SELECTED_STRATEGY, V33_SELECTED_STRATEGY, SELECTED_STRATEGY]
  if (engines.some((value) => value !== null)) throw new Error("selectedStrategy must stay null")
  const states = [docs.v30.states, docs.v32.states, docs.v33.states]
  for (const state of states) {
    if (state.RECOVERING !== 53 || state.STABILIZING !== 4 || state.STILL_FALLING !== 46) {
      throw new Error("stored T+5 state counts disagree")
    }
  }
  const lookAhead = ["v30", "v31", "v32", "v33", "v29", "v28", "v27"].map((name) => ({
    name,
    violations: violationsOf(docs[name]),
  }))
  if (lookAhead.some((item) => item.violations !== 0)) throw new Error("stored look-ahead violation")
  const baseline = quoteBaseline(docs.v30, docs.v32, docs.v33)
  const gates = adoptionGates(docs)
  const policy = docs.v30.prices.window
  const windowMatrix = docs.v30.matrix.window
  const reentry = docs.v31.cards.map((card) => {
    const book = docs.v31.portfolio[card.method].window
    return {
      method: card.method,
      n: card.n,
      strategyMean: book.strategy.mean,
      buyHoldMean: book.buyHold.mean,
      incremental: book.incremental.mean,
      ci95: [card.ciLow, card.ciHigh],
      oosPositive: card.oosPositive,
      oosNegative: card.oosNegative,
      tail10Strategy: book.strategy.tail10,
      tail10Hold: book.buyHold.tail10,
      tail20Strategy: book.strategy.tail20,
      tail20Hold: book.buyHold.tail20,
      looFlip: card.looFlip,
    }
  })
  const holdIds = ["t0", "eventAtr", "spyAtr"]
  const hold = holdIds.map((id) => {
    const link = docs.v32.univariate[id]
    const card = cardById(docs.v32, id)
    return {
      id,
      windowRho: link.window.rho,
      windowCi: link.window.ci95,
      t20Rho: link.t20.rho,
      tail20Rho: link.tail20.rho,
      oosSame: card.oosSame,
      returnClear: card.returnClear,
      tailClear: card.tailClear,
      tickerEqual: link.tickerEqual.spearman,
      looFlips: docs.v32.loo[id].signFlips,
    }
  })
  const independence = ["eventAtr|t0+spyAtr", "spyAtr|t0+eventAtr"].map((id) => {
    const step = docs.v33.steps[id]
    return {
      id,
      independent: step.independent,
      deltaR2: step.pooled.deltaR2,
      deltaR2Ci: step.pooled.deltaR2Ci,
      meanDeltaMae: step.meanDeltaMae,
      r2ImproveSplits: step.r2ImproveSplits,
    }
  })
  const judgment = judgeSynthesis({
    lookAheadViolations: 0,
    conflicts: baseline.conflicts,
    gates,
    v31Label: docs.v31.judgment.label,
    v32Label: docs.v32.judgment.label,
    v33Cleared: docs.v33.judgment.cleared,
  })
  const net = docs.v29.policies.window.C
  return {
    selectedStrategy: SELECTED_STRATEGY,
    note: "Synthesis of stored v1–v33 results. Not a sell rule.",
    rules: {
      noNewPredictor: true,
      noThresholdSearch: true,
      noNewSellRule: true,
      noModelPick: true,
      readOnly: true,
    },
    lookAhead,
    baseline,
    states: docs.v30.states,
    maxEvents: docs.v32.maxEvents,
    policyC: {
      label: docs.v30.judgment.label,
      anchor: docs.v30.judgment.anchor,
      window: {
        n: policy.n,
        buyHold: policy.allHold,
        policyC: policy.policyC,
        sacrifice: policy.opportunityCost,
        breakEvenLambda: docs.v30.breakEven.window.lambda,
      },
      tails: {
        "10": {
          hold: windowMatrix["10"].holdTail,
          policy: windowMatrix["10"].policyTail,
          reductionPp: windowMatrix["10"].reductionPp,
          precision: windowMatrix["10"].precision,
          recall: windowMatrix["10"].recall,
          falseSellRate: windowMatrix["10"].falseSellRate,
          trueCount: windowMatrix["10"].trueCount,
          falseCount: windowMatrix["10"].falseCount,
        },
        "20": {
          hold: windowMatrix["20"].holdTail,
          policy: windowMatrix["20"].policyTail,
          reductionPp: windowMatrix["20"].reductionPp,
          precision: windowMatrix["20"].precision,
          recall: windowMatrix["20"].recall,
          falseSellRate: windowMatrix["20"].falseSellRate,
          trueCount: windowMatrix["20"].trueCount,
          falseCount: windowMatrix["20"].falseCount,
          holdCount: windowMatrix["20"].counts.holdTails,
          policyCount: windowMatrix["20"].counts.policyTails,
        },
      },
      tickerReturnGap: {
        baseline: docs.v30.ticker.returnGap.baseline,
        min: docs.v30.ticker.returnGap.min,
        max: docs.v30.ticker.returnGap.max,
        signFlips: docs.v30.ticker.returnGap.signFlips.length,
      },
    },
    reentry: {
      label: docs.v31.judgment.label,
      opposed: docs.v31.judgment.opposed,
      cleared: docs.v31.judgment.cleared,
      scenarios: reentry,
    },
    hold,
    holdLabel: docs.v32.judgment,
    independence: {
      label: docs.v33.judgment.label,
      cleared: docs.v33.judgment.cleared,
      steps: independence,
      models: ["M0", "M1", "M2", "M3", "M4"].map((id) => ({
        id,
        inSampleR2: docs.v33.models[id].inSample.r2,
        test50: docs.v33.models[id].splits["50"].test.r2,
        test60: docs.v33.models[id].splits["60"].test.r2,
        test70: docs.v33.models[id].splits["70"].test.r2,
      })),
    },
    opportunity: {
      label: docs.v29.judgment.label,
      avoided: net.avoided.mean,
      missed: net.missed.mean,
      net: net.net.mean,
      lossCapture: net.capture.lossCapture,
      gainSacrifice: net.capture.gainSacrifice,
    },
    storedLabels: {
      v19: docs.v19?.judgment?.label ?? null,
      v20: docs.v20?.judgment?.label ?? null,
      v24: docs.v24?.judgment?.label ?? null,
      v27Independence: docs.v27?.judgment?.independence?.label ?? null,
      v27Decision: docs.v27?.judgment?.decision?.label ?? null,
      v28: docs.v28?.judgment?.label ?? null,
      v28Note: docs.v28?.note ?? null,
      v29: docs.v29.judgment.label,
      v30: docs.v30.judgment.label,
      v31: docs.v31.judgment.label,
      v32: docs.v32.judgment.label,
      v33: docs.v33.judgment.label,
    },
    gates,
    judgment,
  }
}
