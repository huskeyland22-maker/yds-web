/**
 * node --test scripts/soxl-crash-buy-v3.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { SELECTED_STRATEGY } from "./lib/soxl-crash-buy-v1.mjs"
import {
  alignSoXlSmh,
  buildFlags,
  freezeThresholds,
  summarizeResearchOrders,
} from "./lib/soxl-crash-buy-v2.mjs"
import {
  FILL_SCENARIOS,
  MIN_COMPARISON_N,
  applyScenario,
  duplicateSessionIndexes,
  holdingAccount,
  horizonAccount,
  regressionMismatches,
  scenarioFillPrice,
  strategyOrders,
  summarizePeriod,
} from "./lib/soxl-crash-buy-v3.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cache = path.join(root, "scripts", ".cache")

function bar(date, close, extra = {}) {
  return {
    date,
    open: extra.open ?? close,
    high: extra.high ?? Math.max(extra.open ?? close, close),
    low: extra.low ?? Math.min(extra.open ?? close, close),
    close,
    volume: 1,
    smhClose: extra.smhClose ?? close,
  }
}

describe("v3 sensitivity rules", () => {
  it("keeps the study unselected and treats extra fills as sensitivity cases", () => {
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(MIN_COMPARISON_N, 10)
    assert.deepEqual(
      FILL_SCENARIOS.map((row) => row.id),
      ["base", "close-through", "gap-only-open", "conservative"],
    )
    const runner = fs.readFileSync(path.join(root, "scripts", "soxl-crash-buy-v3.mjs"), "utf8")
    assert.equal(runner.match(/writeFileSync\(/g).length, 1)
    assert.match(runner, /soxl-crash-buy-v3-result\.json/)
    assert.doesNotMatch(runner, /soxl-crash-buy-v2-result\.json",/)
  })

  it("drops wick touches in steps and does not use the next close as the limit", () => {
    const session = { open: 95, high: 96, low: 89, close: 94 }
    const touch = { kind: "touch", limit: 90 }
    const gap = { kind: "gap", limit: 90 }
    const byId = Object.fromEntries(FILL_SCENARIOS.map((row) => [row.id, row]))
    assert.equal(scenarioFillPrice(session, touch, byId.base), 90)
    assert.equal(scenarioFillPrice(session, touch, byId["close-through"]), null)
    assert.equal(scenarioFillPrice({ ...session, close: 90 }, touch, byId["close-through"]), 90)
    assert.equal(scenarioFillPrice(session, touch, byId["gap-only-open"]), null)
    assert.equal(scenarioFillPrice(session, touch, byId.conservative), null)
    assert.equal(scenarioFillPrice({ open: 80, close: 88 }, gap, byId.base), 80)
    assert.equal(scenarioFillPrice({ open: 80, close: 88 }, gap, byId["gap-only-open"]), 80)
    assert.equal(scenarioFillPrice({ open: 80, close: 88 }, gap, byId.conservative), 90 * 1.001)
  })

  it("does not buy a second position or spend more cash than it has", () => {
    const rows = [0, 1, 2, 3, 4, 5].map((i) => bar(`2024-01-0${i + 1}`, 100))
    rows[1] = bar("2024-01-02", 80, { open: 80 })
    rows[2] = bar("2024-01-03", 90, { open: 70 })
    const orders = [
      { decisionDate: "2024-01-01", sessionIndex: 1, filled: true, fillPrice: 80, kind: "gap" },
      { decisionDate: "2024-01-02", sessionIndex: 2, filled: true, fillPrice: 70, kind: "gap" },
    ]
    const held = holdingAccount(rows, orders, { start: "2024-01-01", end: "2024-01-06" })
    assert.equal(held.fills, 1)
    assert.equal(held.realized, null)
    assert.equal(held.cashNeverNegative, true)
    assert.equal(held.endingCashWeight, 0)
    assert.equal(duplicateSessionIndexes(orders).length, 0)
    assert.throws(() => holdingAccount(rows, [orders[0], { ...orders[0] }], { start: "2024-01-01", end: "2024-01-06" }))
  })

  it("releases accounting cash only after the horizon and not on the release day", () => {
    const rows = [0, 1, 2, 3, 4].map((i) => bar(`2024-02-0${i + 1}`, 100))
    rows[1] = { ...rows[1], close: 80 }
    rows[2] = { ...rows[2], close: 88 }
    rows[4] = { ...rows[4], close: 110 }
    const orders = [
      { decisionDate: "2024-02-01", sessionIndex: 1, filled: true, fillPrice: 80, kind: "gap" },
      { decisionDate: "2024-02-02", sessionIndex: 2, filled: true, fillPrice: 88, kind: "touch" },
      { decisionDate: "2024-02-03", sessionIndex: 4, filled: true, fillPrice: 100, kind: "gap" },
    ]
    const account = horizonAccount(rows, orders, { start: "2024-02-01", end: "2024-02-05" }, 1)
    assert.equal(account.realized, null)
    assert.equal(account.fills, 2)
    assert.equal(account.finalEquity, 1.21)
    assert.equal(account.cashNeverNegative, true)
  })

  it("defers a comparison when the horizon sample is below 10", () => {
    const rows = [0, 1, 2].map((i) => bar(`2024-03-0${i + 1}`, 100))
    const orders = [{ decisionDate: "2024-03-01", sessionDate: "2024-03-02", decisionIndex: 0, sessionIndex: 1, filled: true, fillPrice: 90, kind: "gap", factor: 0.9 }]
    const summary = summarizePeriod(rows, orders, { id: "tiny", start: "2024-03-01", end: "2024-03-03", censorAtEnd: true })
    assert.equal(summary.horizons["20"].comparisonDeferred, true)
    assert.equal(summary.horizons["20"].n, 0)
  })
})

describe("v2 regression", () => {
  it("reproduces frozen thresholds and the v2 evaluation fill statistics", () => {
    const soxl = JSON.parse(fs.readFileSync(path.join(cache, "soxl-crash-buy-v1-daily-ohlcv.json"), "utf8")).bars
    const smh = JSON.parse(fs.readFileSync(path.join(cache, "dbb-smh-daily-ohlcv.json"), "utf8")).bars
    const v2 = JSON.parse(fs.readFileSync(path.join(cache, "soxl-crash-buy-v2-result.json"), "utf8"))
    const rows = alignSoXlSmh(soxl, smh)
    const thresholds = freezeThresholds(rows)
    assert.equal(thresholds.drawdownMax, v2.thresholds.drawdownMax)
    assert.equal(thresholds.return5Max, v2.thresholds.return5Max)
    assert.equal(thresholds.selectedByReturn, false)
    const trainOnly = rows.filter((row) => row.date <= "2022-09-30")
    const fromTrain = freezeThresholds(trainOnly)
    assert.equal(fromTrain.drawdownMax, thresholds.drawdownMax)
    assert.equal(fromTrain.return5Max, thresholds.return5Max)

    const flags = buildFlags(rows, thresholds)
    const orders = strategyOrders(rows, flags)
    const evalPeriod = { id: "eval", start: "2022-10-01", end: "2026-09-30", censorAtEnd: false }
    for (const strategy of ["C", "D", "A", "B"]) {
      const base = summarizePeriod(rows, applyScenario(rows, orders[strategy], FILL_SCENARIOS[0]), evalPeriod)
      const conservativeOrders = applyScenario(rows, orders[strategy], FILL_SCENARIOS[3])
      const conservative = summarizeResearchOrders(rows, conservativeOrders, { start: "2022-10-01" })
      assert.deepEqual(regressionMismatches(base, v2.strategies[strategy].base.eval), [])
      assert.deepEqual(regressionMismatches(conservative, v2.strategies[strategy].conservative.eval), [])
      assert.equal(duplicateSessionIndexes(orders[strategy]).length, 0)
    }
  })
})
