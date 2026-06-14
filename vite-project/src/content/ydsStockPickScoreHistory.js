/**
 * V5/V6 — 점수·순위 이력 (localStorage) 및 변화량
 */

const STORAGE_KEY = "yds-stock-pick-score-history-v1"
const MAX_DAYS = 30

/** @returns {Record<string, Array<{ date: string; total: number; rank: number; statusId: string; quality: number; timing: number }>>} */
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
 * @param {Record<string, Array<{ date: string; total: number; rank: number }>>} [history]
 */
export function getScoreDeltas(ticker, history = readScoreHistory()) {
  return {
    day1: getScoreDeltaForDays(ticker, 1, history),
    day7: getScoreDeltaForDays(ticker, 7, history),
    day14: getScoreDeltaForDays(ticker, 14, history),
  }
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
    const total = stock.v4Score?.total ?? stock.scoreBreakdown?.total ?? 0
    const entry = {
      date: today,
      total: Math.round(total),
      rank: stock.rank ?? 0,
      statusId: stock.v4Score?.recommendStatusId ?? "",
      quality: stock.v4Score?.quality ?? 0,
      timing: stock.v4Score?.timing ?? 0,
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
  const historyBefore = readHistory()

  const withMeta = stocks.map((stock) => ({
    ...stock,
    scoreDeltas: getScoreDeltas(stock.ticker, historyBefore),
  }))

  recordScoreHistory(withMeta, historyBefore)
  return withMeta
}
