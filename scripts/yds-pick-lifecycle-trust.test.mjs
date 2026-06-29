import assert from "node:assert/strict"
import {
  buildPickTrustPerfStats,
  filterHubHistoryRows,
  migratePickLifecycle,
  updatePickLifecycle,
} from "../vite-project/src/content/ydsPickLifecycleEngine.js"
import { buildRecommendPerfReport } from "../vite-project/src/content/ydsRecommendPerfReportEngine.js"
import { buildStockPickHubHistoryReport } from "../vite-project/src/content/ydsStockPickTrustEngine.js"

const today = "2026-06-22"

/** @param {Partial<import("../vite-project/src/content/ydsValidationStorage.js").ValidationPickRecord>} overrides */
function pick(overrides = {}) {
  return {
    id: "2026-06-01:US:NVDA",
    ticker: "NVDA",
    name: "NVIDIA",
    country: "US",
    rank: 1,
    isTop3: true,
    recommendedAt: "2026-06-01",
    recommendedPrice: 100,
    recommendedScore: 85,
    qualityGrade: "A",
    timingGrade: "B",
    marketFitGrade: "A",
    statusId: "trend",
    statusLabel: "추세",
    currentPrice: 112,
    returnPct: 12,
    horizons: { d7: 5, d14: 8, d30: 12, d90: null, d180: null, d365: null },
    horizonPrices: {},
    priceLog: { "2026-06-01": 100, "2026-06-15": 112 },
    regimeId: "neutral",
    regimeLabel: "중립",
    strategyLabel: "조정안정",
    lifecycleId: "active",
    lifecycleLabel: "추천중",
    closedAt: null,
    closeReason: null,
    finalReturnPct: null,
    recommendSnapshot: null,
    recordedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    ...overrides,
  }
}

const targetHit = migratePickLifecycle(
  pick({ returnPct: 12, recommendedAt: "2026-06-10" }),
  today,
)
assert.equal(targetHit.lifecycleId, "targetHit")
assert.ok(targetHit.closedAt)

const stopLoss = migratePickLifecycle(
  pick({
    returnPct: -6,
    horizons: { d7: -4, d14: -5, d30: -6, d90: null, d180: null, d365: null },
    priceLog: { "2026-06-01": 100, "2026-06-10": 94 },
    recommendedAt: "2026-06-10",
  }),
  today,
)
assert.equal(stopLoss.lifecycleId, "stopLoss")

const ended = migratePickLifecycle(
  pick({ recommendedAt: "2026-04-01", returnPct: 3, horizons: { d7: 2, d14: 3, d30: 3 } }),
  today,
)
assert.equal(ended.lifecycleId, "ended")

const frozen = updatePickLifecycle(
  pick({ lifecycleId: "stopLoss", closedAt: "2026-06-15", finalReturnPct: -6 }),
  today,
)
assert.equal(frozen.lifecycleId, "stopLoss")
assert.equal(frozen.finalReturnPct, -6)

const rows = [
  { lifecycleId: "active" },
  { lifecycleId: "targetHit" },
  { lifecycleId: "stopLoss" },
  { lifecycleId: "ended" },
]
assert.equal(filterHubHistoryRows(rows, "success").length, 1)
assert.equal(filterHubHistoryRows(rows, "failure").length, 1)
assert.equal(filterHubHistoryRows(rows, "active").length, 1)

const stats = buildPickTrustPerfStats(
  [
    pick({ lifecycleId: "targetHit", finalReturnPct: 12, closedAt: "2026-06-20" }),
    pick({
      id: "2026-06-05:US:AMD",
      ticker: "AMD",
      lifecycleId: "stopLoss",
      finalReturnPct: -6,
      closedAt: "2026-06-18",
      recommendedAt: "2026-06-05",
    }),
    pick({
      id: "2026-06-10:US:MSFT",
      ticker: "MSFT",
      lifecycleId: "active",
      recommendedAt: "2026-06-10",
    }),
    pick({
      id: "2026-06-08:US:GOOG",
      ticker: "GOOG",
      lifecycleId: "ended",
      finalReturnPct: 2,
      closedAt: "2026-06-19",
      recommendedAt: "2026-06-08",
    }),
  ],
  30,
)
assert.equal(stats.count, 4)
assert.equal(stats.successCount, 1)
assert.equal(stats.failureCount, 1)
assert.equal(stats.endedCount, 1)
assert.equal(stats.holdingCount, 1)
assert.equal(stats.winRate, 50)

const perf = buildRecommendPerfReport(
  [
    pick({ lifecycleId: "targetHit", finalReturnPct: 12, closedAt: "2026-06-20" }),
    pick({
      id: "2026-06-05:US:AMD",
      ticker: "AMD",
      lifecycleId: "stopLoss",
      finalReturnPct: -6,
      closedAt: "2026-06-18",
      recommendedAt: "2026-06-05",
    }),
  ],
  30,
)
assert.ok(perf.trustStats)
assert.equal(perf.trustStats.successCount, 1)

const hub = buildStockPickHubHistoryReport([
  {
    ticker: "NVDA",
    name: "NVIDIA",
    snapshot: { price: 112, close: 112 },
  },
])
assert.ok(hub.rows.every((r) => r.resultBadge && r.statusTone))

console.log("yds-pick-lifecycle-trust.test.mjs OK")
