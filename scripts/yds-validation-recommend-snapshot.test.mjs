import assert from "node:assert/strict"
import {
  applySnapshotToRecord,
  backfillRecommendSnapshot,
  buildRecommendSnapshot,
  formatRecommendSnapshotLine,
  formatSnapshotGradeCell,
  getRecommendSnapshot,
  isSnapshotFrozen,
  migrateRecommendSnapshot,
} from "../vite-project/src/content/ydsValidationRecommendSnapshot.js"

/** @type {import("../vite-project/src/content/ydsStockPickModel.js").StockPickView} */
const stock = {
  ticker: "AMD",
  name: "AMD",
  country: "US",
  rank: 1,
  dataSource: "live",
  score: 95,
  scoreBreakdown: { quality: 68, timing: 22, marketEnv: 12 },
  v4Score: {
    finalRankScore: 95,
    total: 95,
    quality: 68,
    timing: 22,
    qualityGrade: "A",
    qualityDisplayGrade: "A",
    timingGrade: "B",
  },
  snapshot: { price: 511.57, close: 511.57 },
  pickMeta: { marketFitGrade: "A", marketFitScore: 12 },
}

const marketContext = {
  strategyLabel: "조정 구간 진입",
  marketStateLabel: "조정 진행 중",
  ydsScore: 45,
  panicLabel: "관심",
}

const snap = buildRecommendSnapshot(stock, marketContext, "2026-06-16")
assert.equal(snap.totalScore, 95)
assert.equal(snap.qualityScore, 68)
assert.equal(snap.timingGrade, "B")
assert.equal(snap.recommendedPrice, 511.57)
assert.equal(isSnapshotFrozen(snap), true)

/** @type {import("../vite-project/src/content/ydsValidationStorage.js").ValidationPickRecord} */
const record = {
  id: "2026-06-16:US:AMD",
  ticker: "AMD",
  name: "AMD",
  country: "US",
  rank: 1,
  isTop3: true,
  recommendedAt: "2026-06-16",
  recommendedPrice: 511.57,
  recommendedScore: 95,
  qualityGrade: "A",
  timingGrade: "B",
  marketFitGrade: "A",
  statusId: "trend",
  statusLabel: "추세",
  currentPrice: null,
  returnPct: null,
  horizons: { d7: 5, d14: null, d30: null, d90: null, d180: null, d365: null },
  horizonPrices: { d7: null, d14: null, d30: null, d90: null, d180: null, d365: null },
  priceLog: {},
  regimeId: "neutral",
  regimeLabel: "중립",
  strategyLabel: "조정 구간 진입",
  recommendSnapshot: snap,
  recordedAt: 1,
  lastUpdatedAt: 1,
}

const line = formatRecommendSnapshotLine(record, 5)
assert.match(line, /AMD/)
assert.match(line, /총점 95/)
assert.match(line, /추천가 511\.57/)
assert.match(line, /7일 \+5\.0%/)
assert.equal(formatSnapshotGradeCell(snap, "quality"), "A (68)")

const refreshed = backfillRecommendSnapshot(record, { ...stock, v4Score: { finalRankScore: 10, qualityGrade: "F", timingGrade: "F" } }, marketContext)
assert.equal(getRecommendSnapshot(refreshed)?.totalScore, 95)
assert.equal(getRecommendSnapshot(refreshed)?.qualityGrade, "A")

/** @type {import("../vite-project/src/content/ydsValidationStorage.js").ValidationPickRecord} */
const legacy = {
  ...record,
  recommendSnapshot: null,
  recommendedScore: 88,
  qualityGrade: "A",
  timingGrade: "A",
  marketFitGrade: "B",
}
const migrated = migrateRecommendSnapshot(legacy)
assert.equal(getRecommendSnapshot(migrated)?.totalScore, 88)
assert.equal(isSnapshotFrozen(getRecommendSnapshot(migrated)), true)

const applied = applySnapshotToRecord(record, snap)
assert.equal(applied.recommendSnapshot?.totalScore, 95)

console.log("yds-validation-recommend-snapshot.test.mjs OK")
