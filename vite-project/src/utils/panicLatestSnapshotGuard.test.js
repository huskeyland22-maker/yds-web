import { describe, expect, it } from "vitest"
import { shouldRefreshLatestPanicSnapshot as apiShouldRefresh } from "../../../api/_lib/panicMetricsHub.js"
import { normalizePanicPayload, panicObjectFromSnapshot } from "../../../api/_lib/panicSnapshot.js"
import { panicIndexHistoryRowFromSnapshot } from "../../../api/_lib/panicSnapshot.js"
import { buildPanicHistoryRow } from "./panicHistoryLocalPersist.js"
import { panicAsOfDate } from "./panicDataFreshness.js"
import {
  coalesceLatestMetrics,
  shouldRefreshLatestPanicSnapshot,
} from "./resolveLatestPanicMetrics.js"
import { getPanicScoreV2 } from "./tradingScores.js"
import { omitManualPanicCore } from "../../../api/_lib/panicCollectors.js"

const latest = { date: "2026-11-05", vix: 28.2, fearGreed: 20, putCall: 0.8, updatedAt: "2026-11-05T12:00:00.000Z" }
const older = { date: "2026-11-01", vix: 40, fearGreed: 5, putCall: 1.3, updatedAt: "2026-11-13T09:00:00.000Z" }

describe("past manual input leaves the latest snapshot", () => {
  it("refreshes the latest snapshot only when the input date is the latest history date", () => {
    expect(apiShouldRefresh("2026-11-05", "2026-11-05")).toBe(true)
    expect(shouldRefreshLatestPanicSnapshot("2026-11-06", "2026-11-05")).toBe(true)
    expect(shouldRefreshLatestPanicSnapshot("2026-11-05", null)).toBe(true)
    expect(apiShouldRefresh("2026-11-01", "2026-11-05")).toBe(false)
    expect(shouldRefreshLatestPanicSnapshot("2026-11-01", "2026-11-05")).toBe(false)
  })

  it("keeps the history date separate from the save timestamp", () => {
    const snap = normalizePanicPayload(
      { ...latest, tradeDate: "2026-11-05", updatedAt: "2026-11-13T13:00:00.000Z" },
      { tradeDate: "2026-11-05" },
    )
    const view = panicObjectFromSnapshot(snap)
    expect(view.date).toBe("2026-11-05")
    expect(view.tradeDate).toBe("2026-11-05")
    expect(view.updatedAt).toBe("2026-11-13T13:00:00.000Z")
    expect(panicAsOfDate(view)).toBe("2026-11-05")
  })

  it("does not mix core metrics from different dates", () => {
    const mixed = coalesceLatestMetrics(
      { date: "2026-11-05", vix: 28.2, updatedAt: "2026-11-13T13:00:00.000Z" },
      { date: "2026-11-01", fearGreed: 20, putCall: 0.8 },
    )
    expect(mixed).toBeNull()
    expect(getPanicScoreV2(mixed)).toBeNull()
  })

  it("scores one same-date snapshot with the existing V2 result", () => {
    const selected = coalesceLatestMetrics(older, latest)
    expect(selected?.date).toBe("2026-11-05")
    expect(selected?.vix).toBe(28.2)
    expect(selected?.fearGreed).toBe(20)
    expect(selected?.putCall).toBe(0.8)
    expect(getPanicScoreV2(selected)).toBe(54)
    expect(getPanicScoreV2({ vix: 22.22, fearGreed: 27, putCall: 0.71 })).toBe(42)
  })

  it("stores a past entry on its own date and leaves the latest local row unchanged", () => {
    const latestRow = buildPanicHistoryRow(latest, "2026-11-05")
    const pastRow = buildPanicHistoryRow(older, "2026-11-01")
    expect(pastRow?.date).toBe("2026-11-01")
    expect(pastRow?.vix).toBe(40)
    expect(latestRow).toEqual({
      date: "2026-11-05",
      vix: 28.2,
      vxn: null,
      fearGreed: 20,
      putCall: 0.8,
      move: null,
      bofa: null,
      skew: null,
      highYield: null,
      hyOas: null,
      panicIndex: null,
    })
    const historyPayload = panicIndexHistoryRowFromSnapshot(
      normalizePanicPayload({ ...older, tradeDate: "2026-11-01" }, { tradeDate: "2026-11-01", source: "manual" }),
    )
    expect(historyPayload.date).toBe("2026-11-01")
    expect(historyPayload.vix).toBe(40)
    expect(historyPayload.date).not.toBe(latestRow?.date)
  })

  it("still omits cron values for the manual core", () => {
    const payload = omitManualPanicCore({ vix: 99, fearGreed: 1, putCall: 1.4, vxn: 33 })
    expect(payload.vix).toBeUndefined()
    expect(payload.fearGreed).toBeUndefined()
    expect(payload.putCall).toBeUndefined()
    expect(payload.vxn).toBe(33)
  })
})
