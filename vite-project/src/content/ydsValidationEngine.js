/**
 * Phase 7 — YDS 검증 레이어 (기존 분석 검증 · 신규 분석 없음)
 */

import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { todayDateKey } from "./ydsPortfolioTradesStorage.js"
import { loadPortfolioReview } from "./ydsPortfolioReviewStorage.js"
import { loadPortfolioStockReviews } from "./ydsPortfolioStockReviewStorage.js"
import { loadPortfolioTrades } from "./ydsPortfolioTradesStorage.js"
import {
  filterByCountry,
  getStockPickUniverse,
  getTop3Stocks,
} from "./ydsStockPickModel.js"
import { getStockSnapshot } from "./stockPickSnapshotProvider.js"
import {
  loadValidationPicks,
  loadValidationPortfolioSnapshots,
  saveValidationPicks,
  saveValidationPortfolioSnapshots,
} from "./ydsValidationStorage.js"

/** @typedef {import("./ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */
/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */
/** @typedef {import("./ydsValidationStorage.js").ValidationPortfolioSnapshot} ValidationPortfolioSnapshot */
/** @typedef {import("./ydsPortfolioV5Engine.js").HoldingRow} HoldingRow */

/** @type {Record<string, string>} */
export const REGIME_LABELS = {
  overheated: "방어 모드",
  neutral: "방어 모드",
  interest: "관심 구간",
  dca: "분할매수",
  panicBuy: "패닉매수",
}

/**
 * @param {YdsMarketAdapterContext | null | undefined} ctx
 */
export function regimeFromMarketContext(ctx) {
  const macroId = ctx?.macroId ?? "neutral"
  const label =
    ctx?.isDefensive && (macroId === "neutral" || macroId === "overheated")
      ? "방어 모드"
      : (REGIME_LABELS[macroId] ?? ctx?.strategyLabel ?? "—")
  return { regimeId: macroId, regimeLabel: label }
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {YdsMarketAdapterContext | null | undefined} marketContext
 * @param {string} recommendedAt
 */
function pickRecordFromStock(stock, marketContext, recommendedAt) {
  const price = Number(stock.snapshot?.price ?? stock.snapshot?.close)
  const { regimeId, regimeLabel } = regimeFromMarketContext(marketContext)
  const country = stock.country === "KR" ? "KR" : "US"
  const id = `${recommendedAt}:${country}:${stock.ticker}`

  return /** @type {ValidationPickRecord} */ ({
    id,
    ticker: stock.ticker,
    name: stock.name,
    country,
    rank: stock.rank,
    recommendedAt,
    recommendedPrice: Number.isFinite(price) && price > 0 ? price : 0,
    currentPrice: null,
    returnPct: null,
    regimeId,
    regimeLabel,
    strategyLabel: marketContext?.strategyLabel ?? "—",
    recordedAt: Date.now(),
    lastUpdatedAt: Date.now(),
  })
}

/**
 * @param {ValidationPickRecord} record
 */
function refreshPickPrice(record) {
  const snap = getStockSnapshot({
    ticker: record.ticker,
    country: record.country,
    status: "interest",
  })
  const current = Number(snap?.price ?? snap?.close)
  const currentPrice = Number.isFinite(current) && current > 0 ? current : null
  const returnPct = calcRecommendReturnPct(record.recommendedPrice, currentPrice)
  return {
    ...record,
    currentPrice,
    returnPct,
    lastUpdatedAt: Date.now(),
  }
}

/**
 * @param {YdsMarketAdapterContext | null | undefined} marketContext
 */
export function captureTodayPickSnapshots(marketContext) {
  const today = todayDateKey()
  const existing = loadValidationPicks()
  const hasToday = existing.some((r) => r.recommendedAt === today)
  if (hasToday) return existing

  const universe = getStockPickUniverse(marketContext ?? null)
  const usTop = getTop3Stocks(filterByCountry(universe, "US"))
  const krTop = getTop3Stocks(filterByCountry(universe, "KR"))
  const fresh = [...usTop, ...krTop]
    .filter((s) => s?.ticker)
    .map((s) => pickRecordFromStock(s, marketContext, today))

  if (!fresh.length) return existing

  const merged = [...existing, ...fresh]
  saveValidationPicks(merged)
  return merged
}

/** @param {ValidationPickRecord[]} picks */
export function refreshValidationPicks(picks) {
  const refreshed = picks.map((r) => refreshPickPrice(r))
  saveValidationPicks(refreshed)
  return refreshed
}

/**
 * @param {import("./ydsPortfolioV5Engine.js").ReturnType<typeof import("./ydsPortfolioV5Engine.js").buildV5Holdings>} portfolio
 */
export function maybeRecordPortfolioSnapshot(portfolio) {
  const snapshots = loadValidationPortfolioSnapshots()
  const today = todayDateKey()
  if (snapshots.some((s) => s.date === today)) return snapshots

  const totalAssets = Number(portfolio?.totalAssets) || 0
  const hasHoldings = Array.isArray(portfolio?.rows) && portfolio.rows.length > 0
  if (totalAssets <= 0 && !hasHoldings) return snapshots

  const next = [
    ...snapshots,
    {
      date: today,
      totalAssets,
      totalPnl: Number(portfolio?.totalPnl) || 0,
      totalReturnPct:
        portfolio?.totalReturnPct != null && Number.isFinite(portfolio.totalReturnPct)
          ? portfolio.totalReturnPct
          : null,
      cashPct: Number(portfolio?.cashPct) || 0,
      realizedPnl: Number(portfolio?.totalRealizedPnl) || 0,
      unrealizedPnl: Number(portfolio?.totalUnrealizedPnl) || 0,
      recordedAt: Date.now(),
    },
  ]
  saveValidationPortfolioSnapshots(next)
  return next
}

/**
 * @param {ValidationPickRecord[]} picks
 */
export function summarizeRegimePerformance(picks) {
  /** @type {Record<string, { regimeLabel: string; count: number; withReturn: number; sumReturn: number; avgReturn: number | null }>} */
  const map = {}

  for (const label of Object.values(REGIME_LABELS)) {
    map[label] = { regimeLabel: label, count: 0, withReturn: 0, sumReturn: 0, avgReturn: null }
  }

  for (const row of picks ?? []) {
    const key = row.regimeLabel || REGIME_LABELS[row.regimeId] || "—"
    if (!map[key]) {
      map[key] = { regimeLabel: key, count: 0, withReturn: 0, sumReturn: 0, avgReturn: null }
    }
    map[key].count += 1
    if (row.returnPct != null && Number.isFinite(row.returnPct)) {
      map[key].withReturn += 1
      map[key].sumReturn += row.returnPct
    }
  }

  return Object.values(map).map((g) => ({
    ...g,
    avgReturn: g.withReturn > 0 ? Math.round((g.sumReturn / g.withReturn) * 10) / 10 : null,
  }))
}

/**
 * @param {ValidationPortfolioSnapshot[]} snapshots
 */
export function summarizePortfolioPerformance(snapshots) {
  const list = [...(snapshots ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  if (!list.length) {
    return {
      snapshots: [],
      latest: null,
      first: null,
      assetsDelta: null,
      pnlDelta: null,
      returnDelta: null,
    }
  }

  const first = list[0]
  const latest = list[list.length - 1]
  const assetsDelta =
    first.totalAssets > 0 ? Math.round(latest.totalAssets - first.totalAssets) : null
  const pnlDelta =
    first.totalPnl != null && latest.totalPnl != null
      ? Math.round(latest.totalPnl - first.totalPnl)
      : null
  const returnDelta =
    first.totalReturnPct != null && latest.totalReturnPct != null
      ? Math.round((latest.totalReturnPct - first.totalReturnPct) * 10) / 10
      : null

  return { snapshots: list, latest, first, assetsDelta, pnlDelta, returnDelta }
}

/**
 * @param {ValidationPickRecord[]} picks
 */
export function summarizePickPerformance(picks) {
  const withRet = (picks ?? []).filter((r) => r.returnPct != null && Number.isFinite(r.returnPct))
  const avgReturn = withRet.length
    ? Math.round((withRet.reduce((s, r) => s + Number(r.returnPct), 0) / withRet.length) * 10) / 10
    : null
  const best = [...withRet].sort((a, b) => Number(b.returnPct) - Number(a.returnPct))[0] ?? null
  return { total: picks.length, tracked: withRet.length, avgReturn, best }
}

export function collectReviewArchive() {
  const global = loadPortfolioReview()
  const stockMap = loadPortfolioStockReviews()
  const trades = loadPortfolioTrades()

  /** @type {{ kind: string; title: string; body: string; at: number }[]} */
  const items = []

  for (const [field, label] of [
    ["mistakes", "실수"],
    ["lessons", "배운 점"],
    ["nextAction", "다음 행동"],
  ]) {
    const body = String(global[field] ?? "").trim()
    if (body) items.push({ kind: "global", title: label, body, at: global.updatedAt || 0 })
  }

  for (const [positionId, entry] of Object.entries(stockMap)) {
    for (const [field, label] of [
      ["buyReason", "매수 이유"],
      ["sellReason", "매도 이유"],
      ["lessons", "배운 점"],
      ["nextAction", "다음 행동"],
    ]) {
      const body = String(entry?.[field] ?? "").trim()
      if (body) {
        items.push({
          kind: "stock",
          title: `${positionId} · ${label}`,
          body,
          at: entry.updatedAt || 0,
        })
      }
    }
  }

  for (const trade of trades) {
    if (trade.action !== "sell") continue
    const memo = String(trade.memo ?? "").trim()
    if (!memo) continue
    items.push({
      kind: "trade",
      title: `${trade.name} · 매도 기록`,
      body: memo,
      at: trade.updatedAt || trade.createdAt || 0,
    })
  }

  items.sort((a, b) => b.at - a.at)

  return {
    total: items.length,
    buyReasons: items.filter((i) => i.title.includes("매수 이유")).length,
    sellReasons:
      items.filter((i) => i.title.includes("매도")).length +
      items.filter((i) => i.kind === "trade").length,
    lessons: items.filter((i) => i.title.includes("배운 점")).length,
    recent: items.slice(0, 6),
  }
}

/**
 * @param {YdsMarketAdapterContext | null | undefined} marketContext
 * @param {import("./ydsPortfolioV5Engine.js").ReturnType<typeof import("./ydsPortfolioV5Engine.js").buildV5Holdings>} portfolio
 */
export function buildValidationReport(marketContext, portfolio) {
  const captured = captureTodayPickSnapshots(marketContext)
  const picks = refreshValidationPicks(captured)
  const portfolioSnapshots = maybeRecordPortfolioSnapshot(portfolio)

  return {
    picks: [...picks].sort((a, b) => b.recommendedAt.localeCompare(a.recommendedAt)),
    pickSummary: summarizePickPerformance(picks),
    regimeSummary: summarizeRegimePerformance(picks),
    portfolio: summarizePortfolioPerformance(portfolioSnapshots),
    reviews: collectReviewArchive(),
  }
}
