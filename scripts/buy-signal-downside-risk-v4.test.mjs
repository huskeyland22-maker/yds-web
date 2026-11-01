/**
 * node --test scripts/buy-signal-downside-risk-v4.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  PRIOR_DROP,
  SELECTED_STRATEGY,
  confusion,
  downsideFeatures,
  downsideLabel,
  newLowCount,
  passesPreRegisteredBar,
  ruleCombo,
  rulePrior5,
} from "./lib/buy-signal-downside-risk-v4.mjs"

function bar(close, extra = {}) {
  return {
    open: extra.open ?? close,
    high: extra.high ?? close,
    low: extra.low ?? close,
    close,
    volume: 100,
    rsi14: 30,
    stochK: 10,
    bbPctB: 0,
    ma20DevPct: -5,
  }
}

describe("downside risk v4", () => {
  it("selects no strategy and keeps the pre-registered drop bar", () => {
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(PRIOR_DROP, -0.05)
  })

  it("does not read prices after the signal when building features", () => {
    const rows = []
    for (let index = 0; index < 20; index += 1) rows.push(bar(100 - index, { low: 99 - index }))
    const before = downsideFeatures(rows, 15)
    rows[16] = bar(10, { low: 5 })
    rows[19] = bar(1, { low: 1 })
    assert.deepEqual(downsideFeatures(rows, 15), before)
    assert.equal(before.priorReturn1, rows[15].close / rows[14].close - 1)
    assert.equal(before.volExpanded == null, false)
  })

  it("leaves short history missing instead of filling it", () => {
    const rows = [bar(100), bar(99), bar(98)]
    const features = downsideFeatures(rows, 2)
    assert.equal(features.priorReturn10, null)
    assert.equal(features.priorNewLow10, null)
    assert.equal(features.newLowCount5, null)
    assert.equal(features.volExpanded, null)
    assert.equal(features.closeVsSma50, null)
    assert.equal(ruleCombo(features), null)
  })

  it("counts a new low only against earlier bars", () => {
    const rows = []
    for (let index = 0; index < 12; index += 1) rows.push(bar(100, { low: 100 }))
    rows[10] = bar(90, { low: 80 })
    rows[11] = bar(91, { low: 95 })
    assert.equal(newLowCount(rows, 11, 5), 1)
    assert.equal(downsideFeatures(rows, 11).priorNewLow5, false)
  })

  it("uses the v3 continued-decline label and leaves a short path unlabeled", () => {
    const rows = [bar(100, { low: 100 })]
    for (let index = 1; index <= 10; index += 1) rows.push(bar(96, { low: 90 }))
    assert.equal(downsideLabel(rows, 0), true)
    rows[6] = bar(100, { low: 99 })
    assert.equal(downsideLabel(rows, 0), false)
    assert.equal(downsideLabel([bar(100), bar(90)], 0), null)
  })

  it("calculates precision, recall, and the false-positive rate", () => {
    const events = [
      { downside: true, features: { priorReturn5: -0.1 } },
      { downside: false, features: { priorReturn5: -0.2 } },
      { downside: true, features: { priorReturn5: 0 } },
      { downside: false, features: { priorReturn5: 0.01 } },
      { downside: false, features: { priorReturn5: null } },
    ]
    const score = confusion(events, rulePrior5)
    assert.equal(score.tp, 1)
    assert.equal(score.fp, 1)
    assert.equal(score.fn, 1)
    assert.equal(score.tn, 1)
    assert.equal(score.missing, 1)
    assert.equal(score.precision, 0.5)
    assert.equal(score.recall, 0.5)
    assert.equal(score.falsePositiveRate, 0.5)
    assert.equal(score.baseRate, 0.5)
  })

  it("does not pass the pre-registered bar when precision is only the base rate", () => {
    const score = { n: 40, precision: 0.2, baseRate: 0.2 }
    const performance = {
      all: { t20: { median: 0.01 }, t60: { median: 0.02 } },
      kept: { t20: { median: 0.03 }, t60: { median: 0.04 } },
      excluded: { t20: { median: 0 }, t60: { median: 0.01 } },
    }
    assert.equal(passesPreRegisteredBar(score, performance), false)
  })
})
