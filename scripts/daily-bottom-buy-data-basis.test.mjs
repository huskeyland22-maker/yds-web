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
    const basis = formatDailyBottomDataBasis({ asOfDate: asOf, source: "api" })
    assert.equal(basis.isSnapshot, false)
    assert.equal(basis.line, "기준일 2026-09-21 · 미국장 종가 기준")
    assert.equal(basis.warn, null)
  })

  it("snapshot fallback asOfDate display", () => {
    const asOf = pickDailyBottomAsOfDate([{ asOfDate: "2026-09-18", count: 3 }])
    assert.equal(asOf, "2026-09-18")
    const basis = formatDailyBottomDataBasis({ asOfDate: asOf, source: "snapshot" })
    assert.equal(basis.isSnapshot, true)
    assert.equal(basis.line, "기준일 2026-09-18 · 최근 저장 데이터")
    assert.equal(basis.warn, "시세 연결에 실패해 최근 저장 데이터를 표시합니다.")
  })

  it("does not invent a date when asOfDate is missing", () => {
    assert.equal(pickDailyBottomAsOfDate([{ ok: true }, { asOfDate: "" }]), null)
    const live = formatDailyBottomDataBasis({ asOfDate: null, source: "api" })
    assert.equal(live.line, "미국장 종가 기준")
    assert.doesNotMatch(live.line, /\d{4}-\d{2}-\d{2}/)
    const snap = formatDailyBottomDataBasis({ asOfDate: null, source: "snapshot" })
    assert.equal(snap.line, "최근 저장 데이터")
    assert.doesNotMatch(snap.line, /\d{4}-\d{2}-\d{2}/)
  })
})
