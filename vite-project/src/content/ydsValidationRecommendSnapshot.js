/**
 * 성과검증 — 추천 당시 점수·시장 스냅샷 (잠금, refresh 시 변경 없음)
 */

import { marketEnvToGrade } from "./ydsStockPickV5Insights.js"

/**
 * @typedef {{
 *   name: string
 *   recommendedPrice: number | null
 *   totalScore: number | null
 *   qualityGrade: string
 *   qualityScore: number | null
 *   timingGrade: string
 *   timingScore: number | null
 *   marketFitGrade: string
 *   marketFitScore: number | null
 *   marketStateLabel: string
 *   panicIntensity: number | null
 *   panicLabel: string
 *   capturedAt: string
 * }} ValidationRecommendSnapshot
 */

/** @param {unknown} v */
function finiteNum(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {string | null | undefined} g */
function normGrade(g) {
  const s = String(g ?? "").trim()
  return s && s !== "undefined" ? s : "—"
}

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} marketContext
 */
export function regimeLabelFromMarketContext(marketContext) {
  const macroId = marketContext?.macroId
  if (macroId === "risk_on") return "리스크온"
  if (macroId === "risk_off") return "리스크오프"
  if (macroId === "neutral") return "중립"
  return marketContext?.strategyLabel ?? "—"
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} marketContext
 * @param {string} recommendedAt
 * @returns {ValidationRecommendSnapshot}
 */
export function buildRecommendSnapshot(stock, marketContext, recommendedAt) {
  const v4 = stock.v4Score
  const price = finiteNum(stock.snapshot?.price ?? stock.snapshot?.close)
  const marketFitScore = finiteNum(
    stock.scoreBreakdown?.marketEnv ?? stock.pickMeta?.marketFitScore ?? stock.scores?.marketFitScore,
  )
  const marketFitGrade =
    stock.pickMeta?.marketFitGrade ?? marketEnvToGrade(marketFitScore ?? 0, 15)
  const regimeLabel = regimeLabelFromMarketContext(marketContext)

  const totalScore = finiteNum(v4?.finalRankScore ?? v4?.total ?? stock.score)

  return {
    name: String(stock.name ?? stock.ticker ?? ""),
    recommendedPrice: price != null && price > 0 ? price : null,
    totalScore,
    qualityGrade: normGrade(v4?.qualityDisplayGrade ?? v4?.qualityGrade),
    qualityScore: finiteNum(v4?.quality ?? stock.scoreBreakdown?.quality),
    timingGrade: normGrade(v4?.timingGrade),
    timingScore: finiteNum(v4?.timing ?? stock.scoreBreakdown?.timing),
    marketFitGrade: normGrade(marketFitGrade),
    marketFitScore: marketFitScore,
    marketStateLabel: String(
      marketContext?.strategyLabel ?? regimeLabel ?? stock.pickMeta?.marketFitGrade ?? "—",
    ),
    panicIntensity: finiteNum(marketContext?.ydsScore),
    panicLabel: String(marketContext?.panicLabel ?? "—"),
    capturedAt: recommendedAt,
  }
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} record
 * @returns {ValidationRecommendSnapshot | null}
 */
export function getRecommendSnapshot(record) {
  if (record.recommendSnapshot?.capturedAt) {
    return record.recommendSnapshot
  }
  return legacySnapshotFromRecord(record)
}

/** @param {import("./ydsValidationStorage.js").ValidationPickRecord} record */
function legacySnapshotFromRecord(record) {
  if (!record.ticker) return null
  return {
    name: record.name,
    recommendedPrice: record.recommendedPrice,
    totalScore: record.recommendedScore,
    qualityGrade: normGrade(record.qualityGrade),
    qualityScore: null,
    timingGrade: normGrade(record.timingGrade),
    timingScore: null,
    marketFitGrade: normGrade(record.marketFitGrade),
    marketFitScore: null,
    marketStateLabel: record.strategyLabel ?? record.regimeLabel ?? "—",
    panicIntensity: null,
    panicLabel: "—",
    capturedAt: record.recommendedAt,
  }
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} record
 * @param {import("./ydsStockPickModel.js").StockPickView | null | undefined} stock
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} marketContext
 */
export function backfillRecommendSnapshot(record, stock, marketContext) {
  if (record.recommendSnapshot?.capturedAt) {
    return applySnapshotToRecord(record, record.recommendSnapshot)
  }
  const today = new Date().toISOString().slice(0, 10)
  if (
    stock?.ticker &&
    stock.dataSource === "live" &&
    record.recommendedAt === today
  ) {
    const snap = buildRecommendSnapshot(stock, marketContext, record.recommendedAt)
    return applySnapshotToRecord(record, snap)
  }
  return applySnapshotToRecord(record, getRecommendSnapshot(record))
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} record
 * @param {ValidationRecommendSnapshot | null} snap
 */
export function applySnapshotToRecord(record, snap) {
  if (!snap) return record
  return {
    ...record,
    name: snap.name || record.name,
    recommendedPrice: snap.recommendedPrice ?? record.recommendedPrice,
    recommendedScore: snap.totalScore ?? record.recommendedScore,
    qualityGrade: snap.qualityGrade,
    timingGrade: snap.timingGrade,
    marketFitGrade: snap.marketFitGrade,
    strategyLabel: snap.marketStateLabel || record.strategyLabel,
    recommendSnapshot: snap,
  }
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} record
 * @param {number | null | undefined} horizon7Pct
 */
export function formatRecommendSnapshotLine(record, horizon7Pct = null) {
  const s = getRecommendSnapshot(record)
  if (!s) return record.name ?? "—"

  const parts = [
    s.totalScore != null ? `총점 ${Math.round(s.totalScore)}` : null,
    s.qualityGrade !== "—" ? `품질 ${s.qualityGrade}` : null,
    s.timingGrade !== "—" ? `타이밍 ${s.timingGrade}` : null,
    s.marketFitGrade !== "—" ? `시장적합 ${s.marketFitGrade}` : null,
  ].filter(Boolean)

  const ret =
    horizon7Pct != null && Number.isFinite(horizon7Pct)
      ? `7일 ${horizon7Pct > 0 ? "+" : ""}${horizon7Pct.toFixed(1)}%`
      : null

  return [record.name, ...parts, ret].filter(Boolean).join(" · ")
}
