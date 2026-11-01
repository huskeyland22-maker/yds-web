/**
 * node --test scripts/buy-signal-repeat-confirm-v1.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { FROZEN_THRESHOLDS } from "./lib/daily-bottom-split-buy-sim.mjs"
import {
  SELECTED_STRATEGY,
  buildConfirmWindows,
  judgeImprovement,
  strategyEntries,
  thresholdsMatchRequest,
} from "./lib/buy-signal-repeat-confirm-v1.mjs"

function row(index, count, open = 10 + index) {
  return {
    date: `2020-01-${String(index + 1).padStart(2, "0")}`,
    open,
    high: open,
    low: open,
    close: 100,
    rsi14: count >= 1 ? 30 : 50,
    stochK: count >= 2 ? 10 : 50,
    bbPctB: count >= 3 ? 0 : 1,
    ma20DevPct: count >= 4 ? -5 : 0,
  }
}

function pad(rows, extra = 130) {
  const last = rows.length
  for (let i = 0; i < extra; i += 1) rows.push(row(last + i, 0, 20))
  return rows
}

describe("repeat confirmation research", () => {
  it("keeps the frozen thresholds and does not select a strategy", () => {
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(thresholdsMatchRequest(FROZEN_THRESHOLDS), true)
    assert.equal(FROZEN_THRESHOLDS.rsiMax, 36)
    assert.equal(FROZEN_THRESHOLDS.stochKMax, 15.4)
    assert.equal(FROZEN_THRESHOLDS.bbPctBMax, 0.01)
    assert.equal(FROZEN_THRESHOLDS.ma20DevMax, -4.2)
  })

  it("buys the first signal at the next open and waits for later hits", () => {
    const rows = pad([row(0, 3, 10), row(1, 3, 11), row(2, 3, 12), row(3, 0, 13)])
    const windows = buildConfirmWindows(rows)
    assert.equal(windows.length, 1)
    assert.deepEqual(windows[0].hits, [0, 1, 2])
    const entries = strategyEntries(rows, windows[0])
    assert.equal(entries.A.entered, true)
    assert.equal(entries.A.fill, 1)
    assert.equal(entries.A.entryPrice, 11)
    assert.notEqual(entries.A.entryPrice, rows[0].close)
    assert.equal(entries.B.fill, 2)
    assert.equal(entries.B.entryPrice, 12)
    assert.equal(entries.C.fill, 3)
    assert.equal(entries.C.entryPrice, 13)
  })

  it("does not treat a signal six sessions later as the same window", () => {
    const rows = pad([row(0, 3), row(1, 0), row(2, 0), row(3, 0), row(4, 0), row(5, 3)])
    const windows = buildConfirmWindows(rows)
    assert.equal(windows.length, 2)
    assert.equal(strategyEntries(rows, windows[0]).B.entered, false)
    assert.equal(strategyEntries(rows, windows[1]).A.entered, true)
    assert.equal(strategyEntries(rows, windows[1]).A.fill, 6)
  })

  it("counts a drop back to 2/4 and a new 3/4 inside the window", () => {
    const rows = pad([row(0, 3), row(1, 2), row(2, 3)])
    const windows = buildConfirmWindows(rows)
    assert.deepEqual(windows[0].hits, [0, 2])
    assert.equal(strategyEntries(rows, windows[0]).B.entered, true)
    assert.equal(strategyEntries(rows, windows[0]).C.entered, false)
  })

  it("keeps one window when the signal stays on for longer than five days", () => {
    const rows = pad(Array.from({ length: 10 }, (_, index) => row(index, 3)))
    const windows = buildConfirmWindows(rows)
    assert.equal(windows.length, 1)
    assert.equal(windows[0].hits.length, 5)
  })

  it("does not fill a signal on the last bar", () => {
    const rows = [row(0, 0), row(1, 3)]
    const windows = buildConfirmWindows(rows)
    assert.equal(strategyEntries(rows, windows[0]).A.reason, "no_next_bar")
  })

  it("withholds an improvement label when the paired sample is small", () => {
    const thin = {
      60: { n: 10, a: { median: 0.01, mean: 0.01, mddMean: -0.1 }, other: { median: 0.02, mean: 0.02, mddMean: -0.1 }, missedN: 0, missedAMedian: null },
      120: { n: 10, a: { median: 0.01, mean: 0.01, mddMean: -0.1 }, other: { median: 0.02, mean: 0.02, mddMean: -0.1 }, missedN: 0, missedAMedian: null },
    }
    assert.equal(judgeImprovement(thin), "판단 보류")
  })
})
