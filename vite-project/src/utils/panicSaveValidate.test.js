import { describe, expect, it } from "vitest"
import {
  coercePanicSavePayload,
  validateCorePanicMetrics,
  validatePanicSavePayload,
  PANIC_CORE_METRIC_SPECS,
} from "./panicSaveValidate.js"
import { getPanicScoreV2, resolvePanicIndexStatus } from "./tradingScores.js"

/** Mirrors api/_lib/panicIndexHistory.preserveWeeklyCoreFields */
function preserveWeekly(row, existing) {
  const out = { ...row }
  if (!existing) return out
  if (out.bofa == null && existing.bofa != null) out.bofa = existing.bofa
  if (out.hy_oas == null && existing.hy_oas != null) out.hy_oas = existing.hy_oas
  return out
}

const TRADE_DATE = "2026-09-15"

const CORE_THREE = {
  tradeDate: TRADE_DATE,
  vix: 17.2,
  fearGreed: 29,
  putCall: 0.91,
}

describe("validateCorePanicMetrics — 핵심 3지표", () => {
  it("core specs are VIX · CNN · Put/Call only", () => {
    expect(PANIC_CORE_METRIC_SPECS.map((s) => s.key)).toEqual([
      "vix",
      "fearGreed",
      "putCall",
    ])
  })

  it("TEST A: VIX+CNN+P/C only → PASS (BofA/HY not required)", () => {
    const core = validateCorePanicMetrics(CORE_THREE)
    expect(core.ok).toBe(true)
    expect(core.missing).toEqual([])
    expect(validatePanicSavePayload(CORE_THREE).ok).toBe(true)
  })

  it("missing one of core 3 → FAIL with missing label", () => {
    const body = { tradeDate: TRADE_DATE, vix: 17.2, fearGreed: 29 }
    const core = validateCorePanicMetrics(body)
    expect(core.ok).toBe(false)
    expect(core.code).toBe("INCOMPLETE_CORE_METRICS")
    expect(core.missing).toContain("Put/Call Ratio")
    expect(core.missing).not.toContain("BofA Bull & Bear")
    expect(core.missing).not.toContain("HY")
  })

  it("TEST B: core 3 + optional BofA/HY → PASS + V2 score from 3 weights", () => {
    const full = { ...CORE_THREE, bofa: 3.5, highYield: 3.2 }
    expect(validateCorePanicMetrics(full).ok).toBe(true)
    expect(validatePanicSavePayload(full).ok).toBe(true)
    const score = getPanicScoreV2(coercePanicSavePayload(full))
    expect(score).toBe(getPanicScoreV2({ vix: 17.2, fearGreed: 29, putCall: 0.91 }))
    expect(resolvePanicIndexStatus(score)?.label).toBeTruthy()
  })

  it("TEST C: BofA/HY null in payload does not overwrite existing weekly values", () => {
    const incoming = {
      date: TRADE_DATE,
      vix: 17.2,
      fear_greed: 29,
      put_call: 0.91,
      bofa: null,
      hy_oas: null,
    }
    const existing = { date: TRADE_DATE, bofa: 4.1, hy_oas: 3.55 }
    const merged = preserveWeekly(incoming, existing)
    expect(merged.bofa).toBe(4.1)
    expect(merged.hy_oas).toBe(3.55)
    expect(merged.vix).toBe(17.2)
  })

  it("legacy VXN/MOVE/SKEW missing does not block when core 3 present", () => {
    const v = validatePanicSavePayload({
      ...CORE_THREE,
      vxn: null,
      move: null,
      skew: null,
    })
    expect(v.ok).toBe(true)
  })
})
