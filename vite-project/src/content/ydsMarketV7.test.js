import { describe, expect, it } from "vitest"
import { buildMarketPositionTimeline } from "./ydsMarketPositionTimeline.js"
import { resolveStockPickCardAction, STOCK_PICK_CARD_ACTIONS } from "./ydsStockPickCardAction.js"

describe("market position timeline", () => {
  it("captures zone transitions from history", () => {
    const rows = [
      { date: "2026-05-13", fearGreed: 75, vix: 14, bofa: 7.5 },
      { date: "2026-05-20", fearGreed: 72, vix: 15, bofa: 7.2 },
      { date: "2026-06-05", fearGreed: 48, vix: 20, bofa: 5.8 },
      { date: "2026-06-10", fearGreed: 45, vix: 21, bofa: 5.5 },
    ]
    const steps = buildMarketPositionTimeline(rows, 4)
    expect(steps.length).toBeGreaterThanOrEqual(2)
    expect(steps[steps.length - 1].isCurrent).toBe(true)
    expect(steps[steps.length - 1].label).toBe("조정")
  })
})

describe("stock pick card action", () => {
  it("maps ux status to v7 labels", () => {
    expect(
      resolveStockPickCardAction({ v4Score: { recommendStatusId: "buy" } }).label,
    ).toBe(STOCK_PICK_CARD_ACTIONS.entry.label)
    expect(
      resolveStockPickCardAction({ v4Score: { recommendStatusId: "watch" } }).label,
    ).toBe(STOCK_PICK_CARD_ACTIONS.waitPullback.label)
    expect(
      resolveStockPickCardAction({ v4Score: { recommendStatusId: "noChase" } }).label,
    ).toBe(STOCK_PICK_CARD_ACTIONS.noChase.label)
  })
})
