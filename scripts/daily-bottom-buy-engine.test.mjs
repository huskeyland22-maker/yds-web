/**
 * Daily Bottom Buy V1 engine unit tests
 * node --test scripts/daily-bottom-buy-engine.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DAILY_BOTTOM_BUY_ETFS,
  DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1,
  DAILY_BOTTOM_BUY_WATCHLIST,
  DAILY_BOTTOM_THRESHOLDS,
  stageFromCount,
  evaluateBars,
  sortCardsByOpportunity,
  buildEtfCard,
} from "../api/_lib/dailyBottomBuyEngine.js"

const PRODUCT_SIX = ["SMH", "GRID", "IGV", "BOTZ", "CIBR", "VOO"]
const RESEARCH_NINE = ["SMH", "GRID", "QQQ", "IGV", "CIBR", "BOTZ", "ITA", "URA", "IBB"]

describe("daily-bottom-buy V1 product constants", () => {
  it("keeps product six ETFs and frozen thresholds", () => {
    assert.equal(DAILY_BOTTOM_BUY_ETFS.length, 6)
    assert.deepEqual(DAILY_BOTTOM_BUY_ETFS.map((e) => e.symbol), PRODUCT_SIX)
    for (const gone of ["QQQ", "JEPQ", "IBB", "URA", "POWR", "IHE", "XLV", "VTV", "SCHD", "XLE", "ITA", "XLK", "XLF", "XLY"]) {
      assert.ok(!DAILY_BOTTOM_BUY_ETFS.some((e) => e.symbol === gone))
    }
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.stochKMax, 15.4)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.bbPctBMax, 0.01)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })

  it("freezes research V1 nine separately from the product six", () => {
    assert.equal(DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1.length, 9)
    assert.deepEqual(
      DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1.map((e) => e.symbol),
      RESEARCH_NINE,
    )
  })

  it("keeps the screen watchlist identical to the product six without leveraged ETFs", () => {
    const symbols = DAILY_BOTTOM_BUY_WATCHLIST.map((e) => e.symbol)
    assert.deepEqual(symbols, PRODUCT_SIX)
    assert.equal(new Set(symbols).size, symbols.length)
    assert.ok(symbols.includes("GRID") && symbols.includes("VOO") && symbols.includes("CIBR"))
    for (const gone of ["FAS", "LABU", "QQQ", "ITA", "XLE", "POWR"]) {
      assert.ok(!symbols.includes(gone))
    }
  })

  it("maps counts to stages", () => {
    assert.equal(stageFromCount(0).label, "대기")
    assert.equal(stageFromCount(1).label, "대기")
    assert.equal(stageFromCount(2).label, "관심")
    assert.equal(stageFromCount(3).label, "1차 매수")
    assert.equal(stageFromCount(4).label, "강한 저점")
  })

  it("sorts opportunities first", () => {
    const cards = [
      buildEtfCard({ symbol: "A", theme: "a" }, { ok: true, count: 1, stage: stageFromCount(1), flags: {} }),
      buildEtfCard({ symbol: "B", theme: "b" }, { ok: true, count: 4, stage: stageFromCount(4), flags: {} }),
      buildEtfCard({ symbol: "C", theme: "c" }, { ok: true, count: 3, stage: stageFromCount(3), flags: {} }),
      buildEtfCard({ symbol: "D", theme: "d" }, { ok: true, count: 2, stage: stageFromCount(2), flags: {} }),
    ]
    const sorted = sortCardsByOpportunity(cards)
    assert.deepEqual(
      sorted.map((c) => c.symbol),
      ["B", "C", "D", "A"],
    )
  })

  it("evaluates oversold synthetic bars toward higher count", () => {
    const bars = []
    for (let i = 0; i < 40; i++) {
      const c = 100 - i * 1.2
      bars.push({
        date: `2024-01-${String(i + 1).padStart(2, "0")}`,
        open: c,
        high: c * 1.01,
        low: c * 0.99,
        close: c,
      })
    }
    const ev = evaluateBars(bars)
    assert.equal(ev.ok, true)
    assert.ok(ev.rsi14 != null && ev.rsi14 < 40)
    assert.ok(ev.count >= 1)
  })
})
