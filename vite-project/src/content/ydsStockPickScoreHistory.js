/**
 * V5/V6 — 점수·순위 이력 (localStorage) 및 변화량
 */

const STORAGE_KEY = "yds-stock-pick-score-history-v1"
const MAX_DAYS = 30

/** @returns {Record<string, Array<{ date: string; total: number; rank: number; statusId: string; quality: number; timing: number; marketFit: number; qualityGrade?: string; qualityDisplayGrade?: string; timingGrade?: string; marketFitGrade?: string; positionId?: string }>>} */
export function readScoreHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

/** @param {Record<string, unknown>} data */
function writeHistory(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

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
 * @typedef {{
 *   current: number
 *   previous: number | null
 *   delta: number | null
 *   direction: 'up' | 'down' | 'flat' | null
 *   display: string | null
 * }} ScoreDeltaView
 */

/**
 * @param {string} ticker
 * @param {number} daysAgo
 * @param {Record<string, Array<{ date: string; total: number }>>} [history]
 * @returns {ScoreDeltaView | null}
 */
export function getScoreDeltaForDays(ticker, daysAgo, history = readScoreHistory()) {
  const rows = history[ticker]
  if (!rows?.length) return null

  const today = todayKey()
  const targetDate = daysBefore(today, daysAgo)
  const currentRow = rows.find((r) => r.date === today) ?? rows[rows.length - 1]
  const prevRow =
    rows.find((r) => r.date === targetDate) ??
    rows.filter((r) => r.date < (currentRow?.date ?? today)).slice(-1)[0]

  if (!currentRow || !prevRow || currentRow.date === prevRow.date) return null

  const delta = currentRow.total - prevRow.total
  if (delta === 0) {
    return {
      current: currentRow.total,
      previous: prevRow.total,
      delta: 0,
      direction: "flat",
      display: "→ 0",
    }
  }

  const direction = delta > 0 ? "up" : "down"
  const sign = delta > 0 ? "+" : ""
  return {
    current: currentRow.total,
    previous: prevRow.total,
    delta,
    direction,
    display: `${delta > 0 ? "▲" : "▼"} ${sign}${delta}`,
  }
}

/**
 * @param {string} ticker
 * @param {'total' | 'timing' | 'marketFit' | 'quality'} field
 * @param {number} daysAgo
 * @param {Record<string, Array<Record<string, unknown>>>} [history]
 */
export function getFieldDeltaForDays(ticker, field, daysAgo, history = readScoreHistory()) {
  const rows = history[ticker]
  if (!rows?.length) return null

  const today = todayKey()
  const targetDate = daysBefore(today, daysAgo)
  const currentRow = rows.find((r) => r.date === today) ?? rows[rows.length - 1]
  const prevRow =
    rows.find((r) => r.date === targetDate) ??
    rows.filter((r) => r.date < (currentRow?.date ?? today)).slice(-1)[0]

  if (!currentRow || !prevRow || currentRow.date === prevRow.date) return null

  const cur = Number(currentRow[field])
  const prev = Number(prevRow[field])
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null

  const delta = cur - prev
  if (delta === 0) {
    return { current: cur, previous: prev, delta: 0, direction: "flat", display: "→ 0" }
  }
  const direction = delta > 0 ? "up" : "down"
  const sign = delta > 0 ? "+" : ""
  return {
    current: cur,
    previous: prev,
    delta,
    direction,
    display: `${delta > 0 ? "▲" : "▼"} ${sign}${delta}`,
  }
}

/**
 * @param {string} ticker
 * @param {Record<string, Array<Record<string, unknown>>>} [history]
 */
export function getWatchlistDeltas(ticker, history = readScoreHistory()) {
  return {
    total: getFieldDeltaForDays(ticker, "total", 1, history),
    timing: getFieldDeltaForDays(ticker, "timing", 1, history),
    marketFit: getFieldDeltaForDays(ticker, "marketFit", 1, history),
  }
}

/**
 * @param {string} ticker
 * @param {Record<string, Array<{ date: string; total: number; rank: number }>>} [history]
 */
export function getScoreDeltas(ticker, history = readScoreHistory()) {
  return {
    day1: getScoreDeltaForDays(ticker, 1, history),
    day5: getScoreDeltaForDays(ticker, 5, history),
    day20: getScoreDeltaForDays(ticker, 20, history),
    recommendDay1: getRecommendScoreDeltaForDays(ticker, 1, history),
    /** @deprecated use day5 */
    day7: getScoreDeltaForDays(ticker, 5, history),
    /** @deprecated use day20 */
    day14: getScoreDeltaForDays(ticker, 20, history),
  }
}

/**
 * @param {string} ticker
 * @param {number} daysAgo
 * @param {Record<string, Array<{ date: string; recommendScore?: number; total?: number }>>} [history]
 */
function getRecommendScoreDeltaForDays(ticker, daysAgo, history = readScoreHistory()) {
  const rows = history[ticker]
  if (!rows?.length) return null

  const today = todayKey()
  const targetDate = daysBefore(today, daysAgo)
  const currentRow = rows.find((r) => r.date === today) ?? rows[rows.length - 1]
  const prevRow =
    rows.find((r) => r.date === targetDate) ??
    rows.filter((r) => r.date < (currentRow?.date ?? today)).slice(-1)[0]

  if (!currentRow || !prevRow || currentRow.date === prevRow.date) return null

  const cur = Number(currentRow.recommendScore ?? currentRow.total)
  const prev = Number(prevRow.recommendScore ?? prevRow.total)
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null

  const delta = cur - prev
  if (delta === 0) {
    return { current: cur, previous: prev, delta: 0, direction: "flat", display: "→ 0" }
  }
  const direction = delta > 0 ? "up" : "down"
  const sign = delta > 0 ? "+" : ""
  return {
    current: cur,
    previous: prev,
    delta,
    direction,
    display: `${delta > 0 ? "▲" : "▼"} ${sign}${delta}`,
  }
}

/** @param {string} ticker @param {Record<string, Array<Record<string, unknown>>>} [history] */
export function getRecommendScoreDelta(ticker, history = readScoreHistory()) {
  return getRecommendScoreDeltaForDays(ticker, 1, history)
}

/**
 * @param {string} ticker
 * @param {number} daysAgo
 * @param {Record<string, Array<Record<string, unknown>>>} [history]
 */
export function getHistoryRowAtDaysAgo(ticker, daysAgo, history = readScoreHistory()) {
  const rows = history[ticker]
  if (!rows?.length) return null

  const today = todayKey()
  const targetDate = daysBefore(today, daysAgo)
  const exact = rows.find((r) => r.date === targetDate)
  if (exact) return exact

  const before = rows.filter((r) => r.date <= targetDate)
  return before.length ? before[before.length - 1] : null
}

/**
 * @param {string} ticker
 * @param {number} daysAgo
 * @param {Record<string, Array<Record<string, unknown>>>} [history]
 */
export function getGradeSnapshotForDays(ticker, daysAgo, history = readScoreHistory()) {
  const row = getHistoryRowAtDaysAgo(ticker, daysAgo, history)
  if (!row) return null
  return {
    qualityGrade: String(row.qualityDisplayGrade ?? row.qualityGrade ?? ""),
    timingGrade: String(row.timingGrade ?? ""),
    marketFitGrade: String(row.marketFitGrade ?? ""),
  }
}

/**
 * @param {string} ticker
 * @param {number} daysAgo
 * @param {Record<string, Array<Record<string, unknown>>>} [history]
 */
export function getPositionSnapshotForDays(ticker, daysAgo, history = readScoreHistory()) {
  const row = getHistoryRowAtDaysAgo(ticker, daysAgo, history)
  if (!row?.positionId) return null
  return { positionId: String(row.positionId), date: String(row.date) }
}

/**
 * @param {string} ticker
 * @param {number} daysAgo
 * @param {Record<string, Array<Record<string, unknown>>>} [history]
 */
function getHistoryRowForDays(ticker, daysAgo, history) {
  const rows = history[ticker]
  if (!rows?.length) return null

  const today = todayKey()
  const targetDate = daysBefore(today, daysAgo)
  const currentRow = rows.find((r) => r.date === today) ?? rows[rows.length - 1]
  const prevRow =
    rows.find((r) => r.date === targetDate) ??
    rows.filter((r) => r.date < (currentRow?.date ?? today)).slice(-1)[0]

  if (!prevRow || !currentRow || currentRow.date === prevRow.date) return null
  return prevRow
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView[]} stocks
 * @param {Record<string, Array<{ date: string; total: number; rank: number; statusId: string; quality: number; timing: number }>>} [historyBefore]
 */
export function recordScoreHistory(stocks, historyBefore = readScoreHistory()) {
  const history = { ...historyBefore }
  const today = todayKey()

  for (const stock of stocks) {
    if (stock.dataSource !== "live") continue
    const total = stock.v4Score?.finalRankScore ?? stock.v4Score?.total ?? stock.scoreBreakdown?.total ?? 0
    const marketFit = stock.pickMeta?.marketFitScore ?? stock.scoreBreakdown?.marketEnv ?? 0
    const v4 = stock.v4Score
    const recommendScore = Math.round(
      stock.recommendEngine?.compositeScore ?? total,
    )
    const entry = {
      date: today,
      total: Math.round(total),
      recommendScore,
      rank: stock.rank ?? 0,
      statusId: v4?.recommendStatusId ?? "",
      quality: v4?.quality ?? 0,
      timing: v4?.timing ?? 0,
      marketFit: Math.round(marketFit),
      qualityGrade: v4?.qualityGrade ?? "",
      qualityDisplayGrade: v4?.qualityDisplayGrade ?? v4?.qualityGrade ?? "",
      timingGrade: v4?.timingGrade ?? "",
      marketFitGrade: stock.pickMeta?.marketFitGrade ?? "",
      positionId: stock.pickMeta?.positionState?.id ?? "",
    }

    const prev = history[stock.ticker] ?? []
    const withoutToday = prev.filter((r) => r.date !== today)
    history[stock.ticker] = [...withoutToday, entry]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-MAX_DAYS)
  }

  writeHistory(history)
  return history
}

/** @param {import("./ydsStockPickModel.js").StockPickView[]} stocks */
export function applyScoreHistoryMeta(stocks) {
  const historyBefore = readScoreHistory()

  const withMeta = stocks.map((stock) => ({
    ...stock,
    scoreDeltas: getScoreDeltas(stock.ticker, historyBefore),
  }))

  recordScoreHistory(withMeta, historyBefore)
  return withMeta
}
