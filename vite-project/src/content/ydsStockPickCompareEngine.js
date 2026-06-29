/**
 * GO #84 — AI 추천 종목 비교 엔진
 */

import { buildAiRationaleProgressBars } from "./ydsStockPickAiAnalysisEngine.js"
import { getRecommendEngineSortScore } from "./ydsStockRecommendEngine.js"
import { resolveRecommendStatusView } from "./ydsStockPickRecommendColors.js"
import { buildStockPickTradeScenarioReport } from "./ydsStockPickTradeScenario.js"
import { buildStockPickDetailPanelReport } from "./ydsStockPickDetailPanelEngine.js"
import { estimateHoldPeriodLabel } from "./ydsStockPickDashboardEngine.js"
import { resolveStockPickUxStatus } from "./ydsStockPickUxStatus.js"

/** @typedef {import("./ydsStockPickModel.js").StockPickView} StockPickView */

export const COMPARE_MAX = 4

export const COMPARE_METRICS = [
  { id: "aiScore", label: "AI 점수", category: "score" },
  { id: "quality", label: "기업 품질", category: "score" },
  { id: "technical", label: "기술적 점수", category: "score" },
  { id: "earnings", label: "실적", category: "score" },
  { id: "supply", label: "수급", category: "score" },
  { id: "momentum", label: "산업 모멘텀", category: "score" },
  { id: "riskSafety", label: "리스크(안전)", category: "score" },
  { id: "status", label: "추천 상태", category: "text" },
  { id: "expectedReturn", label: "예상 수익률", category: "pct" },
  { id: "target", label: "목표가", category: "text" },
  { id: "holdPeriod", label: "보유기간", category: "text" },
  { id: "stopLoss", label: "손절 기준", category: "text" },
]

/**
 * @param {StockPickView} stock
 */
function buildStockCompareMetrics(stock) {
  const bars = buildAiRationaleProgressBars(stock)
  const barMap = Object.fromEntries(bars.map((b) => [b.id, b.score]))
  const engine = stock.recommendEngine
  const scenario = buildStockPickTradeScenarioReport(stock, null, null)
  const detail = buildStockPickDetailPanelReport(stock, null)
  const bull = scenario.scenarios?.find((s) => s.id === "bull")
  const momentum = engine?.scores?.momentum ?? 50
  const expectedReturn = Math.round((12 + momentum / 5) * ((bull?.probability ?? 40) / 100) * 10) / 10
  const statusId = resolveStockPickUxStatus(stock).id

  return {
    ticker: stock.ticker,
    name: stock.name,
    aiScore: Math.round(getRecommendEngineSortScore(stock)),
    quality: Math.round(stock.v4Score?.quality ?? stock.scoreBreakdown?.quality ?? 0),
    technical: barMap.technical ?? 0,
    earnings: barMap.earnings ?? 0,
    supply: barMap.supply ?? 0,
    momentum: barMap.momentum ?? 0,
    riskSafety: engine?.riskSafety ?? Math.max(0, 100 - (barMap.risk ?? 50)),
    status: resolveRecommendStatusView(stock).label,
    expectedReturn: `${expectedReturn > 0 ? "+" : ""}${expectedReturn}%`,
    target: detail.priceLevels?.target1 ?? bull?.target ?? "—",
    holdPeriod: estimateHoldPeriodLabel(statusId),
    stopLoss: detail.priceLevels?.stopLoss ?? "—",
    radar: [
      { axis: "AI", value: Math.round(getRecommendEngineSortScore(stock)) },
      { axis: "품질", value: Math.min(100, Math.round((stock.v4Score?.quality ?? 0) * 1.5)) },
      { axis: "기술", value: barMap.technical ?? 0 },
      { axis: "실적", value: barMap.earnings ?? 0 },
      { axis: "수급", value: barMap.supply ?? 0 },
      { axis: "모멘텀", value: barMap.momentum ?? 0 },
    ],
  }
}

/**
 * @param {StockPickView[]} stocks
 * @param {string[]} tickers
 */
export function buildStockPickCompareReport(stocks, tickers) {
  const selected = tickers
    .slice(0, COMPARE_MAX)
    .map((t) => stocks.find((s) => s.ticker.toUpperCase() === t.toUpperCase()))
    .filter(Boolean)

  if (!selected.length) {
    return { visible: false, title: "AI 추천 비교", stocks: [], metrics: COMPARE_METRICS, radarData: [] }
  }

  const items = selected.map(buildStockCompareMetrics)

  const radarData = items[0].radar.map((r) => {
    /** @type {Record<string, number | string>} */
    const row = { axis: r.axis }
    for (const item of items) {
      const match = item.radar.find((x) => x.axis === r.axis)
      row[item.ticker] = match?.value ?? 0
    }
    return row
  })

  return {
    visible: true,
    title: "AI 추천 비교",
    stocks: items,
    metrics: COMPARE_METRICS,
    radarData,
    colors: ["#38bdf8", "#4ade80", "#fbbf24", "#f87171"],
  }
}

/** @param {string} raw */
export function parseCompareTickers(raw) {
  if (!raw) return []
  return [...new Set(String(raw).split(/[,+\s]+/).map((t) => t.trim().toUpperCase()).filter(Boolean))].slice(
    0,
    COMPARE_MAX,
  )
}
