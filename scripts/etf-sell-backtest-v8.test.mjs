/**
 * node --test scripts/etf-sell-backtest-v8.test.mjs
 */
import assert from "node:assert/strict"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { locateProfitCorrection } from "./lib/etf-sell-backtest-v6.mjs"
import { observeThrough, outcomesAfter } from "./lib/etf-sell-backtest-v8.mjs"

function flat(length = 80) {
  return Array.from({ length }, () => 100)
}

describe("etf sell backtest v8", () => {
  it("does not let a later crash change the T+5 additional-drawdown group", () => {
    const closes = flat()
    for (let i = 6; i <= 9; i++) closes[i] = 120
    for (let i = 10; i <= 15; i++) closes[i] = 108
    closes[16] = 90
    const located = locateProfitCorrection(closes, 1, 60, 0.1, 0.1)
    assert.equal(located.t0, 10)
    const state = observeThrough(closes, located.t0, located.t0Price, located.entry, located.t0 + 5)
    assert.equal(state.dd5, false)
    assert.equal(state.additionalMae, 0)
    const outcomes = outcomesAfter(closes, located, located.t0 + 5)
    assert.ok(outcomes.subsequentDd > 0.1)
    assert.equal(observeThrough(closes, located.t0, located.t0Price, located.entry, located.t0 + 5).dd5, false)
  })

  it("measures the rebound from the low already seen, and keeps a missing T+20 empty", () => {
    const closes = flat()
    for (let i = 6; i <= 9; i++) closes[i] = 120
    closes[10] = 108
    closes[11] = 100
    closes[12] = 106
    closes[15] = 106
    closes[30] = 80
    const early = observeThrough(closes, 10, 108, 100, 15)
    assert.equal(early.reb5, true)
    assert.equal(early.reb7, false)
    assert.equal(early.dd5, true)
    assert.equal(early.rebreak, false)

    closes[13] = 99
    const broken = observeThrough(closes, 10, 108, 100, 13)
    assert.equal(broken.rebreak, true)
    const beforeBreak = observeThrough(closes, 10, 108, 100, 12)
    assert.equal(beforeBreak.rebreak, false)

    const late = flat()
    for (let i = 6; i <= 49; i++) late[i] = 120
    late[50] = 108
    for (let i = 51; i <= 61; i++) late[i] = 108
    late[61] = 130
    const located = locateProfitCorrection(late, 1, 60, 0.1, 0.1)
    const outcomes = outcomesAfter(late, located, located.t0 + 5)
    assert.equal(outcomes.t20, null)
    assert.equal(Math.round(outcomes.windowEnd.vsEntry * 100), 30)
  })
})
