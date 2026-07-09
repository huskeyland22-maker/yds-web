/**
 * 추천 히스토리 — 검증 스냅샷 + 점수 이력
 */

import { loadValidationPicks } from "./ydsValidationStorage.js"
import { readScoreHistory } from "./ydsStockPickScoreHistory.js"
import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { formatPerfPct } from "./ydsPickPerformanceEngine.js"
import { formatTransparencyPrice } from "./ydsStockPickTransparency.js"
import {
  computePickReturnExtremes,
  migratePickLifecycle,
  resolvePickLifecycleView,
} from "./ydsPickLifecycleEngine.js"

/** @param {string} dateKey */
function formatMdDot(dateKey) {
  const [y, m, d] = String(dateKey).slice(0, 10).split("-")
  return m && d ? `${m}/${d}` : dateKey
}

/**
 * @param {string} ticker
 * @param {'US' | 'KR'} [country]
 */
export function findAllValidationPicksForTicker(ticker, country = "US") {
  const sym = String(ticker ?? "").toUpperCase()
  return loadValidationPicks()
    .filter(
      (p) =>
        String(p.ticker ?? "").toUpperCase() === sym &&
        (country === "KR" ? p.country === "KR" : p.country !== "KR"),
    )
    .sort((a, b) => a.recommendedAt.localeCompare(b.recommendedAt))
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} record
 */
function resolveRecommendStatus(record) {
  const migrated = migratePickLifecycle(record)
  const view = resolvePickLifecycleView(migrated.lifecycleId ?? "active")
  return { id: view.filterGroup, label: view.label, lifecycleId: migrated.lifecycleId }
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 */
export function buildStockPickRecommendHistoryReport(stock) {
  const country = stock.country === "KR" ? "KR" : "US"
  const validationRows = findAllValidationPicksForTicker(stock.ticker, country)
  const firstPick = validationRows[0] ?? null
  const latestPick = validationRows[validationRows.length - 1] ?? null
  const scoreRows = readScoreHistory()[stock.ticker] ?? []

  const today = new Date().toISOString().slice(0, 10)
  let daysHeld = null
  if (firstPick?.recommendedAt) {
    daysHeld = Math.max(
      0,
      Math.round(
        (Date.parse(today) - Date.parse(String(firstPick.recommendedAt).slice(0, 10))) / 86400000,
      ),
    )
  }

  const firstRecommendedAt = firstPick?.recommendedAt ?? null
  const firstRecommendedScore =
    firstPick?.recommendedScore ?? scoreRows[0]?.recommendScore ?? stock.v4Score?.finalRankScore ?? 0
  const timeline = []

  if (firstPick) {
    timeline.push({
      date: firstPick.recommendedAt,
      dateLabel: formatMdDot(firstPick.recommendedAt),
      score: Math.round(firstRecommendedScore),
      isStart: true,
      isCurrent: false,
      opinion: "추천 시작",
    })
  }

  const scoreUpdates = scoreRows
    .filter((row, index, arr) => index === 0 || row.total !== arr[index - 1].total)
    .filter((row) => {
      if (!firstRecommendedAt) return true
      return String(row.date).slice(0, 10) > String(firstRecommendedAt).slice(0, 10)
    })
    .slice(-5)
    .map((row, index, arr) => ({
      date: row.date,
      dateLabel: formatMdDot(row.date),
      score: Math.round(row.total),
      isStart: false,
      isCurrent: index === arr.length - 1,
      opinion: index === arr.length - 1 ? "현재 추천 상태" : "점수 갱신",
    }))

  timeline.push(...scoreUpdates)

  if (!timeline.length && latestPick) {
    timeline.push({
      date: latestPick.recommendedAt,
      dateLabel: formatMdDot(latestPick.recommendedAt),
      score: Math.round(latestPick.recommendedScore ?? stock.v4Score?.finalRankScore ?? 0),
      isStart: true,
      isCurrent: true,
      opinion: "추천 시작",
    })
  } else if (timeline.length === 1) {
    timeline[0] = {
      ...timeline[0],
      isCurrent: true,
    }
  }

  const recPrice = firstPick?.recommendedPrice ?? latestPick?.recommendedPrice ?? null
  const currentPrice = Number(stock.snapshot?.price ?? stock.snapshot?.close)
  const currentReturn = calcRecommendReturnPct(recPrice, currentPrice)

  let maxReturn = currentReturn
  for (const pick of validationRows) {
    const { maxRet } = computePickReturnExtremes(pick)
    if (maxRet != null && (maxReturn == null || maxRet > maxReturn)) maxReturn = maxRet
  }

  const status = latestPick
    ? resolveRecommendStatus(latestPick)
    : { id: "active", label: "추천중" }

  const scoreDelta =
    timeline.length >= 2
      ? timeline[timeline.length - 1].score - timeline[0].score
      : stock.scoreDeltas?.day5?.delta ?? null

  const ledger = {
    recommendedAt: firstPick?.recommendedAt ?? null,
    recommendedAtIso: firstPick?.recommendedAtIso ?? firstPick?.lockedRecommendedAtIso ?? null,
    lockedRecommendedPrice:
      firstPick?.lockedRecommendedPrice ?? firstPick?.recommendedPrice ?? null,
    recommendedPrice: recPrice,
    currentPrice: Number.isFinite(currentPrice) ? currentPrice : latestPick?.currentPrice ?? null,
    profitPercent: currentReturn,
    holdingDays: daysHeld,
    highestProfit: maxReturn,
    lowestProfit:
      validationRows.reduce((minValue, pick) => {
        const { minRet } = computePickReturnExtremes(pick)
        if (minRet == null || !Number.isFinite(minRet)) return minValue
        if (minValue == null || minRet < minValue) return minRet
        return minValue
      }, /** @type {number | null} */ (currentReturn)),
    currentStatus: status.label,
  }

  if (firstPick && scoreRows.length) {
    console.table(
      validationRows.map((row) => ({
        id: row.id,
        recommendedAt: row.recommendedAt,
        recommendedAtIso: row.recommendedAtIso ?? row.lockedRecommendedAtIso ?? null,
        lockedRecommendedPrice: row.lockedRecommendedPrice ?? null,
        recommendedPrice: row.recommendedPrice ?? null,
        currentPrice: row.currentPrice ?? null,
        createdAt: row.recordedAt ?? null,
        updatedAt: row.lastUpdatedAt ?? null,
      })),
    )
  }

  return {
    visible: Boolean(firstPick || timeline.length),
    title: "추천 히스토리",
    firstRecommendedAt: firstPick?.recommendedAt ?? null,
    daysHeld,
    scoreDelta,
    scoreDeltaLabel:
      scoreDelta != null ? `${scoreDelta >= 0 ? "+" : ""}${scoreDelta}점` : "—",
    timeline,
    status,
    maxReturn,
    maxReturnLabel: formatPerfPct(maxReturn),
    currentReturn,
    currentReturnLabel: formatPerfPct(currentReturn),
    lowestProfitLabel: formatPerfPct(ledger.lowestProfit),
    endedPicks: validationRows.filter(
      (p) => (migratePickLifecycle(p).lifecycleId ?? "active") !== "active",
    ).length,
    ledger,
    display: {
      recommendedAt: ledger.recommendedAt ?? "—",
      recommendedPrice:
        ledger.recommendedPrice != null ? formatTransparencyPrice(ledger.recommendedPrice, country) : "—",
      currentPrice:
        ledger.currentPrice != null ? formatTransparencyPrice(ledger.currentPrice, country) : "—",
      holdingDays:
        ledger.holdingDays != null && Number.isFinite(ledger.holdingDays)
          ? `D+${ledger.holdingDays}`
          : "—",
      highestProfit: formatPerfPct(ledger.highestProfit),
      lowestProfit: formatPerfPct(ledger.lowestProfit),
      currentProfit: formatPerfPct(ledger.profitPercent),
      currentStatus: ledger.currentStatus ?? "—",
    },
  }
}
