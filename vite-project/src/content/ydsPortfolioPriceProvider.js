/**
 * YDS Portfolio — 환율·원화 환산 (Phase 6-1)
 */

/** 미국 종목 평가 시 원화 환산 기본값 (API 실패 시) */
export const PORTFOLIO_USDKRW_DEFAULT = 1350

let portfolioUsdKrw = PORTFOLIO_USDKRW_DEFAULT

/** @param {number | null | undefined} rate */
export function setPortfolioUsdKrw(rate) {
  if (rate != null && Number.isFinite(rate) && rate > 0) {
    portfolioUsdKrw = rate
  }
}

export function getPortfolioUsdKrw() {
  return portfolioUsdKrw
}

/**
 * @param {'us' | 'kr'} country
 * @param {number} localAmount
 * @param {number} [usdkrw]
 */
export function toKrwValue(country, localAmount, usdkrw = portfolioUsdKrw) {
  const n = Number(localAmount) || 0
  if (n <= 0) return 0
  const rate = usdkrw > 0 ? usdkrw : PORTFOLIO_USDKRW_DEFAULT
  return country === "us" ? Math.round(n * rate) : Math.round(n)
}
