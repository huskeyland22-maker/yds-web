/**
 * node --test scripts/etf-sell-backtest-v4.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildSellEvents } from "./lib/etf-sell-backtest.mjs"
import { firstArmedPullback } from "./lib/etf-sell-backtest-v3.mjs"
import {
  STATE_MACHINES,
  analyzeSymbolV4,
  extendPullback,
  simulateStateMachine,
  summarizeMachine,
  summarizePathGroup,
  thresholdsOf,
} from "./lib/etf-sell-backtest-v4.mjs"

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

const E1 = thresholdsOf(STATE_MACHINES[0])
const E2 = thresholdsOf(STATE_MACHINES[1])

describe("etf sell backtest v4", () => {
  it("keeps eight state machines and the v1 episode boundary", () => {
    assert.deepEqual(
      STATE_MACHINES.map((rule) => rule.id),
      ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8"],
    )
    const rows = flat()
    rows[1] = row(1, 100, THREE)
    rows[2] = row(2, 100, FAIL)
    const v1 = buildSellEvents(rows)
    const v4 = analyzeSymbolV4("SMH", rows)
    assert.equal(v4.events.length, v1.events.length)
    assert.equal(v4.events[0].entryIdx, v1.events[0].entryIdx)
  })

  it("updates the running peak through today, so a new high cannot exit", () => {
    const rows = flat()
    hold(rows, 6, 10, 112)
    const sold = simulateStateMachine(closesFrom(rows), 1, 60, E1)
    assert.notEqual(sold.holdDays, 5)
    assert.ok(sold.holdDays > 9)
    const laterHigh = rows.map((item) => ({ ...item }))
    laterHigh[40].close = 200
    const early = firstArmedPullback(closesFrom(rows), 1, 60, 0.1, 0.05)
    const after = firstArmedPullback(closesFrom(laterHigh), 1, 60, 0.1, 0.05)
    assert.equal(early.pullbackIdx, after.pullbackIdx)
    assert.equal(early.peak, 112)
  })

  it("raises the profit state and does not step back down", () => {
    const rows = flat()
    hold(rows, 6, 9, 125)
    rows[10].close = 112.5
    const sold = simulateStateMachine(closesFrom(rows), 1, 60, E1)
    assert.equal(sold.exited, true)
    assert.equal(sold.state, "p20")
    assert.equal(sold.holdDays, 9)
    assert.equal(Math.round(sold.total * 1000) / 10, 12.5)

    const stillHigh = flat()
    stillHigh[6].close = 125
    hold(stillHigh, 7, 61, 112)
    const held = simulateStateMachine(closesFrom(stillHigh), 1, 60, { p10: 0.05, p15: 0.05, p20: 0.2 })
    assert.equal(held.exited, false)
    assert.equal(held.state, "p20")
  })

  it("uses the current state's peak drawdown, not the entry-price return", () => {
    const rows = flat()
    hold(rows, 6, 7, 112)
    rows[8].close = 112 * 0.94
    hold(rows, 9, 11, 112)
    rows[12].close = 118
    hold(rows, 13, 15, 118)
    rows[16].close = 118 * 0.95
    const early = simulateStateMachine(closesFrom(rows), 1, 60, E1)
    const later = simulateStateMachine(closesFrom(rows), 1, 60, E2)
    assert.equal(early.exited, true)
    assert.equal(early.state, "p10")
    assert.equal(early.holdDays, 7)
    assert.equal(later.exited, true)
    assert.equal(later.state, "p15")
    assert.equal(later.holdDays, 15)
    const ratio = (118 - 118 * 0.95) / 118
    assert.ok(ratio + 1e-9 >= 0.05)
    assert.ok((112 - 112 * 0.94) / 112 + 1e-9 < 0.07)
  })

  it("measures a 20-day reclaim from the pullback peak and marks day 60 when no exit occurs", () => {
    const rows = flat()
    hold(rows, 6, 9, 112)
    rows[10].close = 106.4
    rows[15].close = 120
    const hit = extendPullback(closesFrom(rows), 1, 60, 0.1, 0.05)
    assert.equal(hit.reclaimedWithin20, true)
    assert.equal(hit.daysToReclaim, 5)
    assert.equal(Math.round(hit.extraUpVsPeak * 1000) / 10, 7.1)

    const late = flat(80)
    hold(late, 40, 49, 112)
    late[50].close = 106.4
    const censored = extendPullback(closesFrom(late), 1, 60, 0.1, 0.05)
    assert.equal(censored.eligible20, false)
    assert.equal(censored.reclaimedWithin20, null)

    const open = flat()
    open[61].close = 90
    const marked = simulateStateMachine(closesFrom(open), 1, 60, E1)
    assert.equal(marked.exited, false)
    assert.equal(marked.completed, false)
    assert.equal(marked.state, null)
    assert.equal(marked.holdDays, 60)
    assert.equal(marked.total, -0.1)
    assert.equal(marked.missedUpside, null)
  })

  it("keeps the +10 miss group apart from exits and day-60 marks", () => {
    const groups = summarizePathGroup("miss10", [
      { mae: 0.08, d20: -0.02, d40: -0.04, d60: -0.06, loss5: true, loss10: false, loss15: false, loss20: false },
    ], 2)
    const other = summarizePathGroup("hit10", [
      { mae: 0.01, d20: 0.12, d40: 0.14, d60: 0.16, loss5: false, loss10: false, loss15: false, loss20: false },
    ], 2)
    assert.equal(groups.n, 1)
    assert.equal(groups.rate, 50)
    assert.equal(other.n, 1)
    assert.notEqual(groups.avgD60, other.avgD60)

    const summary = summarizeMachine(STATE_MACHINES[0], [
      { event: {}, outcome: { exited: true, state: "p10", total: 0.064, holdDays: 9, missedUpside: 0.02 } },
      { event: {}, outcome: { exited: false, state: null, total: -0.1, holdDays: 60, missedUpside: null } },
    ])
    assert.equal(summary.exits, 1)
    assert.equal(summary.openCount, 1)
    assert.equal(summary.openNeverArmed, 1)
    assert.equal(summary.exitAvg, 6.4)
    assert.equal(summary.openAvg, -10)
    assert.notEqual(summary.bookAvg, summary.exitAvg)
    assert.equal(summary.exitMix.p10.n, 1)
    assert.equal(summary.exitMix.p15.n, 0)
  })
})
