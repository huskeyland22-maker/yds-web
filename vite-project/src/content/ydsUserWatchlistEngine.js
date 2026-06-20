/**
 * 사용자 관심종목 Watchlist — 점수·위치·변화·대시보드
 */

import { readScoreHistory, getWatchlistDeltas } from "./ydsStockPickScoreHistory.js"
import { resolvePricePosition } from "./ydsStockPickV5Insights.js"
import { resolveStockPickCardAction } from "./ydsStockPickCardAction.js"
import { marketEnvToGrade } from "./ydsStockPickV5Insights.js"

/** @typedef {import("./ydsStockPickModel.js").StockPickView} StockPickView */

export const WATCHLIST_POSITION_SHORT = {
  dip: "눌림",
  earlyRise: "상승초기",
  overheat: "과열",
}

/** @param {StockPickView} stock */
export function buildWatchlistItem(stock, history = readScoreHistory()) {
  const position = stock.pickMeta?.pricePosition ?? resolvePricePosition(stock)
  const positionShort = WATCHLIST_POSITION_SHORT[position.id] ?? position.label
  const cardAction = resolveStockPickCardAction(stock)
  const marketFitScore = stock.pickMeta?.marketFitScore ?? stock.scoreBreakdown?.marketEnv ?? 0
  const marketFitGrade =
    stock.pickMeta?.marketFitGrade ?? marketEnvToGrade(marketFitScore, 15)
  const deltas = getWatchlistDeltas(stock.ticker, history)

  return {
    ticker: stock.ticker,
    name: stock.name,
    country: stock.country === "KR" ? "KR" : "US",
    totalScore: stock.v4Score?.finalRankScore ?? stock.score ?? 0,
    qualityGrade: stock.v4Score?.qualityGrade ?? "—",
    timingGrade: stock.v4Score?.timingGrade ?? "—",
    marketFitGrade,
    quality: stock.v4Score?.quality ?? 0,
    timing: stock.v4Score?.timing ?? 0,
    marketFitScore: Math.round(marketFitScore),
    positionId: position.id,
    positionLabel: positionShort,
    positionEmoji: position.emoji,
    cardActionId: cardAction.id,
    cardActionLabel: cardAction.label,
    statusId: stock.v4Score?.recommendStatusId ?? "",
    deltas,
    hasChange:
      (deltas.total?.delta != null && deltas.total.delta !== 0) ||
      (deltas.timing?.delta != null && deltas.timing.delta !== 0) ||
      (deltas.marketFit?.delta != null && deltas.marketFit.delta !== 0),
  }
}

/**
 * @param {Set<string> | string[]} favorites
 * @param {StockPickView[]} liveStocks
 */
export function buildUserWatchlistReport(favorites, liveStocks) {
  const favSet = favorites instanceof Set ? favorites : new Set(favorites)
  const history = readScoreHistory()
  const byTicker = new Map(liveStocks.map((s) => [s.ticker, s]))

  const items = [...favSet]
    .map((ticker) => {
      const stock = byTicker.get(ticker)
      if (!stock || stock.dataSource !== "live") return null
      return buildWatchlistItem(stock, history)
    })
    .filter(Boolean)
    .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))

  const withTotalDelta = items.filter((i) => i.deltas.total?.delta != null)
  const changedToday = items.filter((i) => i.hasChange)
  const topUp = [...withTotalDelta]
    .filter((i) => (i.deltas.total?.delta ?? 0) > 0)
    .sort((a, b) => (b.deltas.total?.delta ?? 0) - (a.deltas.total?.delta ?? 0))
    .slice(0, 10)
  const topDown = [...withTotalDelta]
    .filter((i) => (i.deltas.total?.delta ?? 0) < 0)
    .sort((a, b) => (a.deltas.total?.delta ?? 0) - (b.deltas.total?.delta ?? 0))
    .slice(0, 10)

  return {
    count: items.length,
    items,
    dashboard: {
      changedToday,
      topUp,
      topDown,
    },
    missingTickers: [...favSet].filter((t) => !byTicker.has(t)),
  }
}

/** @param {import("./ydsStockPickScoreHistory.js").ScoreDeltaView | null | undefined} delta */
export function formatWatchlistDelta(delta) {
  if (!delta?.display) return "—"
  return delta.display
}

/** @param {'up' | 'down' | 'flat' | null | undefined} direction */
export function deltaToneClass(direction) {
  if (direction === "up") return "yds-user-watchlist__delta--up"
  if (direction === "down") return "yds-user-watchlist__delta--down"
  return ""
}
