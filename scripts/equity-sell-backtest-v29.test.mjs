/**
 * node --test scripts/equity-sell-backtest-v29.test.mjs
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
  assertSellIdentities,
  assertV18Split,
  attachEarly,
  attachForward,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  auditDecisionLookAhead,
  decisionReturn,
  eventGap,
  judgeSellValue,
  loadOhlcv,
  measureCheckpoint,
  policyAction,
  recoveryPoint,
  recoveryState,
  selectMildEvents,
  sellValue,
  study,
} from "./lib/equity-sell-backtest-v29.mjs"

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

describe("equity sell backtest v29", () => {
  it("splits a T+5 sale into avoided loss and missed gain without reading the future", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const source = fs.readFileSync(new URL("./lib/equity-sell-backtest-v29.mjs", import.meta.url), "utf8")
    assert.equal(source.includes("vite-project"), false)
    const loss = sellValue(-0.08)
    const gain = sellValue(0.12)
    within(loss.avoidedLoss + loss.missedGain, 0.08)
    within(loss.net, loss.avoidedLoss - loss.missedGain)
    within(loss.net, 0.08)
    within(gain.avoidedLoss + gain.missedGain, 0.12)
    within(gain.net, -0.12)
    const soldLoss = eventGap(-0.08, "sell", 0)
    const soldGain = eventGap(0.12, "sell", 0)
    const held = eventGap(0.12, "hold", 0)
    within(soldLoss.gap, soldLoss.avoidedLoss - soldLoss.missedGain)
    within(soldGain.gap, soldGain.avoidedLoss - soldGain.missedGain)
    within(held.gap, 0)
    assert.equal(soldLoss.allSellReturn, 0)
    assert.equal(decisionReturn(0.04, "sell", 0), 0)
    assert.equal(decisionReturn(-0.04, "sell", 0), 0)
    assert.equal(decisionReturn(0.04, "hold", 0), 0.04)
    assert.equal(decisionReturn(0.04, "sell", 0.0025), -0.0025)

    const base = { early: { stateT5: "RECOVERING", t5: { return: 0.02, depth: 0.01 } }, forward: { window: -0.4 } }
    const later = { ...base, forward: { window: 0.4 } }
    assert.equal(policyAction("C", base), policyAction("C", later))
    assert.equal(policyAction("C", base), "hold")
    assert.equal(policyAction("C", { early: { stateT5: "STILL_FALLING", t5: { return: -0.02, depth: 0.04 } } }), "sell")
    assert.equal(policyAction("C", { early: { stateT5: "STABILIZING", t5: { return: 0, depth: 0 } } }), "sell")
    assert.equal(policyAction("P1", base), "hold")

    const closes = [100, 90, 88, 89, 91, 95, 110]
    const t3 = recoveryPoint(measureCheckpoint(closes, 0, 3))
    const t5 = recoveryPoint(measureCheckpoint(closes, 0, 5))
    const state = recoveryState(t3, t5)
    const poisoned = closes.slice()
    poisoned[6] = 40
    const again = recoveryPoint(measureCheckpoint(poisoned, 0, 5))
    assert.equal(recoveryState(recoveryPoint(measureCheckpoint(poisoned, 0, 3)), again), state)
    assert.equal(again.return, t5.return)
    assert.notEqual(poisoned[6] / poisoned[5] - 1, closes[6] / closes[5] - 1)

    const strong = {
      lookAheadViolations: 0,
      recoverN: 53,
      fallN: 46,
      windowSellNetPositive: true,
      t20SellNetPositive: true,
      windowNetCiLow: 0.4,
      windowTailCiLow: 0.4,
      windowNetPositive: 2,
      t20NetPositive: 2,
      windowNetDirection: 2,
      t20NetDirection: 2,
      windowTailReduced: 2,
      t20TailReduced: 2,
      fullTailReduced: true,
    }
    assert.equal(judgeSellValue(strong).label, "매도 의사결정 가치 강하게 지지")
    assert.equal(judgeSellValue({
      ...strong,
      windowSellNetPositive: false,
      t20SellNetPositive: false,
      windowNetCiLow: -1,
      windowNetPositive: 0,
      t20NetPositive: 0,
    }).label, "부분적으로 지지")
    assert.equal(judgeSellValue({
      ...strong,
      windowSellNetPositive: false,
      fullTailReduced: false,
      windowTailReduced: 0,
      t20TailReduced: 0,
      recoverN: 5,
      fallN: 5,
    }).label, "매도 의사결정 가치 확인 실패")
  })

  it("keeps the stored 103 events and the sell identities on every horizon", () => {
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
    const identities = assertSellIdentities(events)
    assert.equal(identities.ok, true)
    assert.ok(identities.maxAbsError <= 1e-10)
    const audit = auditDecisionLookAhead(events, series)
    assert.equal(audit.checked, 103)
    assert.equal(audit.violations, 0)
    const result = study(events, { lookAheadViolations: 0 })
    assert.equal(result.selectedStrategy, null)
    assert.equal(result.policies.window.B.mean, 0)
    assert.equal(result.policies.window.B.avoided.mean, result.path.window.avoided.mean)
    assert.equal(result.policies.window.B.missed.mean, result.path.window.missed.mean)
    assert.ok(Math.abs(result.policies.window.C.net.mean - (result.policies.window.C.mean - result.policies.window.A.mean)) <= 0.02)
    assert.match(result.note, /not a sell rule/i)
    assert.equal(result.identities.maxAbsError <= 1e-10, true)
    assert.equal(result.judgment.label, "부분적으로 지지")
  })
})
