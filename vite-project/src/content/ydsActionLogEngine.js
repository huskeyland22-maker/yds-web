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

/** @typedef {'buy' | 'sell' | 'watch'} QuickActionType */

/**
 * @typedef {{
 *   usPct?: number
 *   krPct?: number
 *   cashPct?: number
 *   quickAction?: QuickActionType | null
 *   ticker?: string
 *   memo?: string
 *   date?: string
 *   startAsset?: number | null
 *   endAsset?: number | null
 *   useExplicitAllocation?: boolean
 *   holdings?: PortfolioStockHoldings
 * }} ActionLogInput
 */

/** @typedef {{ stockPct: number; cashPct: number }} PortfolioStockHoldings */

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
/**
 * @param {import("./ydsPortfolioAllocationEngine.js").AssetAllocation} recommended
 * @param {PortfolioStockHoldings} [holdings]
 */
export function deriveActualFromPortfolioHoldings(recommended, holdings) {
  const stockPct = holdings?.stockPct ?? recommended.usPct + recommended.krPct
  const cashPct = holdings?.cashPct ?? recommended.cashPct
  const stockRec = recommended.usPct + recommended.krPct
  if (stockRec <= 0) {
    return { usPct: 0, krPct: 0, cashPct: clampPct(cashPct) }
  }
  const usShare = recommended.usPct / stockRec
  const usPct = Math.round(stockPct * usShare)
  const krPct = stockPct - usPct
  return { usPct, krPct, cashPct: clampPct(cashPct) }
}

/**
 * @param {ActionLogInput} input
 * @param {import("./ydsPortfolioAllocationEngine.js").AssetAllocation} recommended
 */
export function resolveActionLogAllocation(input, recommended) {
  const holdings = input.holdings
  if (input.useExplicitAllocation) {
    return normalizeTriple(input)
  }
  if (input.quickAction === "watch") {
    return {
      usPct: recommended.usPct,
      krPct: recommended.krPct,
      cashPct: recommended.cashPct,
    }
  }
  if (input.quickAction === "buy" || input.quickAction === "sell") {
    return deriveActualFromPortfolioHoldings(recommended, holdings)
  }
  if (input.usPct != null && input.krPct != null && input.cashPct != null) {
    return normalizeTriple(input)
  }
  return deriveActualFromPortfolioHoldings(recommended, holdings)
}

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
  const actual = resolveActionLogAllocation(input, recommendedAlloc)
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
    quickAction: input.quickAction ?? existing.quickAction ?? null,
    ticker: String(input.ticker ?? existing.ticker ?? "").trim(),
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
      quickAction: updates.quickAction !== undefined ? updates.quickAction : entry.quickAction,
      ticker: updates.ticker !== undefined ? updates.ticker : entry.ticker,
      memo: updates.memo ?? entry.memo,
      date: updates.date ?? entry.date,
      startAsset: updates.startAsset !== undefined ? updates.startAsset : entry.startAsset,
      endAsset: updates.endAsset !== undefined ? updates.endAsset : entry.endAsset,
      useExplicitAllocation: updates.useExplicitAllocation ?? Boolean(updates.usPct != null),
      holdings: updates.holdings,
    },
    entry,
  )
}

/** @param {QuickActionType | null | undefined} action */
export function quickActionLabel(action) {
  if (action === "buy") return "매수"
  if (action === "sell") return "매도"
  if (action === "watch") return "관망"
  return ""
}
