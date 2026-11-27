import { describe, expect, it } from "vitest"
import {
  adaptCoreDomainHistory,
  buildFeatureDateMeta,
} from "./coreDomainHistoryAdapter.js"

describe("coreDomainHistoryAdapter", () => {
  it("preserves null R_core and partial coverage", () => {
    const hist = adaptCoreDomainHistory({
      series: [
        {
          as_of: "1995-03-31",
          DS: null,
          DQ: 40,
          DR: null,
          R_core: null,
          coverage: "PARTIAL_COVERAGE",
        },
        {
          as_of: "2020-06-30",
          DS: 55,
          DQ: 40,
          DR: 70,
          R_core: 55,
          coverage: "FULL",
        },
      ],
      tip: { as_of: "2020-06-30", R_core: 55 },
      notes: ["test"],
    })
    expect(hist.ready).toBe(true)
    expect(hist.series[0].R_core).toBeNull()
    expect(hist.series[0].DS).toBeNull()
    expect(hist.rCoreSeries).toHaveLength(1)
    expect(hist.quality.partial_n).toBe(1)
    expect(hist.quality.full_n).toBe(1)
  })

  it("maps feature observation dates without inventing release_date", () => {
    const meta = buildFeatureDateMeta(
      {
        H8_YOY: { last: "2026-11-11", n: 100, n_future_vs_retrieval: 0 },
        DELINQUENCY: { last: "2026-06-30", n: 50, n_future_vs_retrieval: 0 },
      },
      "2026-11-27",
    )
    expect(meta.CREDIT_QUANTITY_H8_CI_YOY_52W.observation_date).toBe("2026-11-11")
    expect(meta.CREDIT_QUANTITY_H8_CI_YOY_52W.release_date).toBeNull()
    expect(meta.CREDIT_REALIZED_CI_DELINQUENCY_SA.observation_date).toBe("2026-06-30")
    expect(meta.CREDIT_REALIZED_CI_DELINQUENCY_SA.retrieval_date).toBe("2026-11-27")
  })
})
