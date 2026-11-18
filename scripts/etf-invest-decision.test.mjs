/**
 * Phase E/F invest decision classification (presentation only)
 * node --test scripts/etf-invest-decision.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { pathToFileURL } from "node:url"
import path from "node:path"

const modUrl = pathToFileURL(
  path.resolve("vite-project/src/content/ydsEtfInvestDecision.js"),
).href
const {
  classifyEtfInvestDecision,
  describeQualityHighlights,
  formatEtfDbbStatusLabel,
  getEtfDbbComputeStatus,
  groupCardsByInvestDecision,
  isEtfDbbBuyReady,
  isEtfPriceStale,
  isEtfQualityStrong,
} = await import(modUrl)

const basisUrl = pathToFileURL(
  path.resolve("vite-project/src/utils/dailyBottomBuyDataBasis.js"),
).href
const { formatDailyBottomDataBasis, pickDailyBottomAsOfDate } = await import(basisUrl)

describe("etf invest decision (Phase E/F)", () => {
  it("does not treat pending quality as strong", () => {
    assert.equal(
      isEtfQualityStrong({
        qualityStatus: "pending",
        qualityGrade: null,
        qualityScore: null,
        ok: true,
        count: 4,
      }),
      false,
    )
  })

  it("treats A/B scored quality as strong only", () => {
    assert.equal(isEtfQualityStrong({ qualityStatus: "scored", qualityGrade: "A", qualityScore: 82 }), true)
    assert.equal(isEtfQualityStrong({ qualityStatus: "scored", qualityGrade: "B", qualityScore: 70 }), true)
    assert.equal(isEtfQualityStrong({ qualityStatus: "scored", qualityGrade: "C", qualityScore: 55 }), false)
  })

  it("uses unchanged 3-of-4 DBB buy-ready rule", () => {
    assert.equal(isEtfDbbBuyReady({ ok: true, count: 3, asOfDate: "2026-11-17" }, { today: "2026-11-18" }), true)
    assert.equal(isEtfDbbBuyReady({ ok: true, count: 2, asOfDate: "2026-11-17" }, { today: "2026-11-18" }), false)
    assert.equal(isEtfDbbBuyReady({ ok: false, count: 4 }), false)
  })

  it("classifies four buckets without combining scores", () => {
    const today = "2026-11-18"
    assert.equal(
      classifyEtfInvestDecision(
        { qualityStatus: "scored", qualityGrade: "A", qualityScore: 80, ok: true, count: 3, asOfDate: "2026-11-17" },
        { today },
      ).id,
      "quality_buy",
    )
    assert.equal(
      classifyEtfInvestDecision(
        { qualityStatus: "scored", qualityGrade: "B", qualityScore: 70, ok: true, count: 1, asOfDate: "2026-11-17" },
        { today },
      ).id,
      "quality_wait",
    )
    assert.equal(
      classifyEtfInvestDecision(
        { qualityStatus: "pending", qualityGrade: null, ok: true, count: 4, asOfDate: "2026-11-17" },
        { today },
      ).id,
      "caution_buy",
    )
    assert.equal(
      classifyEtfInvestDecision(
        { qualityStatus: "scored", qualityGrade: "E", qualityScore: 20, ok: true, count: 0, asOfDate: "2026-11-17" },
        { today },
      ).id,
      "observe",
    )
  })

  it("distinguishes DBB compute error from quality_wait / unmet conditions", () => {
    const decision = classifyEtfInvestDecision({
      qualityStatus: "scored",
      qualityGrade: "A",
      qualityScore: 82,
      ok: false,
      error: "insufficient_bars",
      count: 0,
    })
    assert.equal(decision.id, "dbb_unavailable")
    assert.equal(isEtfDbbBuyReady({ ok: false, error: "insufficient_bars", count: 4 }), false)
    assert.match(formatEtfDbbStatusLabel({ ok: false, error: "insufficient_bars" }), /오류/)
  })

  it("does not present stale price as a normal buy signal", () => {
    const card = {
      qualityStatus: "scored",
      qualityGrade: "A",
      qualityScore: 82,
      ok: true,
      count: 4,
      asOfDate: "2026-10-01",
      stage: { label: "강한 저점" },
    }
    assert.equal(isEtfPriceStale(card, { today: "2026-11-18" }), true)
    assert.equal(isEtfDbbBuyReady(card, { today: "2026-11-18" }), false)
    assert.equal(classifyEtfInvestDecision(card, { today: "2026-11-18" }).id, "data_stale")
    assert.equal(getEtfDbbComputeStatus(card, { today: "2026-11-18" }).id, "stale")
  })

  it("keeps quality and DBB independent in caution_buy", () => {
    const buyButPending = classifyEtfInvestDecision(
      {
        qualityStatus: "pending",
        qualityLabel: "평가 보류",
        ok: true,
        count: 4,
        asOfDate: "2026-11-17",
        stage: { id: "strong", label: "강한 저점", count: 4 },
      },
      { today: "2026-11-18" },
    )
    assert.equal(buyButPending.id, "caution_buy")
  })

  it("groups matrix and data-issue buckets separately", () => {
    const groups = groupCardsByInvestDecision(
      [
        { symbol: "VOO", qualityStatus: "scored", qualityGrade: "A", ok: true, count: 3, asOfDate: "2026-11-17" },
        { symbol: "VGT", qualityStatus: "scored", qualityGrade: "B", ok: true, count: 1, asOfDate: "2026-11-17" },
        { symbol: "BOTZ", qualityStatus: "scored", qualityGrade: "D", ok: true, count: 3, asOfDate: "2026-11-17" },
        { symbol: "QQQM", qualityStatus: "pending", ok: true, count: 0, asOfDate: "2026-11-17" },
        { symbol: "ERR", qualityStatus: "scored", qualityGrade: "A", ok: false, error: "cache_missing" },
      ],
      { today: "2026-11-18" },
    )
    assert.equal(groups.quality_buy.map((c) => c.symbol).join(","), "VOO")
    assert.equal(groups.quality_wait.map((c) => c.symbol).join(","), "VGT")
    assert.equal(groups.caution_buy.map((c) => c.symbol).join(","), "BOTZ")
    assert.equal(groups.observe.map((c) => c.symbol).join(","), "QQQM")
    assert.equal(groups.dbb_unavailable.map((c) => c.symbol).join(","), "ERR")
  })

  it("highlights strengths/weaknesses and excluded pillars without inventing scores", () => {
    const h = describeQualityHighlights({
      pillars: {
        performance: { score: 90, excluded: false },
        cost: { score: 10, excluded: false },
        composition: { score: null, excluded: true, excludeReason: "missing_official_top10" },
      },
    })
    assert.ok(h.strengths.some((s) => s.includes("성과")))
    assert.ok(h.weaknesses.some((s) => s.includes("비용")))
    assert.ok(h.excluded.some((s) => s.includes("구성")))
  })

  it("pickDailyBottomAsOfDate falls back to quality.asOfDate for FREE redaction", () => {
    assert.equal(
      pickDailyBottomAsOfDate([
        { symbol: "VOO", quality: { asOfDate: "2026-11-17" } },
      ]),
      "2026-11-17",
    )
  })

  it("formatDailyBottomDataBasis warns on stale dates", () => {
    const stale = formatDailyBottomDataBasis({
      asOfDate: "2026-10-01",
      source: "api",
      today: "2026-11-18",
    })
    assert.equal(stale.isStale, true)
    assert.ok(stale.warn && stale.warn.includes("지연"))
  })
})
