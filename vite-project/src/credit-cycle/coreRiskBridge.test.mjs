import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  adaptCoreRiskSnapshot,
  buildUnavailableCoreRiskDto,
} from "./coreRiskBridge.js"

describe("coreRiskBridge", () => {
  it("unavailable dto keeps R_core null", () => {
    const d = buildUnavailableCoreRiskDto("TEST")
    assert.equal(d.R_core, null)
    assert.equal(d.risk_grade, null)
    assert.equal(d.feed_status, "NO_VERIFIED_PRODUCT_FEED")
  })

  it("does not promote research_reference tip 60 to live R_core when unverified", () => {
    const model = adaptCoreRiskSnapshot({
      feed_status: "NO_VERIFIED_PRODUCT_FEED",
      core_risk: {
        feed_status: "NO_VERIFIED_PRODUCT_FEED",
        R_core: null,
        r_status: "INSUFFICIENT_DATA",
        domain_scores: { supply: null, quantity: null, realized: null },
        grade_status: "GRADE_NOT_CALIBRATED",
      },
      research_reference_only: {
        example_historical_tip: { as_of: "2026-06-30", R_core: 60 },
      },
    })
    assert.equal(model.core_risk.R_core, null)
    assert.equal(model.loadStatus, "NO_VERIFIED_PRODUCT_FEED")
    assert.equal(model.research_reference_only.example_historical_tip.R_core, 60)
  })

  it("forces null when feed unavailable even if R_core sneaks in", () => {
    const model = adaptCoreRiskSnapshot({
      feed_status: "NO_VERIFIED_PRODUCT_FEED",
      core_risk: {
        feed_status: "NO_VERIFIED_PRODUCT_FEED",
        R_core: 60,
        r_status: "OK",
        domain_scores: { supply: 64, quantity: 23, realized: 93 },
      },
    })
    assert.equal(model.core_risk.R_core, null)
  })

  it("accepts VERIFIED_PRODUCT_FEED live score", () => {
    const model = adaptCoreRiskSnapshot({
      feed_status: "VERIFIED_PRODUCT_FEED",
      core_risk: {
        feed_status: "VERIFIED_PRODUCT_FEED",
        R_core: 60,
        r_status: "OK",
        as_of: "2026-06-30",
        domain_scores: { supply: 64, quantity: 23, realized: 93 },
        grade_status: "GRADE_NOT_CALIBRATED",
        pit_class: "NON_STRICT_PIT",
      },
      research_reference_only: {
        example_historical_tip: {
          as_of: "2026-06-30",
          R_core: 60,
          label: "RESEARCH_VALIDATION_ONLY",
        },
      },
    })
    assert.equal(model.loadStatus, "VERIFIED_PRODUCT_FEED")
    assert.equal(model.core_risk.R_core, 60)
    assert.equal(
      model.research_reference_only.example_historical_tip.label,
      "RESEARCH_VALIDATION_ONLY",
    )
  })

  it("malformed snapshot yields unavailable", () => {
    const model = adaptCoreRiskSnapshot({})
    assert.equal(model.core_risk.R_core, null)
    assert.equal(model.loadStatus, "MALFORMED")
  })
})
