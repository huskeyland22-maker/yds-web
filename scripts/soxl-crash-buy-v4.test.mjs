/**
 * node --test scripts/soxl-crash-buy-v4.test.mjs
 */
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { SELECTED_STRATEGY } from "./lib/soxl-crash-buy-v1.mjs"
import {
  FROZEN_DRAWDOWN_MAX,
  FROZEN_RETURN5_MAX,
  asReportedFill,
  cdSensitivityFromV3,
  isActualOrderLog,
  touchDependence,
} from "./lib/soxl-crash-buy-v4.mjs"
import { buildV4Result } from "./soxl-crash-buy-v4.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cache = path.join(root, "scripts", ".cache")

function sha(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")
}

describe("SOXL crash-buy v4 audit", () => {
  it("keeps selectedStrategy null and does not adopt a strategy", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const runner = fs.readFileSync(path.join(root, "scripts", "soxl-crash-buy-v4.mjs"), "utf8")
    assert.equal(runner.match(/writeFileSync\(/g).length, 1)
    assert.match(runner, /soxl-crash-buy-v4-result\.json/)
  })

  it("does not label a simulated or incomplete row as an actual fill", () => {
    assert.equal(isActualOrderLog({ actualFill: true, fillPrice: 10, source: "v3" }), false)
    assert.deepEqual(asReportedFill({ actualFill: true, filled: 34 }), {
      actualFill: false,
      evidenceClass: "simulation-or-incomplete",
    })
    assert.equal(
      isActualOrderLog({
        sourceType: "broker-or-user-blotter",
        orderDate: "2024-01-02",
        priorClose: 100,
        limitPrice: 90,
        quantity: 1,
        createdAt: "2024-01-01T21:00:00Z",
        canceledAt: null,
        limitChanges: [],
        fillQuantity: 1,
        averageFillPrice: 90,
        rationale: "stated at the time",
      }),
      false,
    )
  })

  it("copies v3 C/D sensitivity and the frozen thresholds without relabeling fills", () => {
    const protectedPaths = [
      "scripts/lib/soxl-crash-buy-v1.mjs",
      "scripts/soxl-crash-buy-v1.mjs",
      "scripts/.cache/soxl-crash-buy-v1-result.json",
      "scripts/lib/soxl-crash-buy-v2.mjs",
      "scripts/soxl-crash-buy-v2.mjs",
      "scripts/.cache/soxl-crash-buy-v2-result.json",
      "scripts/lib/soxl-crash-buy-v3.mjs",
      "scripts/soxl-crash-buy-v3.mjs",
      "scripts/.cache/soxl-crash-buy-v3-result.json",
    ].map((rel) => path.join(root, rel))
    const before = protectedPaths.map(sha)
    const v2 = JSON.parse(fs.readFileSync(path.join(cache, "soxl-crash-buy-v2-result.json"), "utf8"))
    const v3 = JSON.parse(fs.readFileSync(path.join(cache, "soxl-crash-buy-v3-result.json"), "utf8"))
    const result = buildV4Result(v2, v3, [{ path: "unused", role: "research-result", reason: "test", exists: true }])
    assert.deepEqual(protectedPaths.map(sha), before)
    assert.equal(result.selectedStrategy, null)
    assert.equal(result.adoptsStrategy, false)
    assert.equal(result.actualOrderLogFound, false)
    assert.equal(result.userDescribedPrinciples.verifiedByOrderRecords, false)
    assert.equal(result.thresholds.drawdownMax, FROZEN_DRAWDOWN_MAX)
    assert.equal(result.thresholds.return5Max, FROZEN_RETURN5_MAX)
    assert.equal(result.thresholds.drawdownMax, v2.thresholds.drawdownMax)
    assert.equal(result.thresholds.return5Max, v2.thresholds.return5Max)
    const copied = cdSensitivityFromV3(v3)
    assert.equal(copied.C.base.eval.filled, v3.sensitivity.C.base.eval.filled)
    assert.equal(copied.D.base.eval.filled, v3.sensitivity.D.base.eval.filled)
    assert.equal(copied.D.base.eval.actualFill, false)
    assert.equal(copied.D.conservative.eval.actualFill, false)
    const dependence = touchDependence(copied)
    assert.equal(dependence.actualFillProbability, null)
    assert.equal(dependence.t20BaseN, v3.sensitivity.D.base.eval.horizons["20"].n)
    assert.equal(dependence.t20GapOnlyDeferred, true)
    assert.equal(dependence.baseTouchFills, v3.sensitivity.D.base.eval.touchesFilled)
  })
})
