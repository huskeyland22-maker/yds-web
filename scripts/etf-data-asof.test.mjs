/**
 * Phase G — multi-source as-of helpers
 * node --test scripts/etf-data-asof.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { pathToFileURL } from "node:url"
import path from "node:path"

const modUrl = pathToFileURL(path.resolve("vite-project/src/content/ydsEtfDataAsOf.js")).href
const {
  extractEtfAsOfDates,
  summarizeUniverseAsOf,
  listOfficialAumPendingCards,
  uniqueAsOfDates,
} = await import(modUrl)

describe("etf data as-of (Phase G)", () => {
  it("extracts per-field dates without inventing missing ones", () => {
    const dates = extractEtfAsOfDates({
      asOfDate: "2026-11-17",
      quality: {
        asOfDate: "2026-11-10",
        sources: [
          { field: "aum", asOf: "2026-11-05" },
          { field: "holdings", asOf: "2026-10-31" },
          { field: "expenseRatio", asOf: "2026-09-01" },
        ],
      },
    })
    assert.equal(dates.price, "2026-11-17")
    assert.equal(dates.dbb, "2026-11-17")
    assert.equal(dates.quality, "2026-11-10")
    assert.equal(dates.aum, "2026-11-05")
    assert.equal(dates.holdings, "2026-10-31")
  })

  it("does not substitute today when dates are missing", () => {
    const dates = extractEtfAsOfDates({ symbol: "QQQM", quality: { status: "pending" } })
    assert.equal(dates.price, null)
    assert.equal(dates.quality, null)
    assert.equal(dates.aum, null)
    assert.equal(dates.holdings, null)
    assert.equal(dates.dbb, null)
  })

  it("flags mismatch when price/quality/dbb differ across universe", () => {
    const summary = summarizeUniverseAsOf([
      {
        asOfDate: "2026-11-17",
        quality: { asOfDate: "2026-11-10", sources: [] },
      },
      {
        asOfDate: "2026-11-17",
        quality: { asOfDate: "2026-11-17", sources: [] },
      },
    ])
    assert.equal(summary.mismatch, true)
    assert.equal(summary.priceLabel, "2026-11-17")
    assert.ok(summary.qualityLabel.includes("2026-11-10"))
    assert.equal(summary.missingPrice, false)
  })

  it("reports missing without fabricating a label", () => {
    const summary = summarizeUniverseAsOf([{ quality: { status: "pending" } }])
    assert.equal(summary.priceLabel, null)
    assert.equal(summary.qualityLabel, null)
    assert.equal(summary.dbbLabel, null)
    assert.equal(summary.missingPrice, true)
    assert.equal(summary.mismatch, false)
  })

  it("lists official AUM pending cards (QQQM)", () => {
    const pending = listOfficialAumPendingCards([
      {
        symbol: "QQQM",
        qualityStatus: "pending",
        quality: { status: "pending", pendingReasons: ["missing_aum"] },
      },
      {
        symbol: "VOO",
        qualityStatus: "scored",
        quality: { status: "scored", pendingReasons: [] },
      },
    ])
    assert.equal(pending.length, 1)
    assert.equal(pending[0].symbol, "QQQM")
  })

  it("uniqueAsOfDates sorts and drops empties", () => {
    assert.deepEqual(uniqueAsOfDates(["2026-11-17", "", null, "2026-11-10", "2026-11-17"]), [
      "2026-11-10",
      "2026-11-17",
    ])
  })
})
