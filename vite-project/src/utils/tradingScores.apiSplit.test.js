/**
 * Panic score API split — Official / Legacy / Final compatibility wrapper.
 * Object-input contracts must match client tradingScores.js and api/_lib/panicScores.js.
 */
import { describe, expect, it } from "vitest"
import * as server from "../../../api/_lib/panicScores.js"
import {
  getFinalScore,
  getFinalScoreLegacy,
  getLegacyPanicScore,
  getOfficialPanicScore,
  getPanicScoreV2,
} from "./tradingScores.js"

const FULL = { vix: 22.22, fearGreed: 27, putCall: 0.71, bofa: 6.6, highYield: 2.82 }
const CORE_ONLY = { vix: 22.22, fearGreed: 27, putCall: 0.71 }
const PARTIAL_MISS_VIX = { fearGreed: 27, putCall: 0.71, bofa: 6.6, highYield: 2.82 }
const EMPTY = {}

describe("getOfficialPanicScore", () => {
  it("equals V2 on complete core (with or without aux)", () => {
    expect(getOfficialPanicScore(FULL)).toBe(getPanicScoreV2(FULL))
    expect(getOfficialPanicScore(FULL)).toBe(42)
    expect(getOfficialPanicScore(CORE_ONLY)).toBe(getPanicScoreV2(CORE_ONLY))
    expect(getOfficialPanicScore(CORE_ONLY)).toBe(42)
  })

  it("returns null on partial / full core missing and nullish input", () => {
    expect(getOfficialPanicScore(PARTIAL_MISS_VIX)).toBeNull()
    expect(getOfficialPanicScore(EMPTY)).toBeNull()
    expect(getOfficialPanicScore(null)).toBeNull()
    expect(getOfficialPanicScore(undefined)).toBeNull()
  })
})

describe("getLegacyPanicScore", () => {
  it("equals getFinalScoreLegacy and ignores V2 preference", () => {
    expect(getLegacyPanicScore(FULL)).toBe(getFinalScoreLegacy(FULL))
    expect(getLegacyPanicScore(FULL)).toBe(40)
    expect(getLegacyPanicScore(CORE_ONLY)).toBe(getFinalScoreLegacy(CORE_ONLY))
    expect(getLegacyPanicScore(PARTIAL_MISS_VIX)).toBe(getFinalScoreLegacy(PARTIAL_MISS_VIX))
    expect(getLegacyPanicScore(PARTIAL_MISS_VIX)).toBe(44)
    expect(getLegacyPanicScore(EMPTY)).toBe(50)
  })

  it("null/undefined throw TypeError (client Legacy contract)", () => {
    expect(() => getLegacyPanicScore(null)).toThrow(TypeError)
    expect(() => getLegacyPanicScore(undefined)).toThrow(TypeError)
  })
})

describe("getFinalScore compatibility wrapper", () => {
  it("uses Official when core complete", () => {
    expect(getFinalScore(FULL)).toBe(getOfficialPanicScore(FULL))
    expect(getFinalScore(CORE_ONLY)).toBe(getOfficialPanicScore(CORE_ONLY))
    expect(getFinalScore(FULL)).not.toBe(getLegacyPanicScore(FULL))
  })

  it("falls back to Legacy when Official is null", () => {
    expect(getOfficialPanicScore(PARTIAL_MISS_VIX)).toBeNull()
    expect(getFinalScore(PARTIAL_MISS_VIX)).toBe(getLegacyPanicScore(PARTIAL_MISS_VIX))
    expect(getFinalScore(EMPTY)).toBe(50)
  })

  it("null/undefined still throw (unchanged client Final contract)", () => {
    expect(() => getFinalScore(null)).toThrow(TypeError)
    expect(() => getFinalScore(undefined)).toThrow(TypeError)
  })
})

describe("client ↔ server API parity (object inputs)", () => {
  const cases = [
    ["full", FULL],
    ["coreOnly", CORE_ONLY],
    ["partial", PARTIAL_MISS_VIX],
    ["empty", EMPTY],
  ]

  it.each(cases)("%s: Official / Legacy / Final match", (_label, data) => {
    expect(server.getOfficialPanicScore(data)).toBe(getOfficialPanicScore(data))
    expect(server.getLegacyPanicScore(data)).toBe(getLegacyPanicScore(data))
    expect(server.getFinalScore(data)).toBe(getFinalScore(data))
    expect(server.getOfficialPanicScore(data)).toBe(server.getPanicScoreV2(data))
    expect(server.getLegacyPanicScore(data)).toBe(server.getFinalScoreLegacy(data))
  })

  it("nullish: Official matches; Final/Legacy keep per-side null guards", () => {
    expect(getOfficialPanicScore(null)).toBe(server.getOfficialPanicScore(null))
    expect(getOfficialPanicScore(undefined)).toBe(server.getOfficialPanicScore(undefined))
    expect(server.getFinalScore(null)).toBe(50)
    expect(server.getLegacyPanicScore(null)).toBe(50)
    expect(() => getFinalScore(null)).toThrow(TypeError)
    expect(() => getLegacyPanicScore(null)).toThrow(TypeError)
  })
})
