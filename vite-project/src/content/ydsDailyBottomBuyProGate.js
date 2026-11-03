/**
 * /daily-bottom-buy ETF — which blocks need PRO membership.
 * Visibility is driven only by useMembership().isPro (server plan).
 */

/**
 * @param {boolean} isPro
 * @returns {{
 *   freeHero: true
 *   freeNotice: true
 *   freeOpportunitySummary: true
 *   freeWatchlistPicker: true
 *   freeTradeRecords: true
 *   proOpportunityMetrics: boolean
 *   proScoreDetail: boolean
 *   proConditions: boolean
 *   proSplitActions: boolean
 * }}
 */
export function buildDailyBottomBuyVisibility(isPro) {
  const unlocked = isPro === true
  return {
    freeHero: true,
    freeNotice: true,
    freeOpportunitySummary: true,
    freeWatchlistPicker: true,
    freeTradeRecords: true,
    proOpportunityMetrics: unlocked,
    proScoreDetail: unlocked,
    proConditions: unlocked,
    proSplitActions: unlocked,
  }
}

export const DBB_PRO_LOCK_COPY = Object.freeze({
  title: "PRO 전용 상세 분석입니다",
  body: "RSI·Stoch·BB %B·MA20 수치와 4 CONDITIONS·분할 검토 안내는 PRO 멤버십에서 확인할 수 있습니다. 오늘 후보 심볼과 충족 개수(N/4)는 계속 볼 수 있습니다.",
})
