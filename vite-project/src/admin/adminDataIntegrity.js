import { rowCalendarKey } from "../utils/cycleHistoryHygiene.js"
import { latestCycleHistoryRow } from "../utils/cycleHistoryUtils.js"

export const PANIC_METRIC_KEYS = [
  { key: "vix", label: "VIX" },
  { key: "fearGreed", label: "CNN" },
  { key: "bofa", label: "BofA" },
  { key: "putCall", label: "Put/Call" },
  { key: "highYield", label: "High Yield" },
]

const MAX_STALE_DAYS = 7
const GAP_WARN_DAYS = 4

/**
 * @param {unknown} v
 */
function isBadNumber(v) {
  if (v == null || v === "") return true
  const n = Number(v)
  return !Number.isFinite(n)
}

/**
 * @param {object[]} rows
 */
export function checkCycleHistoryIntegrity(rows) {
  const issues = []
  const list = Array.isArray(rows) ? rows : []

  if (!list.length) {
    issues.push({ id: "empty", level: "critical", message: "사이클 히스토리가 비어 있습니다." })
    return { ok: false, issues, stats: { rowCount: 0 } }
  }

  let nullHits = 0
  let nanHits = 0
  const metricNullCounts = Object.fromEntries(PANIC_METRIC_KEYS.map((m) => [m.key, 0]))

  for (const row of list) {
    for (const { key } of PANIC_METRIC_KEYS) {
      const v = row[key]
      if (v == null || v === "") {
        nullHits += 1
        metricNullCounts[key] += 1
      } else if (!Number.isFinite(Number(v))) {
        nanHits += 1
      }
    }
  }

  if (nullHits > 0) {
    issues.push({
      id: "null-values",
      level: "warn",
      message: `null/빈 값 ${nullHits}건 (최근 ${list.length}행 기준)`,
    })
  }
  if (nanHits > 0) {
    issues.push({
      id: "nan-values",
      level: "critical",
      message: `NaN/비숫자 값 ${nanHits}건`,
    })
  }

  const keys = list
    .map((r) => rowCalendarKey(r))
    .filter(Boolean)
    .sort()
  let gapCount = 0
  for (let i = 1; i < keys.length; i++) {
    const prev = new Date(`${keys[i - 1]}T12:00:00Z`).getTime()
    const cur = new Date(`${keys[i]}T12:00:00Z`).getTime()
    const days = Math.round((cur - prev) / 86400000)
    if (days > GAP_WARN_DAYS) gapCount += 1
  }
  if (gapCount > 0) {
    issues.push({
      id: "date-gaps",
      level: "warn",
      message: `누락 구간 의심 ${gapCount}곳 (${GAP_WARN_DAYS}일 초과 간격)`,
    })
  }

  const latest = latestCycleHistoryRow(list)
  const latestKey = latest ? rowCalendarKey(latest) : null
  if (latestKey) {
    const ageDays = Math.floor(
      (Date.now() - new Date(`${latestKey}T12:00:00Z`).getTime()) / 86400000,
    )
    if (ageDays > MAX_STALE_DAYS) {
      issues.push({
        id: "stale-latest",
        level: "critical",
        message: `최신 데이터 ${latestKey} (${ageDays}일 전)`,
      })
    }
  } else {
    issues.push({ id: "no-latest", level: "critical", message: "최신 행을 식별할 수 없습니다." })
  }

  const latestRow = latest ?? null
  for (const { key, label } of PANIC_METRIC_KEYS) {
    if (latestRow && isBadNumber(latestRow[key])) {
      issues.push({
        id: `latest-${key}`,
        level: "warn",
        message: `최신 행 ${label} 값 없음`,
      })
    }
  }

  return {
    ok: issues.filter((i) => i.level === "critical").length === 0,
    issues,
    stats: {
      rowCount: list.length,
      firstDate: keys[0] ?? null,
      lastDate: keys[keys.length - 1] ?? null,
      nullHits,
      nanHits,
      gapCount,
      metricNullCounts,
    },
  }
}
