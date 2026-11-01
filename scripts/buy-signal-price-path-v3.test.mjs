/**
 * node --test scripts/buy-signal-price-path-v3.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConfirmWindows } from "./lib/buy-signal-repeat-confirm-v1.mjs"
import { FROZEN_THRESHOLDS } from "./lib/daily-bottom-split-buy-sim.mjs"
import {
  SELECTED_STRATEGY,
  PATH_RULES,
  classifyPath,
  countSignalDays,
  nextOpenOutcome,
  pathSnapshot,
  predictContinuedDecline,
  priorFeatures,
  signalCloseOutcome,
  thresholdsMatchRequest,
} from "./lib/buy-signal-price-path-v3.mjs"

function bar(close, extra = {}) {
  return {
    date: extra.date || "2020-01-01",
    open: extra.open ?? close,
    high: extra.high ?? close,
    low: extra.low ?? close,
    close,
    volume: extra.volume ?? 100,
    rsi14: extra.count >= 1 ? 30 : 50,
    stochK: extra.count >= 2 ? 10 : 50,
    bbPctB: extra.count >= 3 ? 0 : 1,
    ma20DevPct: 0,
  }
}

function withPath(signal, later) {
  const rows = [signal]
  for (let index = 0; index < 10; index += 1) rows.push(later[index] || bar(signal.close))
  return rows
}

describe("price path v3", () => {
  it("keeps the frozen thresholds and selects no strategy", () => {
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(thresholdsMatchRequest(FROZEN_THRESHOLDS), true)
    assert.equal(PATH_RULES.rebound, 0.05)
    assert.equal(PATH_RULES.dip, -0.05)
  })

  it("measures the low, the high, the low day, and the recovery day in order", () => {
    const rows = withPath(bar(100, { low: 99 }), [
      bar(98, { low: 90, high: 101 }),
      bar(97, { low: 80, high: 102 }),
      bar(99, { low: 96, high: 130 }),
      bar(100, { low: 99, high: 110 }),
    ])
    const snapshot = pathSnapshot(rows, 0)
    assert.equal(snapshot.daysToLow, 2)
    assert.equal(snapshot.maxAdverseLow, 80 / 100 - 1)
    assert.equal(snapshot.maxFavorableHigh, 130 / 100 - 1)
    assert.equal(snapshot.daysToRecover, 4)
    assert.equal(snapshot.closeReturn[1], 98 / 100 - 1)
    assert.equal(snapshot.newLow5, true)
    assert.equal(snapshot.newLow10, true)
  })

  it("applies the fixed type boundaries", () => {
    const quick = withPath(bar(100), [bar(105), bar(101), bar(102), bar(103), bar(104)])
    assert.equal(classifyPath(pathSnapshot(quick, 0)), "C")
    const exactDip = withPath(bar(100, { low: 100 }), Array.from({ length: 10 }, (_, index) => bar(index === 0 ? 95 : 96, { low: 94 })))
    assert.equal(classifyPath(pathSnapshot(exactDip, 0)), "B")
    const rebound = withPath(bar(100), [bar(99), bar(94), bar(96), bar(97), bar(98), bar(100)])
    assert.equal(classifyPath(pathSnapshot(rebound, 0)), "A")
    const flat = withPath(bar(100, { low: 90 }), [bar(101), bar(99), bar(100), bar(100.5), bar(99.5)])
    assert.equal(classifyPath(pathSnapshot(flat, 0)), "D")
  })

  it("marks a short series incomplete and does not fill a missing next open", () => {
    const rows = [bar(100), bar(99), bar(98)]
    assert.equal(pathSnapshot(rows, 0).complete10, false)
    assert.equal(classifyPath(pathSnapshot(rows, 0)), "INCOMPLETE")
    assert.equal(signalCloseOutcome(rows, 0)[20].complete, false)
    rows.push(bar(90, { open: Number.NaN }))
    assert.equal(nextOpenOutcome([bar(100, { date: "2020-01-01" })], 0), null)
  })

  it("does not let prices after the observation window change the type or the prior features", () => {
    const rows = withPath(bar(100), [bar(105), bar(104), bar(103), bar(102), bar(101)])
    for (let index = 0; index < 5; index += 1) rows.unshift(bar(110 - index, { low: 100 }))
    const signal = 5
    const beforeType = classifyPath(pathSnapshot(rows, signal))
    const beforeFeatures = priorFeatures(rows, signal)
    rows.push(bar(50, { low: 40 }))
    rows[signal + 11] = bar(40, { low: 30 })
    assert.equal(classifyPath(pathSnapshot(rows, signal)), beforeType)
    assert.deepEqual(priorFeatures(rows, signal), beforeFeatures)
    assert.equal(beforeFeatures.priorReturn[11], undefined)
  })

  it("counts one window when the signal stays on for consecutive days", () => {
    const rows = []
    for (let index = 0; index < 8; index += 1) {
      rows.push(bar(100 - index, { date: `2020-01-${String(index + 1).padStart(2, "0")}`, count: index < 3 ? 3 : 0 }))
    }
    assert.equal(countSignalDays(rows), 3)
    assert.equal(buildConfirmWindows(rows).length, 1)
  })

  it("uses only the pre-signal drop and a new low for the decline flag", () => {
    const rows = []
    for (let index = 0; index < 6; index += 1) rows.push(bar(100 - index * 2, { low: 99 - index * 2 }))
    const features = priorFeatures(rows, 5)
    assert.equal(features.priorReturn[5] <= -0.05, true)
    assert.equal(features.priorNewLow5, true)
    assert.equal(predictContinuedDecline(features), true)
    features.priorNewLow5 = false
    assert.equal(predictContinuedDecline(features), false)
  })
})
