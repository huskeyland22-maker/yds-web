/**
 * node --test scripts/equity-sell-backtest-v30.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import {
  SELECTED_STRATEGY,
  assertBaseline,
  assertEventList,
  assertRiskIdentities,
  assertV18Split,
  attachEarly,
  attachForward,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  auditDecisionLookAhead,
  breakEvenLambda,
  classifySells,
  decisionReturn,
  judgeRiskBudget,
  loadOhlcv,
  policyAction,
  selectMildEvents,
  study,
  utilityOf,
} from "./lib/equity-sell-backtest-v30.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

function within(left, right) {
  assert.ok(Math.abs(left - right) <= 1e-10, `${left} drifted from ${right}`)
}

describe("equity sell backtest v30", () => {
  it("keeps the loss limit out of the T+5 decision and solves the break-even penalty", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const source = fs.readFileSync(new URL("./lib/equity-sell-backtest-v30.mjs", import.meta.url), "utf8")
    assert.equal(source.includes("vite-project"), false)
    const rows = [
      { hold: -0.1, action: "sell", policyReturn: 0, sellAllReturn: 0 },
      { hold: 0.2, action: "sell", policyReturn: 0, sellAllReturn: 0 },
      { hold: 0.05, action: "hold", policyReturn: 0.05, sellAllReturn: 0 },
    ]
    const solved = breakEvenLambda(rows)
    within(solved.lambda, 1)
    const gap = rows.reduce((sum, row) => sum + utilityOf(row.policyReturn, solved.lambda) - utilityOf(row.hold, solved.lambda), 0) / rows.length
    within(gap, 0)
    within(utilityOf(-0.1, 0), -0.1)
    within(utilityOf(0, 2), 0)
    const block = classifySells(rows, 0.1)
    assert.equal(block.counts.trueSell + block.counts.falseSell, block.counts.sells)
    assert.equal(block.counts.trueSell, 1)
    assert.equal(block.counts.falseSell, 1)
    assert.equal(block.counts.holdTails - block.counts.policyTails, block.counts.trueSell)
    assert.equal(decisionReturn(0.04, "sell", 0), 0)
    const base = { early: { stateT5: "STILL_FALLING", t5: { return: -0.02, depth: 0.04 } }, forward: { window: -0.2 } }
    const later = { ...base, forward: { window: 0.2 } }
    assert.equal(policyAction("C", base), policyAction("C", later))
    assert.equal(policyAction("C", base), "sell")
    assert.equal(policyAction("C", { early: { stateT5: "RECOVERING", t5: { return: 0.01, depth: 0.01 } } }), "hold")

    const strong = {
      lookAheadViolations: 0,
      recoverN: 53,
      fallN: 46,
      windowReduction10: 10,
      t20Reduction10: 4,
      windowOos10: 2,
      t20Oos10: 2,
      windowTailCiLow10: 1,
      windowPrecision10: 55,
      windowRecall10: 60,
      windowCostPerPp10: 0.3,
      windowLambda: 0.8,
    }
    assert.equal(judgeRiskBudget(strong).label, "위험한도 기반 매도 가치 강하게 지지")
    assert.equal(judgeRiskBudget({ ...strong, windowPrecision10: 20, windowLambda: 1.5 }).label, "위험한도 기반 매도 가치 부분적으로 지지")
    assert.equal(judgeRiskBudget({ ...strong, windowReduction10: 0, windowOos10: 0, recoverN: 5, fallN: 5 }).label, "위험한도 기반 매도 가치 확인 실패")
  })

  it("keeps the stored 103 events and the loss-limit identities", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((row) => row.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const spy = loadSeries("SPY")
    const held = attachHold(attachRegime(attachSplit(selected, series, spy), spy), series)
    const early = attachEarly(attachShape(held, series))
    const events = attachForward(early, series)
    assert.doesNotThrow(() => assertBaseline(events))
    assert.doesNotThrow(() => assertV18Split(events))
    assert.doesNotThrow(() => assertEventList(events))
    assert.equal(events.length, 103)
    assert.equal(events.filter((row) => row.lowDay != null).length, 102)
    assert.equal(events.filter((row) => row.leadershipGroup === "HIGH").length, 15)
    assert.equal(events.filter((row) => row.leadershipGroup === "MID").length, 53)
    assert.equal(events.filter((row) => row.leadershipGroup === "LOW").length, 35)
    assert.equal(events.bandCounts.LOW, 34)
    assert.equal(events.bandCounts.MID, 34)
    assert.equal(events.bandCounts.HIGH, 35)
    assert.equal(events.filter((row) => row.early.stateT5 === "RECOVERING").length, 53)
    assert.equal(events.filter((row) => row.early.stateT5 === "STABILIZING").length, 4)
    assert.equal(events.filter((row) => row.early.stateT5 === "STILL_FALLING").length, 46)
    const identities = assertRiskIdentities(events)
    assert.equal(identities.ok, true)
    assert.ok(identities.maxAbsError <= 1e-10)
    const audit = auditDecisionLookAhead(events, series)
    assert.equal(audit.checked, 103)
    assert.equal(audit.violations, 0)
    const result = study(events, { lookAheadViolations: 0 })
    assert.equal(result.selectedStrategy, null)
    assert.equal(result.prices.window.allSell, 0)
    assert.equal(result.prices.window.n, 99)
    assert.equal(result.prices.t20.n, 103)
    assert.equal(result.matrix.window["10"].counts.trueSell + result.matrix.window["10"].counts.falseSell, result.matrix.window["10"].counts.sells)
    assert.equal(result.costs.window["0.005"].tails["10"].policyTail, result.matrix.window["10"].policyTail)
    assert.equal(result.breakEven.window.utilityGap === 0 || Math.abs(result.breakEven.window.utilityGap) <= 1e-10, true)
    assert.match(result.note, /not a sell rule/i)
    assert.equal(result.rules.anchoredLimit, "-10%")
    assert.equal(result.rules.noRefit, true)
    assert.equal(result.judgment.label, "위험한도 기반 매도 가치 부분적으로 지지")
  })
})
