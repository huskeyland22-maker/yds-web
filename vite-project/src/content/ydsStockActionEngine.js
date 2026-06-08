/**
 * YDS Phase 2-5 — 점수 → 상태 · 행동 변환
 */

/** @typedef {'trend' | 'dip' | 'interest' | 'overheat'} StockActionStatusId */
/** @typedef {'hold' | 'watchlist' | 'scale_in' | 'no_chase'} StockActionId */

/**
 * @typedef {{
 *   id: StockActionStatusId
 *   emoji: string
 *   label: string
 *   description: string
 * }} StockStatusView
 */

/**
 * @typedef {{
 *   id: StockActionId
 *   emoji: string
 *   label: string
 * }} StockActionView
 */

/**
 * @typedef {{
 *   stockStatus: StockStatusView
 *   stockAction: StockActionView
 *   actionReason: string
 *   statusId: StockActionStatusId
 *   actionId: StockActionId
 * }} StockActionResult
 */

export const STOCK_STATUS_VIEWS = {
  trend: {
    id: "trend",
    emoji: "🟢",
    label: "추세 유지",
    description: "강한 상승 추세 · 보유 유지",
  },
  dip: {
    id: "dip",
    emoji: "🟡",
    label: "눌림 대기",
    description: "상승 추세 유지 · 단기 조정 구간",
  },
  interest: {
    id: "interest",
    emoji: "🟠",
    label: "관심 구간",
    description: "추세 전환 가능 · 분할 진입 검토",
  },
  overheat: {
    id: "overheat",
    emoji: "🔴",
    label: "과열 구간",
    description: "단기 과열 · 추격매수 금지",
  },
}

export const STOCK_ACTION_VIEWS = {
  hold: { id: "hold", emoji: "🟢", label: "보유 유지" },
  watchlist: { id: "watchlist", emoji: "🟡", label: "관심 등록" },
  scale_in: { id: "scale_in", emoji: "🟠", label: "분할 진입 검토" },
  no_chase: { id: "no_chase", emoji: "🔴", label: "추격 금지" },
}

/** @type {Record<StockActionStatusId, StockActionId>} */
const STATUS_TO_ACTION = {
  trend: "hold",
  dip: "watchlist",
  interest: "scale_in",
  overheat: "no_chase",
}

/**
 * @param {StockActionStatusId} statusId
 * @param {string} [actionReason]
 * @returns {StockActionResult}
 */
export function buildStockActionResult(statusId, actionReason = "") {
  const stockStatus = STOCK_STATUS_VIEWS[statusId] ?? STOCK_STATUS_VIEWS.interest
  const actionId = STATUS_TO_ACTION[statusId] ?? "watchlist"
  const stockAction = STOCK_ACTION_VIEWS[actionId]

  return {
    stockStatus,
    stockAction,
    actionReason,
    statusId,
    actionId,
  }
}

/**
 * @param {import("./ydsStockScoreConfig.js").YdsScoreBreakdown} scores
 * @param {import("./ydsStockScoreEngine.js").StockScoreComputeMeta} meta
 * @param {import("./ydsStockRecommendReasons.js").RecommendReason[]} [reasons]
 * @returns {StockActionResult}
 */
export function deriveStockAction(scores, meta, reasons = []) {
  const { trendScore, volumeScore, positionScore } = scores
  const drawdownPct = meta.drawdownPct ?? 0

  /** @type {StockActionStatusId} */
  let statusId = "interest"

  if (drawdownPct <= 2 && trendScore >= 34 && volumeScore >= 14 && positionScore <= 12) {
    statusId = "overheat"
  } else if (trendScore >= 30 && drawdownPct <= 8 && positionScore <= 15) {
    statusId = "trend"
  } else if (trendScore >= 22 && positionScore >= 14 && drawdownPct >= 5) {
    statusId = "dip"
  } else if (trendScore >= 18) {
    statusId = "interest"
  }

  const actionReason =
    reasons.length > 0
      ? reasons
          .slice(0, 2)
          .map((r) => r.text)
          .join(" · ")
      : STOCK_STATUS_VIEWS[statusId].description

  return buildStockActionResult(statusId, actionReason)
}
