/**
 * GO #82 — 추천 히스토리 상세 검증 리포트
 * GO #81 — undefined·null 안전 기본값
 */

import { loadValidationPicks } from "./ydsValidationStorage.js"
import { readScoreHistory, getRecommendScoreDelta } from "./ydsStockPickScoreHistory.js"
import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { formatPerfPct } from "./ydsPickPerformanceEngine.js"
import { formatTransparencyPrice } from "./ydsStockPickTransparency.js"
import { buildStockPickAiAnalysisReport } from "./ydsStockPickAiAnalysisEngine.js"
import { migratePickLifecycle, resolvePickLifecycleView } from "./ydsPickLifecycleEngine.js"

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */
/** @typedef {import("./ydsStockPickModel.js").StockPickView} StockPickView */

/** @param {string} pickId */
export function findValidationPickById(pickId) {
  const id = decodeURIComponent(String(pickId ?? ""))
  if (!id) return null
  const picks = loadValidationPicks() ?? []
  return picks.find((p) => p?.id === id) ?? null
}

/**
 * @param {ValidationPickRecord} pick
 */
function buildPriceSeries(pick) {
  const entry = pick.recommendedPrice
  if (entry == null || entry <= 0) return []

  /** @type {{ date: string; price: number; returnPct: number; axisLabel: string }[]} */
  const points = []
  const start = String(pick.recommendedAt).slice(0, 10)
  points.push({
    date: start,
    price: entry,
    returnPct: 0,
    axisLabel: start.slice(5).replace("-", "/"),
  })

  const log = pick.priceLog ?? {}
  for (const date of Object.keys(log).sort()) {
    if (date < start) continue
    const price = log[date]
    if (price == null || !Number.isFinite(price)) continue
    const ret = calcRecommendReturnPct(entry, price)
    points.push({
      date,
      price,
      returnPct: ret ?? 0,
      axisLabel: date.slice(5).replace("-", "/"),
    })
  }

  const current = pick.currentPrice
  if (current != null && Number.isFinite(current)) {
    const today = new Date().toISOString().slice(0, 10)
    const last = points[points.length - 1]
    if (!last || last.date !== today) {
      points.push({
        date: today,
        price: current,
        returnPct: calcRecommendReturnPct(entry, current) ?? 0,
        axisLabel: "현재",
      })
    }
  }

  return points
}

/**
 * @param {ValidationPickRecord} pick
 */
function computeMfeMae(pick, priceSeries) {
  const entry = pick.recommendedPrice
  if (entry == null || entry <= 0) {
    return { highPrice: null, lowPrice: null, mfe: null, mae: null }
  }

  const series = priceSeries ?? []
  let high = entry
  let low = entry
  for (const pt of series) {
    if (pt.price > high) high = pt.price
    if (pt.price < low) low = pt.price
  }

  return {
    highPrice: high,
    lowPrice: low,
    mfe: calcRecommendReturnPct(entry, high),
    mae: calcRecommendReturnPct(entry, low),
  }
}

/**
 * @param {ValidationPickRecord} pick
 */
function buildScoreSeries(pick) {
  const history = readScoreHistory() ?? {}
  const rows = history[pick.ticker] ?? []
  const start = String(pick.recommendedAt).slice(0, 10)
  return rows
    .filter((r) => r?.date >= start)
    .map((r) => ({
      date: r.date,
      axisLabel: r.date.slice(5).replace("-", "/"),
      score: Math.round(r.recommendScore ?? r.total ?? 0),
      statusId: r.statusId ?? "",
    }))
}

/**
 * @param {ValidationPickRecord} pick
 */
function buildStatusTimeline(pick) {
  const history = readScoreHistory() ?? {}
  const rows = history[pick.ticker] ?? []
  const start = String(pick.recommendedAt).slice(0, 10)
  const filtered = rows.filter((r) => r?.date >= start)
  /** @type {{ date: string; dateLabel: string; statusId: string; statusLabel: string; score: number }[]} */
  const timeline = [
    {
      date: start,
      dateLabel: start,
      statusId: pick.statusId ?? "",
      statusLabel: pick.statusLabel || "추천 시작",
      score: Math.round(pick.recommendedScore ?? 0),
    },
  ]

  for (const row of filtered) {
    const last = timeline[timeline.length - 1]
    if (last && last.statusId === row.statusId && last.score === (row.recommendScore ?? row.total)) {
      continue
    }
    timeline.push({
      date: row.date,
      dateLabel: row.date,
      statusId: row.statusId ?? "",
      statusLabel: row.statusId || "점수 갱신",
      score: Math.round(row.recommendScore ?? row.total ?? 0),
    })
  }

  return timeline.slice(-12)
}

/**
 * @param {StockPickView | null} liveStock
 */
function safeBuildAiAnalysis(liveStock) {
  if (!liveStock) return null
  try {
    return buildStockPickAiAnalysisReport(liveStock, null)
  } catch {
    return null
  }
}

/**
 * @param {ValidationPickRecord} pick
 * @param {StockPickView | null} [liveStock]
 */
export function buildPickValidationDetailReport(pick, liveStock = null) {
  if (!pick) return { visible: false }

  const country = pick.country === "KR" ? "KR" : "US"
  const priceSeries = buildPriceSeries(pick) ?? []
  const { highPrice, lowPrice, mfe, mae } = computeMfeMae(pick, priceSeries)
  const currentPrice = liveStock?.snapshot?.price ?? pick.currentPrice ?? null
  const recPrice = pick.recommendedPrice ?? null
  const currentRet = calcRecommendReturnPct(recPrice, currentPrice)

  const today = new Date().toISOString().slice(0, 10)
  const daysHeld = Math.max(
    0,
    Math.round((Date.parse(today) - Date.parse(String(pick.recommendedAt).slice(0, 10))) / 86400000),
  )

  const scoreSeries = buildScoreSeries(pick) ?? []
  const currentAiScore =
    liveStock?.recommendEngine?.compositeScore ??
    scoreSeries[scoreSeries.length - 1]?.score ??
    pick.recommendedScore ??
    null
  const recAiScore = Math.round(pick.recommendedScore ?? pick.recommendSnapshot?.compositeScore ?? 0)
  const scoreDelta = pick.ticker ? getRecommendScoreDelta(pick.ticker) : null
  const aiAnalysis = safeBuildAiAnalysis(liveStock)

  const snap = pick.recommendSnapshot
  /** @type {string[]} */
  const recommendReasons = []
  const topReasons = snap?.topReasons ?? []
  const rationales = snap?.rationales ?? []
  if (topReasons.length) {
    for (const r of topReasons) recommendReasons.push(String(r))
  } else if (rationales.length) {
    for (const r of rationales) recommendReasons.push(String(r.text ?? r))
  } else if (pick.qualityGrade) {
    recommendReasons.push(`품질 ${pick.qualityGrade} · 타이밍 ${pick.timingGrade ?? "—"}`)
  }

  const currentEvaluation =
    aiAnalysis?.comprehensiveOpinion?.paragraphs?.[1] ??
    aiAnalysis?.comprehensiveOpinion?.text?.split("\n\n")[1] ??
    (currentRet != null && currentRet >= 5
      ? "추천 이후 양호한 흐름 — 목표가 구간 점검"
      : currentRet != null && currentRet < -5
        ? "추천 대비 하락 — 손절·비중 점검 필요"
        : "횡보 구간 — 추세 확인 후 대응")

  const lifecycle = resolvePickLifecycleView(
    migratePickLifecycle(pick).lifecycleId ?? "active",
  )

  const ledger = pick.marketLedger
  const recommendedAtIso =
    pick.recommendedAtIso ??
    pick.lockedRecommendedAtIso ??
    String(pick.recommendedAt).slice(0, 10)
  const maxReturnPct = pick.maxReturnPct ?? mfe
  const minReturnPct = pick.minReturnPct ?? mae

  return {
    visible: true,
    pickId: pick.id,
    ticker: pick.ticker,
    name: pick.name ?? pick.ticker,
    country,
    recommendedAt: String(pick.recommendedAt).slice(0, 10),
    recommendedAtIso,
    recommendedPrice: recPrice != null ? formatTransparencyPrice(recPrice, country) : "—",
    currentPrice: formatTransparencyPrice(currentPrice, country),
    highPrice: highPrice != null ? formatTransparencyPrice(highPrice, country) : "—",
    lowPrice: lowPrice != null ? formatTransparencyPrice(lowPrice, country) : "—",
    currentReturnLabel: formatPerfPct(currentRet),
    mfeLabel: formatPerfPct(mfe),
    maeLabel: formatPerfPct(mae),
    maxReturnLabel: formatPerfPct(maxReturnPct),
    minReturnLabel: formatPerfPct(minReturnPct),
    ledgerState: pick.ledgerState ?? (pick.lifecycleId === "active" ? "active" : "ended"),
    recommendGrade: pick.recommendGrade ?? "—",
    recommendReason: pick.recommendReason ?? recommendReasons[0] ?? "—",
    marketStateLabel:
      ledger?.marketStateLabel ??
      snap?.unifiedMarketStateLabel ??
      snap?.marketStateLabel ??
      pick.strategyLabel ??
      "—",
    panicIntensityLabel:
      ledger?.panicIntensity ?? snap?.panicIntensity ?? null,
    panicLabel: ledger?.panicLabel ?? snap?.panicLabel ?? "—",
    cycleLabel: ledger?.cycleLabel ?? "—",
    vixLabel: ledger?.vix ?? null,
    cnnLabel: ledger?.cnn ?? null,
    bofaLabel: ledger?.bofa ?? null,
    daysHeld: `${daysHeld}일`,
    recAiScore,
    currentAiScore: currentAiScore != null ? Math.round(currentAiScore) : "—",
    scoreDelta: scoreDelta
      ? {
          previous: scoreDelta.previous,
          current: scoreDelta.current,
          delta: scoreDelta.delta,
          display: scoreDelta.display,
          direction: scoreDelta.direction,
        }
      : null,
    recommendReasons,
    currentEvaluation,
    priceSeries,
    scoreSeries,
    statusTimeline: buildStatusTimeline(pick) ?? [],
    regimeLabel: pick.regimeLabel || pick.strategyLabel || "—",
    lifecycleLabel: `${lifecycle.emoji} ${lifecycle.label}`,
    resultBadge: `${lifecycle.badgeEmoji} ${lifecycle.badgeLabel}`,
    closeReason: pick.closeReason ?? null,
    closedAt: pick.closedAt ?? null,
  }
}

/** @param {import("./ydsStockPickModel.js").StockPickView[]} [liveStocks] */
export function buildValidationPickListReport(liveStocks = []) {
  const stocks = liveStocks ?? []
  const priceByTicker = new Map(
    stocks.map((s) => [String(s.ticker).toUpperCase(), Number(s.snapshot?.price ?? s.snapshot?.close)]),
  )

  const rows = (loadValidationPicks() ?? [])
    .slice()
    .sort((a, b) => b.recommendedAt.localeCompare(a.recommendedAt))
    .slice(0, 100)
    .map((pick) => {
      const sym = String(pick.ticker).toUpperCase()
      const currentPrice = priceByTicker.get(sym) ?? pick.currentPrice
      const ret = calcRecommendReturnPct(pick.recommendedPrice, currentPrice)
      return {
        pickId: pick.id,
        ticker: pick.ticker,
        name: pick.name,
        recommendedAt: String(pick.recommendedAt).slice(0, 10),
        returnLabel: formatPerfPct(ret),
        recommendedScore: pick.recommendedScore,
      }
    })

  return { visible: rows.length > 0, title: "추천 상세 검증", rows }
}
