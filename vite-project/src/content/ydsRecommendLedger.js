/**
 * 추천 이력 영구 원장 — 불변(immutable) 추천 기록 + 가변(현재가·수익) 갱신
 * localStorage(v2) 유지 · Supabase 이전 대비 확장 스키마
 */

import { computePickReturnExtremes } from "./ydsPickLifecycleEngine.js"

export const RECOMMEND_LEDGER_VERSION = 1

/** @param {unknown} value */
function toPositivePrice(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

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
 *   recommendedPrice?: number | null
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
export function buildMarketLedgerSnapshot(marketContext, panicData, recommendedPrice = null) {
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
    recommendedPrice: toNum(recommendedPrice),
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
    recommendedPrice: toPositivePrice(snap.recommendedPrice),
  })
}

/** @param {import("./ydsValidationStorage.js").ValidationPickRecord | null | undefined} record */
export function resolveImmutableRecommendedPrice(record) {
  if (!record) return null
  const lockedAt = String(record.lockedRecommendedAt ?? record.recommendedAt ?? "").slice(0, 10)
  return (
    toPositivePrice(record.lockedRecommendedPrice) ??
    (lockedAt ? toPositivePrice(record.priceLog?.[lockedAt]) : null) ??
    toPositivePrice(record.recommendSnapshot?.recommendedPrice) ??
    toPositivePrice(record.marketLedger?.recommendedPrice) ??
    toPositivePrice(record.recommendedPrice)
  )
}

/** @param {import("./ydsValidationStorage.js").ValidationPickRecord | null | undefined} record */
export function resolveImmutableRecommendedAt(record) {
  return String(record?.lockedRecommendedAt ?? record?.recommendedAt ?? "").slice(0, 10) || null
}

/**
 * @param {string} source
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} before
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} after
 */
export function logImmutableLedgerViolation(source, before, after) {
  console.error("[immutable-ledger]", {
    source,
    id: before.id,
    ticker: before.ticker,
    recommendedAtBefore: before.recommendedAt,
    recommendedAtAfter: after.recommendedAt,
    recommendedPriceBefore: before.recommendedPrice,
    recommendedPriceAfter: after.recommendedPrice,
    lockedRecommendedPriceBefore: before.lockedRecommendedPrice ?? null,
    lockedRecommendedPriceAfter: after.lockedRecommendedPrice ?? null,
    snapshotRecommendedPriceBefore: before.recommendSnapshot?.recommendedPrice ?? null,
    snapshotRecommendedPriceAfter: after.recommendSnapshot?.recommendedPrice ?? null,
  })
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} record
 * @param {string} source
 */
export function repairImmutableLedgerRecord(record, source = "unknown") {
  if (!isPickImmutableSealed(record)) return record

  const lockedPrice = resolveImmutableRecommendedPrice(record)
  const lockedAt = resolveImmutableRecommendedAt(record) ?? record.recommendedAt
  const lockedAtIso = repaired.lockedRecommendedAtIso ?? repaired.recommendedAtIso
  const nextSnapshot = record.recommendSnapshot
    ? Object.freeze({
        ...record.recommendSnapshot,
        recommendedAt: lockedAt,
        recommendedPrice: lockedPrice ?? record.recommendSnapshot.recommendedPrice ?? null,
        frozen: true,
      })
    : record.recommendSnapshot
  const nextMarketLedger = record.marketLedger
    ? {
        ...record.marketLedger,
        recommendedPrice: lockedPrice ?? record.marketLedger.recommendedPrice ?? null,
      }
    : record.marketLedger

  const next = {
    ...record,
    recommendedAt: lockedAt,
    recommendedAtIso: lockedAtIso,
    recommendedPrice: lockedPrice,
    lockedRecommendedPrice: lockedPrice,
    lockedRecommendedAt: lockedAt,
    lockedRecommendedAtIso: lockedAtIso,
    recommendSnapshot: nextSnapshot,
    marketLedger: nextMarketLedger,
    immutableSealed: true,
    ledgerVersion: record.ledgerVersion ?? RECOMMEND_LEDGER_VERSION,
  }

  if (
    record.recommendedPrice !== next.recommendedPrice ||
    record.lockedRecommendedPrice !== next.lockedRecommendedPrice ||
    record.recommendedAt !== next.recommendedAt
  ) {
    logImmutableLedgerViolation(`${source}:repair`, record, next)
  }
  return next
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
  const repaired = repairImmutableLedgerRecord(record, "applyMutablePickUpdate:input")
  const lockedPrice = resolveImmutableRecommendedPrice(repaired)
  const lockedAt = resolveImmutableRecommendedAt(repaired) ?? repaired.recommendedAt
  const lockedAtIso = record.lockedRecommendedAtIso ?? record.recommendedAtIso
  const snap = repaired.recommendSnapshot

  const immutableCore = isPickImmutableSealed(repaired)
    ? {
        id: repaired.id,
        ticker: repaired.ticker,
        name: snap?.name ?? repaired.name,
        country: repaired.country,
        rank: repaired.rank,
        isTop3: repaired.isTop3,
        recommendedAt: lockedAt,
        recommendedAtIso: lockedAtIso,
        recommendedPrice: lockedPrice,
        recommendedScore: snap?.totalScore ?? repaired.recommendedScore,
        qualityGrade: snap?.qualityGrade ?? repaired.qualityGrade,
        timingGrade: snap?.timingGrade ?? repaired.timingGrade,
        marketFitGrade: snap?.marketFitGrade ?? repaired.marketFitGrade,
        statusId: repaired.statusId,
        statusLabel: repaired.statusLabel,
        regimeId: repaired.regimeId,
        regimeLabel: repaired.regimeLabel,
        strategyLabel: snap?.marketStateLabel ?? repaired.strategyLabel,
        recommendSnapshot: snap ?? repaired.recommendSnapshot,
        marketLedger: repaired.marketLedger,
        recommendReason: repaired.recommendReason,
        recommendGrade: repaired.recommendGrade,
        recordedAt: repaired.recordedAt,
        immutableSealed: true,
        ledgerVersion: repaired.ledgerVersion ?? RECOMMEND_LEDGER_VERSION,
        lockedRecommendedPrice: lockedPrice,
        lockedRecommendedAt: lockedAt,
        lockedRecommendedAtIso: lockedAtIso,
      }
    : repaired

  return {
    ...immutableCore,
    currentPrice: mutable.currentPrice ?? repaired.currentPrice,
    returnPct: mutable.returnPct ?? repaired.returnPct,
    maxReturnPct: mutable.maxReturnPct ?? repaired.maxReturnPct,
    minReturnPct: mutable.minReturnPct ?? repaired.minReturnPct,
    priceLog: mutable.priceLog ?? repaired.priceLog,
    horizonPrices: mutable.horizonPrices ?? repaired.horizonPrices,
    horizons: mutable.horizons ?? repaired.horizons,
    lifecycleId: mutable.lifecycleId ?? repaired.lifecycleId,
    lifecycleLabel: mutable.lifecycleLabel ?? repaired.lifecycleLabel,
    closedAt: mutable.closedAt ?? repaired.closedAt,
    closeReason: mutable.closeReason ?? repaired.closeReason,
    finalReturnPct: mutable.finalReturnPct ?? repaired.finalReturnPct,
    ledgerState:
      mutable.ledgerState ??
      repaired.ledgerState ??
      mapLifecycleToLedgerState(repaired.lifecycleId, repaired.statusId),
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
  const lockedPrice = resolveImmutableRecommendedPrice(record)
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
    recommendedPrice: lockedPrice,
    recommendedAtIso: formatRecommendAtIso(recordedAt),
    ledgerVersion: RECOMMEND_LEDGER_VERSION,
    immutableSealed: true,
    lockedRecommendedPrice: lockedPrice,
    lockedRecommendedAt: recommendedAt,
    lockedRecommendedAtIso: formatRecommendAtIso(recordedAt),
    marketLedger:
      record.marketLedger ??
      buildMarketLedgerSnapshot(marketContext, panicData, lockedPrice) ??
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
    return repairImmutableLedgerRecord(record, "migratePickToRecommendLedger")
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
