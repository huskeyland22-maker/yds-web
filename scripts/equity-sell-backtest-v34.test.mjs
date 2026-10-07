/**
 * node --test scripts/equity-sell-backtest-v34.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import {
  SELECTED_STRATEGY,
  adoptionGates,
  judgeSynthesis,
  quoteBaseline,
  synthesize,
} from "./lib/equity-sell-backtest-v34.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const CACHE = path.join(ROOT, "scripts", ".cache")

function load(version) {
  return JSON.parse(fs.readFileSync(path.join(CACHE, `equity-sell-backtest-v${version}-result.json`), "utf8"))
}

describe("equity sell backtest v34", () => {
  it("keeps adoption closed unless every stored gate passes", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const source = fs.readFileSync(new URL("./lib/equity-sell-backtest-v34.mjs", import.meta.url), "utf8")
    assert.equal(source.includes("vite-project"), false)
    assert.equal(source.includes("noThresholdSearch: true"), true)
    assert.equal(source.includes("noNewSellRule: true"), true)
    const blocked = judgeSynthesis({
      lookAheadViolations: 0,
      conflicts: [],
      gates: {
        meanAdvantage: false,
        tail10Improved: true,
        tail20Stable: false,
        reentryOvercome: false,
        oosAdvantage: false,
        tickerRobust: false,
      },
      v31Label: "반대 증거",
      v32Label: "부분적인 보유 확신 신호",
      v33Cleared: 0,
    })
    assert.equal(blocked.adopt, false)
    assert.equal(blocked.recommendation, "연구 종료 — 현재 Buy & Hold 기준을 유지")
    assert.equal(blocked.sellEdge, "반대 증거")
    const open = judgeSynthesis({
      lookAheadViolations: 0,
      conflicts: [],
      gates: {
        meanAdvantage: true,
        tail10Improved: true,
        tail20Stable: true,
        reentryOvercome: true,
        oosAdvantage: true,
        tickerRobust: true,
      },
      v31Label: "반대 증거",
      v32Label: "부분적인 보유 확신 신호",
      v33Cleared: 0,
    })
    assert.equal(open.adopt, true)
    assert.equal(open.recommendation, "연구 종료 — 매도 규칙 채택")
    assert.throws(() => judgeSynthesis({ lookAheadViolations: 1, conflicts: [], gates: {}, v31Label: "", v32Label: "", v33Cleared: 0 }))
    const clash = quoteBaseline(
      { prices: { window: { allHold: 1, n: 99 }, t20: { allHold: 1 }, t40: { allHold: 1 } }, matrix: { window: { "10": { holdTail: 1 }, "20": { holdTail: 1 } } } },
      { levels: { window: { mean: 2, n: 99, tail10: 1, tail20: 1 }, t20: { mean: 1 }, t40: { mean: 1 } } },
      { levels: { window: { mean: 2, n: 99, tail10: 1, tail20: 1 }, t20: {} } },
    )
    assert.equal(clash.conflicts.length, 1)
    assert.equal(clash.conflicts[0].field, "windowMean")
  })

  it("reads the stored results and does not adopt a sell rule", () => {
    const docs = {}
    for (const version of [19, 20, 24, 27, 28, 29, 30, 31, 32, 33]) docs[`v${version}`] = load(version)
    const result = synthesize(docs)
    assert.equal(result.selectedStrategy, null)
    assert.equal(result.rules.readOnly, true)
    assert.equal(result.baseline.conflicts.length, 0)
    assert.equal(result.policyC.window.buyHold, docs.v30.prices.window.allHold)
    assert.equal(result.policyC.window.policyC, docs.v30.prices.window.policyC)
    assert.equal(result.policyC.window.sacrifice, docs.v30.prices.window.opportunityCost)
    assert.equal(result.baseline.window.mean, docs.v32.levels.window.mean)
    assert.equal(result.baseline.window.tail20, docs.v32.levels.window.tail20)
    assert.equal(result.reentry.scenarios.length, 6)
    assert.equal(result.reentry.label, "반대 증거")
    assert.equal(result.holdLabel.full, 0)
    assert.equal(result.independence.cleared, 0)
    assert.equal(result.opportunity.net, docs.v29.policies.window.C.net.mean)
    assert.equal(result.states.STABILIZING, 4)
    assert.ok(result.lookAhead.every((item) => item.violations === 0))
    const gates = adoptionGates(docs)
    assert.equal(gates.meanAdvantage, false)
    assert.equal(gates.reentryOvercome, false)
    assert.equal(result.judgment.adopt, false)
    assert.equal(result.judgment.recommendation, "연구 종료 — 현재 Buy & Hold 기준을 유지")
    assert.equal(result.judgment.sellEdge, "반대 증거")
    assert.equal(result.judgment.holdSignal, "부분 증거")
    assert.equal(result.judgment.riskControl, "증거 부족")
    assert.match(result.note, /not a sell rule/i)
    assert.equal(result.best, undefined)
  })
})
