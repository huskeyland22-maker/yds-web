/**
 * 종목추천 상세 — 점수 공개 · 추천/제외 사유 · 신뢰도
 */

import { PHASE3_QUALITY_MAX } from "./ydsStockPickPhase3Breakdown.js"
import { TIMING_SCORE_MAX } from "./ydsStockPickTimingScore.js"
import { buildTimingPenaltyReasons, buildNoChaseReasons } from "./ydsStockPickV5Insights.js"
import { buildTodaySignalReasons } from "./ydsStockPickUxStatus.js"
import { STOCK_PICK_UX_STATUS } from "./ydsStockPickUxStatus.js"

/** @typedef {import("./ydsStockPickModel.js").StockPickView} StockPickView */
/** @typedef {import("./ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */

export const RECOMMEND_STATUS_LABELS = {
  aggressiveBuy: { id: "aggressiveBuy", label: "강력 추천", tone: "strong" },
  buy: { id: "buy", label: "추천", tone: "buy" },
  scaleIn: { id: "scaleIn", label: "관찰", tone: "watch" },
  watch: { id: "watch", label: "관찰", tone: "watch" },
  noChase: { id: "noChase", label: "대기", tone: "wait" },
}

/** @param {number} v @param {number} max @param {number} [targetMax] */
function scalePoints(v, max, targetMax = 20) {
  if (!Number.isFinite(v) || max <= 0) return 0
  return Math.round((v / max) * targetMax)
}

/** @param {number} n @param {number} max */
function fmtPlus(n, max) {
  const v = Math.max(0, Math.min(max, Math.round(n)))
  return `+${v}`
}

/**
 * @param {StockPickView} stock
 */
function buildQualityItems(stock) {
  const b = stock.scoreBreakdown ?? {}
  const rating = Number(stock.rating) || 0
  const vol = Number(stock.scores?.volumeScore) || 0
  const pos = Number(stock.scores?.positionScore) || 0

  const growth = scalePoints(b.performance ?? 0, 30, 20)
  const roe = scalePoints((rating / 5) * 30, 30, 15)
  const finance = scalePoints(b.industry ?? 0, 25, 15)
  const supply = scalePoints(vol, 20, 15)
  const value = scalePoints(pos, 20, 12)

  return [
    { id: "growth", label: "실적 성장", points: growth, max: 20, display: fmtPlus(growth, 20) },
    { id: "roe", label: "수익성(ROE)", points: roe, max: 15, display: fmtPlus(roe, 15) },
    { id: "finance", label: "재무 건전성", points: finance, max: 15, display: fmtPlus(finance, 15) },
    { id: "supply", label: "수급", points: supply, max: 15, display: fmtPlus(supply, 15) },
    { id: "value", label: "밸류에이션", points: value, max: 12, display: fmtPlus(value, 12) },
  ]
}

/**
 * @param {StockPickView} stock
 */
function buildTimingItems(stock) {
  const trend = Number(stock.scores?.trendScore) || 0
  const vol = Number(stock.scores?.volumeScore) || 0
  const checks = stock.timingScore?.checks ?? []

  const trendPts = scalePoints(trend, 40, 12)
  const volPts = scalePoints(vol, 20, 10)
  const maPts =
    (checks.find((c) => c.id === "ma20")?.points ?? 0) +
    (checks.find((c) => c.id === "ma60")?.points ?? 0)
  const momentumPts = scalePoints(
    (checks.find((c) => c.id === "highBreak")?.points ?? 0) +
      (checks.find((c) => c.id === "pullback")?.points ?? 0),
    7,
    8,
  )

  return [
    { id: "trend", label: "추세", points: trendPts || maPts, max: 12, display: fmtPlus(trendPts || maPts, 12) },
    { id: "volume", label: "거래량", points: volPts, max: 10, display: fmtPlus(volPts, 10) },
    { id: "momentum", label: "모멘텀", points: momentumPts, max: 8, display: fmtPlus(momentumPts, 8) },
  ]
}

/**
 * @param {StockPickView} stock
 * @param {YdsMarketAdapterContext | null | undefined} ctx
 */
function buildMarketFitItems(stock, ctx) {
  const b = stock.scoreBreakdown ?? {}
  const marketEnv = scalePoints(b.marketEnv ?? 0, 15, 15)
  const sector = scalePoints(b.sector ?? 0, 20, 15)
  const sectorRank = stock.pickMeta?.sectorRank
  const sectorBonus =
    sectorRank?.rank != null && sectorRank.rank <= 5 ? 3 : sectorRank?.rank <= 10 ? 1 : 0

  return [
    {
      id: "market",
      label: "시장상태 적합성",
      points: marketEnv,
      max: 15,
      display: fmtPlus(marketEnv, 15),
      sub: ctx?.ready ? ctx.panicLabel : undefined,
    },
    {
      id: "sector",
      label: "섹터 강도",
      points: Math.min(15, sector + sectorBonus),
      max: 15,
      display: fmtPlus(Math.min(15, sector + sectorBonus), 15),
      sub: sectorRank?.rank != null ? `${stock.sectorLabel} ${sectorRank.rank}위` : stock.sectorLabel,
    },
  ]
}

/**
 * @param {StockPickView} stock
 */
function buildContribution(stock) {
  const v4 = stock.v4Score
  const quality = v4?.quality ?? stock.scoreBreakdown?.quality ?? 0
  const timing = v4?.timing ?? stock.scoreBreakdown?.timing ?? 0
  const marketFit = (stock.scoreBreakdown?.marketEnv ?? 0) + (stock.scoreBreakdown?.sector ?? 0) * 0.5
  const marketNorm = Math.min(25, Math.round(marketFit * 0.8))

  const sum = quality + timing + marketNorm || 1
  return {
    quality: { points: quality, max: PHASE3_QUALITY_MAX, pct: Math.round((quality / sum) * 100) },
    timing: { points: timing, max: TIMING_SCORE_MAX, pct: Math.round((timing / sum) * 100) },
    marketFit: { points: marketNorm, max: 25, pct: Math.round((marketNorm / sum) * 100) },
  }
}

/**
 * @param {StockPickView} stock
 */
function buildRecommendReasonsList(stock) {
  const fromEngine = buildTodaySignalReasons(stock, 5)
  const fromDetail = (stock.recommendReasonsDetail ?? stock.recommendReasons ?? []).map((r) => r.text)
  const merged = [...new Set([...fromDetail, ...fromEngine])]

  if (merged.length < 3 && stock.v4Score?.qualityGrade === "A") merged.push("기업품질 A")
  if (merged.length < 3 && stock.sectorLabel) merged.push(`${stock.sectorLabel} 섹터`)
  if (merged.length < 3 && (stock.scores?.marketFitScore ?? 0) >= 14) merged.push("시장 적합")

  return merged.slice(0, 3)
}

/**
 * @param {StockPickView} stock
 */
function buildExcludeReasonsList(stock) {
  /** @type {string[]} */
  const reasons = []

  reasons.push(...(stock.pickMeta?.timingPenaltyReasons ?? buildTimingPenaltyReasons(stock)))
  reasons.push(...(stock.pickMeta?.noChaseReasons ?? buildNoChaseReasons(stock)))

  const checks = stock.timingScore?.checks ?? []
  for (const c of checks) {
    if (!c.pass && c.id === "volume") reasons.push("거래량 부족")
    if (!c.pass && (c.id === "ma20" || c.id === "ma60")) reasons.push("추세 약화")
    if (!c.pass && c.id === "highBreak") reasons.push("돌파 미확인")
  }

  if (stock.v4Score?.timingGrade === "D" || stock.v4Score?.timingGrade === "F") {
    reasons.push("타이밍 등급 낮음")
  }

  const deltas = stock.scoreDeltas ?? stock.pickMeta?.scoreDeltas
  if (deltas?.totalDelta != null && deltas.totalDelta < -3) {
    reasons.push("점수 전일 대비 하락")
  }

  return [...new Set(reasons)].slice(0, 3)
}

/**
 * @param {StockPickView} stock
 */
function buildInterpretation(stock) {
  const v4 = stock.v4Score
  const statusId = v4?.recommendStatusId ?? "watch"
  const q = v4?.qualityGrade ?? "C"
  const t = v4?.timingGrade ?? "C"

  if (statusId === "aggressiveBuy" || statusId === "buy") {
    return "기업품질과 타이밍이 모두 양호한 구간입니다."
  }
  if (q === "A" || q === "B") {
    if (t === "C" || t === "D" || t === "F") {
      return "좋은 기업이지만 현재 진입 타이밍은 부족합니다."
    }
    return "우량 기업 · 분할 접근을 검토할 수 있습니다."
  }
  if (statusId === "noChase") {
    return "단기 과열·추격 리스크가 있어 신규 진입은 대기가 유리합니다."
  }
  return "관찰 구간 · 눌림·거래량 확인 후 접근하세요."
}

/**
 * @param {StockPickView} stock
 * @param {YdsMarketAdapterContext | null | undefined} ctx
 */
function computeConfidence(stock, ctx) {
  /** @type {{ id: string; label: string; score: number; max: number }[]} */
  const factors = []

  const relStars = stock.pickMeta?.reliability?.stars ?? (stock.dataSource === "live" ? 4 : 2)
  const dataScore = Math.round((relStars / 5) * 100)
  factors.push({ id: "data", label: "데이터 완성도", score: dataScore, max: 100 })

  const fitScore = stock.pickMeta?.marketFitScore ?? stock.scoreBreakdown?.marketEnv ?? 0
  const marketScore = Math.round((fitScore / 15) * 100)
  factors.push({ id: "market", label: "시장상태 일치도", score: marketScore, max: 100 })

  const sr = stock.pickMeta?.sectorRank
  let sectorScore = 50
  if (sr?.rank != null) {
    if (sr.rank <= 3) sectorScore = 90
    else if (sr.rank <= 10) sectorScore = 72
    else if (sr.rank <= 20) sectorScore = 58
    else sectorScore = 42
  }
  factors.push({ id: "sector", label: "섹터 강도 일치도", score: sectorScore, max: 100 })

  const deltas = stock.scoreDeltas ?? stock.pickMeta?.scoreDeltas
  let stabilityScore = 70
  if (deltas?.totalDelta != null) {
    const abs = Math.abs(deltas.totalDelta)
    if (abs <= 1) stabilityScore = 92
    else if (abs <= 3) stabilityScore = 78
    else if (abs <= 6) stabilityScore = 55
    else stabilityScore = 38
  }
  factors.push({ id: "stability", label: "점수 안정성", score: stabilityScore, max: 100 })

  const total = Math.round(factors.reduce((s, f) => s + f.score, 0) / factors.length)
  let grade = "D"
  if (total >= 85) grade = "A"
  else if (total >= 70) grade = "B"
  else if (total >= 55) grade = "C"

  return { score: total, grade, factors }
}

/**
 * @param {StockPickView} stock
 * @param {YdsMarketAdapterContext | null | undefined} [marketContext]
 */
export function buildStockPickScoreDetail(stock, marketContext = null) {
  const v4 = stock.v4Score
  const totalScore = Math.round(v4?.finalRankScore ?? v4?.total ?? stock.score ?? 0)
  const statusId = v4?.recommendStatusId ?? "watch"
  const status =
    RECOMMEND_STATUS_LABELS[statusId] ?? RECOMMEND_STATUS_LABELS.watch

  return {
    totalScore,
    qualityItems: buildQualityItems(stock),
    timingItems: buildTimingItems(stock),
    marketFitItems: buildMarketFitItems(stock, marketContext),
    contribution: buildContribution(stock),
    recommendReasons: buildRecommendReasonsList(stock),
    excludeReasons: buildExcludeReasonsList(stock),
    interpretation: buildInterpretation(stock),
    status,
    uxStatus: STOCK_PICK_UX_STATUS[statusId] ?? STOCK_PICK_UX_STATUS.watch,
    confidence: computeConfidence(stock, marketContext),
    v4Display: v4?.qualityDisplay,
    timingDisplay: v4?.timingDisplay,
  }
}
