/**
 * 추천 종목 순위 변동 추적 — 전일 순위 대비 현재 순위·변화 배지
 */

import { readScoreHistory } from "./ydsStockPickScoreHistory.js"

/** @typedef {import("./ydsStockPickModel.js").StockPickView} StockPickView */

/** @typedef {'surge' | 'rising' | 'hold' | 'falling' | 'warn' | 'newEntry'} RankTrackBadgeId */

/**
 * @typedef {{
 *   id: RankTrackBadgeId
 *   label: string
 *   tone: string
 * }} RankTrackBadge
 */

/**
 * @typedef {{
 *   currentRank: number
 *   previousRank: number | null
 *   delta: number | null
 *   deltaDisplay: string | null
 *   rankDisplay: string
 *   badge: RankTrackBadge
 *   isNewEntry: boolean
 * }} RankTrackView
 */

/** @returns {string} */
function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

/** @param {string} dateStr @param {number} daysAgo */
function daysBefore(dateStr, daysAgo) {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

/**
 * @param {Array<{ date: string; rank: number }>} rows
 * @param {string} today
 */
function resolvePreviousRankRow(rows, today) {
  if (!rows.length) return null

  const yesterday = daysBefore(today, 1)
  const exactYesterday = rows.find((r) => r.date === yesterday)
  if (exactYesterday) return exactYesterday

  const priorRows = rows.filter((r) => r.date < today)
  if (priorRows.length) return priorRows[priorRows.length - 1]

  return rows.length >= 2 ? rows[rows.length - 2] : null
}

/**
 * @param {number | null} delta
 * @param {number} currentRank
 * @param {number | null} previousRank
 * @returns {RankTrackBadge}
 */
function resolveRankBadge(delta, currentRank, previousRank) {
  if (previousRank == null) {
    if (currentRank > 0 && currentRank <= 10) {
      return { id: "newEntry", label: "신규", tone: "rising" }
    }
    return { id: "hold", label: "유지", tone: "hold" }
  }

  if (previousRank <= 10 && currentRank > 10) {
    return { id: "warn", label: "경고", tone: "red" }
  }
  if (previousRank > 10 && currentRank <= 10) {
    return { id: "surge", label: "급상승", tone: "surge" }
  }

  const d = delta ?? 0
  if (d >= 5) return { id: "surge", label: "급상승", tone: "surge" }
  if (d >= 2) return { id: "rising", label: "상승중", tone: "rising" }
  if (d === 0) return { id: "hold", label: "유지", tone: "hold" }
  if (d <= -5) return { id: "warn", label: "경고", tone: "red" }
  if (d <= -2) return { id: "falling", label: "하락중", tone: "weakening" }
  if (d === -1) return { id: "falling", label: "하락중", tone: "weakening" }
  if (d === 1) return { id: "rising", label: "상승중", tone: "rising" }

  return { id: "hold", label: "유지", tone: "hold" }
}

/** @param {number | null} delta */
function formatDeltaDisplay(delta) {
  if (delta == null || delta === 0) return null
  if (delta > 0) return `▲ +${delta}`
  return `▼ ${delta}`
}

/**
 * @param {StockPickView} stock
 * @param {Record<string, Array<{ date: string; rank: number }>>} [history]
 * @returns {RankTrackView | null}
 */
export function computeRankTrack(stock, history = readScoreHistory()) {
  const currentRank = stock.rank ?? 0
  if (!currentRank || currentRank <= 0) return null

  const today = todayKey()
  const rows = (history[stock.ticker] ?? [])
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))

  const previousRow = resolvePreviousRankRow(rows, today)

  const previousRank =
    previousRow?.rank != null && Number.isFinite(previousRow.rank) && previousRow.rank > 0
      ? previousRow.rank
      : null

  const delta =
    previousRank != null ? previousRank - currentRank : null
  const badge = resolveRankBadge(delta, currentRank, previousRank)

  return {
    currentRank,
    previousRank,
    delta,
    deltaDisplay: formatDeltaDisplay(delta),
    rankDisplay: `${currentRank}위`,
    badge,
    isNewEntry: badge.id === "newEntry",
  }
}

/** @param {RankTrackView | null | undefined} track */
export function serializeRankTrackForSnapshot(track) {
  if (!track) return undefined
  return {
    currentRank: track.currentRank,
    previousRank: track.previousRank,
    delta: track.delta,
    badgeId: track.badge.id,
    badgeLabel: track.badge.label,
  }
}
