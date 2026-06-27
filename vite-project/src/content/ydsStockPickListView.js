/**
 * 종목추천 리스트 · 테이블 · TOP5 카드 공통 표시 데이터
 */

import { findValidationPickByTicker } from "./ydsPickValidationLink.js"
import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { formatTransparencyPrice } from "./ydsStockPickTransparency.js"
import { resolveStockPosition } from "./ydsStockPositionEngine.js"
import { formatPerfPct } from "./ydsPickPerformanceEngine.js"

/** @typedef {import("./ydsStockPickModel.js").StockPickView} StockPickView */

/** @param {number} score */
export function confidenceDisplayTier(score) {
  if (!Number.isFinite(score)) return { label: "—", tone: "muted", min: 0 }
  if (score >= 90) return { label: "매우 높음", tone: "very-high", min: 90 }
  if (score >= 80) return { label: "높음", tone: "high", min: 80 }
  if (score >= 70) return { label: "보통", tone: "mid", min: 70 }
  if (score >= 60) return { label: "주의", tone: "warn", min: 60 }
  return { label: "낮음", tone: "low", min: 0 }
}

/** @param {StockPickView} stock */
export function resolveAiScore(stock) {
  return Math.round(
    stock.trustReport?.recommendScore ??
      stock.recommendEngine?.compositeScore ??
      stock.v4Score?.finalRankScore ??
      stock.score ??
      0,
  )
}

/** @param {StockPickView} stock */
export function resolveRecommendGradeLabel(stock) {
  const v4 = stock.v4Score
  if (!v4) return "—"
  const q = v4.qualityDisplayGrade ?? v4.qualityGrade ?? "—"
  const t = v4.timingGrade ?? "—"
  return `${q} · ${t}`
}

/** @param {StockPickView} stock */
export function resolveRecommendGradeSort(stock) {
  const v4 = stock.v4Score
  if (!v4) return 0
  return (v4.finalRankScore ?? v4.total ?? 0) + (v4.quality ?? 0) * 0.01
}

/** @param {StockPickView} stock */
export function buildStockPickListRow(stock) {
  const country = stock.country === "KR" ? "KR" : "US"
  const pick = findValidationPickByTicker(stock.ticker, country)
  const recPrice = pick?.recommendedPrice ?? null
  const currentRaw = Number(stock.snapshot?.price ?? stock.snapshot?.close)
  const returnPct = calcRecommendReturnPct(recPrice, currentRaw)
  const position = stock.pickMeta?.positionState ?? resolveStockPosition(stock)
  const conf = stock.trustReport?.aiConfidence

  return {
    ticker: stock.ticker,
    name: stock.name,
    aiScore: resolveAiScore(stock),
    recommendGrade: resolveRecommendGradeLabel(stock),
    recommendGradeSort: resolveRecommendGradeSort(stock),
    statusLabel: position.label,
    statusTone: position.tone,
    sector: stock.sectorLabel || stock.sector || "—",
    recommendedPrice: recPrice,
    recommendedPriceLabel:
      recPrice != null ? formatTransparencyPrice(recPrice, country) : "—",
    currentPriceLabel: formatTransparencyPrice(currentRaw, country),
    returnPct,
    returnLabel: formatPerfPct(returnPct),
    confidenceScore: conf?.score ?? null,
    confidenceTier: conf ? confidenceDisplayTier(conf.score) : null,
    rank: stock.rank,
  }
}

/** @typedef {'aiScore' | 'recommendGrade' | 'returnPct'} StockPickListSortKey */

/**
 * @param {StockPickView[]} stocks
 * @param {StockPickListSortKey} sortKey
 * @param {'asc' | 'desc'} direction
 */
export function sortStockPickList(stocks, sortKey, direction = "desc") {
  const sign = direction === "asc" ? 1 : -1
  return stocks.slice().sort((a, b) => {
    const ra = buildStockPickListRow(a)
    const rb = buildStockPickListRow(b)
    let diff = 0
    if (sortKey === "aiScore") diff = ra.aiScore - rb.aiScore
    else if (sortKey === "recommendGrade") diff = ra.recommendGradeSort - rb.recommendGradeSort
    else if (sortKey === "returnPct") {
      const av = ra.returnPct ?? -9999
      const bv = rb.returnPct ?? -9999
      diff = av - bv
    } else diff = (a.rank ?? 999) - (b.rank ?? 999)
    if (diff === 0) diff = ra.aiScore - rb.aiScore
    return diff * sign
  })
}
