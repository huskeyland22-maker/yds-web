/**
 * node --test scripts/etf-sell-backtest-v7.test.mjs
 */
import assert from "node:assert/strict"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { describeCorrection, locateProfitCorrection } from "./lib/etf-sell-backtest-v6.mjs"
import {
  PATH_CLASS_RULE,
  classifyCell,
  matchesRebound,
  reboundStateBefore,
} from "./lib/etf-sell-backtest-v7.mjs"

const FAIL = { rsi14: 50, stochK: 50, bbPctB: 0.5, ma20DevPct: 0 }

function row(i, close) {
  const date = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10)
  return { date, close, ...FAIL }
}

function flat(length = 80) {
  return Array.from({ length }, (_, i) => row(i, 100))
}

function hold(rows, from, to, close) {
  for (let i = from; i <= to; i++) rows[i].close = close
}

describe("etf sell backtest v7", () => {
  it("keeps the path labels fixed and does not treat a split horizon as a risk path", () => {
    assert.equal(PATH_CLASS_RULE.sellRule, false)
    assert.equal(PATH_CLASS_RULE.minClassN, 10)
    assert.equal(PATH_CLASS_RULE.noConclusionN, 5)
    assert.equal(PATH_CLASS_RULE.peakLowPct, 25)
    assert.equal(PATH_CLASS_RULE.additionalHighPct, 5)
    assert.deepEqual(
      classifyCell({
        n60: 25,
        n20: 20,
        t20Avg: 4,
        t20Win: 60,
        windowEndAvg: 8,
        windowEndWin: 70,
        peakRecovery: 40,
        avgAdditional: 3,
      }).label,
      "RECOVERY-LIKE",
    )
    assert.deepEqual(
      classifyCell({
        n60: 25,
        n20: 20,
        t20Avg: -4,
        t20Win: 40,
        windowEndAvg: -2,
        windowEndWin: 45,
        peakRecovery: 10,
        avgAdditional: 6,
      }).label,
      "RISK-LIKE",
    )
    const mixed = classifyCell({
      n60: 25,
      n20: 20,
      t20Avg: -4,
      t20Win: 40,
      windowEndAvg: 3,
      windowEndWin: 60,
      peakRecovery: 4,
      avgAdditional: 8,
    })
    assert.equal(mixed.label, "MIXED")
    assert.equal(classifyCell({ n60: 9, n20: 9, t20Avg: -4, t20Win: 20, windowEndAvg: -3, windowEndWin: 20, peakRecovery: 0, avgAdditional: 9 }).label, null)
    assert.equal(classifyCell({ n60: 4, n20: 4, t20Avg: -4, t20Win: 20, windowEndAvg: -3, windowEndWin: 20, peakRecovery: 0, avgAdditional: 9 }).no_conclusion, true)
  })

  it("does not treat a rebound printed on the outcome bar as already known", () => {
    const rows = flat()
    hold(rows, 6, 9, 120)
    hold(rows, 10, 30, 108)
    rows[31].close = 113.4
    const described = describeCorrection(rows.map((item) => item.close), locateProfitCorrection(rows.map((item) => item.close), 1, 60, 0.1, 0.1))
    assert.equal(described.event, true)
    assert.equal(described.t0, 10)
    assert.equal(reboundStateBefore(described, described.t0 + 20), "LT5")
    assert.equal(matchesRebound(reboundStateBefore(described, described.end), "GE5"), true)
    assert.equal(matchesRebound(reboundStateBefore(described, described.end), "GE10"), false)
    rows[30].close = 113.4
    const onTheBar = describeCorrection(rows.map((item) => item.close), locateProfitCorrection(rows.map((item) => item.close), 1, 60, 0.1, 0.1))
    assert.equal(reboundStateBefore(onTheBar, onTheBar.t0 + 20), "LT5")
  })
})
