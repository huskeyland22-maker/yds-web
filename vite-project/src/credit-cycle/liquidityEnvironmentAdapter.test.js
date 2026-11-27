import { describe, expect, it } from "vitest"
import {
  buildLiquidityEnvironment,
  LIQUIDITY_LAMBDA,
} from "./liquidityEnvironmentAdapter.js"

describe("liquidityEnvironmentAdapter", () => {
  it("keeps lambda 0 and never marks r_core merge", () => {
    const sofr = []
    const onRrp = []
    for (let i = 0; i < 40; i++) {
      sofr.push({ date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`, value: 3.8 + i * 0.002 })
      onRrp.push({
        date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
        value: 400_000_000 - i * 1_000_000,
      })
    }
    // unique sorted dates
    const sofrU = sofr.map((p, i) => ({ date: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`, value: p.value }))
    const rrpU = onRrp.map((p, i) => ({
      date: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
      value: p.value,
    }))

    const env = buildLiquidityEnvironment({ sofr: sofrU, onRrp: rrpU })
    expect(LIQUIDITY_LAMBDA).toBe(0)
    expect(env.lambda).toBe(0)
    expect(env.r_core_includes_liquidity).toBe(false)
    expect(env.sofr.latest).not.toBeNull()
    expect(env.on_rrp.latest).not.toBeNull()
    expect(env.D_liquidity.status === "ANALYTIC_ONLY" || env.D_liquidity.status === "INSUFFICIENT_DATA").toBe(
      true,
    )
    expect(env.r_core_includes_liquidity).toBe(false)
    expect(env.on_rrp.note).toBe("rrp_decline_alone_does_not_raise_risk")
    expect(env.interpretation_guide?.sofr?.cannot_alone).toMatch(/SOFR/)
    expect(env.interpretation_guide?.on_rrp?.cannot_alone).toMatch(/rrp_decline/)
    expect(env.sofr.observation_date).toBeTruthy()
    expect(env.sofr.retrieval_date).toBeTruthy()
  })

  it("returns INSUFFICIENT_DATA when series empty", () => {
    const env = buildLiquidityEnvironment({ sofr: [], onRrp: [] })
    expect(env.coverage).toBe("NO_DATA")
    expect(env.D_liquidity.status).toBe("INSUFFICIENT_DATA")
    expect(env.D_liquidity.score).toBeNull()
  })
})
