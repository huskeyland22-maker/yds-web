/**
 * V6 — 승격/강등 배지
 */

/** @returns {Record<string, Array<{ date: string; rank: number }>>} */
function readHistorySafe() {
  try {
    const raw = localStorage.getItem("yds-stock-pick-score-history-v1")
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/**
 * @typedef {'newEntry' | 'rankUp' | 'rankDown' | 'top10Exit' | null} RankChangeId
 */

/**
 * @typedef {{
 *   id: RankChangeId
 *   label: string
 *   emoji: string
 * } | null} RankChangeView
 */

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {Record<string, Array<{ date: string; rank: number }>>} [history]
 * @returns {RankChangeView}
 */
export function computeRankChange(stock, history = readHistorySafe()) {
  const rows = history[stock.ticker]
  if (!rows || rows.length < 2) {
    if (stock.rank > 0 && stock.rank <= 10) {
      return { id: "newEntry", label: "신규 진입", emoji: "🆕" }
    }
    return null
  }

  const today = new Date().toISOString().slice(0, 10)
  const current = rows.find((r) => r.date === today) ?? rows[rows.length - 1]
  const prev = rows[rows.length - 2]

  if (!current || !prev) return null

  const rankDiff = prev.rank - current.rank

  if (prev.rank > 10 && current.rank <= 10) {
    return { id: "newEntry", label: "TOP10 진입", emoji: "🆕" }
  }
  if (prev.rank <= 10 && current.rank > 10) {
    return { id: "top10Exit", label: "TOP10 이탈", emoji: "⬇️" }
  }
  if (rankDiff >= 3) {
    return { id: "rankUp", label: `순위 ↑${rankDiff}`, emoji: "⬆️" }
  }
  if (rankDiff <= -3) {
    return { id: "rankDown", label: `순위 ↓${Math.abs(rankDiff)}`, emoji: "⬇️" }
  }

  return null
}
