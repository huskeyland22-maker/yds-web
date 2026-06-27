/**
 * 패닉 강도 — 오늘 vs 3일전 vs 5일전 (최근 변화 속도)
 */

import { getFinalScore } from "../utils/tradingScores.js"

/**
 * @typedef {{
 *   label: string
 *   score: number | null
 *   delta: number | null
 *   date: string | null
 * }} PanicIntensityComparePoint
 */

/** @param {unknown} v */
function toNum(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {object | null | undefined} row */
function normalizeHistoryRow(row) {
  if (!row || typeof row !== "object") return null
  const date = String(row.date ?? row.ts ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  return {
    date,
    vix: toNum(row.vix),
    fearGreed: toNum(row.fearGreed ?? row.cnn),
    bofa: toNum(row.bofa),
    putCall: toNum(row.putCall),
    highYield: toNum(row.highYield ?? row.hyOas),
  }
}

/** @param {string} dateKey @param {number} days */
export function subtractCalendarDays(dateKey, days) {
  const d = new Date(`${dateKey}T12:00:00`)
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * @param {Array<{ date: string }>} sortedRows
 * @param {string} refDate
 * @param {number} offsetCalendarDays
 */
export function findNearestTradingDayRow(sortedRows, refDate, offsetCalendarDays) {
  if (!sortedRows.length) return null
  const target = subtractCalendarDays(refDate, offsetCalendarDays)

  let onOrBefore = null
  for (const row of sortedRows) {
    if (row.date <= target) onOrBefore = row
    else break
  }
  if (onOrBefore) return onOrBefore

  for (const row of sortedRows) {
    if (row.date >= target) return row
  }
  return sortedRows[0] ?? null
}

/** @param {ReturnType<typeof normalizeHistoryRow>} row */
function scoreFromHistoryRow(row) {
  if (!row) return null
  const hasInput =
    row.vix != null ||
    row.fearGreed != null ||
    row.putCall != null ||
    row.bofa != null ||
    row.highYield != null
  if (!hasInput) return null

  const score = getFinalScore({
    vix: row.vix ?? undefined,
    fearGreed: row.fearGreed ?? undefined,
    bofa: row.bofa ?? undefined,
    putCall: row.putCall ?? undefined,
    highYield: row.highYield ?? undefined,
  })
  return Number.isFinite(score) ? Math.round(score) : null
}

/** @param {object | null | undefined} panicData */
function scoreFromPanicData(panicData) {
  if (!panicData) return null
  const score = getFinalScore(panicData)
  return Number.isFinite(score) ? Math.round(score) : null
}

/**
 * @param {number | null} today
 * @param {number | null} days3Ago
 * @param {number | null} days5Ago
 */
function buildConclusion(today, days3Ago, days5Ago) {
  if (today == null) {
    return { conclusion: "비교 데이터 수집 중", subConclusion: "" }
  }

  const delta3 = days3Ago != null ? today - days3Ago : null
  const delta5 = days5Ago != null ? today - days5Ago : null

  if (delta3 == null && delta5 == null) {
    return { conclusion: "패닉 수준 확인", subConclusion: "과거 비교 데이터 부족" }
  }

  if (delta3 != null && delta3 >= 6) {
    return { conclusion: "공포 급속 확대", subConclusion: "최근 3일 변화 주의" }
  }
  if (delta3 != null && delta3 <= -6) {
    return { conclusion: "공포 급속 완화", subConclusion: "최근 3일 위험 감소" }
  }
  if (delta5 != null && delta3 != null && delta5 >= 8 && delta3 >= 4) {
    return { conclusion: "패닉 지속 상승", subConclusion: "5일간 공포 확대" }
  }
  if (delta5 != null && delta3 != null && delta5 <= -8 && delta3 <= -3) {
    return { conclusion: "패닉 지속 완화", subConclusion: "5일간 공포 감소" }
  }
  if (delta3 != null && Math.abs(delta3) <= 2) {
    return { conclusion: "패닉 수준 유지", subConclusion: "단기 변화 미미" }
  }
  if (delta3 != null && delta3 > 0) {
    return { conclusion: "공포 점진 확대", subConclusion: "최근 변화 관찰" }
  }
  if (delta3 != null && delta3 < 0) {
    return { conclusion: "공포 점진 완화", subConclusion: "최근 변화 관찰" }
  }

  return { conclusion: "패닉 수준 확인", subConclusion: "" }
}

/** @param {number | null} delta */
export function formatPanicCompareDelta(delta) {
  if (delta == null || !Number.isFinite(delta)) return ""
  if (delta === 0) return "(±0)"
  return delta > 0 ? `(+${delta})` : `(${delta})`
}

/**
 * @param {object[]} historyRows
 * @param {object | null | undefined} panicData
 * @param {string | null} [refDateOverride]
 */
export function buildPanicIntensityComparison(historyRows, panicData = null, refDateOverride = null) {
  const normalized = (Array.isArray(historyRows) ? historyRows : [])
    .map((row) => normalizeHistoryRow(row))
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))

  const refDate =
    refDateOverride ??
    normalized[normalized.length - 1]?.date ??
    new Date().toISOString().slice(0, 10)

  const todayFromPanic = scoreFromPanicData(panicData)
  const latestRow = normalized[normalized.length - 1] ?? null
  const todayFromHistory = scoreFromHistoryRow(latestRow)
  const today = todayFromPanic ?? todayFromHistory

  const row3 = findNearestTradingDayRow(normalized, refDate, 3)
  const row5 = findNearestTradingDayRow(normalized, refDate, 5)

  const days3Ago = scoreFromHistoryRow(row3)
  const days5Ago = scoreFromHistoryRow(row5)

  const delta3 = today != null && days3Ago != null ? today - days3Ago : null
  const delta5 = today != null && days5Ago != null ? today - days5Ago : null
  const { conclusion, subConclusion } = buildConclusion(today, days3Ago, days5Ago)

  /** @type {PanicIntensityComparePoint[]} */
  const points = [
    { label: "오늘", score: today, delta: null, date: refDate },
    { label: "3일전", score: days3Ago, delta: delta3, date: row3?.date ?? null },
    { label: "5일전", score: days5Ago, delta: delta5, date: row5?.date ?? null },
  ]

  return {
    visible: today != null,
    refDate,
    today,
    days3Ago,
    days5Ago,
    delta3,
    delta5,
    points,
    conclusion,
    subConclusion,
  }
}
