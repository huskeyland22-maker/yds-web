import assert from "node:assert/strict"
import {
  assertBtdCreditIndependence,
  buildCreditCycleBtdContext,
  CC_BTD_PREMIUM_ONLY,
  CC_BTD_FREE_VISIBLE,
} from "../vite-project/src/credit-cycle/creditCycleBtdContext.js"

const cc = {
  asOf: "2026-10-01",
  cci: 39,
  coveragePct: 100,
  pitLabel: "NON_PIT",
  statusLabel: "Staging API · License-safe",
  feedStatus: "STAGING_API",
  hold: false,
  testSeedOnly: false,
  indicators: [
    { id: "sloos", label: "SLOOS", exposed: true, licenseRestricted: false, quality: "VALID" },
    { id: "bank", label: "Bank", exposed: true, licenseRestricted: false, quality: "STALE" },
    { id: "hy", label: "HY", exposed: false, licenseRestricted: true, quality: "LICENSE_RESTRICTED" },
  ],
}

const buy = {
  product: "etf",
  symbol: "QQQ",
  scoreNOf4: 3,
  stageLabel: "1차 매수",
  buyOk: true,
  priceAsOf: "2026-11-20",
}

const ctx = buildCreditCycleBtdContext(cc, buy)
assert.equal(ctx.independence.scoresMerged, false)
assert.equal(ctx.independence.cciIsBuySellSignal, false)
assert.equal(assertBtdCreditIndependence(ctx), true)
assert.equal(ctx.marketOpportunity.scoreNOf4, 3)
assert.equal(ctx.creditEnvironment.cci, 39)
assert.equal(ctx.creditEnvironment.pitLabel, "NON_PIT")
assert.ok(ctx.creditEnvironment.staleIndicators.some((s) => s.id === "bank"))
assert.equal(ctx.creditEnvironment.hyBbbRestricted, true)
assert.equal(ctx.premium.gateEnabled, false)
assert.ok(CC_BTD_FREE_VISIBLE.includes("cci_level"))
assert.ok(CC_BTD_PREMIUM_ONLY.includes("cross_regime_vs_dbb_stage"))
assert.equal(Object.hasOwn(ctx, "mergedScore"), false)

const empty = buildCreditCycleBtdContext(null, null)
assert.equal(empty.creditEnvironment.available, false)
assert.equal(empty.marketOpportunity.available, false)
assert.ok(empty.creditEnvironment.summaryLines.some((l) => /추정하지/.test(l)))

console.log(
  JSON.stringify(
    {
      ok: true,
      independence: ctx.independence.scoresMerged === false,
      market: ctx.marketOpportunity.summary,
      creditCci: ctx.creditEnvironment.cci,
      stale: ctx.creditEnvironment.staleIndicators.map((s) => s.id),
      premiumGate: ctx.premium.gateEnabled,
    },
    null,
    2,
  ),
)
