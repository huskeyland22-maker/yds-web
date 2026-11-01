/**
 * node --test scripts/etf-sell-backtest-v3.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildSellEvents } from "./lib/etf-sell-backtest.mjs"
import {
  RECOVERY_WINDOW,
  SELL_RULES,
  analyzeSymbolV3,
  firstArmedPullback,
  measurePullback,
  simulateArmedTrail,
  summarizePullbacks,
} from "./lib/etf-sell-backtest-v3.mjs"

const FAIL = { rsi14: 50, stochK: 50, bbPctB: 0.5, ma20DevPct: 0 }
const THREE = { rsi14: 30, stochK: 10, bbPctB: 0.5, ma20DevPct: -5 }

function row(i, close, flags = FAIL) {
  const date = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10)
  return { date, close, ...flags }
}

function closesFrom(rows) {
  return rows.map((item) => item.close)
}

function flat(length = 80) {
  return Array.from({ length }, (_, i) => row(i, 100))
}

function hold(rows, from, to, close) {
  for (let i = from; i <= to; i++) rows[i].close = close
}

describe("etf sell backtest v3", () => {
  it("defines the six full-position candidates and the 20-day recovery window", () => {
    assert.deepEqual(
      SELL_RULES.map((rule) => rule.id),
      ["S1", "S2", "S3", "S4", "S5", "S6"],
    )
    assert.equal(RECOVERY_WINDOW, 20)
  })

  it("uses the same episode boundary as v1", () => {
    const rows = flat()
    rows[1] = row(1, 100, THREE)
    rows[2] = row(2, 100, FAIL)
    const v1 = buildSellEvents(rows)
    const v3 = analyzeSymbolV3("SMH", rows)
    assert.equal(v3.events.length, v1.events.length)
    assert.equal(v3.events[0].entryIdx, v1.events[0].entryIdx)
  })

  it("counts a pullback only after the profit close, from the peak seen so far", () => {
    const rows = flat()
    hold(rows, 6, 9, 112)
    rows[10].close = 106.4
    rows[15].close = 112
    const no15 = measurePullback(closesFrom(rows), 1, 60, 0.15, 0.05)
    assert.equal(no15.reached, false)
    rows[25].close = 120
    const hit = measurePullback(closesFrom(rows), 1, 60, 0.1, 0.05)
    assert.equal(hit.reached, true)
    assert.equal(hit.pullback, true)
    assert.equal(hit.pullbackDays, 9)
    assert.equal(Math.round(hit.returnAt * 1000) / 10, 6.4)
    assert.equal(hit.reclaimedWithin20, true)
    assert.equal(hit.daysToReclaim, 5)

    const early = flat()
    early[4].close = 108
    early[6].close = 102.6
    const beforeProfit = firstArmedPullback(closesFrom(early), 1, 60, 0.1, 0.05)
    assert.equal(beforeProfit.reached, false)
    assert.equal(beforeProfit.pullbackIdx, null)
  })

  it("does not move the pullback day when a later close makes a higher peak", () => {
    const base = flat()
    hold(base, 6, 9, 112)
    base[10].close = 106.4
    const laterHigh = base.map((item) => ({ ...item }))
    laterHigh[40].close = 200
    const a = firstArmedPullback(closesFrom(base), 1, 60, 0.1, 0.05)
    const b = firstArmedPullback(closesFrom(laterHigh), 1, 60, 0.1, 0.05)
    assert.equal(a.pullbackIdx, b.pullbackIdx)
    assert.equal(a.peak, 112)
    assert.equal(b.peak, 112)
  })

  it("splits a held dip from a dip that does not reclaim the prior peak within 20 days", () => {
    const recovered = flat()
    hold(recovered, 6, 9, 112)
    recovered[10].close = 106.4
    recovered[15].close = 113
    const failed = flat()
    hold(failed, 6, 9, 112)
    failed[10].close = 106.4
    const summary = summarizePullbacks(0.1, 0.05, [
      measurePullback(closesFrom(recovered), 1, 60, 0.1, 0.05),
      measurePullback(closesFrom(failed), 1, 60, 0.1, 0.05),
    ])
    assert.equal(summary.reached, 2)
    assert.equal(summary.pullbacks, 2)
    assert.equal(summary.aCount, 1)
    assert.equal(summary.bCount, 1)
    assert.equal(summary.aRate, 50)
    assert.equal(summary.bRate, 50)
    assert.equal(summary.aAvgRecoveryDays, 5)
    assert.ok(summary.bAvgExtraDown > 0)
  })

  it("leaves a late pullback out of the 20-day recovery rate", () => {
    const rows = flat(80)
    hold(rows, 40, 49, 112)
    rows[50].close = 106.4
    const late = measurePullback(closesFrom(rows), 1, 60, 0.1, 0.05)
    assert.equal(late.pullback, true)
    assert.equal(late.eligible20, false)
    assert.equal(late.reclaimedWithin20, null)
    assert.equal(late.fwd20, null)
    assert.notEqual(late.fwd5, null)
  })

  it("sells the whole position at the pullback close rather than at the profit close", () => {
    const rows = flat()
    hold(rows, 6, 9, 112)
    rows[10].close = 106.4
    rows[61].close = 100
    const sold = simulateArmedTrail(closesFrom(rows), 1, 60, 0.1, 0.05)
    assert.equal(sold.completed, true)
    assert.equal(sold.holdDays, 9)
    assert.equal(sold.openWeight, 0)
    assert.equal(Math.round(sold.total * 1000) / 10, 6.4)
    const unsold = simulateArmedTrail(closesFrom(flat()), 1, 60, 0.1, 0.05)
    assert.equal(unsold.completed, false)
    assert.equal(unsold.openWeight, 1)
    assert.equal(unsold.total, 0)
  })
})
