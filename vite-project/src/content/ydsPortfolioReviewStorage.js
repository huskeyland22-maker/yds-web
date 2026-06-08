/**
 * YDS Portfolio V2 — 투자 복기 저장소
 */

export const PORTFOLIO_REVIEW_KEY = "yds-portfolio-review-v1"

/**
 * @typedef {{
 *   overheating: string
 *   panic: string
 *   mistakes: string
 *   lessons: string
 *   updatedAt: number
 * }} PortfolioReview
 */

const EMPTY = {
  overheating: "",
  panic: "",
  mistakes: "",
  lessons: "",
  updatedAt: 0,
}

/** @returns {PortfolioReview} */
export function loadPortfolioReview() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_REVIEW_KEY)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw)
    return {
      overheating: String(parsed.overheating ?? ""),
      panic: String(parsed.panic ?? ""),
      mistakes: String(parsed.mistakes ?? ""),
      lessons: String(parsed.lessons ?? ""),
      updatedAt: Number(parsed.updatedAt) || 0,
    }
  } catch {
    return { ...EMPTY }
  }
}

/** @param {PortfolioReview} review */
export function savePortfolioReview(review) {
  try {
    localStorage.setItem(PORTFOLIO_REVIEW_KEY, JSON.stringify(review))
  } catch {
    /* ignore */
  }
}
