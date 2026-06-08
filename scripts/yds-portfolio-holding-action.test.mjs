import assert from "node:assert/strict"
import { derivePortfolioHoldingAction } from "../vite-project/src/content/ydsPortfolioHoldingAction.js"

const defensiveCtx = {
  ready: true,
  macroId: "neutral",
  panicLabel: "공포 부족",
  strategyLabel: "방어 모드",
  strategyEmoji: "🛡️",
  isDefensive: true,
  cycleStageId: "normal",
}

/** @type {import("../vite-project/src/content/ydsPortfolioV5Engine.js").HoldingRow} */
const trendHolding = {
  id: "lot-1",
  name: "현대차",
  ticker: "005380",
  country: "kr",
  quantity: 10,
  avgUnitPrice: 200000,
  costBasisLocal: 2000000,
  realizedPnl: 0,
  firstBuyDate: "2026-01-01",
  priceReady: true,
  currentPrice: 208000,
  marketValueKrw: 2080000,
  costBasisKrw: 2000000,
  unrealizedPnl: 80000,
  returnPct: 3.9,
  weightPct: 77,
  priceStatus: "delayed",
  priceUpdatedAt: null,
  priceStale: true,
}

const action = derivePortfolioHoldingAction(trendHolding, defensiveCtx)
assert.equal(action.stockAction.label, "보유 유지")
assert.equal(action.stockStatus.id, "trend")

const overheat = derivePortfolioHoldingAction(
  { ...trendHolding, returnPct: 28 },
  defensiveCtx,
)
assert.equal(overheat.stockAction.label, "추격 금지")

console.log("yds-portfolio-holding-action.test.mjs OK")
