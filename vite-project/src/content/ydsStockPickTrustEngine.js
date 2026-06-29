/**
 * 종목추천 신뢰도 레이어 — 핵심 이유 · AI Confidence · 제외 · 추적 · 리스크 · 브리핑
 */

import { buildStockPickScoreDetail } from "./ydsStockPickScoreDetailEngine.js"
import { findValidationPickByTicker } from "./ydsPickValidationLink.js"
import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { formatPerfPct } from "./ydsPickPerformanceEngine.js"
import { loadValidationPicks } from "./ydsValidationStorage.js"
import { getRegimeTopStocks } from "./ydsStockPickMarketRegime.js"
import { RECOMMEND_ENGINE_LABELS } from "./ydsStockRecommendEngine.js"
import { buildAiRationaleProgressBars } from "./ydsStockPickAiAnalysisEngine.js"

/** @typedef {import("./ydsStockPickModel.js").StockPickView} StockPickView */
/** @typedef {import("./ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */

const TOP_REASON_COUNT = 3
const RISK_LEVELS = ["낮음", "보통", "높음"]

/** @param {number} n */
function clamp100(n) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** @param {number} score */
export function confidenceLabelFromScore(score) {
  if (score >= 85) return "매우 높음"
  if (score >= 75) return "높음"
  if (score >= 60) return "보통"
  return "낮음"
}

/**
 * @param {StockPickView} stock
 * @param {{ compositeScore?: number; riskSafety?: number; scores?: Record<string, number> }} engine
 */
export function computeAiConfidence(stock, engine) {
  const composite = engine.compositeScore ?? stock.recommendEngine?.compositeScore ?? 0
  const riskSafety = engine.riskSafety ?? stock.recommendEngine?.riskSafety ?? 50
  const deltas = stock.scoreDeltas ?? stock.pickMeta?.scoreDeltas
  let stability = 72
  if (deltas?.totalDelta != null) {
    const abs = Math.abs(deltas.totalDelta)
    if (abs <= 1) stability = 92
    else if (abs <= 3) stability = 78
    else if (abs <= 6) stability = 58
    else stability = 40
  }
  const liveBonus = stock.dataSource === "live" ? 6 : 0
  const score = clamp100(composite * 0.52 + riskSafety * 0.28 + stability * 0.12 + liveBonus)
  return {
    score,
    label: confidenceLabelFromScore(score),
    grade: score >= 85 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D",
  }
}

/**
 * @param {StockPickView} stock
 */
function buildTopReasons(stock) {
  const engine = stock.recommendEngine
  /** @type {string[]} */
  const prioritized = []

  const pushUnique = (text) => {
    const t = String(text ?? "").trim()
    if (!t || prioritized.includes(t)) return
    prioritized.push(t)
  }

  for (const r of engine?.reasons ?? []) {
    pushUnique(r.text)
  }
  for (const r of stock.recommendRationales ?? []) {
    pushUnique(r.text)
  }

  const checks = stock.technicalScore?.checks ?? []
  if (checks.find((c) => c.id === "ma20")?.pass) pushUnique("20일선 재돌파")
  if (checks.find((c) => c.id === "volume")?.pass) pushUnique("기관 매수 증가")
  if (checks.find((c) => c.id === "high52")?.pass) pushUnique("신고가 추세")

  const rating = Number(stock.rating)
  if (rating >= 4 && !prioritized.some((t) => t.includes("실적"))) {
    pushUnique(rating >= 5 ? "실적 상향" : "실적 점수 양호")
  }

  if ((engine?.scores?.marketFit ?? 0) >= 65) pushUnique("시장상태 적합")

  return prioritized.slice(0, TOP_REASON_COUNT).map((text, index) => ({
    order: index + 1,
    text,
  }))
}

/**
 * @param {StockPickView} stock
 */
function buildDetailReasons(stock, topTexts) {
  /** @type {string[]} */
  const items = []
  const topSet = new Set(topTexts)

  for (const c of stock.technicalScore?.checks ?? []) {
    if (c.pass && !topSet.has(c.label)) items.push(c.label)
  }
  for (const row of stock.scoreRows ?? []) {
    const line = `${row.label} ${row.value}/${row.max}`
    if (!topSet.has(line)) items.push(line)
  }
  for (const r of stock.recommendReasonsDetail ?? []) {
    if (!topSet.has(r.text)) items.push(r.text)
  }

  return [...new Set(items)].slice(0, 8)
}

/**
 * @param {StockPickView} stock
 */
function buildPrimaryExcludeReason(stock, marketContext = null) {
  const list = buildStockPickScoreDetail(stock, marketContext).excludeReasons
  if (list.length) return list[0]

  const engine = stock.recommendEngine
  if ((engine?.scores?.risk ?? 0) >= 70) return "리스크 과다"
  if ((engine?.scores?.marketFit ?? 0) < 45) return "시장상태 미적합"
  if ((stock.scores?.trendScore ?? 0) < 18) return "추세 하락"
  if ((stock.scores?.volumeScore ?? 0) < 10) return "거래량 부족"
  if (stock.v4Score?.recommendStatusId === "noChase") return "과열·추격 구간"

  return null
}

/**
 * @param {StockPickView} stock
 */
function buildScoreBarsFromEngine(stock) {
  return buildAiRationaleProgressBars(stock).map((bar) => ({
    ...bar,
    max: 100,
  }))
}

/**
 * @param {StockPickView} stock
 */
function buildAiRiskItems(stock) {
  /** @type {{ id: string; text: string; level: string }[]} */
  const items = []
  const engine = stock.recommendEngine
  const scores = engine?.scores ?? {}

  const add = (id, text, severity) => {
    items.push({ id, text, level: RISK_LEVELS[Math.min(2, Math.max(0, severity))] })
  }

  if (stock.statusId === "overheat" || stock.v4Score?.recommendStatusId === "noChase") {
    add("overheat", "과열권", 2)
  }
  if ((scores.risk ?? 0) >= 65) add("risk-score", "변동성 확대", 2)
  else if ((scores.risk ?? 0) >= 50) add("risk-score", "변동성 주의", 1)

  const volCheck = stock.technicalScore?.checks?.find((c) => c.id === "volume")
  if (volCheck && !volCheck.pass) add("volume", "거래량 감소", 1)

  const high52 = stock.technicalScore?.checks?.find((c) => c.id === "high52")
  if (high52?.pass) add("high52", "신고가 부담", 1)

  if ((stock.scoreMeta?.drawdownPct ?? 0) >= 10) add("drawdown", "조정 폭 확대", 2)

  if (stock.sector === "defense" || stock.sector === "nuclear") {
    add("policy", "정책 변수", 1)
  }

  const pos52 = stock.statusDiag?.inputs?.position52w
  if (pos52 != null && pos52 >= 88) add("extension", "고점 부담", 1)

  return items
    .sort((a, b) => RISK_LEVELS.indexOf(b.level) - RISK_LEVELS.indexOf(a.level))
    .slice(0, 3)
}

/**
 * @param {StockPickView} stock
 */
function buildAiTracking(stock) {
  const country = stock.country === "KR" ? "KR" : "US"
  const pick = findValidationPickByTicker(stock.ticker, country)
  const recPrice = pick?.recommendedPrice ?? null
  const currentPrice = Number(stock.snapshot?.price ?? stock.snapshot?.close)
  const retPct = calcRecommendReturnPct(recPrice, currentPrice)

  /** @type {'up' | 'sideways' | 'pullback' | 'stop' | 'target' | 'unknown'} */
  let phaseId = "unknown"
  let phaseLabel = "데이터 수집중"
  if (retPct != null) {
    if (retPct >= 10) {
      phaseId = "target"
      phaseLabel = "목표가 도달"
    } else if (retPct <= -8) {
      phaseId = "stop"
      phaseLabel = "손절"
    } else if (retPct >= 2) {
      phaseId = "up"
      phaseLabel = "상승 진행"
    } else if (retPct <= -2) {
      phaseId = "pullback"
      phaseLabel = "조정"
    } else {
      phaseId = "sideways"
      phaseLabel = "횡보"
    }
  }

  const milestones = [3, 5, 10, 20].map((pct) => ({
    pct,
    label: `+${pct}%`,
    reached: retPct != null && retPct >= pct,
  }))

  return {
    phaseId,
    phaseLabel,
    returnPct: retPct,
    returnLabel: formatPerfPct(retPct),
    milestones,
  }
}

/**
 * @param {StockPickView} stock
 * @param {YdsMarketAdapterContext | null} [marketContext]
 */
function buildTradeStrategy(stock, marketContext) {
  const price = Number(stock.snapshot?.price ?? stock.snapshot?.close)
  const country = stock.country === "KR" ? "KR" : "US"
  const engine = stock.recommendEngine
  const risk = engine?.scores?.risk ?? 50
  const momentum = engine?.scores?.momentum ?? 50
  const panic = marketContext?.ydsScore ?? 50
  const pos = marketContext?.marketPositionId

  let weightPct = 12
  if (engine?.compositeScore >= 80) weightPct = 18
  else if (engine?.compositeScore >= 70) weightPct = 15
  if (pos === "fear" || pos === "panic") weightPct += 3
  if (pos === "overheat") weightPct -= 4
  if (panic >= 65) weightPct -= 2
  weightPct = Math.max(5, Math.min(25, weightPct))

  if (!Number.isFinite(price) || price <= 0) {
    return {
      visible: false,
      title: "AI 매매 전략",
      entry1: "—",
      entry2: "—",
      addBuy: "—",
      takeProfit: "—",
      stopLoss: "—",
      weightPct,
      targetPrice: "—",
    }
  }

  const entry1 = price * (0.98 - (100 - momentum) / 5000)
  const entry2 = price * (0.96 - (100 - momentum) / 4000)
  const addBuy = price * 0.94
  const takeProfit = price * (1.1 + momentum / 400)
  const stopLoss = price * (0.92 - (100 - risk) / 800)
  const targetPrice = price * (1.15 + momentum / 350)

  const fmt = (v) =>
    country === "KR"
      ? `${Math.round(v).toLocaleString("ko-KR")}원`
      : `$${v.toFixed(2)}`

  return {
    visible: stock.dataSource === "live",
    title: "AI 매매 전략",
    entry1: fmt(entry1),
    entry2: fmt(entry2),
    addBuy: fmt(addBuy),
    takeProfit: fmt(takeProfit),
    stopLoss: fmt(stopLoss),
    weightPct,
    targetPrice: fmt(targetPrice),
  }
}

/**
 * @param {StockPickView} stock
 * @param {YdsMarketAdapterContext | null} [marketContext]
 */
export function buildStockPickTrustReport(stock, marketContext = null) {
  const engine = stock.recommendEngine
  const topReasons = buildTopReasons(stock)
  const topTexts = topReasons.map((r) => r.text)
  const aiConfidence = computeAiConfidence(stock, engine ?? {})
  const excludeReason = buildPrimaryExcludeReason(stock, marketContext)
  const excludeList = buildStockPickScoreDetail(stock, marketContext).excludeReasons
  const isRecommended =
    Boolean(stock.v4Score?.top5Eligible) ||
    (stock.rank > 0 && stock.rank <= 20 && stock.dataSource === "live")

  return {
    topReasons,
    detailReasons: buildDetailReasons(stock, topTexts),
    aiConfidence,
    excludeReason: isRecommended ? null : excludeReason,
    excludeReasons: excludeReason ? [excludeReason] : excludeList.slice(0, 3),
    scoreBars: buildScoreBarsFromEngine(stock),
    aiTracking: buildAiTracking(stock),
    aiRisk: {
      title: "AI Risk",
      items: buildAiRiskItems(stock),
    },
    tradeStrategy: buildTradeStrategy(stock, marketContext),
    recommendScore: engine?.compositeScore ?? stock.score ?? 0,
  }
}

/**
 * @param {StockPickView[]} stocks
 * @param {YdsMarketAdapterContext | null} [marketContext]
 * @param {number} [limit]
 */
export function buildTodayRecommendBriefing(stocks, marketContext = null, limit = 10) {
  const live = stocks.filter((s) => s.dataSource === "live")
  const top = getRegimeTopStocks(live, limit)
  if (!top.length) {
    return { visible: false, title: "오늘 추천 브리핑", lines: [] }
  }

  /** @type {Record<string, number>} */
  const sectorCount = {}
  for (const s of top) {
    const key = s.sectorLabel || s.sector || "기타"
    sectorCount[key] = (sectorCount[key] ?? 0) + 1
  }
  const sectors = Object.entries(sectorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name)

  const pos = marketContext?.marketPositionId
  const unified = marketContext?.unifiedMarketStateLabel ?? marketContext?.strategyLabel

  /** @type {string[]} */
  const lines = []

  if (sectors.length) {
    lines.push(`오늘은 ${sectors.join("·")} 비중이 높습니다.`)
  } else {
    lines.push("오늘은 우량주 중심으로 추천이 구성되었습니다.")
  }

  if (pos === "overheat" || pos === "boundary") {
    lines.push("추세는 유지되지만 추격보다는 눌림목 접근이 유리합니다.")
  } else if (pos === "fear" || pos === "panic") {
    lines.push("공포 구간 — 분할 매수 관점의 종목 비중이 늘었습니다.")
  } else {
    lines.push("추세는 유지되지만 추격보다는 눌림목 접근이 유리합니다.")
  }

  const policyHeavy = top.filter((s) => s.sector === "defense" || s.sector === "nuclear").length
  if (policyHeavy >= 2) {
    lines.push("정책 민감주는 비중을 줄이는 것이 좋습니다.")
  } else if (unified) {
    lines.push(`현재 시장(${unified})에 맞춘 섹터 구성입니다.`)
  } else {
    lines.push("실적·모멘텀 점수가 높은 종목 위주입니다.")
  }

  return {
    visible: true,
    title: "오늘 추천 브리핑",
    lines: lines.slice(0, 3),
  }
}

/**
 * @param {StockPickView[]} stocks
 */
export function buildStockPickHubHistoryReport(stocks) {
  const picks = loadValidationPicks()
    .slice()
    .sort((a, b) => b.recommendedAt.localeCompare(a.recommendedAt))
    .slice(0, 30)

  const priceByTicker = new Map(
    stocks.map((s) => [String(s.ticker).toUpperCase(), Number(s.snapshot?.price ?? s.snapshot?.close)]),
  )
  const nameByTicker = new Map(stocks.map((s) => [String(s.ticker).toUpperCase(), s.name]))

  const rows = picks.map((pick) => {
    const sym = String(pick.ticker).toUpperCase()
    const currentPrice = priceByTicker.get(sym) ?? pick.currentPrice ?? null
    const recPrice = pick.recommendedPrice ?? null
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
    const days =
      (Date.parse(today) - Date.parse(String(pick.recommendedAt).slice(0, 10))) / 86400000
    let statusLabel = "추천중"
    if (days > 45) statusLabel = "종료"
    else if (pick.statusId === "watch" || pick.statusId === "scaleIn") statusLabel = "관찰"

    return {
      pickId: pick.id,
      recommendedAt: pick.recommendedAt,
      ticker: pick.ticker,
      name: nameByTicker.get(sym) ?? pick.name ?? pick.ticker,
      recommendedPrice: recPrice,
      currentPrice,
      returnPct: ret,
      returnLabel: formatPerfPct(ret),
      maxReturnLabel: formatPerfPct(maxRet),
      minReturnLabel: formatPerfPct(minRet),
      statusLabel,
    }
  })

  return {
    visible: rows.length > 0,
    title: "추천 히스토리",
    rows,
  }
}

export { RECOMMEND_ENGINE_LABELS }
