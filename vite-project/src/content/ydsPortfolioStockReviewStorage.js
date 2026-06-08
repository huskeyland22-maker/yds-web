/**
 * Portfolio V6.4 — 종목별 복기 (확장 준비)
 */

export const PORTFOLIO_STOCK_REVIEW_KEY = "yds-portfolio-stock-review-v1"

/**
 * @typedef {{
 *   buyReason: string
 *   sellReason: string
 *   lessons: string
 *   nextAction: string
 *   updatedAt: number
 * }} PortfolioStockReview
 */

const EMPTY_ENTRY = {
  buyReason: "",
  sellReason: "",
  lessons: "",
  nextAction: "",
  updatedAt: 0,
}

/** @returns {Record<string, PortfolioStockReview>} */
export function loadPortfolioStockReviews() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_STOCK_REVIEW_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    /** @type {Record<string, PortfolioStockReview>} */
    const out = {}
    for (const [id, entry] of Object.entries(parsed)) {
      if (!id || !entry || typeof entry !== "object") continue
      out[id] = {
        buyReason: String(entry.buyReason ?? ""),
        sellReason: String(entry.sellReason ?? ""),
        lessons: String(entry.lessons ?? ""),
        nextAction: String(entry.nextAction ?? ""),
        updatedAt: Number(entry.updatedAt) || 0,
      }
    }
    return out
  } catch {
    return {}
  }
}

/** @param {Record<string, PortfolioStockReview>} reviews */
export function savePortfolioStockReviews(reviews) {
  try {
    localStorage.setItem(PORTFOLIO_STOCK_REVIEW_KEY, JSON.stringify(reviews))
  } catch {
    /* ignore */
  }
}

/** @param {string} positionId */
export function emptyStockReview(positionId) {
  return { ...EMPTY_ENTRY, positionId }
}
