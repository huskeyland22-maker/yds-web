/**
 * V6 — 최종 액션 (지금 가능 / 눌림 대기 / 관심 등록 / 추격 금지 / 제외)
 */

/** @typedef {'now' | 'waitPullback' | 'watchlist' | 'noChase' | 'excluded'} FinalActionId */

/**
 * @typedef {{
 *   id: FinalActionId
 *   label: string
 *   emoji: string
 * }} FinalActionView
 */

/** @type {Record<FinalActionId, FinalActionView>} */
export const FINAL_ACTION_VIEWS = {
  now: { id: "now", label: "지금 가능", emoji: "✅" },
  waitPullback: { id: "waitPullback", label: "눌림 대기", emoji: "⏳" },
  watchlist: { id: "watchlist", label: "관심 등록", emoji: "👀" },
  noChase: { id: "noChase", label: "추격 금지", emoji: "🚫" },
  excluded: { id: "excluded", label: "제외", emoji: "—" },
}

/** @param {import("./ydsStockPickModel.js").StockPickView} stock */
export function resolveFinalAction(stock) {
  if (!stock.v4Score?.top5Eligible && stock.dataSource === "live") {
    return FINAL_ACTION_VIEWS.excluded
  }

  const statusId = stock.v4Score?.recommendStatusId
  if (statusId === "aggressiveBuy" || statusId === "buy") return FINAL_ACTION_VIEWS.now
  if (statusId === "scaleIn") return FINAL_ACTION_VIEWS.waitPullback
  if (statusId === "watch") return FINAL_ACTION_VIEWS.watchlist
  if (statusId === "noChase") return FINAL_ACTION_VIEWS.noChase

  return FINAL_ACTION_VIEWS.watchlist
}
