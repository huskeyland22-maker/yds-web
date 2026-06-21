/**
 * 현재 vs YDS 권장 자산배분 비교
 */

/** @typedef {'ok' | 'warn' | 'excess' | 'short'} AllocationStatusId */

/**
 * @typedef {{
 *   status: AllocationStatusId
 *   badge: string
 *   label: string
 * }} AllocationStatus
 */

/**
 * @typedef {{
 *   id: 'stock' | 'cash'
 *   label: string
 *   currentPct: number
 *   recommendedPct: number
 *   deltaPct: number
 *   deltaLabel: string
 *   status: AllocationStatusId
 *   badge: string
 *   statusLabel: string
 * }} AllocationCompareRow
 */

/**
 * @typedef {{
 *   stock: AllocationCompareRow
 *   cash: AllocationCompareRow
 *   maxGapPct: number
 *   postureId: 'aligned' | 'aggressive' | 'defensive' | 'slightly-aggressive' | 'slightly-defensive'
 *   postureLabel: string
 *   postureTone: 'ok' | 'warn' | 'risk'
 * }} AllocationCompareReport
 */

export const ALLOCATION_OK_GAP_PCT = 8
export const ALLOCATION_WARN_GAP_PCT = 20

/**
 * @param {number} signedDelta actual - recommended
 * @returns {AllocationStatus}
 */
export function classifyAllocationDelta(signedDelta) {
  const abs = Math.abs(signedDelta)
  if (abs <= ALLOCATION_OK_GAP_PCT) {
    return { status: "ok", badge: "🟢", label: "적정" }
  }
  if (abs <= ALLOCATION_WARN_GAP_PCT) {
    return { status: "warn", badge: "🟡", label: "주의" }
  }
  if (signedDelta > 0) {
    return { status: "excess", badge: "🔴", label: "과다" }
  }
  return { status: "short", badge: "🔴", label: "부족" }
}

/** @param {number} signedDelta */
export function formatAllocationDelta(signedDelta) {
  const rounded = Math.round(signedDelta)
  if (rounded === 0) return "0%"
  return `${rounded > 0 ? "+" : ""}${rounded}%`
}

/**
 * @param {number} stockDelta
 * @returns {{ postureId: AllocationCompareReport['postureId'], postureLabel: string, postureTone: AllocationCompareReport['postureTone'] }}
 */
export function deriveAllocationPosture(stockDelta) {
  if (Math.abs(stockDelta) <= ALLOCATION_OK_GAP_PCT) {
    return { postureId: "aligned", postureLabel: "권장 배분에 근접", postureTone: "ok" }
  }
  if (stockDelta >= ALLOCATION_WARN_GAP_PCT) {
    return {
      postureId: "aggressive",
      postureLabel: "권장 대비 공격적 (주식 비중 과다)",
      postureTone: "risk",
    }
  }
  if (stockDelta <= -ALLOCATION_WARN_GAP_PCT) {
    return {
      postureId: "defensive",
      postureLabel: "권장 대비 방어적 (주식 비중 부족)",
      postureTone: "warn",
    }
  }
  if (stockDelta > 0) {
    return {
      postureId: "slightly-aggressive",
      postureLabel: "다소 공격적 (주식 비중 높음)",
      postureTone: "warn",
    }
  }
  return {
    postureId: "slightly-defensive",
    postureLabel: "다소 방어적 (현금 비중 높음)",
    postureTone: "warn",
  }
}

/**
 * @param {number} maxGapPct
 * @param {number} maxScore
 * @param {number} [softGap]
 */
export function scoreFromAllocationGap(maxGapPct, maxScore, softGap = ALLOCATION_OK_GAP_PCT) {
  if (maxGapPct <= softGap) return maxScore
  const excess = maxGapPct - softGap
  const ratio = Math.min(1, excess / (ALLOCATION_WARN_GAP_PCT * 1.5))
  return Math.max(0, Math.round(maxScore * (1 - ratio)))
}

/**
 * @param {{
 *   actualStockPct: number
 *   actualCashPct: number
 *   recommendedStockPct: number
 *   recommendedCashPct: number
 * }} input
 * @returns {AllocationCompareReport}
 */
export function buildAllocationCompareReport(input) {
  const currentStock = Math.round(input.actualStockPct)
  const currentCash = Math.round(input.actualCashPct)
  const recStock = Math.round(input.recommendedStockPct)
  const recCash = Math.round(input.recommendedCashPct)

  const stockDelta = currentStock - recStock
  const cashDelta = currentCash - recCash
  const stockStatus = classifyAllocationDelta(stockDelta)
  const cashStatus = classifyAllocationDelta(cashDelta)
  const posture = deriveAllocationPosture(stockDelta)

  /** @param {'stock' | 'cash'} id @param {string} label @param {number} current @param {number} rec @param {number} delta @param {AllocationStatus} st */
  function row(id, label, current, rec, delta, st) {
    return {
      id,
      label,
      currentPct: current,
      recommendedPct: rec,
      deltaPct: delta,
      deltaLabel: formatAllocationDelta(delta),
      status: st.status,
      badge: st.badge,
      statusLabel: st.label,
    }
  }

  return {
    stock: row("stock", "주식", currentStock, recStock, stockDelta, stockStatus),
    cash: row("cash", "현금", currentCash, recCash, cashDelta, cashStatus),
    maxGapPct: Math.max(Math.abs(stockDelta), Math.abs(cashDelta)),
    ...posture,
  }
}
