/**
 * GO #76 — 오늘의 투자 요약 대시보드
 */

import { getRegimeTopStocks } from "./ydsStockPickMarketRegime.js"
import { buildSectorStrengthMap } from "./ydsStockPickSectorStrength.js"
import { resolveStockPickUxStatus } from "./ydsStockPickUxStatus.js"
import {
  isBuyPossibleStatus,
  isRecommendProhibitedStatus,
} from "./ydsStockPickRecommendColors.js"
import { resolveAiScore, buildStockPickListRow } from "./ydsStockPickListView.js"

/** @typedef {import("./ydsStockPickModel.js").StockPickView} StockPickView */
import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"

/**
 * @param {StockPickView[]} stocks
 * @param {number} [regimeLimit]
 */
export function buildStockPickInvestDashboard(stocks, regimeLimit = 10) {
  const live = stocks.filter((s) => s.dataSource === "live")
  const picks = getRegimeTopStocks(live, regimeLimit)

  /** @type {Record<string, number>} */
  const statusCounts = {
    aggressiveBuy: 0,
    buy: 0,
    scaleIn: 0,
    watch: 0,
    noChase: 0,
  }

  let rising = 0
  let falling = 0
  let newEntry = 0
  let excluded = 0
  let aiSum = 0

  for (const stock of picks) {
    const statusId = resolveStockPickUxStatus(stock).id
    statusCounts[statusId] = (statusCounts[statusId] ?? 0) + 1
    aiSum += resolveAiScore(stock)

    const row = buildStockPickListRow(stock)
    if (row.returnPct != null) {
      if (row.returnPct > 0) rising += 1
      else if (row.returnPct < 0) falling += 1
    }

    if (stock.pickMeta?.rankTrack?.isNewEntry) newEntry += 1
    if (isRecommendProhibitedStatus(statusId)) excluded += 1
  }

  const sectorMap = buildSectorStrengthMap(live)
  const sectors = Object.values(sectorMap).filter((s) => s.strength != null)
  sectors.sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))
  const strongest = sectors[0] ?? null
  const weakest = sectors.length ? sectors[sectors.length - 1] : null

  const buyPossible =
    statusCounts.aggressiveBuy + statusCounts.buy + statusCounts.scaleIn
  const watchCount = statusCounts.watch

  let changeSummary = "변화 없음"
  if (newEntry > 0 && rising > falling) {
    changeSummary = `신규 ${newEntry} · 상승 ${rising}종목`
  } else if (falling > rising) {
    changeSummary = `조정 ${falling}종목 · 관망 확대`
  } else if (rising > 0) {
    changeSummary = `상승 ${rising}종목 유지`
  }

  return {
    visible: picks.length > 0,
    title: "오늘의 투자 요약",
    recommendCount: picks.length,
    buyPossible,
    watchCount,
    prohibitedCount: statusCounts.noChase,
    avgAiScore: picks.length ? Math.round(aiSum / picks.length) : null,
    strongestSector: strongest?.label ?? "—",
    weakestSector: weakest?.label ?? "—",
    changeSummary,
    risingCount: rising,
    fallingCount: falling,
    newEntryCount: newEntry,
    excludedCount: excluded,
    statusCounts,
  }
}

/** @param {StockPickView} stock @param {number} [rank] */
export function estimateUpsidePct(stock, rank = 0) {
  const current = Number(stock.snapshot?.price ?? stock.snapshot?.close)
  const targetRaw = stock.trustReport?.tradeStrategy?.targetPrice
  if (typeof targetRaw === "string" && targetRaw !== "—") {
    const num = Number(String(targetRaw).replace(/[^\d.]/g, ""))
    if (Number.isFinite(num) && Number.isFinite(current) && current > 0) {
      return Math.round(((num - current) / current) * 1000) / 10
    }
  }
  const momentum = stock.recommendEngine?.scores?.momentum ?? 50
  return Math.round((8 + momentum / 10 - rank * 0.5) * 10) / 10
}

/** @param {import("./ydsStockPickUxStatus.js").StockPickUxStatusId} statusId */
export function estimateHoldPeriodLabel(statusId) {
  if (statusId === "aggressiveBuy") return "2~4주"
  if (statusId === "buy") return "3~6주"
  if (statusId === "scaleIn") return "4~8주"
  if (statusId === "watch") return "관망"
  return "—"
}
