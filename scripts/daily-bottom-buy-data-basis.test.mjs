/**
 * node --test scripts/daily-bottom-buy-data-basis.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formatDailyBottomDataBasis,
  pickDailyBottomAsOfDate,
} from "../vite-project/src/utils/dailyBottomBuyDataBasis.js"

describe("daily bottom buy data basis labels", () => {
  it("live asOfDate display", () => {
    const asOf = pickDailyBottomAsOfDate([
      { symbol: "SMH", asOfDate: null },
      { symbol: "ITA", asOfDate: "2026-09-21" },
    ])
    assert.equal(asOf, "2026-09-21")
    const basis = formatDailyBottomDataBasis({
      asOfDate: asOf,
      source: "api",
      today: "2026-09-22",
    })
    assert.equal(basis.isSnapshot, false)
    assert.equal(basis.line, "기준일 2026-09-21 · 미국장 최근 종가 · 실시간")
    assert.equal(basis.warn, null)
    assert.equal(basis.isStale, false)
  })

  it("snapshot fallback asOfDate display", () => {
    const asOf = pickDailyBottomAsOfDate([{ asOfDate: "2026-09-18", count: 3 }])
    assert.equal(asOf, "2026-09-18")
    const basis = formatDailyBottomDataBasis({
      asOfDate: asOf,
      source: "snapshot",
      today: "2026-09-19",
    })
    assert.equal(basis.isSnapshot, true)
    assert.equal(basis.line, "기준일 2026-09-18 · 최근 저장 데이터")
    assert.equal(basis.warn, "⚠️ 실시간 데이터 연결 실패 · 최근 저장 데이터 표시 중")
  })

  it("uses quality.asOfDate when card.asOfDate is redacted", () => {
    assert.equal(
      pickDailyBottomAsOfDate([{ symbol: "VOO", quality: { asOfDate: "2026-11-17" } }]),
      "2026-11-17",
    )
  })

  it("marks stale live dates with a delay warning", () => {
    const basis = formatDailyBottomDataBasis({
      asOfDate: "2026-10-01",
      source: "api",
      today: "2026-11-18",
    })
    assert.equal(basis.isStale, true)
    assert.ok(basis.warn?.includes("지연"))
  })

  it("does not invent a date when asOfDate is missing", () => {
    assert.equal(pickDailyBottomAsOfDate([{ ok: true }, { asOfDate: "" }]), null)
    const live = formatDailyBottomDataBasis({ asOfDate: null, source: "api" })
    assert.equal(live.line, "미국장 최근 종가 · 실시간")
    assert.doesNotMatch(live.line, /\d{4}-\d{2}-\d{2}/)
    const snap = formatDailyBottomDataBasis({ asOfDate: null, source: "snapshot" })
    assert.equal(snap.line, "최근 저장 데이터")
    assert.doesNotMatch(snap.line, /\d{4}-\d{2}-\d{2}/)
  })
})
