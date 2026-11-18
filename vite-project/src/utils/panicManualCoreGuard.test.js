import { describe, expect, it } from "vitest"
import { omitManualPanicCore } from "../../../api/_lib/panicCollectors.js"
import { rowsFromPanicSnapshot } from "../../../api/_lib/panicMetricsHub.js"
import { preserveFromExistingRows } from "../../../api/_lib/panicPipeline.js"
import {
  panicIndexHistoryDbPayloadFromNormalized,
} from "../../../api/_lib/panicIndexHistoryColumns.js"
import { finalizePanicHistoryRow } from "../../../api/_lib/panicNumeric.js"
import { panicIndexHistoryRowFromSnapshot, normalizePanicPayload } from "../../../api/_lib/panicSnapshot.js"
import { validateCorePanicMetrics } from "../../../api/_lib/panicSaveValidate.js"
import { getPanicScoreV2 } from "./tradingScores.js"

const manual = { vix: 28.2, fearGreed: 20, putCall: 0.8 }
const CORE = ["vix", "fearGreed", "putCall"]

function keysOf(rows) {
  return rows.map((row) => row.metric_key)
}

describe("manual panic core guard", () => {
  it("drops a successful cron quote for the three manual inputs", () => {
    const payload = omitManualPanicCore({
      ...manual,
      vix: 40,
      fearGreed: 5,
      putCall: 1.3,
      vxn: 33,
      move: 90,
      skew: 140,
      highYield: 3.2,
      bofa: 6.6,
      changes: { vix: 1, fearGreed: -2, putCall: 0.1, vxn: 0.4 },
    })
    expect(payload.vix).toBeUndefined()
    expect(payload.fearGreed).toBeUndefined()
    expect(payload.putCall).toBeUndefined()
    expect(payload.changes.vix).toBeUndefined()
    expect(payload.vxn).toBe(33)
    expect(payload.highYield).toBe(3.2)
    expect(payload.bofa).toBe(6.6)

    const rows = rowsFromPanicSnapshot({ ...payload, source: "cron", updatedAt: "2026-11-13T00:00:00.000Z" })
    expect(keysOf(rows).some((key) => CORE.includes(key))).toBe(false)
    expect(rows.find((row) => row.metric_key === "vxn")?.metric_value).toBe(33)
    expect(rows.find((row) => row.metric_key === "bofa")?.metric_value).toBe(6.6)
  })

  it("does not turn a failed cron quote into a null core write", () => {
    const rows = rowsFromPanicSnapshot({
      source: "cron",
      vix: null,
      fearGreed: null,
      putCall: null,
      bofa: 4,
      move: null,
      highYield: 0,
      updatedAt: "2026-11-13T00:00:00.000Z",
    })
    expect(keysOf(rows).some((key) => CORE.includes(key))).toBe(false)
    expect(rows.find((row) => row.metric_key === "bofa")?.metric_value).toBe(4)
    expect(rows.find((row) => row.metric_key === "highYield")?.metric_value).toBe(0)
  })

  it("keeps stored BofA, VXN, and SKEW while leaving the manual core out of the preserve map", () => {
    const preserved = preserveFromExistingRows([
      { metric_key: "vix", metric_value: 28.2 },
      { metric_key: "fearGreed", metric_value: 20 },
      { metric_key: "putCall", metric_value: 0.8 },
      { metric_key: "bofa", metric_value: 6.6 },
      { metric_key: "vxn", metric_value: 25 },
      { metric_key: "skew", metric_value: 140 },
    ])
    expect(preserved).toEqual({ bofa: 6.6, vxn: 25, skew: 140 })
  })

  it("still writes a manual entry, including a later edit on the same date", () => {
    const first = normalizePanicPayload({ ...manual, tradeDate: "2026-11-05" }, { source: "manual" })
    const second = normalizePanicPayload(
      { ...manual, vix: 30, tradeDate: "2026-11-05" },
      { source: "manual" },
    )
    const firstRow = panicIndexHistoryRowFromSnapshot(first)
    const secondRow = panicIndexHistoryRowFromSnapshot(second)
    expect(firstRow.date).toBe("2026-11-05")
    expect(firstRow.vix).toBe(28.2)
    expect(secondRow.date).toBe("2026-11-05")
    expect(secondRow.vix).toBe(30)
    expect(secondRow.fear_greed).toBe(20)
    expect(secondRow.put_call).toBe(0.8)
    expect(validateCorePanicMetrics(second)).toEqual({ ok: true, code: null, missing: [] })

    const saved = rowsFromPanicSnapshot({ ...second, source: "manual" })
    expect(saved.find((row) => row.metric_key === "vix")?.metric_value).toBe(30)
  })

  it("does not put another date or the manual core into a cron history payload", () => {
    const snap = normalizePanicPayload(
      { vxn: 33, highYield: 3.2, bofa: 6.6, tradeDate: "2026-11-13", source: "cron" },
      { source: "cron" },
    )
    const row = panicIndexHistoryDbPayloadFromNormalized(
      finalizePanicHistoryRow(panicIndexHistoryRowFromSnapshot(snap)),
    )
    expect(row.date).toBe("2026-11-13")
    expect(row.vix).toBeUndefined()
    expect(row.fear_greed).toBeUndefined()
    expect(row.put_call).toBeUndefined()
    expect(row.vxn).toBe(33)
    expect(validateCorePanicMetrics(snap).ok).toBe(false)
  })

  it("keeps the V2 score for the staging inputs and the known fixture", () => {
    expect(getPanicScoreV2(manual)).toBe(54)
    expect(getPanicScoreV2({ vix: 22.22, fearGreed: 27, putCall: 0.71 })).toBe(42)
    expect(getPanicScoreV2({ ...manual, bofa: null, highYield: 0, bbbOas: 1.7 })).toBe(54)
  })
})
