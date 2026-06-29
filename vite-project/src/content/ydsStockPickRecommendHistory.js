/**
 * 추천 히스토리 — 검증 스냅샷 + 점수 이력
 */

import { loadValidationPicks } from "./ydsValidationStorage.js"
import { readScoreHistory } from "./ydsStockPickScoreHistory.js"
import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { formatPerfPct } from "./ydsPickPerformanceEngine.js"
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

  const timeline = scoreRows
    .filter((row, index, arr) => index === 0 || row.total !== arr[index - 1].total)
    .slice(-6)
    .map((row, index, arr) => ({
      date: row.date,
      dateLabel: formatMdDot(row.date),
      score: Math.round(row.total),
      isStart: index === 0,
      isCurrent: index === arr.length - 1,
      opinion:
        index === 0
          ? "추천 시작"
          : index === arr.length - 1
            ? "현재 추천 상태"
            : "점수 갱신",
    }))

  if (!timeline.length && latestPick) {
    timeline.push({
      date: latestPick.recommendedAt,
      dateLabel: formatMdDot(latestPick.recommendedAt),
      score: Math.round(latestPick.recommendedScore ?? stock.v4Score?.finalRankScore ?? 0),
      isStart: true,
      isCurrent: true,
      opinion: "추천 시작",
    })
  }

  const recPrice = latestPick?.recommendedPrice ?? firstPick?.recommendedPrice ?? null
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
    endedPicks: validationRows.filter(
      (p) => (migratePickLifecycle(p).lifecycleId ?? "active") !== "active",
    ).length,
  }
}
