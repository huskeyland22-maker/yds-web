import assert from "node:assert/strict"
import { buildStockPickDetailPanelReport } from "../vite-project/src/content/ydsStockPickDetailPanelEngine.js"
import { buildRecommendPerfReport } from "../vite-project/src/content/ydsRecommendPerfReportEngine.js"
import { buildAiPortfolioRecommendReport } from "../vite-project/src/content/ydsAiPortfolioEngine.js"
import { buildStockPickRecommendHistoryReport } from "../vite-project/src/content/ydsStockPickRecommendHistory.js"
import { buildStockPickTradeScenarioReport } from "../vite-project/src/content/ydsStockPickTradeScenario.js"

const stock = {
  dataSource: "live",
  ticker: "NVDA",
  name: "NVIDIA",
  country: "US",
  sector: "semiconductor",
  sectorLabel: "반도체",
  rating: 4.5,
  v4Score: {
    finalRankScore: 88,
    quality: 62,
    timing: 18,
    qualityGrade: "A",
    timingGrade: "B",
    recommendStatusId: "buy",
  },
  scoreBreakdown: {
    performance: 26,
    industry: 20,
    sector: 16,
    marketEnv: 12,
    technical: 4,
    volume: 3,
    timing: 18,
    quality: 62,
    total: 80,
  },
  scores: { trendScore: 32, volumeScore: 14, positionScore: 15, marketFitScore: 16 },
  snapshot: { price: 120, ma20: 115, close: 120 },
  recommendRationales: [{ text: "AI 수요 견조" }],
  recommendReasonSummary: "AI 수요 견조",
  opinion: { summary: "분할 매수 검토 구간입니다." },
  pickMeta: { marketFitScore: 12 },
}

const detail = buildStockPickDetailPanelReport(stock, null)
assert.ok(detail.visible)
assert.equal(detail.scoreBars.length, 6)
assert.ok(detail.aiOpinion)
assert.ok(detail.priceLevels.buyZone !== "—")

const perf = buildRecommendPerfReport([], 30)
assert.ok(perf.title)

const portfolio = buildAiPortfolioRecommendReport({ stocks: [stock, { ...stock, ticker: "AMD", name: "AMD" }, { ...stock, ticker: "TSM", name: "TSMC" }] })
assert.ok(portfolio.plans.length === 3)

const history = buildStockPickRecommendHistoryReport(stock)
assert.ok(history.title)

const scenario = buildStockPickTradeScenarioReport(stock, null, null)
assert.equal(scenario.scenarios.length, 3)
assert.equal(scenario.scenarios.reduce((s, x) => s + x.probability, 0), 100)

console.log("yds-stock-pick-ai-suite.test.mjs OK")
