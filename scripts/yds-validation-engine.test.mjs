import assert from "node:assert/strict"
import {
  regimeFromMarketContext,
  summarizePickPerformance,
  summarizeStockStatusPerformance,
} from "../vite-project/src/content/ydsValidationEngine.js"

const defensive = {
  macroId: "neutral",
  strategyLabel: "방어 모드",
  isDefensive: true,
}

const regime = regimeFromMarketContext(defensive)
assert.equal(regime.regimeLabel, "방어 모드")

/** @type {import("../vite-project/src/content/ydsValidationStorage.js").ValidationPickRecord[]} */
const picks = [
  {
    id: "1",
    ticker: "NVDA",
    name: "NVDA",
    country: "US",
    rank: 1,
    isTop3: true,
    recommendedAt: "2026-06-01",
    recommendedPrice: 145,
    statusId: "trend",
    statusLabel: "추세 유지",
    currentPrice: 162,
    returnPct: 11.7,
    horizons: { d7: null, d30: 11.7, d90: null, d180: null, d365: null },
    priceLog: {},
    regimeLabel: "방어 모드",
    regimeId: "neutral",
    strategyLabel: "방어 모드",
    recordedAt: 1,
    lastUpdatedAt: 1,
  },
  {
    id: "2",
    ticker: "AVGO",
    name: "AVGO",
    country: "US",
    rank: 4,
    isTop3: false,
    recommendedAt: "2026-06-01",
    recommendedPrice: 100,
    statusId: "interest",
    statusLabel: "관심 구간",
    currentPrice: 98,
    returnPct: -2,
    horizons: { d7: null, d30: -2, d90: null, d180: null, d365: null },
    priceLog: {},
    regimeLabel: "관심 구간",
    regimeId: "interest",
    strategyLabel: "관심",
    recordedAt: 1,
    lastUpdatedAt: 1,
  },
]

const pickSum = summarizePickPerformance(picks)
assert.equal(pickSum.tracked, 2)
assert.equal(pickSum.winRate, 50)
assert.equal(pickSum.top3.count, 1)
assert.equal(pickSum.top3.winRate, 100)

const statusSum = summarizeStockStatusPerformance(picks)
assert.equal(statusSum.find((s) => s.statusId === "trend")?.count, 1)

console.log("yds-validation-engine.test.mjs OK")
