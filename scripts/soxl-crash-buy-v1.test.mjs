/**
 * node --test scripts/soxl-crash-buy-v1.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import {
  COMMISSION,
  CONSERVATIVE_SLIPPAGE,
  LIMIT_FACTORS,
  PUBLISHED_SOXL_SPLITS,
  SELECTED_STRATEGY,
  assessBars,
  buildOrders,
  buyAndHoldPriceReturn,
  classifyFill,
  confirmSplitAdjustment,
  fillPrice,
  splitsFromChartResult,
  summarizeStrategy,
  withoutOpenSession,
} from "./lib/soxl-crash-buy-v1.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function bar(date, close, extra = {}) {
  return {
    date,
    open: extra.open ?? close,
    high: extra.high ?? Math.max(extra.open ?? close, close, extra.low ?? close),
    low: extra.low ?? Math.min(extra.open ?? close, close),
    close,
    volume: 1,
  }
}

describe("SOXL crash-buy v1 assumptions", () => {
  it("keeps the study unselected and fixes costs before any result", () => {
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(LIMIT_FACTORS.A, 0.9)
    assert.equal(LIMIT_FACTORS.B, 0.85)
    assert.equal(CONSERVATIVE_SLIPPAGE, 0.001)
    assert.equal(COMMISSION, 0)
    assert.deepEqual(
      PUBLISHED_SOXL_SPLITS.map((row) => [row.exDate, row.numerator, row.denominator]),
      [
        ["2015-05-20", 4, 1],
        ["2021-03-02", 15, 1],
      ],
    )
  })

  it("does not target existing ETF caches or sell-study results", () => {
    const runner = fs.readFileSync(path.join(root, "scripts", "soxl-crash-buy-v1.mjs"), "utf8")
    assert.match(runner, /soxl-crash-buy-v1-daily-ohlcv\.json/)
    assert.match(runner, /soxl-crash-buy-v1-result\.json/)
    assert.match(runner, /refusing to write protected cache/)
    assert.doesNotMatch(runner, /etf-sell-backtest-v\d-result/)
    assert.doesNotMatch(runner, /dbb-\$\{/)
  })
})

describe("split adjustment gate", () => {
  it("reads Yahoo split events", () => {
    const splits = splitsFromChartResult({
      events: {
        splits: {
          1: { date: Date.parse("2021-03-02T00:00:00Z") / 1000, numerator: 15, denominator: 1 },
        },
      },
    })
    assert.equal(splits[0].exDate, "2021-03-02")
    assert.equal(splits[0].numerator, 15)
  })

  it("rejects a series that jumps by the split factor", () => {
    const bars = [
      bar("2015-05-19", 40),
      bar("2015-05-20", 10, { open: 10 }),
      bar("2021-03-01", 150),
      bar("2021-03-02", 10, { open: 10 }),
    ]
    const yahoo = [
      { exDate: "2015-05-20", numerator: 4, denominator: 1 },
      { exDate: "2021-03-02", numerator: 15, denominator: 1 },
    ]
    const check = confirmSplitAdjustment(bars, yahoo)
    assert.equal(check.confirmed, false)
  })

  it("accepts continuous prices across both published splits", () => {
    const bars = [
      bar("2015-05-19", 10),
      bar("2015-05-20", 10.2, { open: 10.1 }),
      bar("2021-03-01", 20),
      bar("2021-03-02", 19.4, { open: 19.6 }),
    ]
    const yahoo = [
      { exDate: "2015-05-20", numerator: 4, denominator: 1 },
      { exDate: "2021-03-02", numerator: 15, denominator: 1 },
    ]
    assert.equal(confirmSplitAdjustment(bars, yahoo).confirmed, true)
    assert.equal(confirmSplitAdjustment(bars, []).confirmed, false)
  })

  it("drops a bar from a New York session that is still open", () => {
    const bars = [bar("2026-10-09", 10), bar("2026-10-12", 11)]
    const now = Date.parse("2026-10-12T14:00:00Z")
    const end = Date.parse("2026-10-12T20:00:00Z") / 1000
    const dropped = withoutOpenSession(bars, now, end)
    assert.equal(dropped.dropped, true)
    assert.equal(dropped.bars.length, 1)
    const kept = withoutOpenSession(bars, Date.parse("2026-10-12T21:00:00Z"), end)
    assert.equal(kept.dropped, false)
  })

  it("fails bars with a duplicate date or an extreme unexplained open", () => {
    const duplicate = assessBars([bar("2020-01-02", 10), bar("2020-01-02", 11), bar("2020-01-03", 11)])
    assert.equal(duplicate.ok, false)
    const jump = assessBars([
      bar("2020-01-02", 100),
      bar("2020-01-03", 10, { open: 10 }),
      bar("2020-01-06", 10),
    ])
    assert.equal(jump.ok, false)
  })
})

describe("limit fills", () => {
  it("classifies a gap, a touch, and a miss without using the next close", () => {
    assert.equal(classifyFill({ open: 80, high: 90, low: 70, close: 88 }, 90), "gap")
    assert.equal(classifyFill({ open: 95, high: 96, low: 90, close: 94 }, 90), "touch")
    assert.equal(classifyFill({ open: 95, high: 96, low: 91, close: 94 }, 90), "unfilled")
    assert.equal(fillPrice("base", "gap", { open: 80 }, 90), 80)
    assert.equal(fillPrice("base", "touch", { open: 95 }, 90), 90)
    assert.equal(fillPrice("conservative", "gap", { open: 80 }, 90), 90 * 1.001)
    assert.equal(fillPrice("conservative", "touch", { open: 95 }, 90), null)
  })

  it("sets the limit from the prior close only", () => {
    const bars = [
      bar("2020-01-02", 100, { open: 130, high: 140, low: 90 }),
      bar("2020-01-03", 50, { open: 80, high: 85, low: 40 }),
      bar("2020-01-06", 70),
      bar("2020-01-07", 70),
      bar("2020-01-08", 70),
      bar("2020-01-09", 70),
      bar("2020-01-10", 88),
    ]
    const orders = buildOrders(bars, 0.9, "base")
    assert.equal(orders[0].limit, 90)
    assert.equal(orders[0].kind, "gap")
    assert.equal(orders[0].fillPrice, 80)
    const summary = summarizeStrategy(bars, 0.9, "base")
    assert.equal(summary.horizons["5"].n, 1)
    assert.equal(summary.horizons["5"].mean, 0.1)
    assert.equal(summary.horizons["20"].n, 0)
    assert.equal(summary.horizons["60"].n, 0)
  })

  it("drops touch fills from the conservative sample", () => {
    const bars = [
      bar("2020-01-02", 100),
      bar("2020-01-03", 100, { open: 95, high: 96, low: 90, close: 94 }),
      bar("2020-01-06", 100),
    ]
    const base = buildOrders(bars, 0.9, "base")
    const conservative = buildOrders(bars, 0.9, "conservative")
    assert.equal(base[0].kind, "touch")
    assert.equal(base[0].filled, true)
    assert.equal(conservative[0].kind, "touch")
    assert.equal(conservative[0].filled, false)
    assert.equal(buyAndHoldPriceReturn(bars), 0)
  })
})
