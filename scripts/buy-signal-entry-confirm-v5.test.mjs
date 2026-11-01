/**
 * node --test scripts/buy-signal-entry-confirm-v5.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConfirmWindows } from "./lib/buy-signal-repeat-confirm-v1.mjs"
import {
  CONFIRM_DAYS,
  SELECTED_STRATEGY,
  clusterMedianInterval,
  entryPlans,
  planBoth,
  planLowHold,
  planSmaRecovery,
} from "./lib/buy-signal-entry-confirm-v5.mjs"

function bar(close, extra = {}) {
  return {
    date: extra.date || "2020-01-01",
    open: extra.open ?? close,
    high: extra.high ?? close,
    low: extra.low ?? close,
    close,
    ma20: extra.ma20 ?? close,
    rsi14: extra.count >= 3 ? 30 : 50,
    stochK: extra.count >= 3 ? 10 : 50,
    bbPctB: extra.count >= 3 ? 0 : 1,
    ma20DevPct: extra.count >= 3 ? -5 : 0,
  }
}

function path(signalLow = 90) {
  const rows = [bar(100, { low: signalLow, open: 100, ma20: 110 })]
  for (let step = 1; step <= 8; step += 1) {
    rows.push(bar(101, { low: 95, open: 100 + step, ma20: 110, date: `2020-01-${String(step + 1).padStart(2, "0")}` }))
  }
  for (let step = rows.length; step < 40; step += 1) rows.push(bar(120, { open: 120, ma20: 110 }))
  return rows
}

describe("entry confirmation v5", () => {
  it("selects no strategy and watches five sessions after the signal", () => {
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(CONFIRM_DAYS, 5)
  })

  it("buys the untouched low at the open after the fifth session", () => {
    const rows = path()
    const plan = planLowHold(rows, 0)
    assert.equal(plan.status, "entered")
    assert.equal(plan.fill, 6)
    assert.equal(plan.entryPrice, rows[6].open)
    assert.notEqual(plan.entryPrice, rows[5].close)
  })

  it("fails the low hold when a later low trades below the signal low", () => {
    const rows = path()
    rows[3] = bar(100, { low: 89, open: 100, ma20: 110 })
    assert.equal(planLowHold(rows, 0).status, "failed")
    assert.equal(planLowHold(rows, 0).reason, "broke_low")
    rows[3] = bar(100, { low: 90, open: 100, ma20: 110 })
    assert.equal(planLowHold(rows, 0).status, "entered")
  })

  it("enters the session after the first close above that day's SMA20", () => {
    const rows = path()
    rows[2] = bar(112, { low: 95, open: 108, ma20: 110 })
    const plan = planSmaRecovery(rows, 0)
    assert.equal(plan.fill, 3)
    assert.equal(plan.entryPrice, rows[3].open)
    rows[2] = bar(110, { low: 95, open: 108, ma20: 110 })
    assert.equal(planSmaRecovery(rows, 0).reason, "no_recovery")
  })

  it("does not enter the combined rule before the five-day low hold is finished", () => {
    const rows = path()
    rows[2] = bar(112, { low: 95, open: 108, ma20: 110 })
    const plan = planBoth(rows, 0)
    assert.equal(plan.fill, 6)
    assert.notEqual(plan.fill, 3)
    rows[4] = bar(112, { low: 80, open: 100, ma20: 100 })
    assert.equal(planBoth(rows, 0).status, "failed")
  })

  it("keeps a short remaining series unlabeled", () => {
    const rows = path().slice(0, 4)
    assert.equal(planLowHold(rows, 0).reason, "window_short")
    assert.equal(planSmaRecovery(rows, 0).reason, "window_short")
    const missing = path()
    missing[6] = bar(100, { open: Number.NaN, low: 95, ma20: 110 })
    assert.equal(planLowHold(missing, 0).reason, "open_missing")
  })

  it("does not let a later session change a finished decision", () => {
    const rows = path()
    rows[2] = bar(112, { low: 95, open: 108, ma20: 110 })
    const before = entryPlans(rows, 0)
    rows[9] = bar(50, { low: 40, open: 50, ma20: 80 })
    const after = entryPlans(rows, 0)
    assert.equal(after.B.fill, before.B.fill)
    assert.equal(after.C.fill, before.C.fill)
    assert.equal(after.D.fill, before.D.fill)
    assert.equal(after.B.entryPrice, before.B.entryPrice)
  })

  it("uses one v1 window when the signal stays on", () => {
    const rows = []
    for (let index = 0; index < 8; index += 1) {
      rows.push(bar(100 - index, { date: `2020-01-${String(index + 1).padStart(2, "0")}`, count: index < 3 ? 3 : 0, ma20: 110 }))
    }
    assert.equal(buildConfirmWindows(rows).length, 1)
  })

  it("repeats a ticker bootstrap for the same seed", () => {
    const rows = [
      { symbol: "X", gap: 0.1 },
      { symbol: "Y", gap: -0.2 },
    ]
    const first = clusterMedianInterval(rows, 20, 7)
    const second = clusterMedianInterval(rows, 20, 7)
    assert.deepEqual(first, second)
    assert.equal(first.tickers, 2)
  })
})
