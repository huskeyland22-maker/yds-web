import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  isStagingTestSeedPoint,
  STAGING_TEST_SEED_AS_OF,
  STAGING_TEST_SEED_CALC_VERSION,
} from "./stagingTestSeed.js"

describe("stagingTestSeed guards", () => {
  it("detects Phase 10B test seed by asOf and calc version", () => {
    assert.equal(isStagingTestSeedPoint({ asOf: STAGING_TEST_SEED_AS_OF, cci: 42 }), true)
    assert.equal(
      isStagingTestSeedPoint({
        asOf: "2024-01-01",
        calculationVersion: STAGING_TEST_SEED_CALC_VERSION,
      }),
      true,
    )
    assert.equal(isStagingTestSeedPoint({ asOf: "2024-06-01", cci: 40 }), false)
  })

  it("detects holdReason marker", () => {
    assert.equal(
      isStagingTestSeedPoint({
        asOf: "2020-01-01",
        holdReason: "PHASE10B_STAGING_TEST_SEED_NOT_MARKET_DATA",
      }),
      true,
    )
  })
})
