/**
 * AI 추천 종목 — 상세 분석 패널 리포트
 */

import { buildStockPickScoreDetail } from "./ydsStockPickScoreDetailEngine.js"
import { buildStockPickRecommendHistoryReport } from "./ydsStockPickRecommendHistory.js"
import { formatTransparencyPrice } from "./ydsStockPickTransparency.js"
import { getScoreDeltas, readScoreHistory } from "./ydsStockPickScoreHistory.js"
import { PHASE3_QUALITY_MAX } from "./ydsStockPickPhase3Breakdown.js"
import { TIMING_SCORE_MAX } from "./ydsStockPickTimingScore.js"

/** @param {number} v @param {number} max */
function toPct100(v, max) {
  if (!Number.isFinite(v) || max <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((v / max) * 100)))
}

/** @param {number | null | undefined} price @param {'US' | 'KR'} country */
function fmtPrice(price, country) {
  if (price == null || !Number.isFinite(price)) return "—"
  return formatTransparencyPrice(price, country)
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 */
function buildScoreBars(stock) {
  const b = stock.scoreBreakdown ?? {}
  const marketFit = stock.pickMeta?.marketFitScore ?? b.marketEnv ?? 0
  const technical = (b.technical ?? 0) + (b.volume ?? 0)
  const momentum = stock.v4Score?.timing ?? b.timing ?? 0
  const performance = b.performance ?? 0
  const pos52 = stock.statusDiag?.inputs?.position52w
  let risk = 55
  if (pos52 != null && Number.isFinite(pos52)) {
    if (pos52 >= 85) risk = 35
    else if (pos52 >= 70) risk = 48
    else if (pos52 <= 35) risk = 78
    else risk = 62
  }
  const statusId = stock.v4Score?.recommendStatusId
  if (statusId === "noChase") risk = Math.min(risk, 40)
  if (statusId === "aggressiveBuy") risk = Math.max(risk, 70)

  const aiScore = Math.round(
    stock.v4Score?.finalRankScore ?? stock.v4Score?.total ?? stock.score ?? 0,
  )

  return [
    { id: "ai", label: "AI 추천점수", score: aiScore, max: 100 },
    { id: "marketFit", label: "시장 적합도", score: toPct100(marketFit, 15), max: 100 },
    { id: "performance", label: "실적 점수", score: toPct100(performance, 30), max: 100 },
    { id: "technical", label: "기술적 점수", score: toPct100(technical, 10), max: 100 },
    { id: "momentum", label: "모멘텀 점수", score: toPct100(momentum, TIMING_SCORE_MAX), max: 100 },
    { id: "risk", label: "리스크 점수", score: risk, max: 100, invertTone: true },
  ]
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 */
function buildPriceLevels(stock) {
  const country = stock.country === "KR" ? "KR" : "US"
  const price = Number(stock.snapshot?.price ?? stock.snapshot?.close)
  if (!Number.isFinite(price) || price <= 0) {
    return {
      buyZone: "—",
      stopLoss: "—",
      target1: "—",
      target2: "—",
    }
  }

  const ma20 = Number(stock.snapshot?.ma20)
  const mom = toPct100(stock.v4Score?.timing ?? 0, TIMING_SCORE_MAX) / 100
  const risk = buildScoreBars(stock).find((s) => s.id === "risk")?.score ?? 55
  const riskAdj = risk / 100

  const buyLow = Number.isFinite(ma20) && ma20 > 0 ? Math.min(ma20, price * 0.98) : price * 0.97
  const buyHigh = price * 1.02
  const stop = price * (0.9 - (1 - riskAdj) * 0.04)
  const t1 = price * (1.08 + mom * 0.06)
  const t2 = price * (1.16 + mom * 0.14)

  return {
    buyZone: `${fmtPrice(buyLow, country)} ~ ${fmtPrice(buyHigh, country)}`,
    stopLoss: fmtPrice(stop, country),
    target1: fmtPrice(t1, country),
    target2: fmtPrice(t2, country),
  }
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} [marketContext]
 */
export function buildStockPickDetailPanelReport(stock, marketContext = null) {
  const detail = buildStockPickScoreDetail(stock, marketContext)
  const historyReport = buildStockPickRecommendHistoryReport(stock)
  const history = readScoreHistory()
  const deltas = stock.scoreDeltas ?? getScoreDeltas(stock.ticker, history)

  const opinionLine =
    stock.opinion?.summary ??
    stock.opinion?.headline ??
    detail.interpretation ??
    stock.recommendReasonSummary ??
    "AI 분석 의견을 준비 중입니다."

  const reasons = [
    ...(stock.recommendRationales ?? []).map((r) => r.text),
    ...detail.recommendReasons,
  ].filter(Boolean)
  const uniqueReasons = [...new Set(reasons)].slice(0, 4)

  const scoreChange =
    deltas?.day5?.display ??
    deltas?.day1?.display ??
    (deltas?.day5?.delta != null ? `${deltas.day5.delta >= 0 ? "+" : ""}${deltas.day5.delta}점` : "—")

  const recommendedAt = historyReport.firstRecommendedAt ?? null
  const daysHeld =
    historyReport.daysHeld != null && Number.isFinite(historyReport.daysHeld)
      ? `D+${historyReport.daysHeld}`
      : "—"
  const statusLabel = historyReport.status?.label ?? "—"

  if (
    recommendedAt &&
    (daysHeld === "—" ||
      historyReport.display?.recommendedPrice === "—" ||
      historyReport.display?.currentPrice === "—" ||
      historyReport.display?.highestProfit === "—" ||
      historyReport.display?.currentProfit === "—")
  ) {
    console.table({
      recommendedAt: historyReport.ledger?.recommendedAt,
      recommendedAtIso: historyReport.ledger?.recommendedAtIso,
      lockedRecommendedPrice: historyReport.ledger?.lockedRecommendedPrice,
      recommendedPrice: historyReport.ledger?.recommendedPrice,
      currentPrice: historyReport.ledger?.currentPrice,
      profitPercent: historyReport.ledger?.profitPercent,
      holdingDays: historyReport.ledger?.holdingDays,
      highestProfit: historyReport.ledger?.highestProfit,
      lowestProfit: historyReport.ledger?.lowestProfit,
    })
  }

  return {
    visible: stock.dataSource === "live",
    ticker: stock.ticker,
    name: stock.name,
    scoreBars: buildScoreBars(stock),
    aiOpinion: opinionLine,
    reasons: uniqueReasons,
    priceLevels: buildPriceLevels(stock),
    meta: {
      recommendedAt: recommendedAt ?? "—",
      daysHeld,
      statusLabel,
      scoreChange,
      qualityDisplay: stock.v4Score?.qualityDisplay ?? `${stock.v4Score?.quality ?? 0}/${PHASE3_QUALITY_MAX}`,
      timingDisplay: stock.v4Score?.timingDisplay ?? `${stock.v4Score?.timing ?? 0}/${TIMING_SCORE_MAX}`,
    },
  }
}
