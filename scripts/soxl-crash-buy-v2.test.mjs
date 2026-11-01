/**
 * node --test scripts/soxl-crash-buy-v2.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { SELECTED_STRATEGY } from "./lib/soxl-crash-buy-v1.mjs"
import {
  DRAWDOWN_QUANTILE,
  EVAL_START,
  RETURN_QUANTILE,
  SMA_PERIOD,
  TRAIN_END,
  alignSoXlSmh,
  buildFlags,
  buildResearchOrders,
  drawdownAt,
  freezeThresholds,
  quantile,
  smaAt,
} from "./lib/soxl-crash-buy-v2.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function iso(offset) {
  const date = new Date(Date.UTC(2021, 0, 1 + offset))
  return date.toISOString().slice(0, 10)
}

function row(offset, close, smhClose = close) {
  return {
    date: iso(offset),
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
    smhClose,
  }
}

describe("v2 threshold policy", () => {
  it("declares the quantile rule and leaves the strategy unselected", () => {
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(TRAIN_END, "2022-09-30")
    assert.equal(EVAL_START, "2022-10-01")
    assert.equal(SMA_PERIOD, 50)
    assert.equal(DRAWDOWN_QUANTILE, 0.25)
    assert.equal(RETURN_QUANTILE, 0.25)
    assert.equal(quantile([1, 2, 3, 4, 5], 0.25), 2)
  })

  it("does not write v1 results or ETF sell caches", () => {
    const runner = fs.readFileSync(path.join(root, "scripts", "soxl-crash-buy-v2.mjs"), "utf8")
    assert.match(runner, /soxl-crash-buy-v2-result\.json/)
    assert.match(runner, /refusing to write protected cache/)
    assert.equal(runner.match(/writeFileSync\(/g).length, 1)
    assert.match(runner, /writeFileSync\(\s*RESULT_PATH/)
    assert.doesNotMatch(runner, /soxl-crash-buy-v1-result/)
  })

  it("ignores sessions after the train end when freezing thresholds", () => {
    const train = []
    for (let i = 0; i < 80; i++) train.push({ date: iso(i), close: 100 + (i % 5) })
    const quiet = train.concat([{ date: "2022-10-03", close: 100 }, { date: "2022-10-04", close: 100 }])
    const crash = train.concat([{ date: "2022-10-03", close: 20 }, { date: "2022-10-04", close: 10 }])
    const left = freezeThresholds(quiet)
    const right = freezeThresholds(crash)
    assert.equal(left.drawdownMax, right.drawdownMax)
    assert.equal(left.return5Max, right.return5Max)
    assert.equal(left.selectedByReturn, false)
    assert.ok(left.trainDrawdownN > 0)
    assert.ok(left.drawdownMax <= 0)
  })

  it("keeps indicators causal", () => {
    const closes = [10, 11, 12, 13, 9, 8]
    assert.equal(smaAt(closes, 3, 4), (10 + 11 + 12 + 13) / 4)
    assert.equal(smaAt(closes, 2, 4), null)
    assert.equal(drawdownAt(closes, 5, 4), 8 / 13 - 1)
    const prefix = smaAt(closes.slice(0, 4), 3, 4)
    assert.equal(prefix, smaAt(closes, 3, 4))
  })
})

describe("C and D orders", () => {
  const bars = [0, 1, 2, 3].map((i) => row(i, 100))

  it("orders C every ready day and uses -15% only when the trend flag is on", () => {
    const flags = [
      { ready: true, deterioration: false, anticipation: false },
      { ready: true, deterioration: true, anticipation: false },
      { ready: true, deterioration: false, anticipation: true },
      { ready: false, deterioration: true, anticipation: true },
    ]
    const orders = buildResearchOrders(bars, flags, "C", "base")
    assert.equal(orders.length, 3)
    assert.equal(orders[0].factor, 0.9)
    assert.equal(orders[1].factor, 0.85)
    assert.equal(orders[1].limit, 85)
    assert.equal(orders[2].factor, 0.9)
  })

  it("orders D only on anticipation and replaces -10% with -15% when the trend is also weak", () => {
    const flags = [
      { ready: true, deterioration: true, anticipation: false },
      { ready: true, deterioration: false, anticipation: true },
      { ready: true, deterioration: true, anticipation: true },
      { ready: true, deterioration: false, anticipation: false },
    ]
    const orders = buildResearchOrders(bars, flags, "D", "base")
    assert.deepEqual(orders.map((order) => order.factor), [0.9, 0.85])
    assert.equal(orders[0].decisionDate, bars[1].date)
    assert.equal(orders[1].limit, 85)
  })

  it("does not let the next close set the limit", () => {
    const flags = [
      { ready: true, deterioration: false, anticipation: true },
      { ready: true, deterioration: false, anticipation: false },
      { ready: true, deterioration: false, anticipation: false },
      { ready: true, deterioration: false, anticipation: false },
    ]
    const dropped = bars.map((bar, index) => (index === 1 ? { ...bar, open: 50, low: 40, close: 45 } : bar))
    const orders = buildResearchOrders(dropped, flags, "D", "base")
    assert.equal(orders[0].limit, 90)
    assert.equal(orders[0].kind, "gap")
    assert.equal(orders[0].fillPrice, 50)
  })

  it("aligns SOXL and SMH on shared dates", () => {
    const aligned = alignSoXlSmh(
      [
        { date: "2020-01-02", open: 1, high: 1, low: 1, close: 1 },
        { date: "2020-01-03", open: 2, high: 2, low: 2, close: 2 },
      ],
      [{ date: "2020-01-03", close: 9 }],
    )
    assert.equal(aligned.length, 1)
    assert.equal(aligned[0].smhClose, 9)
  })

  it("builds flags from the frozen thresholds without reading a later close", () => {
    const rows = []
    for (let i = 0; i < 60; i++) rows.push(row(i, 100, 100))
    rows.push(row(60, 70, 70))
    const thresholds = { drawdownMax: -0.2, return5Max: -0.1 }
    const flags = buildFlags(rows, thresholds)
    assert.equal(flags[59].ready, true)
    assert.equal(flags[59].deterioration, false)
    assert.equal(flags[60].anticipation, true)
    assert.equal(flags[60].deterioration, true)
    const truncated = buildFlags(rows.slice(0, 60), thresholds)
    assert.equal(truncated[59].deterioration, flags[59].deterioration)
    assert.equal(truncated[59].anticipation, flags[59].anticipation)
  })
})
