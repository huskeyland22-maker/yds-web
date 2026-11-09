/**
 * /daily-bottom-buy ETF — which blocks need PRO membership.
 * Visibility is driven only by useMembership().isPro (server plan).
 * Logged-out and FREE share the same analysis visibility (FREE tier).
 */

import { DBB_SHARED_PRO_LOCK_COPY } from "./ydsDailyBottomBuyAccessPolicy.js"

/**
 * @param {boolean} isPro
 * @returns {{
 *   freeHero: true
 *   freeNotice: true
 *   freeOpportunitySummary: true
 *   freeWatchlistPicker: true
 *   freeTradeRecords: true
 *   freeScoreSummary: true
 *   proOpportunityMetrics: boolean
 *   proPrice: boolean
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
    freeScoreSummary: true,
    proOpportunityMetrics: unlocked,
    proPrice: unlocked,
    proScoreDetail: unlocked,
    proConditions: unlocked,
    proSplitActions: unlocked,
  }
}

export const DBB_PRO_LOCK_COPY = DBB_SHARED_PRO_LOCK_COPY
