/**
 * node --test scripts/equity-sell-backtest-v4.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { eventIdentity } from "./lib/equity-sell-backtest-v2.mjs"
import {
  SELECTED_STRATEGY,
  comparisonJudgment,
  joinV3Events,
  lockedGroupCheck,
  olsTwo,
  partialSpearman,
  sampleJudgment,
  studentTwoTail,
  summarizeSlice,
  t0Bucket,
} from "./lib/equity-sell-backtest-v4.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

describe("equity sell backtest v4", () => {
  it("keeps a null strategy and the fixed T0 bucket edges", () => {
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(EQUITY_SELL_RESEARCH_UNIVERSE.length, 31)
    assert.equal(t0Bucket(-0.001), "lt0")
    assert.equal(t0Bucket(0), "b0")
    assert.equal(t0Bucket(0.0499), "b0")
    assert.equal(t0Bucket(0.05), "b5")
    assert.equal(t0Bucket(0.1), "b10")
    assert.equal(t0Bucket(0.15), "b15")
    assert.equal(t0Bucket(0.2), "ge20")
    assert.equal(t0Bucket(0.5), "ge20")
  })

  it("keeps the three sample states and a two-stock average", () => {
    assert.equal(sampleJudgment(10), "limited")
    assert.equal(sampleJudgment(9), "withhold")
    assert.equal(sampleJudgment(5), "withhold")
    assert.equal(sampleJudgment(4), "no_conclusion")
    assert.equal(comparisonJudgment(12, 11), "limited")
    assert.equal(comparisonJudgment(12, 6), "withhold")
    assert.equal(comparisonJudgment(12, 3), "no_conclusion")
    const events = [
      { ticker: "AMD", leadershipGroup: "HIGH", t20: 0.3, windowEnd: 0.3, t1: 0.3, t3: 0.3, t5: 0.3, t10: 0.3, t40: 0.3, recovered: true, peakRecovered: false, additionalDrawdown: 0.01, reboundFromLow: 0.1, leadershipScore: 80, t0: 0.1 },
      { ticker: "AMD", leadershipGroup: "HIGH", t20: 0.1, windowEnd: 0.1, t1: 0.1, t3: 0.1, t5: 0.1, t10: 0.1, t40: 0.1, recovered: true, peakRecovered: false, additionalDrawdown: 0.01, reboundFromLow: 0.1, leadershipScore: 80, t0: 0.1 },
      { ticker: "AAPL", leadershipGroup: "LOW", t20: 0, windowEnd: 0, t1: 0, t3: 0, t5: 0, t10: 0, t40: 0, recovered: false, peakRecovered: false, additionalDrawdown: 0.02, reboundFromLow: 0.05, leadershipScore: 10, t0: 0.1 },
    ]
    const summary = summarizeSlice(events)
    assert.equal(summary.stock.all.windowEnd.avg, 10)
    assert.equal(summary.event.all.windowEnd.avg, 13.33)
    assert.equal(summary.stock.HIGH.n, 1)
  })

  it("drops a partial correlation when the control copies the score", () => {
    const pairs = [1, 2, 3, 4, 5, 6].map((value, index) => ({ x: value, y: [2, 1, 4, 3, 6, 5][index], z: value }))
    const partial = partialSpearman(pairs)
    assert.equal(partial.n, 6)
    assert.equal(partial.rho, null)
    const open = partialSpearman([
      { x: 1, y: 1, z: 5 },
      { x: 2, y: 3, z: 1 },
      { x: 3, y: 2, z: 4 },
      { x: 4, y: 5, z: 2 },
      { x: 5, y: 4, z: 3 },
      { x: 6, y: 6, z: 6 },
    ])
    assert.equal(open.n, 6)
    assert.ok(open.rho > -1 && open.rho < 1)
    assert.ok(Math.abs(studentTwoTail(0, 10) - 1) < 1e-9)
    assert.ok(studentTwoTail(2.228, 10) > 0.04 && studentTwoTail(2.228, 10) < 0.06)
  })

  it("recovers a known two-variable line", () => {
    const rows = []
    for (let i = 0; i < 12; i++) {
      const leadership = i
      const t0 = (i % 4) * 1.5
      rows.push({ leadership, t0, y: 1 + 2 * leadership + 3 * t0 })
    }
    const fit = olsTwo(rows)
    assert.equal(fit.n, 12)
    assert.equal(fit.r2, 1)
    assert.equal(fit.coefficients[0].coefficient, 1)
    assert.equal(fit.coefficients[1].coefficient, 2)
    assert.equal(fit.coefficients[2].coefficient, 3)
  })

  it("matches v2 identities and v3 leadership, dates, and path levels", () => {
    const v2 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v2-result.json"), "utf8"))
    const v3 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v3-result.json"), "utf8"))
    const v2Events = v2.events.filter((event) => event.correctionDepth === 0.1)
    const v3Events = v3.events.filter((event) => event.correctionDepth === 0.1)
    const events = joinV3Events(v2Events, v3Events)
    assert.equal(events.length, 494)
    assert.deepEqual(
      events.map((event) => event.eventId),
      v2Events.map((event) => eventIdentity(event).join("|")),
    )
    assert.deepEqual(
      events.map((event) => event.t0Date),
      v3Events.map((event) => event.t0Date),
    )
    const check = lockedGroupCheck(events)
    assert.equal(check.match, true)
    assert.deepEqual(check.counts, { HIGH: 86, MID: 275, LOW: 129, unclassified: 4 })
  })
})
