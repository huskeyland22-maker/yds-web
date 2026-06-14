/**
 * V7 — 종목 카드 행동 라벨 (단순 3단계)
 */

/** @typedef {'entry' | 'waitPullback' | 'noChase'} StockPickCardActionId */

/**
 * @typedef {{
 *   id: StockPickCardActionId
 *   label: string
 *   emoji: string
 * }} StockPickCardActionView
 */

/** @type {Record<StockPickCardActionId, StockPickCardActionView>} */
export const STOCK_PICK_CARD_ACTIONS = {
  entry: { id: "entry", label: "1차 진입 가능", emoji: "✅" },
  waitPullback: { id: "waitPullback", label: "눌림 대기", emoji: "⏳" },
  noChase: { id: "noChase", label: "추격 금지", emoji: "🚫" },
}

/** @param {import("./ydsStockPickModel.js").StockPickView} stock */
export function resolveStockPickCardAction(stock) {
  const finalId = stock.pickMeta?.finalAction?.id
  if (finalId === "noChase") return STOCK_PICK_CARD_ACTIONS.noChase
  if (finalId === "now") return STOCK_PICK_CARD_ACTIONS.entry

  const statusId = stock.v4Score?.recommendStatusId
  if (statusId === "noChase") return STOCK_PICK_CARD_ACTIONS.noChase
  if (statusId === "aggressiveBuy" || statusId === "buy" || statusId === "scaleIn") {
    return STOCK_PICK_CARD_ACTIONS.entry
  }
  return STOCK_PICK_CARD_ACTIONS.waitPullback
}
