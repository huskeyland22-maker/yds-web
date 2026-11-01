/**
 * node --test scripts/buy-signal-repeat-confirm-v2.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConfirmWindows, strategyEntries } from "./lib/buy-signal-repeat-confirm-v1.mjs"
import {
  SELECTED_STRATEGY,
  counterfactualStats,
  entryDecomposition,
  exclusionSets,
  nonOverlappingWindows,
  pairExitSplit,
} from "./lib/buy-signal-repeat-confirm-v2.mjs"

function row(index, count, open, close) {
  return {
    date: `2020-01-${String(index + 1).padStart(2, "0")}`,
    open,
    high: Math.max(open, close),
    low: Math.min(open, close),
    close,
    rsi14: count >= 1 ? 30 : 50,
    stochK: count >= 2 ? 10 : 50,
    bbPctB: count >= 3 ? 0 : 1,
    ma20DevPct: count >= 4 ? -5 : 0,
  }
}

function series() {
  const rows = [
    row(0, 3, 100, 100),
    row(1, 3, 90, 95),
    row(2, 0, 80, 96),
  ]
  for (let index = 3; index < 130; index += 1) rows.push(row(index, 0, 100, 100 + index))
  return rows
}

describe("repeat confirmation v2", () => {
  it("does not select a strategy", () => {
    assert.equal(SELECTED_STRATEGY, null)
  })

  it("separates the drop before entry from the return after entry", () => {
    const rows = series()
    const window = buildConfirmWindows(rows)[0]
    const strategies = strategyEntries(rows, window)
    const first = entryDecomposition(rows, window, strategies.A)
    const second = entryDecomposition(rows, window, strategies.B)
    assert.equal(first.preEntry, 90 / 100 - 1)
    assert.equal(second.preEntry, 80 / 100 - 1)
    assert.equal(first.horizons[20].fromEntry, strategies.A.horizons[20].return)
    assert.ok(Math.abs(first.horizons[20].fromSignalClose - (rows[21].close / 100 - 1)) < 1e-12)
    assert.notEqual(first.horizons[20].fromSignalClose, first.horizons[20].fromEntry)
  })

  it("keeps same-exit and same-hold gaps apart", () => {
    const rows = series()
    const window = { start: 0, strategies: strategyEntries(rows, buildConfirmWindows(rows)[0]) }
    const split = pairExitSplit(rows, window).B[20]
    const exitA = window.strategies.A.fill + 20
    const close = rows[exitA].close
    const expected = close / window.strategies.B.entryPrice - close / window.strategies.A.entryPrice
    assert.ok(Math.abs(split.sameExitAsA - expected) < 1e-12)
    assert.notEqual(split.sameHoldGap, split.sameExitAsA)
  })

  it("tracks a one-hit window as an A opportunity B did not take", () => {
    const rows = [row(0, 3, 100, 100), row(1, 0, 90, 120)]
    for (let index = 2; index < 30; index += 1) rows.push(row(index, 0, 100, 130))
    const window = buildConfirmWindows(rows)[0]
    const wrapped = { symbol: "X", start: window.start, strategies: strategyEntries(rows, window) }
    const report = exclusionSets([wrapped], "B")
    assert.equal(report.reasons.hits_short, 1)
    assert.equal(report.excluded.length, 1)
    const stats = counterfactualStats(report.excluded)
    assert.equal(stats[20].n, 1)
    assert.ok(stats[20].mean > 0)
    assert.equal(wrapped.strategies.B.entered, false)
  })

  it("drops a later window inside the 120-bar gap", () => {
    const windows = [
      { symbol: "X", start: 0 },
      { symbol: "X", start: 10 },
      { symbol: "X", start: 130 },
      { symbol: "Y", start: 5 },
    ]
    assert.deepEqual(nonOverlappingWindows(windows).map((window) => `${window.symbol}:${window.start}`), ["X:0", "X:130", "Y:5"])
  })
})
