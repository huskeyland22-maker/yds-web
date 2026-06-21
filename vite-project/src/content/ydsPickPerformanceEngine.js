/**
 * 성과 검증 — 추천 스냅샷 기반 KPI·등급·차트 집계
 * 수익률은 추천 당시 가격 대비 잠금(horizon) 값만 사용한다.
 */

import { todayDateKey } from "./ydsPortfolioTradesStorage.js"
import { subtractCalendarDays } from "./ydsValidationEngine.js"
import {
  filterPicksByPatternGrade,
  MARKET_FIT_PATTERN_BUCKETS,
  patternGradeBucketLabel,
  QUALITY_PATTERN_BUCKETS,
  TIMING_PATTERN_BUCKETS,
} from "./ydsPickPatternGrades.js"

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */

export const PERF_HORIZONS = [
  { key: "d7", label: "7일", days: 7 },
  { key: "d14", label: "14일", days: 14 },
  { key: "d30", label: "30일", days: 30 },
]

/** @param {number | null | undefined} v */
export function formatPerfPct(v) {
  if (v == null || !Number.isFinite(v)) return "—"
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`
}

/** @param {number | null | undefined} v */
export function formatPerfPrice(v) {
  if (v == null || !Number.isFinite(v) || v <= 0) return "N/A"
  return v >= 1000 ? v.toLocaleString("ko-KR", { maximumFractionDigits: 0 }) : v.toFixed(2)
}

/**
 * @param {ValidationPickRecord[]} picks
 * @param {number} [windowDays]
 */
export function filterPicksInWindow(picks, windowDays = 30) {
  const today = todayDateKey()
  const cutoff = subtractCalendarDays(today, windowDays)
  return (picks ?? []).filter((p) => p.recommendedAt >= cutoff && p.recommendedAt <= today)
}

/**
 * @param {ValidationPickRecord[]} picks
 * @param {string} horizonKey
 */
function picksWithLockedReturn(picks, horizonKey) {
  return (picks ?? []).filter((p) => {
    const ret = p.horizons?.[horizonKey]
    return ret != null && Number.isFinite(ret)
  })
}

/**
 * @param {ValidationPickRecord[]} picks
 * @param {string} horizonKey
 */
export function summarizeHorizonReturns(picks, horizonKey) {
  const rows = picksWithLockedReturn(picks, horizonKey)
  if (!rows.length) {
    return { count: 0, avgReturn: null, winRate: null, maxGain: null, maxLoss: null }
  }
  const returns = rows.map((r) => Number(r.horizons[horizonKey]))
  const wins = returns.filter((v) => v > 0).length
  const avg = returns.reduce((s, v) => s + v, 0) / returns.length
  const sorted = [...returns].sort((a, b) => b - a)
  return {
    count: rows.length,
    avgReturn: Math.round(avg * 10) / 10,
    winRate: Math.round((wins / returns.length) * 1000) / 10,
    maxGain: sorted[0] ?? null,
    maxLoss: sorted[sorted.length - 1] ?? null,
  }
}

/**
 * @param {ValidationPickRecord} pick
 * @param {string[]} preferKeys
 */
export function pickBestLockedReturn(pick, preferKeys = ["d30", "d14", "d7"]) {
  for (const key of preferKeys) {
    const ret = pick.horizons?.[key]
    if (ret != null && Number.isFinite(ret)) return { key, returnPct: ret }
  }
  return { key: null, returnPct: null }
}

/**
 * @param {ValidationPickRecord[]} picks
 * @param {import("./ydsPickPatternGrades.js").PatternGradeField} field
 * @param {string} grade
 * @param {string} horizonKey
 */
function summarizeGrade(picks, field, grade, horizonKey = "d30") {
  const subset = filterPicksByPatternGrade(picks, field, grade)
  const stats = summarizeHorizonReturns(subset, horizonKey)
  return {
    field: `${field}Grade`,
    grade,
    label: patternGradeBucketLabel(field, grade),
    ...stats,
  }
}

/** @param {string} field @param {string} grade @deprecated */
function gradeLabel(field, grade) {
  if (field === "qualityGrade") return patternGradeBucketLabel("quality", grade)
  if (field === "timingGrade") return patternGradeBucketLabel("timing", grade)
  if (field === "marketFitGrade") return patternGradeBucketLabel("marketFit", grade)
  return `${field} ${grade}`
}

/**
 * @param {ValidationPickRecord[]} picks
 * @param {string} horizonKey
 */
export function buildGradeBreakdown(picks, horizonKey = "d30") {
  const quality = QUALITY_PATTERN_BUCKETS.map((g) => summarizeGrade(picks, "quality", g, horizonKey))
  const timing = TIMING_PATTERN_BUCKETS.map((g) => summarizeGrade(picks, "timing", g, horizonKey))
  const marketFit = MARKET_FIT_PATTERN_BUCKETS.map((g) =>
    summarizeGrade(picks, "marketFit", g, horizonKey),
  )
  return { quality, timing, marketFit }
}

/**
 * @param {ValidationPickRecord[]} picks
 * @param {'best' | 'worst'} mode
 * @param {number} limit
 * @param {string} horizonKey
 */
export function buildTopCases(picks, mode = "best", limit = 10, horizonKey = "d30") {
  const rows = picksWithLockedReturn(picks, horizonKey)
    .map((p) => ({
      ...p,
      lockedReturn: Number(p.horizons[horizonKey]),
      lockedPrice: p.horizonPrices?.[horizonKey] ?? null,
    }))
    .sort((a, b) =>
      mode === "best" ? b.lockedReturn - a.lockedReturn : a.lockedReturn - b.lockedReturn,
    )
  return rows.slice(0, limit)
}

/**
 * @param {ValidationPickRecord[]} picks
 * @param {string} horizonKey
 */
export function buildMonthlySeries(picks, horizonKey = "d30") {
  /** @type {Map<string, number[]>} */
  const byMonth = new Map()
  for (const p of picksWithLockedReturn(picks, horizonKey)) {
    const month = p.recommendedAt.slice(0, 7)
    if (!byMonth.has(month)) byMonth.set(month, [])
    byMonth.get(month).push(Number(p.horizons[horizonKey]))
  }

  const months = [...byMonth.keys()].sort()
  let cumulative = 0
  return months.map((month) => {
    const vals = byMonth.get(month) ?? []
    const wins = vals.filter((v) => v > 0).length
    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
    const winRate = vals.length ? (wins / vals.length) * 100 : null
    cumulative += avg ?? 0
    return {
      month,
      monthLabel: month.replace("-", "."),
      count: vals.length,
      avgReturn: avg != null ? Math.round(avg * 10) / 10 : null,
      winRate: winRate != null ? Math.round(winRate * 10) / 10 : null,
      cumulativeReturn: Math.round(cumulative * 10) / 10,
    }
  })
}

/**
 * @param {ValidationPickRecord[]} allPicks
 * @param {number} [windowDays]
 */
export function buildPickPerformanceReport(allPicks, windowDays = 30) {
  const picks = filterPicksInWindow(allPicks, windowDays)
  const horizonStats = Object.fromEntries(
    PERF_HORIZONS.map((h) => [h.key, summarizeHorizonReturns(picks, h.key)]),
  )
  const d30 = horizonStats.d30 ?? summarizeHorizonReturns(picks, "d30")

  return {
    windowDays,
    pickCount: picks.length,
    kpi: {
      count: picks.length,
      avgReturn: d30.avgReturn,
      winRate: d30.winRate,
      maxGain: d30.maxGain,
      maxLoss: d30.maxLoss,
      horizons: PERF_HORIZONS.map((h) => ({
        ...h,
        ...horizonStats[h.key],
      })),
    },
    gradeBreakdown: buildGradeBreakdown(picks, "d30"),
    topSuccess: buildTopCases(picks, "best", 10, "d30"),
    topFailure: buildTopCases(picks, "worst", 10, "d30"),
    monthly: buildMonthlySeries(allPicks ?? [], "d30"),
    picks: [...picks].sort((a, b) => b.recommendedAt.localeCompare(a.recommendedAt)),
    allPickCount: (allPicks ?? []).length,
  }
}
