const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
const assert = process.env.VITEST ? null : (await import("node:assert/strict")).default

import { FROZEN_THRESHOLDS } from "./lib/daily-bottom-split-buy-sim.mjs"
import { EQUITY_SELL_RESEARCH_SELECTED_STRATEGY } from "./lib/equity-sell-research-universe.mjs"
import { SELECTED_STRATEGY as TECHNICAL_SELECTED_STRATEGY } from "./lib/equity-technical-sell-v1.mjs"
import { assertStoredEpisodes, firstBreachIndex } from "./lib/equity-addon-buy-v39.mjs"
import {
  FOCUS_TICKERS,
  STUDY_SELECTED_STRATEGY,
  TICKERS,
  averageCost,
  bucketOf,
  judgeRecovery,
  postAddPath,
  recoveryAfter,
  recoveryDay,
  sampleLabel,
} from "./lib/equity-addon-recovery-v40.mjs"

const ORDER = ["AMZN", "AAPL", "AMAT", "ASML", "AVGO", "CEG", "ETN", "FCX", "FTNT", "GOOGL", "LRCX", "LLY", "MU", "NVDA", "ORCL", "PANW", "PLTR", "TSLA", "TSM", "VST", "KLAC", "ANET", "VRT", "PWR", "V", "MSFT", "GEV", "ISRG", "SNPS", "AMD", "CRWD"]

function check(condition, message) {
  if (process.env.VITEST) {
    if (!condition) throw new Error(message)
    return
  }
  assert.equal(condition, true, message)
}

function deep(overrides = {}) {
  return {
    n: 40,
    mean: 0.08,
    median: 0.04,
    win: 0.7,
    addRecovery: 0.9,
    avgRecovery: 0.8,
    buyRecovery: 0.6,
    loss10: 0.1,
    deep30n: 12,
    deep30Mean: 0.03,
    deep30Add: 0.7,
    ...overrides,
  }
}

describe("v40 post-add recovery", () => {
  it("keeps the frozen buy and a null strategy", () => {
    check(TICKERS.join() === ORDER.join(), "31 names")
    check(FOCUS_TICKERS.join() === "NVDA,AMD,AVGO,CRWD,PLTR,TSLA", "focus names")
    check(STUDY_SELECTED_STRATEGY === null && TECHNICAL_SELECTED_STRATEGY === null, "strategy null")
    check(EQUITY_SELL_RESEARCH_SELECTED_STRATEGY === null, "universe strategy")
    check(FROZEN_THRESHOLDS.rsiMax === 36 && FROZEN_THRESHOLDS.stochKMax === 15.4, "thresholds")
    check(FROZEN_THRESHOLDS.bbPctBMax === 0.01 && FROZEN_THRESHOLDS.ma20DevMax === -4.2, "band and distance")
    check(sampleLabel(4) === "해석 금지" && sampleLabel(7) === "결론 금지" && sampleLabel(10) === "제한적 해석", "sample rule")
  })

  it("touches the first breach and classifies the later low", () => {
    const closes = [100, 96, 94, 90, 110]
    check(firstBreachIndex(closes, 0, -0.05, 4) === 2, "first -5% close")
    check(firstBreachIndex(closes, 0, -0.1, 4) === 3, "first -10% close")
    check(Math.abs(averageCost(100, 90) - 2 / (1 / 100 + 1 / 90)) < 1e-9, "harmonic average")
    check(bucketOf(-0.049) === "A" && bucketOf(-0.05) === "B", "five percent edge")
    check(bucketOf(-0.1) === "C" && bucketOf(-0.2) === "D" && bucketOf(-0.3) === "E" && bucketOf(-0.4) === "F", "deeper edges")
    check(recoveryDay([100, 90, 95, 100], 0, 3, 100, true) === 3, "add-price recovery starts the next day")
    check(recoveryDay([100, 101, 70, 80], 0, 3, 100, true) === 1, "an early bounce is not the low")
    check(recoveryAfter([100, 101, 70, 80], 2, 3, 100) == null, "no recovery after the low")
    check(recoveryAfter([100, 90, 70, 80, 100], 2, 4, 100) === 2, "recovery is counted after the low")
    check(recoveryDay([100, 90, 95, 100], 0, 3, 100, false) === 0, "including the add day is immediate")
    const path = postAddPath([100, 90, 80, 95], 0, 3)
    check(Math.abs(path.minReturn - -0.2) < 1e-12 && path.lowDay === 2 && Math.abs(path.ret - -0.05) < 1e-12, "path uses the window low")
    check(postAddPath([100, 101], 0, 5) == null, "missing horizon stays missing")
  })

  it("does not adopt a rule from a deep recovery", () => {
    const strong = { ADD5: deep(), ADD10: deep() }
    const verdict = judgeRecovery(strong)
    check(verdict.label.startsWith("A."), "both deep groups clear the locked bar")
    check(verdict.production === "없음" && verdict.selectedStrategy === null, "A stays research")
    check(verdict.buyChanged === false && verdict.sellChanged === false && verdict.addChanged === false, "no rule change")
    const mixed = { ADD5: deep({ win: 0.55, buyRecovery: 0.4 }), ADD10: deep() }
    check(judgeRecovery(mixed).label.startsWith("B."), "one incomplete deep group is not universal")
    const weak = {
      ADD5: deep({ mean: -0.02, median: -0.04, win: 0.4, addRecovery: 0.45 }),
      ADD10: deep({ mean: -0.01, median: -0.03, win: 0.42, addRecovery: 0.4 }),
    }
    check(judgeRecovery(weak).label.startsWith("C."), "both deep groups miss the weak bar")
  })

  it("stops when stored episodes differ", () => {
    let thrown = false
    try {
      assertStoredEpisodes(
        [{ symbol: "AMZN", date: "2020-01-02" }],
        { episodes: [{ symbol: "AMZN", date: "2020-01-03" }], fingerprint: "nope" },
      )
    } catch (error) {
      thrown = error.lines.some((line) => line.includes("AMZN"))
    }
    check(thrown, "date mismatch is reported")
  })
})
