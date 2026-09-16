import { describe, expect, it } from "vitest"
import {
  coercePanicSavePayload,
  validatePanicSavePayload,
  PANIC_SAVE_REQUIRED_SPECS,
  PANIC_SAVE_OPTIONAL_SPECS,
} from "./panicSaveValidate.js"
import {
  assertPanicSubmitPayloadNumeric,
  normalizePanicSubmitPayload,
} from "./panicDbNumeric.js"
import { getPanicScoreV2, resolvePanicIndexStatus } from "./tradingScores.js"

const TRADE_DATE = "2026-05-19"

/** Production 재현 입력 (legacy 5개 없음) */
const CORE_THREE = {
  tradeDate: TRADE_DATE,
  vix: 17.1,
  fearGreed: 31,
  putCall: 0.91,
}

describe("panicSaveValidate — Panic Index V2 required = 3", () => {
  it("required specs are only VIX · CNN · Cboe Total P/C (+ date)", () => {
    const metricKeys = PANIC_SAVE_REQUIRED_SPECS.filter((s) => s.key !== "tradeDate").map(
      (s) => s.key,
    )
    expect(metricKeys).toEqual(["vix", "fearGreed", "putCall"])
    expect(PANIC_SAVE_OPTIONAL_SPECS.map((s) => s.key)).toEqual([
      "vxn",
      "move",
      "bofa",
      "skew",
      "highYield",
    ])
  })

  it("TEST A: VIX+CNN+P/C → validation PASS, Panic Score 32", () => {
    const body = {
      ...CORE_THREE,
      vxn: null,
      move: null,
      bofa: null,
      skew: null,
      highYield: null,
    }
    const coerced = coercePanicSavePayload(body)
    const validation = validatePanicSavePayload(body)
    expect(validation.ok).toBe(true)
    expect(validation.missing).toEqual([])
    expect(coerced.vix).toBe(17.1)
    expect(coerced.fearGreed).toBe(31)
    expect(coerced.putCall).toBe(0.91)
    expect(coerced.vxn).toBeUndefined()
    expect(coerced.move).toBeUndefined()
    expect(coerced.bofa).toBeUndefined()
    expect(coerced.skew).toBeUndefined()
    expect(coerced.highYield).toBeUndefined()

    const score = getPanicScoreV2(coerced)
    expect(score).toBe(32)
    expect(resolvePanicIndexStatus(score)?.label).toBe("경계")
  })

  it("TEST B: missing P/C → FAIL with Cboe Total P/C", () => {
    const validation = validatePanicSavePayload({
      tradeDate: TRADE_DATE,
      vix: 17.1,
      fearGreed: 31,
      putCall: null,
    })
    expect(validation.ok).toBe(false)
    expect(validation.missing).toContain("Cboe Total P/C")
    expect(validation.error).toMatch(/Cboe Total P\/C/)
  })

  it("TEST C: missing VIX → FAIL with VIX", () => {
    const validation = validatePanicSavePayload({
      tradeDate: TRADE_DATE,
      vix: null,
      fearGreed: 31,
      putCall: 0.91,
    })
    expect(validation.ok).toBe(false)
    expect(validation.missing).toContain("VIX")
    expect(validation.error).toMatch(/VIX/)
  })

  it("TEST D: legacy 5 missing → PASS (does not block save)", () => {
    const validation = validatePanicSavePayload({
      tradeDate: TRADE_DATE,
      vix: 17.1,
      fearGreed: 31,
      putCall: 0.91,
      // explicitly omit vxn/move/bofa/skew/highYield
    })
    expect(validation.ok).toBe(true)
    expect(validation.missing).toEqual([])
    expect(validation.error).toBeUndefined()
  })

  it("TEST E: savePanicMetricsHub / postPanicSave client path with 3 metrics", () => {
    // Mirrors config/api.js postPanicSave + store coerce before submitManualPanicData
    const input = { ...CORE_THREE }
    const storePayload = coercePanicSavePayload(input)
    const storeValidation = validatePanicSavePayload(storePayload)
    expect(storeValidation.ok).toBe(true)

    const normalized = normalizePanicSubmitPayload(storePayload)
    assertPanicSubmitPayloadNumeric(normalized)

    const body = coercePanicSavePayload(
      Object.fromEntries(
        Object.entries(normalized).filter(([, v]) => v !== undefined && v !== null),
      ),
    )
    const postValidation = validatePanicSavePayload(body)
    expect(postValidation.ok).toBe(true)
    expect(body.vix).toBe(17.1)
    expect(body.fearGreed).toBe(31)
    expect(body.putCall).toBe(0.91)
    expect(getPanicScoreV2(body)).toBe(32)
    expect(resolvePanicIndexStatus(32)?.label).toBe("경계")
  })

  it("legacy optional values still coerce when present", () => {
    const coerced = coercePanicSavePayload({
      ...CORE_THREE,
      vxn: 22.5,
      move: 100,
      bofa: 4.2,
      skew: 130,
      highYield: 3.5,
    })
    expect(validatePanicSavePayload(coerced).ok).toBe(true)
    expect(coerced.vxn).toBe(22.5)
    expect(coerced.move).toBe(100)
    expect(coerced.bofa).toBe(4.2)
    expect(coerced.skew).toBe(130)
    expect(coerced.highYield).toBe(3.5)
  })
})
