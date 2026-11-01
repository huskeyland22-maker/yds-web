/**
 * P2-19 — desk market state label must not ingest Legacy market_view panic prose
 */
import { describe, expect, it } from "vitest"
import { resolveDeskMarketStateLabel } from "./resolveLatestPanicMetrics.js"

const insufficient = {
  stateKey: "insufficient",
  label: "지표 부족",
  shortLabel: "지표 부족",
  headline: "지표 부족",
  mood: "—",
}

describe("resolveDeskMarketStateLabel Official/Legacy gate (P2-19)", () => {
  it("does not use Legacy market_view panic score text as the live state label", () => {
    const out = resolveDeskMarketStateLabel(insufficient, {
      deskReport: {
        market_view: "패닉지수 48",
        panic_score: 48,
      },
    })
    expect(out.label).not.toMatch(/패닉|48/)
    expect(out.headline).not.toMatch(/패닉|48/)
    expect(out.stateKey).toBe("neutral")
    expect(out.label).toBe("중립")
  })

  it("does not treat free-form Legacy market_view as a current regime", () => {
    const out = resolveDeskMarketStateLabel(insufficient, {
      deskReport: {
        market_view: "패닉 48 · 중립 · 리스크 혼합",
        marketView: "패닉지수 50",
      },
    })
    expect(out.label).toBe("중립")
    expect(out.stateKey).toBe("neutral")
    expect(String(out.label)).not.toContain("패닉")
  })

  it("keeps a valid known market_state key from deskReport", () => {
    const out = resolveDeskMarketStateLabel(insufficient, {
      deskReport: {
        market_state: "fear_dominant",
        market_view: "패닉지수 48",
      },
    })
    expect(out.stateKey).toBe("fear_dominant")
    expect(out.label).toBe("공포 우세")
    expect(out.label).not.toMatch(/패닉지수|48/)
  })

  it("prefers history/cycle known keys over desk report", () => {
    const out = resolveDeskMarketStateLabel(insufficient, {
      latestHistory: { market_state: "risk_on" },
      deskReport: { market_state: "defensive", market_view: "패닉지수 48" },
    })
    expect(out.stateKey).toBe("risk_on")
    expect(out.label).toBe("Risk-on")
  })

  it("passes through when live compute already has a non-insufficient state", () => {
    const computed = {
      stateKey: "fear_dominant",
      label: "공포 우세",
      shortLabel: "공포 우세",
      headline: "공포 우세",
      mood: "위축",
    }
    const out = resolveDeskMarketStateLabel(computed, {
      deskReport: { market_view: "패닉지수 48", market_state: "neutral" },
    })
    expect(out).toBe(computed)
    expect(out.stateKey).toBe("fear_dominant")
  })

  it("ignores unknown free-form market_state strings (no label injection)", () => {
    const out = resolveDeskMarketStateLabel(insufficient, {
      marketCycleRow: { market_state: "패닉지수 48" },
    })
    expect(out.stateKey).toBe("neutral")
    expect(out.label).toBe("중립")
  })
})
