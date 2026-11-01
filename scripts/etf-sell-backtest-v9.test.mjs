/**
 * node --test scripts/etf-sell-backtest-v9.test.mjs
 */
import assert from "node:assert/strict"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { locateProfitCorrection } from "./lib/etf-sell-backtest-v6.mjs"
import { observeThrough, outcomesAfter } from "./lib/etf-sell-backtest-v8.mjs"
import { LOCKED_SPEED, furtherDrop } from "./lib/etf-sell-backtest-v9.mjs"
import { speedBucket } from "./lib/etf-sell-backtest-v6.mjs"

function flat(length = 80) {
  return Array.from({ length }, () => 100)
}

describe("etf sell backtest v9", () => {
  it("keeps a later low out of the T+5 group and does not copy the window end into T+20", () => {
    const closes = flat()
    for (let i = 6; i <= 9; i++) closes[i] = 120
    for (let i = 10; i <= 15; i++) closes[i] = 108
    closes[16] = 90
    const located = locateProfitCorrection(closes, 1, 60, 0.1, 0.1)
    const state = observeThrough(closes, located.t0, located.t0Price, located.entry, located.t0 + 5)
    assert.equal(state.additionalMae, 0)
    assert.equal(state.dd3, false)
    assert.ok(furtherDrop(closes, located.t0Price, located.t0 + 5, located.end, state.additionalMae) > 0.05)
    const dipped = flat()
    for (let i = 6; i <= 9; i++) dipped[i] = 120
    for (let i = 10; i <= 15; i++) dipped[i] = 108
    dipped[12] = 108 * 0.97
    dipped[20] = 80
    const touch = observeThrough(dipped, 10, 108, 100, 15)
    assert.ok(touch.additionalMae >= 0.03 && touch.additionalMae < 0.031)
    assert.equal(touch.dd3, true)
    const after = observeThrough(dipped, 10, 108, 100, 20)
    assert.ok(after.additionalMae > touch.additionalMae)
    const late = flat()
    for (let i = 6; i <= 49; i++) late[i] = 120
    late[50] = 108
    for (let i = 51; i <= 61; i++) late[i] = 108
    late[61] = 130
    const locatedLate = locateProfitCorrection(late, 1, 60, 0.1, 0.1)
    const outcomes = outcomesAfter(late, locatedLate, locatedLate.t0 + 5)
    assert.equal(outcomes.t20, null)
    assert.equal(Math.round(outcomes.windowEnd.vsEntry * 100), 30)
  })

  it("uses the locked speed boundaries", () => {
    assert.equal(speedBucket(9, LOCKED_SPEED), "FAST")
    assert.equal(speedBucket(10, LOCKED_SPEED), "NORMAL")
    assert.equal(speedBucket(13, LOCKED_SPEED), "NORMAL")
    assert.equal(speedBucket(14, LOCKED_SPEED), "SLOW")
  })
})
