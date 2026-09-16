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

const FULL_FIVE = {
  tradeDate: TRADE_DATE,
  vix: 17.2,
  fearGreed: 29,
  bofa: 3.5,
  putCall: 0.91,
  highYield: 3.2,
}

describe("validateCorePanicMetrics — history 핵심 5지표", () => {
  it("core specs are VIX · CNN · BofA · P/C · HY", () => {
    expect(PANIC_CORE_METRIC_SPECS.map((s) => s.key)).toEqual([
      "vix",
      "fearGreed",
      "bofa",
      "putCall",
      "highYield",
    ])
  })

  it("TEST A: VIX+P/C+CNN only → FAIL, missing BofA+HY", () => {
    const body = {
      tradeDate: TRADE_DATE,
      vix: 17.2,
      fearGreed: 29,
      putCall: 0.91,
    }
    const core = validateCorePanicMetrics(body)
    expect(core.ok).toBe(false)
    expect(core.code).toBe("INCOMPLETE_CORE_METRICS")
    expect(core.missing).toContain("BofA Bull & Bear")
    expect(core.missing).toContain("HY")
    expect(core.missing).not.toContain("VIX")

    const save = validatePanicSavePayload(body)
    expect(save.ok).toBe(false)
    expect(save.code).toBe("INCOMPLETE_CORE_METRICS")
    expect(save.missing).toEqual(expect.arrayContaining(["BofA Bull & Bear", "HY"]))
  })

  it("TEST B: 5개 모두 → PASS + Panic V2 score still computable", () => {
    const core = validateCorePanicMetrics(FULL_FIVE)
    expect(core.ok).toBe(true)
    expect(validatePanicSavePayload(FULL_FIVE).ok).toBe(true)
    const score = getPanicScoreV2(coercePanicSavePayload(FULL_FIVE))
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

  it("legacy VXN/MOVE/SKEW missing does not block when core 5 present", () => {
    const v = validatePanicSavePayload({
      ...FULL_FIVE,
      vxn: null,
      move: null,
      skew: null,
    })
    expect(v.ok).toBe(true)
  })
})
