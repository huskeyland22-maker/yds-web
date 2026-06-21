/**
 * 성과검증 — 추천 당시 점수·시장 스냅샷 (잠금, refresh 시 변경 없음)
 */

import { marketEnvToGrade } from "./ydsStockPickV5Insights.js"
import { serializeRationalesForSnapshot } from "./ydsStockPickRecommendRationale.js"
import { serializeActionGuideForSnapshot } from "./ydsStockPickActionGuide.js"
import { serializeRankTrackForSnapshot } from "./ydsStockPickRankTrack.js"
import { serializeLifecycleForSnapshot } from "./ydsStockPickLifecycle.js"

/**
 * @typedef {{
 *   name: string
 *   recommendedAt: string
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
 *   recommendRationales?: { id: string; category: string; source: string; score: number; max: number; text: string }[]
 *   actionGuide?: { primaryId: string; timingGrade: string; recommendStatusId: string; summary: string; items: { id: string; source: string; text: string }[] }
 *   rankTrack?: { currentRank: number; previousRank: number | null; delta: number | null; badgeId: string; badgeLabel: string }
 *   lifecycle?: { id: string; label: string; hint: string }
 *   capturedAt: string
 *   frozen: boolean
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
  return s && s !== "undefined" && s !== "null" ? s : "—"
}

/** @param {ValidationRecommendSnapshot | null | undefined} snap */
export function isSnapshotFrozen(snap) {
  return Boolean(snap?.frozen && snap?.capturedAt)
}

/** @param {ValidationRecommendSnapshot | null | undefined} snap */
export function hasSnapshotScores(snap) {
  if (!snap) return false
  return (
    snap.totalScore != null ||
    (snap.qualityGrade !== "—" && snap.timingGrade !== "—")
  )
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
  const rationales = serializeRationalesForSnapshot(stock.recommendRationales ?? [])
  const actionGuide = serializeActionGuideForSnapshot(stock.actionGuide)
  const rankTrack = serializeRankTrackForSnapshot(stock.pickMeta?.rankTrack)
  const lifecycle = serializeLifecycleForSnapshot(
    stock.lifecycle ?? stock.pickMeta?.lifecycle ?? { id: "interest", label: "관심", hint: "관찰·등록" },
  )

  return freezeSnapshot({
    name: String(stock.name ?? stock.ticker ?? ""),
    recommendedAt,
    recommendedPrice: price != null && price > 0 ? price : null,
    totalScore,
    qualityGrade: normGrade(v4?.qualityDisplayGrade ?? v4?.qualityGrade),
    qualityScore: finiteNum(v4?.quality ?? stock.scoreBreakdown?.quality),
    timingGrade: normGrade(v4?.timingGrade),
    timingScore: finiteNum(v4?.timing ?? stock.scoreBreakdown?.timing),
    marketFitGrade: normGrade(marketFitGrade),
    marketFitScore: marketFitScore,
    marketStateLabel: String(
      marketContext?.marketStateLabel ??
        marketContext?.strategyLabel ??
        regimeLabel ??
        "—",
    ),
    panicIntensity: finiteNum(marketContext?.ydsScore),
    panicLabel: String(marketContext?.panicLabel ?? "—"),
    recommendRationales: rationales.length ? rationales : undefined,
    actionGuide,
    rankTrack,
    lifecycle: lifecycle.id !== "excluded" ? lifecycle : undefined,
    capturedAt: recommendedAt,
    frozen: true,
  })
}

/** @param {ValidationRecommendSnapshot} snap */
function freezeSnapshot(snap) {
  return Object.freeze({ ...snap, frozen: true })
}

/** @param {import("./ydsStockPickModel.js").StockPickView} stock */
export function stockReadyForRecommendCapture(stock) {
  if (!stock?.ticker || stock.dataSource !== "live") return false
  const v4 = stock.v4Score
  if (v4?.finalRankScore != null || v4?.total != null) return true
  if (v4?.qualityGrade && v4?.timingGrade) return true
  return finiteNum(stock.score) != null
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} record
 * @param {string} [recommendedAt]
 */
export function snapshotFromRecordFields(record, recommendedAt) {
  const at = recommendedAt ?? record.recommendedAt
  return freezeSnapshot({
    name: record.name,
    recommendedAt: at,
    recommendedPrice: record.recommendedPrice,
    totalScore: record.recommendedScore,
    qualityGrade: normGrade(record.qualityGrade),
    qualityScore: null,
    timingGrade: normGrade(record.timingGrade),
    timingScore: null,
    marketFitGrade: normGrade(record.marketFitGrade),
    marketFitScore: null,
    marketStateLabel: record.strategyLabel ?? record.regimeLabel ?? "—",
    panicIntensity: record.recommendSnapshot?.panicIntensity ?? null,
    panicLabel: record.recommendSnapshot?.panicLabel ?? "—",
    capturedAt: at,
    frozen: true,
  })
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
  const hasGrades =
    record.recommendedScore != null ||
    record.qualityGrade !== "—" ||
    record.timingGrade !== "—"
  if (!hasGrades && !record.recommendedPrice) return null

  return {
    name: record.name,
    recommendedAt: record.recommendedAt,
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
    frozen: false,
  }
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} record
 */
export function migrateRecommendSnapshot(record) {
  if (isSnapshotFrozen(record.recommendSnapshot) && hasSnapshotScores(record.recommendSnapshot)) {
    return applySnapshotToRecord(record, record.recommendSnapshot)
  }

  if (record.recommendSnapshot?.capturedAt && hasSnapshotScores(record.recommendSnapshot)) {
    return applySnapshotToRecord(record, freezeSnapshot({ ...record.recommendSnapshot, frozen: true }))
  }

  const legacy = legacySnapshotFromRecord(record)
  if (legacy && hasSnapshotScores(legacy)) {
    return applySnapshotToRecord(record, freezeSnapshot({ ...legacy, frozen: true }))
  }

  return record
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} record
 * @param {import("./ydsStockPickModel.js").StockPickView | null | undefined} stock
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} marketContext
 */
export function backfillRecommendSnapshot(record, stock, marketContext) {
  if (isSnapshotFrozen(record.recommendSnapshot) && hasSnapshotScores(record.recommendSnapshot)) {
    return applySnapshotToRecord(record, record.recommendSnapshot)
  }

  if (record.recommendSnapshot?.capturedAt && hasSnapshotScores(record.recommendSnapshot)) {
    return applySnapshotToRecord(record, freezeSnapshot({ ...record.recommendSnapshot, frozen: true }))
  }

  const today = new Date().toISOString().slice(0, 10)
  if (
    stock?.ticker &&
    stock.dataSource === "live" &&
    record.recommendedAt === today &&
    stockReadyForRecommendCapture(stock)
  ) {
    const snap = buildRecommendSnapshot(stock, marketContext, record.recommendedAt)
    return applySnapshotToRecord(record, snap)
  }

  return migrateRecommendSnapshot(record)
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} record
 * @param {ValidationRecommendSnapshot | null} snap
 */
export function applySnapshotToRecord(record, snap) {
  if (!snap) return record

  const existing = record.recommendSnapshot
  if (
    isSnapshotFrozen(existing) &&
    hasSnapshotScores(existing) &&
    (!hasSnapshotScores(snap) || !snap.frozen)
  ) {
    snap = existing
  }

  return {
    ...record,
    name: snap.name || record.name,
    recommendedAt: snap.recommendedAt || record.recommendedAt,
    recommendedPrice: snap.recommendedPrice ?? record.recommendedPrice,
    recommendedScore: snap.totalScore ?? record.recommendedScore,
    qualityGrade: snap.qualityGrade,
    timingGrade: snap.timingGrade,
    marketFitGrade: snap.marketFitGrade,
    strategyLabel: snap.marketStateLabel || record.strategyLabel,
    recommendSnapshot: snap.frozen ? snap : freezeSnapshot({ ...snap, frozen: true }),
  }
}

/** @param {number | null | undefined} price */
export function formatSnapshotPrice(price) {
  if (price == null || !Number.isFinite(price) || price <= 0) return "—"
  return price >= 1000
    ? price.toLocaleString("ko-KR", { maximumFractionDigits: 2 })
    : price.toFixed(2)
}

/**
 * @param {ValidationRecommendSnapshot | null | undefined} snap
 * @param {'quality' | 'timing' | 'marketFit'} kind
 */
export function formatSnapshotGradeCell(snap, kind) {
  if (!snap) return "—"
  const grade =
    kind === "quality"
      ? snap.qualityGrade
      : kind === "timing"
        ? snap.timingGrade
        : snap.marketFitGrade
  const score =
    kind === "quality"
      ? snap.qualityScore
      : kind === "timing"
        ? snap.timingScore
        : snap.marketFitScore

  if (grade === "—" && score == null) return "—"
  if (score != null) return `${grade} (${Math.round(score)})`
  return grade
}

/** @param {ValidationRecommendSnapshot | null | undefined} snap */
export function formatSnapshotTotalScore(snap) {
  if (!snap || snap.totalScore == null || !Number.isFinite(snap.totalScore)) return "—"
  return String(Math.round(snap.totalScore))
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
    s.recommendedPrice != null ? `추천가 ${formatSnapshotPrice(s.recommendedPrice)}` : null,
  ].filter(Boolean)

  const ret =
    horizon7Pct != null && Number.isFinite(horizon7Pct)
      ? `7일 ${horizon7Pct > 0 ? "+" : ""}${horizon7Pct.toFixed(1)}%`
      : null

  return [record.name, ...parts, ret].filter(Boolean).join(" · ")
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} record
 */
export function pickDisplayFieldsFromSnapshot(record) {
  const s = getRecommendSnapshot(record)
  return {
    name: s?.name ?? record.name,
    recommendedAt: s?.recommendedAt ?? record.recommendedAt,
    recommendedPrice: s?.recommendedPrice ?? record.recommendedPrice,
    totalScore: s?.totalScore ?? record.recommendedScore,
    qualityGrade: s?.qualityGrade ?? record.qualityGrade,
    qualityScore: s?.qualityScore ?? null,
    timingGrade: s?.timingGrade ?? record.timingGrade,
    timingScore: s?.timingScore ?? null,
    marketFitGrade: s?.marketFitGrade ?? record.marketFitGrade,
    marketFitScore: s?.marketFitScore ?? null,
    marketStateLabel: s?.marketStateLabel ?? record.strategyLabel,
    panicLabel: s?.panicLabel ?? "—",
  }
}
