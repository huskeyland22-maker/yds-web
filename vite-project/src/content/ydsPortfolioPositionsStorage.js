/**
 * YDS Portfolio V2 — 보유 종목 저장소
 */

export const PORTFOLIO_POSITIONS_KEY = "yds-portfolio-positions-v1"

/**
 * @typedef {{
 *   id: string
 *   name: string
 *   ticker: string
 *   country: 'us' | 'kr'
 *   buyDate: string
 *   avgPrice: number
 *   quantity: number
 *   currentPrice: number | null
 *   createdAt: number
 *   updatedAt: number
 * }} PortfolioPosition
 */

/** @returns {PortfolioPosition[]} */
export function loadPortfolioPositions() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_POSITIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((p) => p && typeof p.id === "string")
  } catch {
    return []
  }
}

/** @param {PortfolioPosition[]} positions */
export function savePortfolioPositions(positions) {
  try {
    localStorage.setItem(PORTFOLIO_POSITIONS_KEY, JSON.stringify(positions))
  } catch {
    /* ignore */
  }
}

export function createPositionId() {
  return `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
