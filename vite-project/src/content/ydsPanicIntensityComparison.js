/**
 * 패닉 강도 — 오늘 vs 1주전 vs 1개월전 비교
 */

import { computeYdsScore } from "../trading-zone/ydsHistoricalEventTypes.js"
import { getFinalScore } from "../utils/tradingScores.js"

/** @param {string} dateKey @param {number} days */
function subtractDays(dateKey, days) {
  const d = new Date(`${dateKey}T12:00:00`)
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * @param {object[]} rows
 * @param {number} offsetDays
 * @param {string} refDate
 */
function scoreAtOffset(rows, offsetDays, refDate) {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  if (!sorted.length) return null

  const target = subtractDays(refDate, offsetDays)
  let match = null
  for (const row of sorted) {
    if (row.date <= target) match = row
    else break
  }
  if (!match) match = sorted[0]
  return computeYdsScore(match)
}

/**
 * @param {number | null} today
 * @param {number | null} weekAgo
 * @param {number | null} monthAgo
 */
function buildConclusion(today, weekAgo, monthAgo) {
  if (today == null) {
    return { conclusion: "비교 데이터 수집 중", subConclusion: "" }
  }
  if (weekAgo == null && monthAgo == null) {
    return { conclusion: "패닉 수준 확인", subConclusion: "과거 비교 데이터 부족" }
  }

  if (weekAgo != null && monthAgo != null) {
    if (today < weekAgo && weekAgo <= monthAgo) {
      return { conclusion: "패닉 지속 감소", subConclusion: "시장 위험 완화" }
    }
    if (today > weekAgo && weekAgo >= monthAgo) {
      return { conclusion: "패닉 지속 상승", subConclusion: "시장 위험 확대" }
    }
  }

  if (monthAgo != null) {
    if (today < monthAgo - 3) {
      return { conclusion: "패닉 완화 추세", subConclusion: "시장 위험 완화" }
    }
    if (today > monthAgo + 3) {
      return { conclusion: "패닉 확대 추세", subConclusion: "시장 위험 주의" }
    }
  }

  return { conclusion: "패닉 수준 유지", subConclusion: "시장 위험 중립" }
}

/**
 * @param {object[]} historyRows
 * @param {object | null | undefined} panicData
 */
export function buildPanicIntensityComparison(historyRows, panicData = null) {
  const rows = Array.isArray(historyRows) ? historyRows : []
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  const refDate = sorted[sorted.length - 1]?.date ?? new Date().toISOString().slice(0, 10)

  const today =
    panicData != null
      ? (() => {
          const s = getFinalScore(panicData)
          return Number.isFinite(s) ? Math.round(s) : null
        })()
      : computeYdsScore(sorted[sorted.length - 1] ?? {})

  const weekAgo = scoreAtOffset(sorted, 7, refDate)
  const monthAgo = scoreAtOffset(sorted, 30, refDate)
  const { conclusion, subConclusion } = buildConclusion(today, weekAgo, monthAgo)

  return {
    visible: today != null,
    today,
    weekAgo,
    monthAgo,
    conclusion,
    subConclusion,
  }
}
