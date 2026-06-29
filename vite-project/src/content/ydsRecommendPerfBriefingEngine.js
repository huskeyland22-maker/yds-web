/**
 * GO #90 — 추천 성과 리포트 한 줄 브리핑
 */

import { formatPerfPct } from "./ydsPickPerformanceEngine.js"

/**
 * @param {{
 *   avgReturn?: number | null
 *   alpha?: number | null
 *   holdingCount?: number
 *   successCount?: number
 *   failureCount?: number
 *   initialRecommendCount?: number
 *   winRate?: number | null
 * }} stats
 * @param {number} [windowDays]
 */
export function buildRecommendPerfBriefing(stats, windowDays = 30) {
  const avg = stats.avgReturn
  const holding = stats.holdingCount ?? 0
  const success = stats.successCount ?? 0
  const failure = stats.failureCount ?? 0
  const alpha = stats.alpha
  const avgLabel = formatPerfPct(avg)

  let strategy = "시장 환경에 맞춰 운용"
  if (avg != null && avg < -1 && holding > 0) {
    strategy = "조정장에서 방어에 집중"
  } else if (avg != null && avg >= 3) {
    strategy = "상승 국면에서 수익 실현에 집중"
  } else if (avg != null && avg < 0) {
    strategy = "하락 구간에서 리스크 관리"
  } else if (holding > 0 && success === 0 && failure === 0) {
    strategy = "추세 확인을 위해 보유 유지"
  }

  const alphaPart =
    alpha != null && Number.isFinite(alpha)
      ? ` S&P500 대비 ${formatPerfPct(alpha)} 초과수익이었습니다.`
      : "."

  let tail = ""
  if (holding > 0) {
    tail =
      success + failure > 0
        ? ` 현재 ${holding}개 종목이 보유 중이며, 성공 ${success}·실패 ${failure}건이 기록되었습니다.`
        : ` 현재 ${holding}개 종목이 보유 중이며 시장 회복 여부를 관찰 중입니다.`
  } else if (success + failure > 0) {
    tail = ` 성공 ${success}·실패 ${failure}건이 집계되었습니다.`
  } else {
    tail = " 추가 데이터가 쌓이면 성과 해석이 정교해집니다."
  }

  return `최근 ${windowDays}일 AI 추천은 ${strategy}했으며, 평균 수익률은 ${avgLabel}였습니다${alphaPart}${tail}`
}
