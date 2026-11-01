/**
 * Panic score baseline — locks CURRENT getPanicScoreV2 / getFinalScore behavior.
 * Do not mix future Official/null-only goals into these expectations.
 * Fixture numbers were observed from the live functions (not guessed).
 */
import { describe, expect, it } from "vitest"
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { resolveProductionCandidateStage } from "../trading-zone/ydsProductionCandidateV3.js"
import { getFinalScore, getPanicScoreV2, resolvePanicIndexStatus } from "./tradingScores.js"

/** Observed fixture: getPanicScoreV2 → 42 when core 3 are present */
const CORE_COMPLETE = { vix: 22.22, fearGreed: 27, putCall: 0.71 }
const WITH_AUX = { ...CORE_COMPLETE, bofa: 6.6, highYield: 2.82 }

describe("panic score baseline — current V2 / Final contracts", () => {
  describe("B1 — core 3 valid → V2 equals Final", () => {
    it("matches when all five fields are present", () => {
      const v2 = getPanicScoreV2(WITH_AUX)
      const fin = getFinalScore(WITH_AUX)
      expect(v2).toBe(42)
      expect(fin).toBe(42)
      expect(fin).toBe(v2)
    })
  })

  describe("B2 — partial core missing → V2 null, Final finite (Legacy fill)", () => {
    it("missing VIX → V2 null, Final 44", () => {
      const data = { fearGreed: 27, putCall: 0.71, bofa: 6.6, highYield: 2.82 }
      expect(getPanicScoreV2(data)).toBeNull()
      const fin = getFinalScore(data)
      expect(Number.isFinite(fin)).toBe(true)
      expect(fin).toBe(44)
    })

    it("missing Fear & Greed → V2 null, Final 36", () => {
      const data = { vix: 22.22, putCall: 0.71, bofa: 6.6, highYield: 2.82 }
      expect(getPanicScoreV2(data)).toBeNull()
      const fin = getFinalScore(data)
      expect(Number.isFinite(fin)).toBe(true)
      expect(fin).toBe(36)
    })

    it("missing Put/Call → V2 null, Final 48", () => {
      const data = { vix: 22.22, fearGreed: 27, bofa: 6.6, highYield: 2.82 }
      expect(getPanicScoreV2(data)).toBeNull()
      const fin = getFinalScore(data)
      expect(Number.isFinite(fin)).toBe(true)
      expect(fin).toBe(48)
    })
  })

  describe("B3 — all core missing → V2 null, Final Legacy 50", () => {
    it("empty object → Final 50", () => {
      expect(getPanicScoreV2({})).toBeNull()
      expect(getFinalScore({})).toBe(50)
    })

    it("explicit null core fields → Final 50", () => {
      const data = {
        vix: null,
        fearGreed: null,
        putCall: null,
        bofa: null,
        highYield: null,
      }
      expect(getPanicScoreV2(data)).toBeNull()
      expect(getFinalScore(data)).toBe(50)
    })
  })

  describe("B4 — core 3 valid, BofA·HY missing → V2 equals Final", () => {
    it("aux metrics are not required for V2 path", () => {
      const v2 = getPanicScoreV2(CORE_COMPLETE)
      const fin = getFinalScore(CORE_COMPLETE)
      expect(v2).toBe(42)
      expect(fin).toBe(42)
      expect(fin).toBe(v2)
    })
  })

  describe("B9 — null inputs and boundary scores (observed contracts)", () => {
    it("getPanicScoreV2(null|undefined) → null", () => {
      expect(getPanicScoreV2(null)).toBeNull()
      expect(getPanicScoreV2(undefined)).toBeNull()
    })

    it("getFinalScore(null|undefined) throws (no object guard on Legacy path)", () => {
      expect(() => getFinalScore(null)).toThrow(TypeError)
      expect(() => getFinalScore(undefined)).toThrow(TypeError)
    })

    it("status helpers: null / non-finite → null", () => {
      expect(resolvePanicIndexStatus(null)).toBeNull()
      expect(resolvePanicIndexStatus(undefined)).toBeNull()
      expect(resolvePanicIndexStatus(Number.NaN)).toBeNull()
      expect(resolveMacroV1Status(null)).toBeNull()
      expect(resolveMacroV1Status(undefined)).toBeNull()
      expect(resolveMacroV1Status(Number.NaN)).toBeNull()
      expect(resolveProductionCandidateStage(null)).toBeNull()
      expect(resolveProductionCandidateStage(undefined)).toBeNull()
      expect(resolveProductionCandidateStage(Number.NaN)).toBeNull()
    })

    it("boundary 79 / 80 / 81 / 99 / 100 differ by function", () => {
      // Panic Index (resolvePanicIndexStatus): strongFear ≤79 · extremePanic ≥80
      expect(resolvePanicIndexStatus(79)?.id).toBe("strongFear")
      expect(resolvePanicIndexStatus(79)?.label).toBe("강한 공포")
      expect(resolvePanicIndexStatus(80)?.id).toBe("extremePanic")
      expect(resolvePanicIndexStatus(80)?.label).toBe("극심한 패닉")
      expect(resolvePanicIndexStatus(81)?.id).toBe("extremePanic")
      expect(resolvePanicIndexStatus(99)?.id).toBe("extremePanic")
      expect(resolvePanicIndexStatus(100)?.id).toBe("extremePanic")

      // Macro V1 (resolveMacroV1Status): dca ≤80 · panicBuy ≥81
      expect(resolveMacroV1Status(79)?.id).toBe("dca")
      expect(resolveMacroV1Status(79)?.label).toBe("높은 공포")
      expect(resolveMacroV1Status(80)?.id).toBe("dca")
      expect(resolveMacroV1Status(80)?.label).toBe("높은 공포")
      expect(resolveMacroV1Status(81)?.id).toBe("panicBuy")
      expect(resolveMacroV1Status(81)?.label).toBe("극심한 공포")
      expect(resolveMacroV1Status(99)?.id).toBe("panicBuy")
      expect(resolveMacroV1Status(100)?.id).toBe("panicBuy")

      // Production Candidate V3: dca ≤79 · panicBuy 80–99 · historicPanic 100
      expect(resolveProductionCandidateStage(79)?.id).toBe("dca")
      expect(resolveProductionCandidateStage(80)?.id).toBe("panicBuy")
      expect(resolveProductionCandidateStage(81)?.id).toBe("panicBuy")
      expect(resolveProductionCandidateStage(99)?.id).toBe("panicBuy")
      expect(resolveProductionCandidateStage(100)?.id).toBe("historicPanic")
    })
  })
})
