/**
 * GO #80 — 추천 생명주기 (추천중 · 목표달성 · 손절 · 종료)
 * 종료된 추천은 삭제하지 않고 누적 보존한다.
 */

import { DEFAULT_OUTCOME_CRITERIA } from "./ydsPickOutcomeEngine.js"
import { resolveStockPickUxStatus } from "./ydsStockPickUxStatus.js"
import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { todayDateKey } from "./ydsPortfolioTradesStorage.js"

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */
/** @typedef {'active' | 'targetHit' | 'stopLoss' | 'ended'} PickLifecycleId */
/** @typedef {'all' | 'active' | 'success' | 'failure' | 'ended'} HubHistoryFilterId */

export const TARGET_HIT_PCT = DEFAULT_OUTCOME_CRITERIA.successMinPct
export const STOP_LOSS_PCT = -5
export const MAX_RECOMMEND_HOLD_DAYS = 45
export const MIN_DAYS_BEFORE_TARGET = 2

/** @type {ReadonlyArray<{ id: HubHistoryFilterId; label: string }>} */
export const HUB_HISTORY_FILTERS = [
  { id: "all", label: "전체" },
  { id: "active", label: "추천중" },
  { id: "success", label: "성공" },
  { id: "failure", label: "실패" },
  { id: "ended", label: "종료" },
]

/** @type {Record<PickLifecycleId, { id: PickLifecycleId; emoji: string; label: string; fullLabel: string; filterGroup: HubHistoryFilterId; badgeEmoji: string; badgeLabel: string; tone: string }>} */
export const PICK_LIFECYCLE_VIEWS = {
  active: {
    id: "active",
    emoji: "🟢",
    label: "추천중",
    fullLabel: "추천중 (현재 보유 중)",
    filterGroup: "active",
    badgeEmoji: "🟡",
    badgeLabel: "진행중",
    tone: "active",
  },
  targetHit: {
    id: "targetHit",
    emoji: "🔵",
    label: "성공",
    fullLabel: "목표가 달성 (수익 실현 종료)",
    filterGroup: "success",
    badgeEmoji: "🟢",
    badgeLabel: "성공",
    tone: "success",
  },
  stopLoss: {
    id: "stopLoss",
    emoji: "🔴",
    label: "실패",
    fullLabel: "손절 종료 (손실 종료)",
    filterGroup: "failure",
    badgeEmoji: "🔴",
    badgeLabel: "실패",
    tone: "failure",
  },
  ended: {
    id: "ended",
    emoji: "⚪",
    label: "종료",
    fullLabel: "추천 종료 (기간 만료 또는 전략 변경)",
    filterGroup: "ended",
    badgeEmoji: "⚪",
    badgeLabel: "종료",
    tone: "ended",
  },
}

/**
 * @param {string} start
 * @param {string} end
 */
export function daysBetweenPickDates(start, end) {
  const d0 = Date.parse(String(start).slice(0, 10))
  const d1 = Date.parse(String(end).slice(0, 10))
  if (!Number.isFinite(d0) || !Number.isFinite(d1)) return 0
  return Math.max(0, Math.round((d1 - d0) / 86400000))
}

/**
 * @param {ValidationPickRecord} record
 */
export function computePickReturnExtremes(record) {
  const recPrice = record.recommendedPrice
  let maxRet = record.returnPct ?? null
  let minRet = record.returnPct ?? null

  if (recPrice != null && recPrice > 0 && record.priceLog) {
    for (const price of Object.values(record.priceLog)) {
      const ret = calcRecommendReturnPct(recPrice, price)
      if (ret == null || !Number.isFinite(ret)) continue
      if (maxRet == null || ret > maxRet) maxRet = ret
      if (minRet == null || ret < minRet) minRet = ret
    }
  }

  for (const v of Object.values(record.horizons ?? {})) {
    if (v == null || !Number.isFinite(v)) continue
    if (maxRet == null || v > maxRet) maxRet = v
    if (minRet == null || v < minRet) minRet = v
  }

  return { maxRet, minRet }
}

/** @param {PickLifecycleId | string | null | undefined} id */
export function resolvePickLifecycleView(id) {
  const key = /** @type {PickLifecycleId} */ (id ?? "active")
  return PICK_LIFECYCLE_VIEWS[key] ?? PICK_LIFECYCLE_VIEWS.active
}

/**
 * @param {ValidationPickRecord} record
 * @param {import("./ydsStockPickModel.js").StockPickView | null} [liveStock]
 */
function isStrategyEnded(record, liveStock) {
  if (!liveStock) return false
  const ux = resolveStockPickUxStatus(liveStock)
  if (ux.id === "noChase") return true
  if (liveStock.rank > 0 && liveStock.rank > 25) return true
  const snapStatus = liveStock.v4Score?.recommendStatusId
  if (snapStatus === "noChase") return true
  if (record.statusId && record.statusId !== liveStock.stockStatus?.id) {
    const endedIds = ["overheat", "watch"]
    if (endedIds.includes(liveStock.stockStatus?.id ?? "")) return true
  }
  return false
}

/**
 * @param {ValidationPickRecord} record
 * @param {PickLifecycleId} lifecycleId
 * @param {string} today
 * @param {string} reason
 */
function closePickLifecycle(record, lifecycleId, today, reason) {
  const view = resolvePickLifecycleView(lifecycleId)
  const ret = record.returnPct ?? record.finalReturnPct ?? null
  return {
    ...record,
    lifecycleId,
    lifecycleLabel: view.fullLabel,
    closedAt: today,
    closeReason: reason,
    finalReturnPct: ret != null && Number.isFinite(ret) ? Math.round(ret * 10) / 10 : null,
    lastUpdatedAt: Date.now(),
  }
}

/**
 * @param {ValidationPickRecord} record
 * @param {string} [today]
 * @param {import("./ydsStockPickModel.js").StockPickView | null} [liveStock]
 */
export function migratePickLifecycle(record, today = todayDateKey(), liveStock = null) {
  if (record.lifecycleId && record.lifecycleId !== "active") {
    const view = resolvePickLifecycleView(record.lifecycleId)
    return {
      ...record,
      lifecycleId: record.lifecycleId,
      lifecycleLabel: record.lifecycleLabel ?? view.fullLabel,
      closedAt: record.closedAt ?? null,
      closeReason: record.closeReason ?? null,
      finalReturnPct:
        record.finalReturnPct ??
        (record.returnPct != null ? Math.round(record.returnPct * 10) / 10 : null),
    }
  }

  const days = daysBetweenPickDates(record.recommendedAt, today)
  const { maxRet, minRet } = computePickReturnExtremes(record)
  const d30 = record.horizons?.d30

  if (days > MAX_RECOMMEND_HOLD_DAYS) {
    return closePickLifecycle(record, "ended", today, `${MAX_RECOMMEND_HOLD_DAYS}일 기간 만료`)
  }

  if (minRet != null && minRet <= STOP_LOSS_PCT) {
    return closePickLifecycle(record, "stopLoss", today, `손절 기준 ${STOP_LOSS_PCT}%`)
  }

  if (maxRet != null && maxRet >= TARGET_HIT_PCT && days >= MIN_DAYS_BEFORE_TARGET) {
    return closePickLifecycle(record, "targetHit", today, `목표 수익 ${TARGET_HIT_PCT}% 달성`)
  }

  if (d30 != null && days >= 30) {
    if (d30 >= TARGET_HIT_PCT) {
      return closePickLifecycle(record, "targetHit", today, `30일 목표 수익 ${TARGET_HIT_PCT}% 달성`)
    }
    if (d30 <= DEFAULT_OUTCOME_CRITERIA.failureMaxPct) {
      return closePickLifecycle(record, "stopLoss", today, "30일 손실 종료")
    }
    return closePickLifecycle(record, "ended", today, "30일 추천 기간 종료")
  }

  if (isStrategyEnded(record, liveStock)) {
    return closePickLifecycle(record, "ended", today, "전략 변경·추천 해제")
  }

  return {
    ...record,
    lifecycleId: "active",
    lifecycleLabel: PICK_LIFECYCLE_VIEWS.active.fullLabel,
    closedAt: null,
    closeReason: null,
    finalReturnPct: null,
  }
}

/**
 * @param {ValidationPickRecord} record
 * @param {string} [today]
 * @param {import("./ydsStockPickModel.js").StockPickView | null} [liveStock]
 */
export function updatePickLifecycle(record, today = todayDateKey(), liveStock = null) {
  if (record.lifecycleId && record.lifecycleId !== "active") {
    return record
  }
  return migratePickLifecycle(record, today, liveStock)
}

/**
 * @param {PickLifecycleId} lifecycleId
 * @param {HubHistoryFilterId} filterId
 */
export function matchesHubHistoryFilter(lifecycleId, filterId) {
  if (filterId === "all") return true
  const view = resolvePickLifecycleView(lifecycleId)
  return view.filterGroup === filterId
}

/**
 * @param {Array<{ lifecycleId?: string }>} rows
 * @param {HubHistoryFilterId} filterId
 */
export function filterHubHistoryRows(rows, filterId) {
  if (filterId === "all") return rows
  return rows.filter((row) => matchesHubHistoryFilter(row.lifecycleId ?? "active", filterId))
}

/**
 * @param {ValidationPickRecord[]} picks
 * @param {number} [windowDays]
 */
export function buildPickTrustPerfStats(picks, windowDays = 30) {
  const today = todayDateKey()
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - windowDays)
  const cutoffKey = cutoff.toISOString().slice(0, 10)

  const windowPicks = (picks ?? []).filter(
    (p) => p.recommendedAt >= cutoffKey && p.recommendedAt <= today,
  )

  const allSorted = [...(picks ?? [])].sort((a, b) =>
    String(a.recommendedAt).localeCompare(String(b.recommendedAt)),
  )
  /** @type {Map<string, string>} */
  const firstEverByKey = new Map()
  for (const p of allSorted) {
    const key = `${p.country}:${String(p.ticker).toUpperCase()}`
    if (!firstEverByKey.has(key)) firstEverByKey.set(key, String(p.recommendedAt).slice(0, 10))
  }

  let initialRecommendCount = 0
  let reRecommendCount = 0
  const uniqueTickerKeys = new Set()

  for (const p of windowPicks) {
    const key = `${p.country}:${String(p.ticker).toUpperCase()}`
    uniqueTickerKeys.add(key)
    const firstDate = firstEverByKey.get(key)
    const at = String(p.recommendedAt).slice(0, 10)
    if (firstDate === at) initialRecommendCount += 1
    else reRecommendCount += 1
  }

  const uniqueTickerCount = uniqueTickerKeys.size
  const rawCount = windowPicks.length

  /** 최신 1건만 성과 집계에 사용 (일별 재추천 중복 완화) */
  /** @type {Map<string, typeof windowPicks[0]>} */
  const latestPerTicker = new Map()
  for (const p of windowPicks) {
    const key = `${p.country}:${String(p.ticker).toUpperCase()}`
    const prev = latestPerTicker.get(key)
    if (!prev || p.recommendedAt > prev.recommendedAt) latestPerTicker.set(key, p)
  }
  const dedupedPicks = [...latestPerTicker.values()]

  let successCount = 0
  let failureCount = 0
  let endedCount = 0
  let holdingCount = 0
  /** @type {number[]} */
  const returns = []
  /** @type {number[]} */
  const lossReturns = []
  /** @type {number[]} */
  const holdDays = []
  /** @type {number[]} */
  const winReturns = []
  /** @type {number[]} */
  const stopLossReturns = []
  /** @type {number[]} */
  const aiScores = []
  /** @type {number[]} */
  const maxReturns = []
  /** @type {number[]} */
  const mddValues = []
  let maxGain = null
  let maxLoss = null

  for (const p of dedupedPicks) {
    const lc = /** @type {PickLifecycleId} */ (p.lifecycleId ?? "active")
    if (lc === "targetHit") successCount += 1
    else if (lc === "stopLoss") failureCount += 1
    else if (lc === "ended") endedCount += 1
    else holdingCount += 1

    const { maxRet, minRet } = computePickReturnExtremes(p)
    const ret =
      p.finalReturnPct ??
      p.returnPct ??
      p.horizons?.d30 ??
      p.horizons?.d14 ??
      p.horizons?.d7 ??
      null

    if (p.recommendedScore != null && Number.isFinite(p.recommendedScore)) {
      aiScores.push(p.recommendedScore)
    }
    if (maxRet != null && Number.isFinite(maxRet)) maxReturns.push(maxRet)
    if (minRet != null && Number.isFinite(minRet)) mddValues.push(minRet)

    if (ret != null && Number.isFinite(ret)) {
      returns.push(ret)
      if (ret < 0) lossReturns.push(ret)
      if (maxGain == null || ret > maxGain) maxGain = ret
      if (maxLoss == null || ret < maxLoss) maxLoss = ret
    }

    if (lc === "targetHit") {
      const winVal = ret ?? maxRet
      if (winVal != null && Number.isFinite(winVal)) winReturns.push(winVal)
    }
    if (lc === "stopLoss") {
      const lossVal = ret ?? minRet
      if (lossVal != null && Number.isFinite(lossVal)) stopLossReturns.push(lossVal)
    }

    const end = p.closedAt ?? today
    holdDays.push(daysBetweenPickDates(p.recommendedAt, end))
  }

  const closedForWin = successCount + failureCount
  const winRate =
    closedForWin > 0 ? Math.round((successCount / closedForWin) * 1000) / 10 : null

  const avgReturn =
    returns.length > 0
      ? Math.round((returns.reduce((s, v) => s + v, 0) / returns.length) * 10) / 10
      : null

  const avgLoss =
    lossReturns.length > 0
      ? Math.round((lossReturns.reduce((s, v) => s + v, 0) / lossReturns.length) * 10) / 10
      : null

  const avgHoldDays =
    holdDays.length > 0
      ? Math.round(holdDays.reduce((s, v) => s + v, 0) / holdDays.length)
      : null

  const wins = returns.filter((v) => v > 0)
  const losses = returns.filter((v) => v < 0)
  const avgWin = wins.length ? wins.reduce((s, v) => s + v, 0) / wins.length : 0
  const avgLossAbs = losses.length
    ? losses.reduce((s, v) => s + v, 0) / losses.length
    : null
  const profitFactor =
    avgLossAbs != null && avgLossAbs < 0 && avgWin > 0
      ? Math.round((avgWin / Math.abs(avgLossAbs)) * 100) / 100
      : null

  const avgTakeProfit =
    winReturns.length > 0
      ? Math.round((winReturns.reduce((s, v) => s + v, 0) / winReturns.length) * 10) / 10
      : null

  const avgStopLoss =
    stopLossReturns.length > 0
      ? Math.round((stopLossReturns.reduce((s, v) => s + v, 0) / stopLossReturns.length) * 10) / 10
      : null

  const maxHoldDays = holdDays.length ? Math.max(...holdDays) : null
  const minHoldDays = holdDays.length ? Math.min(...holdDays) : null

  const avgAiScore =
    aiScores.length > 0
      ? Math.round(aiScores.reduce((s, v) => s + v, 0) / aiScores.length)
      : null

  const avgMaxReturn =
    maxReturns.length > 0
      ? Math.round((maxReturns.reduce((s, v) => s + v, 0) / maxReturns.length) * 10) / 10
      : null

  const avgMdd =
    mddValues.length > 0
      ? Math.round((mddValues.reduce((s, v) => s + v, 0) / mddValues.length) * 10) / 10
      : null

  return {
    count: initialRecommendCount,
    rawCount,
    initialRecommendCount,
    reRecommendCount,
    uniqueTickerCount,
    successCount,
    failureCount,
    endedCount,
    holdingCount,
    winRate,
    avgReturn,
    avgLoss,
    maxGain,
    maxLoss,
    avgHoldDays,
    profitFactor,
    avgTakeProfit,
    avgStopLoss,
    maxHoldDays,
    minHoldDays,
    avgAiScore,
    avgMaxReturn,
    avgMdd,
    alpha: null,
  }
}
