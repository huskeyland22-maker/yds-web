/**
 * P2-20 / P2-32 — daily_ai_reports client + DB status → official_panic_score
 */
import { describe, expect, it } from "vitest"
import {
  dailyReportToClient,
  resolveStoredDailyPanicScoreContract,
} from "../../../api/_lib/dailyAiReports.js"
import { createDailyReport } from "../../../api/_lib/dailyReportEngine.js"
import { reportMetricsFromDeskReport } from "./resolveLatestPanicMetrics.js"

describe("resolveStoredDailyPanicScoreContract", () => {
  it("marks numeric stored scores as stored_unverified (cannot prove Official)", () => {
    const c = resolveStoredDailyPanicScoreContract(48)
    expect(c.panic_score).toBe(48)
    expect(c.panic_score_status).toBe("stored_unverified")
    expect(c.official_panic_score).toBeNull()
  })

  it("does not treat stored 50 as certified Official", () => {
    const c = resolveStoredDailyPanicScoreContract(50)
    expect(c.panic_score).toBe(50)
    expect(c.panic_score_status).toBe("stored_unverified")
    expect(c.official_panic_score).toBeNull()
  })

  it("marks null/empty as absent", () => {
    expect(resolveStoredDailyPanicScoreContract(null).panic_score_status).toBe("absent")
    expect(resolveStoredDailyPanicScoreContract(undefined).panic_score_status).toBe("absent")
    expect(resolveStoredDailyPanicScoreContract("").panic_score_status).toBe("absent")
    expect(resolveStoredDailyPanicScoreContract(null).official_panic_score).toBeNull()
  })

  it("DB ok + finite 0..100 → official_panic_score number", () => {
    const c = resolveStoredDailyPanicScoreContract(42, "ok")
    expect(c.panic_score).toBe(42)
    expect(c.panic_score_status).toBe("ok")
    expect(c.official_panic_score).toBe(42)
  })

  it("DB stored_unverified / data_insufficient / missing → official null", () => {
    expect(resolveStoredDailyPanicScoreContract(48, "stored_unverified").official_panic_score).toBeNull()
    expect(resolveStoredDailyPanicScoreContract(null, "data_insufficient")).toEqual({
      panic_score: null,
      panic_score_status: "data_insufficient",
      official_panic_score: null,
    })
    expect(resolveStoredDailyPanicScoreContract(42, null).official_panic_score).toBeNull()
  })
})

describe("dailyReportToClient response contract", () => {
  it("date lookup shape: keeps panic_score for compat but adds status + official null", () => {
    const row = dailyReportToClient({
      date: "2026-01-15",
      summary: "s",
      market_view: "패닉지수 48",
      panic_score: 48,
      market_state: "neutral",
      updated_at: "2026-01-15T12:00:00.000Z",
    })
    expect(row.date).toBe("2026-01-15")
    expect(row.panic_score).toBe(48)
    expect(row.panic_score_status).toBe("stored_unverified")
    expect(row.official_panic_score).toBeNull()
    expect(row.market_view).toBe("패닉지수 48")
  })

  it("DB ok certifies official_panic_score; unverified does not", () => {
    const ok = dailyReportToClient({
      date: "2026-01-15",
      summary: "s",
      panic_score: 42,
      panic_score_status: "ok",
    })
    expect(ok.panic_score).toBe(42)
    expect(ok.panic_score_status).toBe("ok")
    expect(ok.official_panic_score).toBe(42)

    const unverified = dailyReportToClient({
      date: "2026-01-15",
      summary: "s",
      panic_score: 42,
      panic_score_status: "stored_unverified",
    })
    expect(unverified.panic_score).toBe(42)
    expect(unverified.official_panic_score).toBeNull()

    const insufficient = dailyReportToClient({
      date: "2026-01-15",
      summary: "s",
      panic_score: 99,
      panic_score_status: "data_insufficient",
    })
    expect(insufficient.panic_score).toBeNull()
    expect(insufficient.panic_score_status).toBe("data_insufficient")
    expect(insufficient.official_panic_score).toBeNull()
  })

  it("list mapping is consistent with single-row mapping", () => {
    const dbRows = [
      { date: "2026-01-15", summary: "a", panic_score: 42, market_view: "패닉 42" },
      { date: "2026-01-14", summary: "b", panic_score: null, market_view: "중립" },
    ]
    const clients = dbRows.map(dailyReportToClient)
    expect(clients[0].panic_score_status).toBe("stored_unverified")
    expect(clients[0].official_panic_score).toBeNull()
    expect(clients[1].panic_score).toBeNull()
    expect(clients[1].panic_score_status).toBe("absent")
    expect(clients[1].official_panic_score).toBeNull()
  })

  it("preserves summary/strategies for backward compatibility", () => {
    const row = dailyReportToClient({
      date: "2026-01-15",
      summary: "요약",
      short_strategy: "단기",
      mid_strategy: "중기",
      long_strategy: "장기",
      panic_score: 42,
    })
    expect(row.summary).toBe("요약")
    expect(row.shortTerm).toBe("단기")
    expect(row.midTerm).toBe("중기")
    expect(row.longTerm).toBe("장기")
  })
})

describe("createDailyReport → upsert payload shape (P2-32)", () => {
  it("Official report carries ok + score for upsertDailyAiReport", () => {
    const report = createDailyReport(
      { vix: 22.22, fearGreed: 27, putCall: 0.71, bofa: 6.6, highYield: 2.82 },
      null,
      "2026-01-15",
    )
    expect(report.panic_score).toBe(42)
    expect(report.panic_score_status).toBe("ok")
  })

  it("insufficient report carries data_insufficient + null score", () => {
    const report = createDailyReport(
      { fearGreed: 45, putCall: 0.9, bofa: 5, highYield: 4 },
      null,
      "2026-01-15",
    )
    expect(report.panic_score).toBeNull()
    expect(report.panic_score_status).toBe("data_insufficient")
  })
})


describe("reportMetricsFromDeskReport respects panic_score_status", () => {
  it("does not promote stored_unverified panic_score into desk metrics", () => {
    const metrics = reportMetricsFromDeskReport({
      date: "2026-01-15",
      market_state: "neutral",
      market_view: "패닉지수 48",
      panic_score: 48,
      panic_score_status: "stored_unverified",
      official_panic_score: null,
    })
    expect(metrics).not.toBeNull()
    expect(metrics.panic_score).toBeNull()
    expect(metrics.panic_score_status).toBe("stored_unverified")
    expect(metrics.official_panic_score).toBeNull()
    expect(metrics.market_view).toBe("패닉지수 48")
  })

  it("uses official_panic_score when provided by a future certified payload", () => {
    const metrics = reportMetricsFromDeskReport({
      date: "2026-01-15",
      panic_score: 48,
      panic_score_status: "stored_unverified",
      official_panic_score: 42,
      market_state: "neutral",
    })
    expect(metrics.panic_score).toBe(42)
    expect(metrics.official_panic_score).toBe(42)
  })
})
