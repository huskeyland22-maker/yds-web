/**
 * 성과검증 — 7일 잠금 실측 기반 인사이트 (규칙 해석 · AI 예측 없음)
 */

import {
  buildOutcomeSummaryReport,
  DEFAULT_OUTCOME_CRITERIA,
} from "./ydsPickOutcomeEngine.js"
import { summarizeHorizonReturns } from "./ydsPickPerformanceEngine.js"
import { getLockedReturns } from "./ydsPickReturnStats.js"

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */

const HORIZON_KEY = "d7"

/**
 * @typedef {{
 *   visible: boolean
 *   horizonLabel: string
 *   total: number
 *   winRate: number | null
 *   avgReturn: number | null
 *   insights: string[]
 * }} PerfInsightReport
 */

/**
 * @param {import("./ydsPickOutcomeEngine.js").OutcomeSummaryReport} summary
 * @param {ReturnType<typeof summarizeHorizonReturns>} stats
 * @param {number[]} returns
 */
function derivePerfInsights(summary, stats, returns) {
  /** @type {string[]} */
  const bullets = []
  const { winRate, avgReturn, maxGain, count } = stats
  const sorted = [...returns].sort((a, b) => b - a)
  const positive = returns.filter((r) => r > 0)
  const topN = Math.max(1, Math.ceil(count * 0.3))
  const topSum = sorted
    .slice(0, topN)
    .filter((r) => r > 0)
    .reduce((s, v) => s + v, 0)
  const posSum = positive.reduce((s, v) => s + v, 0)
  const concentration = posSum > 0 ? topSum / posSum : 0

  if (
    (concentration >= 0.6 && positive.length >= 2) ||
    (maxGain != null && avgReturn != null && avgReturn > 0 && maxGain >= avgReturn * 2.5)
  ) {
    bullets.push("소수 종목이 큰 수익을 만들고 있음")
  }

  if (winRate != null && avgReturn != null) {
    if (winRate < 50 && avgReturn > 0) {
      bullets.push("전체 승률은 낮지만 기대수익은 플러스")
    } else if (winRate >= 50 && avgReturn > 0) {
      bullets.push("승률과 평균수익이 함께 양호한 흐름")
    } else if (avgReturn < 0) {
      bullets.push("평균수익이 마이너스 — 손실 구간 비중 점검 필요")
    } else if (winRate < 40) {
      bullets.push("승률이 낮아 수익 집중도 관리가 중요")
    }
  }

  if (summary.successRate != null && summary.avgReturn != null) {
    if (summary.successRate < 40 && summary.avgReturn > 0 && concentration >= 0.45) {
      bullets.push("현재 전략은 선별 적중형 구조")
    } else if (summary.successRate >= 40) {
      bullets.push("고수익(+10%) 적중 비율이 안정적")
    }
  }

  if (summary.failureCount > summary.successCount && avgReturn != null && avgReturn > 0) {
    bullets.push("무분별한 종목 확대보다 품질 개선이 중요")
  } else if (summary.normalCount >= summary.successCount && summary.successCount > 0) {
    bullets.push("보통 구간 종목 비중이 높아 상단 수익 집중도가 핵심")
  } else if (summary.failureCount > count * 0.5) {
    bullets.push("실패 비중이 높아 추천 필터 강화가 유리")
  }

  if (bullets.length < 3) {
    if (avgReturn != null && avgReturn > 0) {
      bullets.push(`7일 평균수익 +${avgReturn}%로 플러스 우위`)
    }
    if (winRate != null) {
      bullets.push(`양수 종목 비율(승률) ${winRate}%`)
    }
    if (summary.successRate != null) {
      bullets.push(
        `성공(+${DEFAULT_OUTCOME_CRITERIA.successMinPct}%) 판정 ${summary.successRate}%`,
      )
    }
  }

  const unique = [...new Set(bullets)]
  return unique.slice(0, 5)
}

/**
 * @param {ValidationPickRecord[]} picks
 * @returns {PerfInsightReport}
 */
export function buildPerfInsightReport(picks) {
  const stats = summarizeHorizonReturns(picks ?? [], HORIZON_KEY)
  if (!stats.count) {
    return {
      visible: false,
      horizonLabel: "7일",
      total: 0,
      winRate: null,
      avgReturn: null,
      insights: [],
    }
  }

  const summary = buildOutcomeSummaryReport(picks, HORIZON_KEY)
  const returns = getLockedReturns(picks, HORIZON_KEY)
  const insights = derivePerfInsights(summary, stats, returns)

  return {
    visible: true,
    horizonLabel: "7일",
    total: stats.count,
    winRate: stats.winRate,
    avgReturn: stats.avgReturn,
    insights,
  }
}
