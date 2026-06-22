/**
 * 성과검증 — 기대값(EV) 분석 (잠금 수익률 · 규칙 해석 · AI 예측 없음)
 *
 * 기대값 = (승률 × 평균수익) + (패배율 × 평균손실)
 * 승률: 수익률 > 0 · 평균수익/손실: 각 구간 평균
 */

import { PERF_HORIZONS } from "./ydsPickPerformanceEngine.js"
import { getLockedReturns } from "./ydsPickReturnStats.js"

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */
/** @typedef {'d7' | 'd14' | 'd30'} EvHorizonKey */

/**
 * @typedef {{
 *   key: EvHorizonKey
 *   label: string
 *   visible: boolean
 *   total: number
 *   winRate: number | null
 *   lossRate: number | null
 *   avgWin: number | null
 *   avgLoss: number | null
 *   expectedValue: number | null
 *   interpretations: string[]
 * }} ExpectedValueHorizonRow
 */

/**
 * @typedef {{
 *   visible: boolean
 *   horizons: ExpectedValueHorizonRow[]
 *   formula: string
 *   interpretations: string[]
 * }} ExpectedValueAnalysisReport
 */

/** @param {number} v */
function round1(v) {
  return Math.round(v * 10) / 10
}

/** @param {number[]} returns */
function computeHorizonExpectedValue(returns) {
  const vals = (returns ?? []).filter((v) => Number.isFinite(v))
  if (!vals.length) return null

  const winVals = vals.filter((v) => v > 0)
  const lossVals = vals.filter((v) => v <= 0)
  const total = vals.length
  const winRate = round1((winVals.length / total) * 100)
  const lossRate = round1(100 - winRate)

  const avgWin = winVals.length
    ? round1(winVals.reduce((s, v) => s + v, 0) / winVals.length)
    : null
  const avgLoss = lossVals.length
    ? round1(lossVals.reduce((s, v) => s + v, 0) / lossVals.length)
    : null

  let expectedValue = null
  if (winVals.length && lossVals.length && avgWin != null && avgLoss != null) {
    expectedValue = round1((winRate / 100) * avgWin + (lossRate / 100) * avgLoss)
  } else if (winVals.length && avgWin != null) {
    expectedValue = avgWin
  } else if (lossVals.length && avgLoss != null) {
    expectedValue = avgLoss
  } else {
    expectedValue = 0
  }

  return {
    total,
    winRate,
    lossRate,
    avgWin,
    avgLoss,
    expectedValue,
  }
}

/**
 * @param {{
 *   winRate: number | null
 *   avgWin: number | null
 *   avgLoss: number | null
 *   expectedValue: number | null
 * }} row
 */
function deriveExpectedValueInterpretations(row) {
  if (row.expectedValue == null) return []

  /** @type {string[]} */
  const bullets = []
  const { winRate, avgWin, avgLoss, expectedValue } = row

  if (
    winRate != null &&
    winRate < 50 &&
    expectedValue > 0 &&
    avgWin != null &&
    avgLoss != null &&
    avgWin > Math.abs(avgLoss)
  ) {
    bullets.push("승률은 낮지만 수익 발생 시 손실보다 크게 먹는 구조")
  }

  if (expectedValue > 0 && winRate != null && winRate < 45) {
    bullets.push("현재 전략은 홈런형 투자 모델")
  } else if (expectedValue > 0 && winRate != null && winRate >= 50) {
    bullets.push("승률·기대값이 함께 양호한 안정형 구조")
  }

  if (expectedValue < 0) {
    bullets.push("1회 추천당 기대 손실 구조")
  } else if (expectedValue > 0 && winRate != null && winRate < 40) {
    bullets.push("적중률보다 손익비가 기대값을 끌어올림")
  }

  if (
    avgWin != null &&
    avgLoss != null &&
    avgWin > 0 &&
    avgLoss < 0 &&
    avgWin >= Math.abs(avgLoss) * 1.5
  ) {
    bullets.push("평균 수익이 평균 손실보다 큰 비대칭 구조")
  }

  if (expectedValue > 0 && bullets.length < 2) {
    bullets.push(`1회 추천당 기대값 +${expectedValue}%`)
  }

  return [...new Set(bullets)].slice(0, 4)
}

/**
 * @param {ValidationPickRecord[]} picks
 * @returns {ExpectedValueAnalysisReport}
 */
export function buildExpectedValueAnalysisReport(picks) {
  const horizons = PERF_HORIZONS.map((h) => {
    const stats = computeHorizonExpectedValue(getLockedReturns(picks, h.key))
    const visible = (stats?.total ?? 0) > 0
    const row = stats
      ? {
          key: /** @type {EvHorizonKey} */ (h.key),
          label: h.label,
          visible,
          total: stats.total,
          winRate: stats.winRate,
          lossRate: stats.lossRate,
          avgWin: stats.avgWin,
          avgLoss: stats.avgLoss,
          expectedValue: stats.expectedValue,
          interpretations: deriveExpectedValueInterpretations(stats),
        }
      : {
          key: /** @type {EvHorizonKey} */ (h.key),
          label: h.label,
          visible: false,
          total: 0,
          winRate: null,
          lossRate: null,
          avgWin: null,
          avgLoss: null,
          expectedValue: null,
          interpretations: [],
        }

    return row
  })

  const visible = horizons.some((h) => h.visible)
  const primary =
    horizons.find((h) => h.key === "d7" && h.visible) ??
    horizons.find((h) => h.visible) ??
    null

  return {
    visible,
    horizons,
    formula: "기대값 = (승률 × 평균수익) + (패배율 × 평균손실)",
    interpretations: primary?.interpretations ?? [],
  }
}
