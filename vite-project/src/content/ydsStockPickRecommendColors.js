/**
 * GO #73 — 추천상태 컬러 시스템 (전 페이지 통일)
 */

import { resolveStockPickUxStatus } from "./ydsStockPickUxStatus.js"

/** @typedef {import("./ydsStockPickUxStatus.js").StockPickUxStatusId} RecommendStatusId */

/** @type {Record<RecommendStatusId, { label: string; tone: string; color: string }>} */
export const RECOMMEND_STATUS_THEME = {
  aggressiveBuy: {
    label: "적극매수",
    tone: "buy-strong",
    color: "#16a34a",
  },
  buy: {
    label: "매수가능",
    tone: "buy",
    color: "#86efac",
  },
  watch: {
    label: "관찰",
    tone: "watch",
    color: "#fbbf24",
  },
  scaleIn: {
    label: "분할매수",
    tone: "scale",
    color: "#fb923c",
  },
  noChase: {
    label: "제외",
    tone: "exclude",
    color: "#ef4444",
  },
}

/** @param {RecommendStatusId | string | undefined} statusId */
export function getRecommendStatusTheme(statusId) {
  const id = /** @type {RecommendStatusId} */ (statusId ?? "watch")
  return RECOMMEND_STATUS_THEME[id] ?? RECOMMEND_STATUS_THEME.watch
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView | { v4Score?: { recommendStatusId?: string } }} stock
 */
export function resolveRecommendStatusView(stock) {
  const ux = resolveStockPickUxStatus(stock)
  const theme = getRecommendStatusTheme(ux.id)
  return {
    id: ux.id,
    label: theme.label,
    tone: theme.tone,
    color: theme.color,
    tooltip: ux.tooltip,
    emoji: ux.emoji,
  }
}

/** @param {RecommendStatusId} statusId */
export function isBuyPossibleStatus(statusId) {
  return statusId === "aggressiveBuy" || statusId === "buy"
}

/** @param {RecommendStatusId} statusId */
export function isRecommendProhibitedStatus(statusId) {
  return statusId === "noChase"
}
