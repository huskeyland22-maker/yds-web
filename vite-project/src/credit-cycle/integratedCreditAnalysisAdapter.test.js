import { describe, expect, it } from "vitest"
import { buildIntegratedCreditAnalysis } from "./integratedCreditAnalysisAdapter.js"
import { buildCreditCycleOverviewFromIntegrated } from "./creditCycleOverviewAdapter.js"

const SAMPLE_CORE = {
  core_risk: {
    feed_status: "VERIFIED_PRODUCT_FEED",
    as_of: "2026-06-30",
    retrieval_date: "2026-11-27",
    R_core: 60,
    r_status: "OK",
    calibration_status: "NOT_CALIBRATED",
    pit_class: "NON_STRICT_PIT",
    domain_scores: { supply: 64, quantity: 23, realized: 93 },
    domain_detail: {
      standards_block: 64,
      demand_block: 31,
      supply_demand_divergence: 33,
      size_divergence: 15,
    },
    feature_scores_by_id: {
      CREDIT_SUPPLY_SLOOS_CI_STANDARDS_LARGE_MEDIUM: { score: 64, status: "OK", n: 40 },
      CREDIT_SUPPLY_SLOOS_CI_STANDARDS_SMALL: { score: 49, status: "OK", n: 40 },
      CREDIT_SUPPLY_SLOOS_CI_DEMAND_LARGE_MEDIUM: { score: 24, status: "OK", n: 40 },
      CREDIT_SUPPLY_SLOOS_CI_DEMAND_SMALL: { score: 31, status: "OK", n: 40 },
      CREDIT_QUANTITY_H8_CI_LOANS_SA: { score: 22, status: "OK", n: 522 },
      CREDIT_QUANTITY_H8_CI_YOY_52W: { score: 24, status: "OK", n: 522 },
      CREDIT_REALIZED_CI_DELINQUENCY_SA: { score: 69, status: "OK", n: 40 },
      CREDIT_REALIZED_CI_CHARGEOFF_SA: { score: 93, status: "OK", n: 40 },
    },
    conflict_flags: [{ code: "SUPPLY_QUANTITY_CONFLICT", additive: false }],
    coverage: { domains: { supply: true, quantity: true, realized: true } },
    confidence: { coverage_domains: 3 },
  },
  loadStatus: "VERIFIED_PRODUCT_FEED",
  transport: "api_core_latest",
}

describe("integratedCreditAnalysisAdapter", () => {
  it("exposes CORE 8 features and keeps liquidity out of R_core", () => {
    const integrated = buildIntegratedCreditAnalysis({
      coreModel: SAMPLE_CORE,
      liquidity: {
        lambda: 0,
        r_core_includes_liquidity: false,
        D_liquidity: { status: "ANALYTIC_ONLY", score: 55 },
        sofr: {
          latest: 3.94,
          status: "AVAILABLE",
          as_of: "2026-11-24",
          observation_date: "2026-11-24",
          interpretation: "관찰",
        },
        on_rrp: {
          latest_billions: 0.3,
          status: "AVAILABLE",
          as_of: "2026-11-25",
          observation_date: "2026-11-25",
          interpretation: "관찰",
          note: "rrp_decline_alone_does_not_raise_risk",
        },
        co_movement: { status: "MUTED", label: "제한" },
        freshness: "AVAILABLE",
        rights: { sofr: "RIGHTS_CONDITIONAL" },
        interpretation_guide: {
          principle: "분리",
          sofr: { observed: "o", means: "m", cannot_alone: "c", next_check: [] },
          on_rrp: { observed: "o", means: "m", cannot_alone: "rrp_decline", next_check: [] },
          together: { next_check: ["CORE"] },
        },
      },
      domainHistory: {
        ready: true,
        chart_r_core: [
          { asOf: "2020-06-30", cci: 55 },
          { asOf: "2026-06-30", cci: 60 },
        ],
        chart_ds: [],
        chart_dq: [],
        chart_dr: [],
        quality: { series_n: 2, r_core_n: 2, partial_n: 0 },
        comparability_warning: "비교 주의",
      },
      cciModel: { cci: 39, asOf: "2026-10-01", regime: { id: "Expansion" } },
    })

    expect(integrated.lambda).toBe(0)
    expect(integrated.cross_domain.r_core_includes_liquidity).toBe(false)
    expect(integrated.core_risk.R_core).toBe(60)
    expect(integrated.date_split.core_observation).toBe("2026-06-30")
    expect(integrated.date_split.sofr_observation).toBe("2026-11-24")
    expect(integrated.domains.DS.features).toHaveLength(4)
    expect(integrated.domains.DQ.features).toHaveLength(2)
    expect(integrated.domains.DR.features).toHaveLength(2)
    expect(integrated.weakest_domain.id).toBe("DR")
    expect(integrated.cci_reference.cci).toBe(39)
    expect(integrated.checklist).toHaveLength(6)

    const view = buildCreditCycleOverviewFromIntegrated(integrated)
    expect(view.ready).toBe(true)
    expect(view.engine).toBe("CORE_PRIMARY")
    expect(view.gauge.score).toBe(60)
    expect(view.gauge.stageLabel).toMatch(/미보정/)
    expect(view.tableRows).toHaveLength(4)
    expect(view.summary.some((s) => s.id === "lambda" && s.valueText === "0")).toBe(true)
    expect(view.diagramSteps.every((s) => s.active === false)).toBe(true)
    expect(view.coreHistoryPoints.length).toBe(2)
    expect(view.dateSplit.core_observation).toBe("2026-06-30")
    expect(view.dateSplit.sofr_observation).toBe("2026-11-24")
    expect(view.liquidityGuide?.on_rrp?.cannot_alone).toMatch(/rrp_decline/)
  })
})
