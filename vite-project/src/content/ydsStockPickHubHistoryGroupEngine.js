/**
 * GO #83 — 추천 히스토리 기간 필터 · 종목별 그룹
 */

import { todayDateKey } from "./ydsPortfolioTradesStorage.js"

/** @typedef {'today' | 'week' | 'month' | 'all'} HubHistoryPeriodId */

/** @type {ReadonlyArray<{ id: HubHistoryPeriodId; label: string }>} */
export const HUB_HISTORY_PERIOD_FILTERS = [
  { id: "today", label: "오늘" },
  { id: "week", label: "이번주" },
  { id: "month", label: "이번달" },
  { id: "all", label: "전체" },
]

/**
 * @param {string} [refDate]
 */
function startOfWeekKey(refDate = todayDateKey()) {
  const d = new Date(`${refDate}T12:00:00`)
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

/**
 * @param {string} [refDate]
 */
function startOfMonthKey(refDate = todayDateKey()) {
  return refDate.slice(0, 8) + "01"
}

/**
 * @param {Array<{ recommendedAt?: string }>} rows
 * @param {HubHistoryPeriodId} periodId
 * @param {string} [refDate]
 */
export function filterHubHistoryByPeriod(rows, periodId, refDate = todayDateKey()) {
  const list = rows ?? []
  if (periodId === "all") return list

  let cutoff = refDate
  if (periodId === "week") cutoff = startOfWeekKey(refDate)
  else if (periodId === "month") cutoff = startOfMonthKey(refDate)

  return list.filter((row) => {
    const d = String(row.recommendedAt ?? "").slice(0, 10)
    if (periodId === "today") return d === refDate
    return d >= cutoff && d <= refDate
  })
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
export function groupHubHistoryByTicker(rows) {
  /** @type {Map<string, { ticker: string; name: string; latestAt: string; rows: Record<string, unknown>[] }>} */
  const map = new Map()

  for (const row of rows ?? []) {
    const ticker = String(row.ticker ?? "")
    if (!ticker) continue
    const at = String(row.recommendedAt ?? "").slice(0, 10)
    let group = map.get(ticker)
    if (!group) {
      group = { ticker, name: String(row.name ?? ticker), latestAt: at, rows: [] }
      map.set(ticker, group)
    }
    group.rows.push(row)
    if (at > group.latestAt) group.latestAt = at
  }

  return [...map.values()]
    .map((g) => ({
      ...g,
      count: g.rows.length,
      rows: g.rows.sort((a, b) =>
        String(b.recommendedAt ?? "").localeCompare(String(a.recommendedAt ?? "")),
      ),
    }))
    .sort((a, b) => b.latestAt.localeCompare(a.latestAt))
}
