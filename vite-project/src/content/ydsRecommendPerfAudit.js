/**
 * 추천 성과 리포트 파이프라인 디버그 (DEV)
 */

import { isDevMode } from "../utils/devMode.js"
import { todayDateKey } from "./ydsPortfolioTradesStorage.js"

/**
 * @param {{
 *   stage: string
 *   totalFromStorage: number
 *   todayCount?: number
 *   windowDays?: number | null
 *   afterWindowFilter?: number
 *   historyRowCount?: number
 *   recentPicksCount?: number
 *   uiDisplayCount?: number
 *   afterStatusFilter?: number
 * }} payload
 */
export function logRecommendPerfPipelineTrace(payload) {
  if (!isDevMode()) return
  console.info(
    "[recommend-perf-pipeline]",
    JSON.stringify({
      ...payload,
      today: todayDateKey(),
    }),
  )
}
