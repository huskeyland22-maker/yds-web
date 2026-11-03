/**
 * /equity-daily-bottom-buy — which blocks need PRO membership.
 * Visibility is driven only by useMembership().isPro (server plan).
 * Logged-out and FREE share the same analysis visibility (FREE tier).
 */

import { DBB_SHARED_PRO_LOCK_COPY } from "./ydsDailyBottomBuyAccessPolicy.js"

/**
 * @param {boolean} isPro
 * @returns {{
 *   freeHero: true
 *   freeCandidateSummary: true
 *   freeWatchlistPicker: true
 *   freeTradeRecords: true
 *   freeScoreSummary: true
 *   proCandidateMetrics: boolean
 *   proConditionType: boolean
 *   proPrice: boolean
 *   proScoreExtras: boolean
 *   proConditions: boolean
 *   proAtr: boolean
 *   proReading: boolean
 * }}
 */
export function buildEquityDailyBottomBuyVisibility(isPro) {
  const unlocked = isPro === true
  return {
    freeHero: true,
    freeCandidateSummary: true,
    freeWatchlistPicker: true,
    freeTradeRecords: true,
    freeScoreSummary: true,
    proCandidateMetrics: unlocked,
    proConditionType: unlocked,
    proPrice: unlocked,
    proScoreExtras: unlocked,
    proConditions: unlocked,
    proAtr: unlocked,
    proReading: unlocked,
  }
}

export const EQUITY_DBB_PRO_LOCK_COPY = DBB_SHARED_PRO_LOCK_COPY
