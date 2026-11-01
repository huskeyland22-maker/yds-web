/**
 * P2-14 / P2-32 — live Official gates + panic_score_status RPC payload contract
 */
import { describe, expect, it } from "vitest"
import {
  buildMarketCyclePayload,
  enrichPanicHistoryRow,
} from "../../../api/_lib/marketCycleCompute.js"
import { panicIndexHistoryDbPayloadFromNormalized } from "../../../api/_lib/panicIndexHistoryColumns.js"
import { latestPanicMetricsRowFromSnapshot } from "../../../api/_lib/latestPanicMetrics.js"
import {
  getLegacyPanicScore,
  getOfficialPanicScore,
} from "./tradingScores.js"

const FULL_SNAP = {
  tradeDate: "2026-01-15",
  updatedAt: "2026-01-15T12:00:00.000Z",
  vix: 22.22,
  fearGreed: 27,
  putCall: 0.71,
  bofa: 6.6,
  highYield: 2.82,
  vxn: null,
  move: null,
  skew: null,
}

const EMPTY_SNAP = {
  tradeDate: "2026-01-15",
  updatedAt: "2026-01-15T12:00:00.000Z",
  vix: null,
  fearGreed: null,
  putCall: null,
  bofa: null,
  highYield: null,
  vxn: null,
  move: null,
  skew: null,
}

const PARTIAL_SNAP = {
  ...EMPTY_SNAP,
  fearGreed: 45,
  putCall: 0.9,
  bofa: 5,
  highYield: 4,
}

describe("buildMarketCyclePayload Official gate", () => {
  it("does not store Legacy 50 or call getAction on empty core", () => {
    const data = {
      vix: EMPTY_SNAP.vix,
      fearGreed: EMPTY_SNAP.fearGreed,
      putCall: EMPTY_SNAP.putCall,
      bofa: EMPTY_SNAP.bofa,
      highYield: EMPTY_SNAP.highYield,
    }
    expect(getOfficialPanicScore(data)).toBeNull()
    expect(getLegacyPanicScore(data)).toBe(50)

    const payload = buildMarketCyclePayload(EMPTY_SNAP, null, "test")
    expect(payload.panic_score).toBeNull()
    expect(Object.prototype.hasOwnProperty.call(payload, "panic_score")).toBe(true)
    expect(payload.long_score).toBeNull()
    expect(payload.recommendation).toBeNull()
    expect(payload.panic_score_status).toBe("data_insufficient")
    expect(payload.score_status).toBeUndefined()
  })

  it("does not substitute Legacy when a core metric is missing", () => {
    const data = {
      vix: PARTIAL_SNAP.vix,
      fearGreed: PARTIAL_SNAP.fearGreed,
      putCall: PARTIAL_SNAP.putCall,
      bofa: PARTIAL_SNAP.bofa,
      highYield: PARTIAL_SNAP.highYield,
    }
    expect(getOfficialPanicScore(data)).toBeNull()
    const legacy = getLegacyPanicScore(data)
    expect(Number.isFinite(legacy)).toBe(true)

    const payload = buildMarketCyclePayload(PARTIAL_SNAP, null, "test")
    expect(payload.panic_score).toBeNull()
    expect(payload.panic_score).not.toBe(legacy)
    expect(payload.recommendation).toBeNull()
    expect(payload.panic_score_status).toBe("data_insufficient")
  })

  it("keeps Official score and recommendation when core is complete", () => {
    const data = {
      vix: FULL_SNAP.vix,
      fearGreed: FULL_SNAP.fearGreed,
      putCall: FULL_SNAP.putCall,
      bofa: FULL_SNAP.bofa,
      highYield: FULL_SNAP.highYield,
    }
    const official = getOfficialPanicScore(data)
    expect(official).toBe(42)

    const payload = buildMarketCyclePayload(FULL_SNAP, null, "test")
    expect(payload.panic_score).toBe(official)
    expect(payload.panic_score_status).toBe("ok")
    expect(payload.long_score).toBe(official)
    expect(payload.recommendation).toBeTruthy()
    expect(payload.score_status).toBeUndefined()
  })

  it("keeps short/mid independent of Official clear", () => {
    const full = buildMarketCyclePayload(FULL_SNAP, null, "test")
    const partial = buildMarketCyclePayload(PARTIAL_SNAP, null, "test")
    expect(Number.isFinite(full.short_score) || full.short_score == null).toBe(true)
    expect(Number.isFinite(full.mid_score) || full.mid_score == null).toBe(true)
    // partial may still compute short/mid from available metrics; long follows Official null
    expect(partial.long_score).toBeNull()
    expect(partial.panic_score_status).toBe("data_insufficient")
  })
})

describe("enrichPanicHistoryRow Official gate", () => {
  it("does not invent Legacy strategy/score when Official missing", () => {
    const row = enrichPanicHistoryRow({ date: "2026-01-15" }, PARTIAL_SNAP, null)
    expect(row.panic_score).toBeNull()
    expect(row.strategy).toBeNull()
    expect(row.panic_score_status).toBe("data_insufficient")
  })

  it("does not keep Legacy baseRow.panic_score when Official missing", () => {
    const row = enrichPanicHistoryRow(
      { date: "2026-01-15", panic_score: 48 },
      PARTIAL_SNAP,
      null,
    )
    expect(row.panic_score).toBeNull()
    expect(row.panic_score_status).toBe("data_insufficient")
  })
})

describe("panicIndexHistoryDbPayloadFromNormalized score contract (P2-32)", () => {
  it("Official 42: keeps ok + score through null-filter", () => {
    const payload = panicIndexHistoryDbPayloadFromNormalized({
      date: "2026-01-15",
      vix: 22,
      panic_score: 42,
      panic_score_status: "ok",
      market: "global",
      source: "test",
    })
    expect(payload.panic_score).toBe(42)
    expect(payload.panic_score_status).toBe("ok")
  })

  it("data_insufficient: preserves panic_score null key (not omitted)", () => {
    const payload = panicIndexHistoryDbPayloadFromNormalized({
      date: "2026-01-15",
      vix: 22,
      panic_score: null,
      panic_score_status: "data_insufficient",
      market: "global",
      source: "test",
    })
    expect(Object.prototype.hasOwnProperty.call(payload, "panic_score")).toBe(true)
    expect(payload.panic_score).toBeNull()
    expect(payload.panic_score_status).toBe("data_insufficient")
  })

  it("Legacy number-only: score without status (RPC → stored_unverified)", () => {
    const payload = panicIndexHistoryDbPayloadFromNormalized({
      date: "2026-01-15",
      panic_score: 40,
      market: "global",
      source: "legacy",
    })
    expect(payload.panic_score).toBe(40)
    expect(payload.panic_score_status).toBeUndefined()
  })

  it("accepts legacy score_status alias and maps to panic_score_status", () => {
    const payload = panicIndexHistoryDbPayloadFromNormalized({
      date: "2026-01-15",
      panic_score: null,
      score_status: "data_insufficient",
    })
    expect(payload.panic_score_status).toBe("data_insufficient")
    expect(payload.panic_score).toBeNull()
  })
})

describe("latestPanicMetricsRowFromSnapshot Official gate", () => {
  it("stores null panic_score instead of Legacy 50 when insufficient", () => {
    expect(latestPanicMetricsRowFromSnapshot(EMPTY_SNAP).panic_score).toBeNull()
    expect(latestPanicMetricsRowFromSnapshot(PARTIAL_SNAP).panic_score).toBeNull()
  })

  it("stores Official panic_score when core complete", () => {
    expect(latestPanicMetricsRowFromSnapshot(FULL_SNAP).panic_score).toBe(42)
  })
})

describe("manualFinalScore Official contract", () => {
  it("maps incomplete metrics to null (same rule as panicStore.applyManualPanicData)", () => {
    const resolveManualFinalScore = (next) => {
      const official = getOfficialPanicScore(next)
      return official != null && Number.isFinite(official) ? official : null
    }
    expect(resolveManualFinalScore({})).toBeNull()
    expect(resolveManualFinalScore(PARTIAL_SNAP)).toBeNull()
    expect(resolveManualFinalScore({
      vix: FULL_SNAP.vix,
      fearGreed: FULL_SNAP.fearGreed,
      putCall: FULL_SNAP.putCall,
      bofa: FULL_SNAP.bofa,
      highYield: FULL_SNAP.highYield,
    })).toBe(42)
  })
})
