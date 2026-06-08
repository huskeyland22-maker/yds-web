/**
 * YDS Phase 4-1 — 행동 로그 엔진
 */

import { computeCompliance } from "./ydsComplianceEngine.js"
import { computeReturnPct } from "./ydsReturnEngine.js"
import { computeRecommendedAssetAllocation } from "./ydsPortfolioAllocationEngine.js"
import {
  createActionLogId,
  todayDateKey,
} from "./ydsActionLogStorage.js"

/** @typedef {import("./ydsActionLogStorage.js").YdsActionLogEntry} YdsActionLogEntry */

/** @typedef {import("./ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */

/**
 * @typedef {{
 *   usPct: number
 *   krPct: number
 *   cashPct: number
 *   memo?: string
 *   date?: string
 *   startAsset?: number | null
 *   endAsset?: number | null
 * }} ActionLogInput
 */

/**
 * @param {YdsMarketAdapterContext} context
 * @returns {import("./ydsActionLogStorage.js").YdsActionLogStateSnapshot}
 */
export function snapshotYdsState(context) {
  return {
    panicLabel: context.panicLabel,
    strategyLabel: context.strategyLabel,
    cycleLabel: context.cycleLabel,
    marketLabel: context.marketLabel,
    macroId: context.macroId,
    ydsScore: context.ydsScore,
  }
}

/**
 * @param {YdsMarketAdapterContext} context
 * @param {ActionLogInput} input
 * @param {Partial<YdsActionLogEntry>} [existing]
 * @returns {YdsActionLogEntry}
 */
export function buildActionLogEntry(context, input, existing = {}) {
  const recommendedAlloc = existing.recommended
    ? {
        usPct: existing.recommended.usPct,
        krPct: existing.recommended.krPct,
        cashPct: existing.recommended.cashPct,
        stockPct: existing.recommended.usPct + existing.recommended.krPct,
        note: "",
      }
    : computeRecommendedAssetAllocation(context)
  const actual = normalizeTriple(input)
  const compliance = computeCompliance(recommendedAlloc, actual)
  const returnPct = computeReturnPct(input.startAsset, input.endAsset)
  const now = Date.now()

  return {
    id: existing.id ?? createActionLogId(),
    date: input.date ?? existing.date ?? todayDateKey(),
    createdAt: existing.createdAt ?? now,
    updatedAt: now,
    memo: String(input.memo ?? existing.memo ?? "").trim(),
    ydsState: existing.ydsState ?? snapshotYdsState(context),
    recommended: {
      usPct: recommendedAlloc.usPct,
      krPct: recommendedAlloc.krPct,
      cashPct: recommendedAlloc.cashPct,
    },
    actual,
    compliance,
    compliancePct: compliance.compliancePct,
    gapPct: compliance.gapPct,
    startAsset: parseAsset(input.startAsset ?? existing.startAsset),
    endAsset: parseAsset(input.endAsset ?? existing.endAsset),
    returnPct,
  }
}

/**
 * @param {ActionLogInput} input
 */
function normalizeTriple(input) {
  let usPct = clampPct(Number(input.usPct) || 0)
  let krPct = clampPct(Number(input.krPct) || 0)
  let cashPct = clampPct(Number(input.cashPct) || 0)
  const sum = usPct + krPct + cashPct
  if (sum !== 100 && sum > 0) {
    usPct = Math.round((usPct / sum) * 100)
    krPct = Math.round((krPct / sum) * 100)
    cashPct = 100 - usPct - krPct
  }
  return { usPct, krPct, cashPct }
}

/** @param {number | null | undefined} v */
function parseAsset(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** @param {number} n */
function clampPct(n) {
  return Math.max(0, Math.min(100, Math.round(n)))
}

/**
 * @param {YdsActionLogEntry} entry
 * @param {YdsMarketAdapterContext} context
 * @param {ActionLogInput} updates
 */
export function updateActionLogEntry(entry, context, updates) {
  return buildActionLogEntry(
    context,
    {
      usPct: updates.usPct ?? entry.actual.usPct,
      krPct: updates.krPct ?? entry.actual.krPct,
      cashPct: updates.cashPct ?? entry.actual.cashPct,
      memo: updates.memo ?? entry.memo,
      date: updates.date ?? entry.date,
      startAsset: updates.startAsset !== undefined ? updates.startAsset : entry.startAsset,
      endAsset: updates.endAsset !== undefined ? updates.endAsset : entry.endAsset,
    },
    entry,
  )
}
