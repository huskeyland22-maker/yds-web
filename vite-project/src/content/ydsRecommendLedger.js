/**
 * 추천 이력 영구 원장 — 불변(immutable) 추천 기록 + 가변(현재가·수익) 갱신
 * localStorage(v2) 유지 · Supabase 이전 대비 확장 스키마
 */

import { computePickReturnExtremes } from "./ydsPickLifecycleEngine.js"

export const RECOMMEND_LEDGER_VERSION = 1

/** @typedef {'active' | 'ended' | 'excluded'} RecommendLedgerState */

/**
 * @typedef {{
 *   capturedAt: number
 *   panicIntensity: number | null
 *   panicLabel: string | null
 *   marketStateLabel: string | null
 *   cycleStageId: string | null
 *   cycleLabel: string | null
 *   macroId: string | null
 *   strategyLabel: string | null
 *   vix: number | null
 *   cnn: number | null
 *   bofa: number | null
 * }} RecommendMarketLedger
 */

/** @param {number} [recordedAt] */
export function formatRecommendAtIso(recordedAt = Date.now()) {
  const d = new Date(recordedAt)
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * @param {'US' | 'KR'} country
 * @param {string} ticker
 * @param {number} recordedAt
 */
export function generateRecommendLedgerId(country, ticker, recordedAt) {
  return `rec-${recordedAt}-${country}-${String(ticker).toUpperCase()}`
}

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} marketContext
 * @param {object | null | undefined} panicData
 */
export function buildMarketLedgerSnapshot(marketContext, panicData) {
  const toNum = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return /** @type {RecommendMarketLedger} */ ({
    capturedAt: Date.now(),
    panicIntensity: marketContext?.ydsScore ?? null,
    panicLabel: marketContext?.panicLabel ?? null,
    marketStateLabel:
      marketContext?.unifiedMarketStateLabel ?? marketContext?.marketStateLabel ?? null,
    cycleStageId: marketContext?.cycleStageId ?? null,
    cycleLabel: marketContext?.cycleLabel ?? null,
    macroId: marketContext?.macroId ?? null,
    strategyLabel: marketContext?.strategyLabel ?? null,
    vix: toNum(panicData?.vix),
    cnn: toNum(panicData?.fearGreed),
    bofa: toNum(panicData?.bofa),
  })
}

/** @param {import("./ydsValidationRecommendSnapshot.js").ValidationRecommendSnapshot | null | undefined} snap */
function buildMarketLedgerFromSnapshot(snap) {
  if (!snap) return null
  return /** @type {RecommendMarketLedger} */ ({
    capturedAt: Date.now(),
    panicIntensity: snap.panicIntensity ?? null,
    panicLabel: snap.panicLabel ?? null,
    marketStateLabel: snap.unifiedMarketStateLabel ?? snap.marketStateLabel ?? null,
    cycleStageId: null,
    cycleLabel: null,
    macroId: null,
    strategyLabel: snap.marketStateLabel ?? null,
    vix: null,
    cnn: null,
    bofa: null,
  })
}

/** @param {import("./ydsValidationStorage.js").ValidationPickRecord} record */
export function resolveRecommendReasonFromRecord(record) {
  const rationales = record.recommendSnapshot?.recommendRationales ?? []
  const first = rationales.find((r) => r?.text)?.text
  if (first) return String(first)
  const guide = record.recommendSnapshot?.actionGuide?.summary
  if (guide) return String(guide)
  if (record.strategyLabel && record.strategyLabel !== "—") return record.strategyLabel
  return "—"
}

/** @param {import("./ydsValidationStorage.js").ValidationPickRecord} record */
export function resolveRecommendGradeFromRecord(record) {
  const snap = record.recommendSnapshot
  const q = snap?.qualityGrade ?? record.qualityGrade ?? "—"
  const t = snap?.timingGrade ?? record.timingGrade ?? "—"
  if (q === "—" && t === "—") return "—"
  return `${q} · ${t}`
}

/** @param {string | null | undefined} lifecycleId @param {string | null | undefined} statusId */
export function mapLifecycleToLedgerState(lifecycleId, statusId) {
  if (statusId === "excluded" || statusId === "overheat") return "excluded"
  if (lifecycleId === "active") return "active"
  return "ended"
}

/** @param {import("./ydsValidationStorage.js").ValidationPickRecord | null | undefined} record */
export function isPickImmutableSealed(record) {
  if (!record) return false
  return Boolean(
    record.immutableSealed ||
      (record.recommendSnapshot?.frozen && record.recommendSnapshot?.capturedAt),
  )
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} record
 * @param {{
 *   currentPrice?: number | null
 *   returnPct?: number | null
 *   maxReturnPct?: number | null
 *   minReturnPct?: number | null
 *   priceLog?: Record<string, number>
 *   horizonPrices?: import("./ydsValidationStorage.js").ValidationHorizonPrices
 *   horizons?: import("./ydsValidationStorage.js").ValidationHorizonReturns
 *   lifecycleId?: string
 *   lifecycleLabel?: string
 *   closedAt?: string | null
 *   closeReason?: string | null
 *   finalReturnPct?: number | null
 *   ledgerState?: RecommendLedgerState
 * }} mutable
 */
export function applyMutablePickUpdate(record, mutable) {
  const lockedPrice =
    record.lockedRecommendedPrice ?? record.recommendedPrice ?? null
  const lockedAt = record.lockedRecommendedAt ?? record.recommendedAt
  const lockedAtIso = record.lockedRecommendedAtIso ?? record.recommendedAtIso
  const snap = record.recommendSnapshot

  const immutableCore = isPickImmutableSealed(record)
    ? {
        id: record.id,
        ticker: record.ticker,
        name: snap?.name ?? record.name,
        country: record.country,
        rank: record.rank,
        isTop3: record.isTop3,
        recommendedAt: lockedAt,
        recommendedAtIso: lockedAtIso,
        recommendedPrice: lockedPrice,
        recommendedScore: snap?.totalScore ?? record.recommendedScore,
        qualityGrade: snap?.qualityGrade ?? record.qualityGrade,
        timingGrade: snap?.timingGrade ?? record.timingGrade,
        marketFitGrade: snap?.marketFitGrade ?? record.marketFitGrade,
        statusId: record.statusId,
        statusLabel: record.statusLabel,
        regimeId: record.regimeId,
        regimeLabel: record.regimeLabel,
        strategyLabel: snap?.marketStateLabel ?? record.strategyLabel,
        recommendSnapshot: snap ?? record.recommendSnapshot,
        marketLedger: record.marketLedger,
        recommendReason: record.recommendReason,
        recommendGrade: record.recommendGrade,
        recordedAt: record.recordedAt,
        immutableSealed: true,
        ledgerVersion: record.ledgerVersion ?? RECOMMEND_LEDGER_VERSION,
        lockedRecommendedPrice: lockedPrice,
        lockedRecommendedAt: lockedAt,
        lockedRecommendedAtIso: lockedAtIso,
      }
    : record

  return {
    ...immutableCore,
    currentPrice: mutable.currentPrice ?? record.currentPrice,
    returnPct: mutable.returnPct ?? record.returnPct,
    maxReturnPct: mutable.maxReturnPct ?? record.maxReturnPct,
    minReturnPct: mutable.minReturnPct ?? record.minReturnPct,
    priceLog: mutable.priceLog ?? record.priceLog,
    horizonPrices: mutable.horizonPrices ?? record.horizonPrices,
    horizons: mutable.horizons ?? record.horizons,
    lifecycleId: mutable.lifecycleId ?? record.lifecycleId,
    lifecycleLabel: mutable.lifecycleLabel ?? record.lifecycleLabel,
    closedAt: mutable.closedAt ?? record.closedAt,
    closeReason: mutable.closeReason ?? record.closeReason,
    finalReturnPct: mutable.finalReturnPct ?? record.finalReturnPct,
    ledgerState:
      mutable.ledgerState ??
      record.ledgerState ??
      mapLifecycleToLedgerState(record.lifecycleId, record.statusId),
    lastUpdatedAt: Date.now(),
  }
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} record
 * @param {number | null | undefined} returnPct
 */
export function resolveRunningReturnExtremes(record, returnPct) {
  const { maxRet, minRet } = computePickReturnExtremes({
    ...record,
    returnPct: returnPct ?? record.returnPct,
  })
  let maxReturnPct = record.maxReturnPct ?? maxRet
  let minReturnPct = record.minReturnPct ?? minRet
  if (returnPct != null && Number.isFinite(returnPct)) {
    if (maxReturnPct == null || returnPct > maxReturnPct) maxReturnPct = returnPct
    if (minReturnPct == null || returnPct < minReturnPct) minReturnPct = returnPct
  }
  if (maxRet != null && (maxReturnPct == null || maxRet > maxReturnPct)) maxReturnPct = maxRet
  if (minRet != null && (minReturnPct == null || minRet < minReturnPct)) minReturnPct = minRet
  return { maxReturnPct, minReturnPct }
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} record
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} [marketContext]
 * @param {object | null | undefined} [panicData]
 */
export function sealNewRecommendLedgerRecord(record, marketContext, panicData) {
  const recordedAt = record.recordedAt || Date.now()
  const recommendedAt = String(record.recommendedAt ?? "").slice(0, 10)
  const country = record.country === "KR" ? "KR" : "US"
  const id =
    record.id && String(record.id).startsWith("rec-")
      ? record.id
      : generateRecommendLedgerId(country, record.ticker, recordedAt)

  return {
    ...record,
    id,
    recordedAt,
    recommendedAt,
    recommendedAtIso: formatRecommendAtIso(recordedAt),
    ledgerVersion: RECOMMEND_LEDGER_VERSION,
    immutableSealed: true,
    lockedRecommendedPrice: record.recommendedPrice,
    lockedRecommendedAt: recommendedAt,
    lockedRecommendedAtIso: formatRecommendAtIso(recordedAt),
    marketLedger:
      record.marketLedger ??
      buildMarketLedgerSnapshot(marketContext, panicData) ??
      buildMarketLedgerFromSnapshot(record.recommendSnapshot),
    recommendReason: record.recommendReason ?? resolveRecommendReasonFromRecord(record),
    recommendGrade: record.recommendGrade ?? resolveRecommendGradeFromRecord(record),
    ledgerState: mapLifecycleToLedgerState(record.lifecycleId, record.statusId),
    maxReturnPct: record.maxReturnPct ?? record.returnPct ?? null,
    minReturnPct: record.minReturnPct ?? record.returnPct ?? null,
  }
}

/** @param {import("./ydsValidationStorage.js").ValidationPickRecord} record */
export function migratePickToRecommendLedger(record) {
  if (record.ledgerVersion >= RECOMMEND_LEDGER_VERSION && record.immutableSealed) {
    return record
  }
  const recordedAt = record.recordedAt || Date.now()
  return sealNewRecommendLedgerRecord({
    ...record,
    recommendReason: record.recommendReason ?? resolveRecommendReasonFromRecord(record),
    recommendGrade: record.recommendGrade ?? resolveRecommendGradeFromRecord(record),
    marketLedger:
      record.marketLedger ?? buildMarketLedgerFromSnapshot(record.recommendSnapshot),
    ledgerState:
      record.ledgerState ?? mapLifecycleToLedgerState(record.lifecycleId, record.statusId),
    maxReturnPct: record.maxReturnPct ?? null,
    minReturnPct: record.minReturnPct ?? null,
  })
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord[]} existing
 * @param {'US' | 'KR'} country
 * @param {string} ticker
 * @param {string} today
 */
export function hasAutoCapturePickToday(existing, country, ticker, today) {
  const sym = String(ticker).toUpperCase()
  return (existing ?? []).some(
    (p) =>
      p.country === country &&
      String(p.ticker).toUpperCase() === sym &&
      String(p.recommendedAt).slice(0, 10) === today,
  )
}
