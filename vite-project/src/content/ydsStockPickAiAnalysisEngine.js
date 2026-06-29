/**
 * AI 종합 분석 — 애널리스트 리포트 · 근거 시각화 · 점수 변화 · 시나리오 · 성과 검증
 */

import { findValidationPickByTicker } from "./ydsPickValidationLink.js"
import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { formatPerfPct } from "./ydsPickPerformanceEngine.js"
import { formatTransparencyPrice } from "./ydsStockPickTransparency.js"
import { resolveStockPickUxStatus } from "./ydsStockPickUxStatus.js"
import { resolveRecommendStatusView } from "./ydsStockPickRecommendColors.js"
import { buildStockPickTradeScenarioReport } from "./ydsStockPickTradeScenario.js"
import {
  getFieldDeltaForDays,
  getRecommendScoreDelta,
  readScoreHistory,
} from "./ydsStockPickScoreHistory.js"
import { estimateHoldPeriodLabel } from "./ydsStockPickDashboardEngine.js"

/** @typedef {import("./ydsStockPickModel.js").StockPickView} StockPickView */
/** @typedef {import("./ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */

/** @param {number} n */
function clamp100(n) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** @param {number} value @param {number} max */
function scale100(value, max) {
  if (!Number.isFinite(value) || max <= 0) return 0
  return clamp100((value / max) * 100)
}

/**
 * @param {StockPickView} stock
 */
export function buildAiRationaleProgressBars(stock) {
  const engine = stock.recommendEngine
  const scores = engine?.scores ?? {}
  const volume = Number(stock.scores?.volumeScore) || 0
  const supply = clamp100(scale100(volume, 20) * 0.7 + (scores.technical ?? 0) * 0.3)

  return [
    { id: "marketFit", label: "시장 적합도", score: scores.marketFit ?? 0, invertTone: false },
    { id: "technical", label: "기술적 분석", score: scores.technical ?? 0, invertTone: false },
    { id: "earnings", label: "실적", score: scores.earnings ?? 0, invertTone: false },
    { id: "supply", label: "수급", score: supply, invertTone: false },
    { id: "momentum", label: "AI 산업 모멘텀", score: scores.momentum ?? 0, invertTone: false },
    { id: "risk", label: "리스크", score: scores.risk ?? 50, invertTone: true },
  ]
}

/**
 * @param {StockPickView} stock
 * @param {YdsMarketAdapterContext | null} [marketContext]
 */
export function buildAiComprehensiveOpinion(stock, marketContext = null) {
  const engine = stock.recommendEngine
  const scores = engine?.scores ?? {}
  const name = stock.name ?? stock.ticker
  const sector = stock.sectorLabel || stock.sector || "해당 섹터"
  const status = resolveRecommendStatusView(stock)
  const action = stock.actionGuide?.summary ?? status.label

  /** @type {string[]} */
  const paragraphs = []

  const marketLabel =
    marketContext?.unifiedMarketStateLabel ??
    marketContext?.strategyLabel ??
    marketContext?.marketPositionLabel ??
    "현재 시장"
  const panic = marketContext?.ydsScore
  const liq = marketContext?.liquidityScore ?? marketContext?.liquidityLabel

  const sectorLead = scores.momentum >= 70
    ? `현재 ${sector} 등 AI·성장 섹터가 시장을 주도하는 흐름입니다.`
    : scores.marketFit >= 65
      ? `현재 ${marketLabel} 환경에서 ${sector} 섹터가 상대적으로 유리합니다.`
      : `${marketLabel} 환경에서 종목별 선별 접근이 필요한 구간입니다.`

  paragraphs.push(sectorLead)

  const volume = Number(stock.scores?.volumeScore) || 0
  const supplyScore = clamp100(scale100(volume, 20) * 0.7 + (scores.technical ?? 0) * 0.3)

  const perfLine = []
  if (scores.earnings >= 70) perfLine.push("실적 개선")
  if (supplyScore >= 65 || scale100(volume, 20) >= 65) {
    perfLine.push("기관·수급 개선")
  } else if (stock.technicalScore?.checks?.find((c) => c.id === "volume")?.pass) {
    perfLine.push("거래량 회복")
  }
  if (scores.marketFit >= 68) perfLine.push("시장 적합도 높음")

  if (perfLine.length) {
    paragraphs.push(
      `${name}은(는) ${perfLine.join("과 ")}이 동시에 관찰되며, AI 추천 알고리즘상 종합 점수 ${engine?.compositeScore ?? "—"}점 수준입니다.`,
    )
  } else {
    paragraphs.push(
      `${name}은(는) 기술·실적·모멘텀을 종합했을 때 ${status.label} 구간으로 분류됩니다.`,
    )
  }

  const macroBits = []
  if (panic != null && Number.isFinite(panic)) {
    macroBits.push(`패닉강도 ${Math.round(panic)}`)
  }
  if (liq != null) {
    macroBits.push(typeof liq === "number" ? `유동성 ${Math.round(liq)}` : String(liq))
  }
  if (scores.technical >= 65) macroBits.push("기술적 추세 양호")
  if (macroBits.length) {
    paragraphs.push(`거시적으로 ${macroBits.join(" · ")} 조건이 반영되었습니다.`)
  }

  const timingLine =
    status.id === "noChase" || status.id === "watch"
      ? "현재는 추격매수보다 눌림목·분할 접근이 유리한 구간으로 판단됩니다."
      : status.id === "scaleIn"
        ? "좋은 기업이나 타이밍은 보통 — 소량 분할매수 관점이 적합합니다."
        : "추세가 유지되는 한 분할 매수·보유 전략이 유효합니다."

  paragraphs.push(`${timingLine} ${action ? `(${action})` : ""}`.trim())

  const text = paragraphs.slice(0, 5).join("\n\n")

  return {
    title: "AI 종합 의견",
    paragraphs,
    text,
  }
}

/**
 * @param {StockPickView} stock
 */
function buildScoreChangeReasons(stock) {
  const ticker = stock.ticker
  const history = readScoreHistory()
  /** @type {string[]} */
  const reasons = []

  const timing = getFieldDeltaForDays(ticker, "timing", 1, history)
  const marketFit = getFieldDeltaForDays(ticker, "marketFit", 1, history)
  const quality = getFieldDeltaForDays(ticker, "quality", 1, history)

  const volPass = stock.technicalScore?.checks?.find((c) => c.id === "volume")?.pass
  const engine = stock.recommendEngine?.scores ?? {}

  if (timing?.delta != null && timing.delta >= 2) reasons.push("타이밍 점수 개선")
  if (timing?.delta != null && timing.delta <= -2) reasons.push("추세 약화")
  if (marketFit?.delta != null && marketFit.delta >= 1) reasons.push("시장 적합도 상승")
  if (marketFit?.delta != null && marketFit.delta <= -1) reasons.push("시장 환경 악화")
  if (quality?.delta != null && quality.delta >= 2) reasons.push("실적 상향")
  if (quality?.delta != null && quality.delta <= -2) reasons.push("실적 점수 하락")
  if (volPass) reasons.push("기관 순매수 증가")
  else if (!volPass && scale100(Number(stock.scores?.volumeScore), 20) < 45) {
    reasons.push("거래량 감소")
  }
  if ((engine.momentum ?? 0) >= 72) reasons.push("AI 산업 모멘텀 증가")
  if ((engine.momentum ?? 0) <= 45) reasons.push("산업 모멘텀 둔화")

  return [...new Set(reasons)].slice(0, 5)
}

/**
 * @param {StockPickView} stock
 */
export function buildAiScoreChangeReport(stock) {
  const delta = getRecommendScoreDelta(stock.ticker)
  const reasons = buildScoreChangeReasons(stock)

  if (!delta) {
    const current = stock.recommendEngine?.compositeScore ?? stock.v4Score?.finalRankScore ?? null
    return {
      visible: current != null,
      previousScore: null,
      currentScore: current,
      delta: null,
      deltaLabel: null,
      direction: null,
      reasons,
    }
  }

  const sign = delta.delta != null && delta.delta > 0 ? "+" : ""
  const deltaLabel = delta.delta != null ? `${sign}${delta.delta}` : null

  return {
    visible: true,
    previousScore: delta.previous,
    currentScore: delta.current,
    delta: delta.delta,
    deltaLabel,
    direction: delta.direction,
    display: `${delta.previous}점 → ${delta.current}점 (${deltaLabel ?? "0"})`,
    reasons,
  }
}

/**
 * @param {StockPickView} stock
 * @param {YdsMarketAdapterContext | null} [marketContext]
 */
export function buildAiInvestmentScenarios(stock, marketContext = null) {
  const base = buildStockPickTradeScenarioReport(stock, marketContext, null)
  if (!base.visible) return { visible: false, title: "AI 투자 시나리오", scenarios: [] }

  const statusId = resolveStockPickUxStatus(stock).id
  const holdDefault = estimateHoldPeriodLabel(statusId)
  const price = Number(stock.snapshot?.price ?? stock.snapshot?.close)
  const country = stock.country === "KR" ? "KR" : "US"
  const momentum = stock.recommendEngine?.scores?.momentum ?? 50

  const targetPct = clamp100(12 + momentum / 5)
  const stopPct = clamp100(6 + (100 - (stock.recommendEngine?.scores?.risk ?? 50)) / 10)

  const fmtStop = (s) => {
    if (typeof s === "string" && s !== "—") return s
    if (Number.isFinite(price) && price > 0) {
      return formatTransparencyPrice(price * (1 - stopPct / 100), country)
    }
    return "—"
  }

  const scenarios = base.scenarios.map((s) => {
    let holdPeriod = holdDefault
    let targetLabel = s.target
    if (s.id === "bull") {
      holdPeriod = statusId === "aggressiveBuy" ? "2~4주" : "3~8주"
      targetLabel = targetLabel && targetLabel !== "—" ? targetLabel : `목표가 +${targetPct}%`
    } else if (s.id === "flat") {
      holdPeriod = "1~3주"
      targetLabel = "—"
    } else {
      holdPeriod = "즉시~1주"
      targetLabel = fmtStop(s.stop)
    }

    let action = s.action
    if (s.id === "bull") action = "보유 · 분할매수"
    if (s.id === "flat") action = "관망"
    if (s.id === "bear") action = "비중 축소"

    return {
      ...s,
      action,
      targetLabel,
      stopLabel: s.id === "bear" ? fmtStop(s.stop) : "—",
      holdPeriod,
    }
  })

  return {
    visible: true,
    title: "AI 투자 시나리오",
    scenarios,
  }
}

/**
 * @param {StockPickView} stock
 */
export function buildStockPickValidationCard(stock) {
  const country = stock.country === "KR" ? "KR" : "US"
  const pick = findValidationPickByTicker(stock.ticker, country)
  if (!pick) {
    return { visible: false, title: "추천 성과 검증" }
  }

  const recPrice = pick.recommendedPrice ?? null
  const currentPrice = Number(stock.snapshot?.price ?? stock.snapshot?.close) ?? pick.currentPrice
  const ret = calcRecommendReturnPct(recPrice, currentPrice)

  let maxRet = ret
  let minRet = ret
  for (const v of Object.values(pick.horizons ?? {})) {
    if (v != null && Number.isFinite(v)) {
      if (maxRet == null || v > maxRet) maxRet = v
      if (minRet == null || v < minRet) minRet = v
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const daysHeld = Math.max(
    0,
    Math.round(
      (Date.parse(today) - Date.parse(String(pick.recommendedAt).slice(0, 10))) / 86400000,
    ),
  )

  return {
    visible: true,
    title: "추천 성과 검증",
    recommendedAt: String(pick.recommendedAt).slice(0, 10),
    recommendedPrice: recPrice != null ? formatTransparencyPrice(recPrice, country) : "—",
    currentPrice: formatTransparencyPrice(currentPrice, country),
    returnLabel: formatPerfPct(ret),
    maxReturnLabel: formatPerfPct(maxRet),
    maxLossLabel: formatPerfPct(minRet),
    daysHeld: `${daysHeld}일`,
  }
}

/**
 * @param {StockPickView} stock
 * @param {YdsMarketAdapterContext | null} [marketContext]
 */
export function buildStockPickAiAnalysisReport(stock, marketContext = null) {
  if (stock.dataSource !== "live") {
    return { visible: false }
  }

  return {
    visible: true,
    comprehensiveOpinion: buildAiComprehensiveOpinion(stock, marketContext),
    rationaleBars: buildAiRationaleProgressBars(stock),
    scoreChange: buildAiScoreChangeReport(stock),
    investmentScenarios: buildAiInvestmentScenarios(stock, marketContext),
    validation: buildStockPickValidationCard(stock),
  }
}
