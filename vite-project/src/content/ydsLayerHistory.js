/**
 * Momentum·Event Layer 공통 히스토리 정규화 (표시 전용)
 */

export function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * 전환신호·레이어 — 실제 데이터 날짜 (updatedAt·생성일 제외)
 * @param {object | null | undefined} row
 */
export function resolveTimelineDataDate(row) {
  if (!row || typeof row !== "object") return null
  const candidates = [row.date, row.tradeDate, row.trade_date, row.ts]
  for (const raw of candidates) {
    const d = String(raw ?? "").trim().slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  }
  return null
}

/** @param {object | null | undefined} row */
export function rowDate(row) {
  return resolveTimelineDataDate(row)
}

/**
 * @param {object[]} rows
 * @param {string | null} asOfDate
 * @param {object | null | undefined} panicData
 */
export function mergeLayerHistory(rows, asOfDate, panicData = null) {
  const map = new Map()
  for (const row of rows ?? []) {
    const d = rowDate(row)
    if (!d) continue
    map.set(d, { ...map.get(d), ...row, date: d })
  }
  if (asOfDate && /^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
    const prev = map.get(asOfDate) ?? {}
    map.set(asOfDate, {
      ...prev,
      date: asOfDate,
      fearGreed: toNum(panicData?.fearGreed) ?? toNum(prev.fearGreed),
      bofa: toNum(panicData?.bofa) ?? toNum(prev.bofa),
    })
  }
  return [...map.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

/**
 * @param {object[]} sorted ascending
 * @param {number} daysBack calendar days from latest (inclusive window)
 */
export function rowsWithinDays(sorted, daysBack) {
  if (!sorted.length) return []
  const latestDate = sorted[sorted.length - 1].date
  const base = new Date(`${latestDate}T12:00:00.000Z`)
  base.setUTCDate(base.getUTCDate() - daysBack)
  const cutoff = base.toISOString().slice(0, 10)
  return sorted.filter((r) => r.date >= cutoff)
}

/**
 * @param {object[]} sorted ascending
 * @param {number} daysBack
 */
export function findRowDaysBefore(sorted, daysBack) {
  if (!sorted.length) return null
  const latestDate = sorted[sorted.length - 1].date
  const base = new Date(`${latestDate}T12:00:00.000Z`)
  base.setUTCDate(base.getUTCDate() - daysBack)
  const target = base.toISOString().slice(0, 10)

  let best = null
  for (const row of sorted) {
    if (row.date <= target) best = row
    else break
  }
  return best
}
