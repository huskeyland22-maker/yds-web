/**
 * Phase I-2 — product ETF universe single-source parity
 * SoT: api/_lib/dailyBottomBuyUniverse.js
 * FE: vite-project/src/content/ydsDailyBottomBuyUniverse.js (re-export)
 * node --test scripts/etf-universe-parity.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { pathToFileURL } from "node:url"
import path from "node:path"
import {
  DAILY_BOTTOM_BUY_ETFS as apiEtfs,
  DAILY_BOTTOM_BUY_WATCHLIST as apiWatch,
} from "../api/_lib/dailyBottomBuyUniverse.js"
import { DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1 } from "../api/_lib/dailyBottomBuyEngine.js"
import { ETF_QUALITY_FUND_META } from "../api/_lib/etfQualityMeta.js"

const feUniverseUrl = pathToFileURL(
  path.resolve("vite-project/src/content/ydsDailyBottomBuyUniverse.js"),
).href
const {
  DAILY_BOTTOM_BUY_ETFS: feEtfs,
  DAILY_BOTTOM_BUY_WATCHLIST: feWatch,
} = await import(feUniverseUrl)

/** Expected product set (order is screen order from SoT, not alphabetical). */
const EXPECTED_SET = new Set([
  "VOO",
  "QQQM",
  "SCHD",
  "AVUV",
  "SMH",
  "VGT",
  "IGV",
  "CIBR",
  "BOTZ",
  "AIQ",
  "GRID",
  "XLU",
  "XLI",
  "XLV",
  "XLF",
])

const RESEARCH_NINE = ["SMH", "GRID", "QQQ", "IGV", "CIBR", "BOTZ", "ITA", "URA", "IBB"]

function rowKey(row) {
  return {
    symbol: row.symbol,
    theme: row.theme,
    themeShort: row.themeShort,
    role: row.role,
    sector: row.sector,
    industry: row.industry,
    legacyCore: row.legacyCore === true,
  }
}

describe("etf universe parity (Phase I-2)", () => {
  it("keeps product universe at exactly 15 with no duplicate tickers", () => {
    assert.equal(apiEtfs.length, 15)
    const symbols = apiEtfs.map((e) => e.symbol)
    assert.equal(new Set(symbols).size, 15)
  })

  it("product set matches the locked fifteen symbols", () => {
    const symbols = apiEtfs.map((e) => e.symbol)
    assert.equal(symbols.length, EXPECTED_SET.size)
    for (const s of symbols) assert.ok(EXPECTED_SET.has(s), `unexpected ${s}`)
    for (const s of EXPECTED_SET) assert.ok(symbols.includes(s), `missing ${s}`)
  })

  it("API and FE universes are identical (same rows, same order)", () => {
    assert.equal(apiEtfs, feEtfs, "FE must re-export the same array reference")
    assert.deepEqual(apiEtfs.map(rowKey), feEtfs.map(rowKey))
    assert.deepEqual(
      apiEtfs.map((e) => e.symbol),
      feEtfs.map((e) => e.symbol),
    )
    assert.deepEqual(
      apiEtfs.map((e) => ({ theme: e.theme, themeShort: e.themeShort, role: e.role })),
      feEtfs.map((e) => ({ theme: e.theme, themeShort: e.themeShort, role: e.role })),
    )
    assert.deepEqual(
      apiEtfs.map((e) => ({ sector: e.sector, industry: e.industry })),
      feEtfs.map((e) => ({ sector: e.sector, industry: e.industry })),
    )
  })

  it("watchlist mirrors product fifteen on both API and FE", () => {
    assert.deepEqual(
      apiWatch.map((e) => e.symbol),
      apiEtfs.map((e) => e.symbol),
    )
    assert.equal(apiWatch, feWatch)
  })

  it("ETF_QUALITY_FUND_META keys match product symbols exactly", () => {
    const product = new Set(apiEtfs.map((e) => e.symbol))
    const metaKeys = new Set(Object.keys(ETF_QUALITY_FUND_META))
    assert.equal(metaKeys.size, 15)
    for (const s of product) {
      assert.ok(metaKeys.has(s), `meta missing ${s}`)
    }
    for (const s of metaKeys) {
      assert.ok(product.has(s), `meta has extra ${s}`)
    }
  })

  it("keeps RESEARCH_V1 nine separate from the product fifteen", () => {
    assert.equal(DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1.length, 9)
    assert.deepEqual(
      DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1.map((e) => e.symbol),
      RESEARCH_NINE,
    )
    const product = new Set(apiEtfs.map((e) => e.symbol))
    const research = DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1.map((e) => e.symbol)
    assert.notDeepEqual(research, [...product])
    // Research includes tickers that are intentionally not in the product fifteen.
    for (const extra of ["QQQ", "ITA", "URA", "IBB"]) {
      assert.ok(research.includes(extra))
      assert.ok(!product.has(extra))
    }
  })
})
