/**
 * 추천 히스토리 · 성과 요약 뷰 (loadValidationPicks 기반, 저장소 변경 없음)
 */

import { loadValidationPicks } from "./ydsValidationStorage.js"
import {
  buildRecommendProfitView,
  formatRecommendProfitLabel,
} from "./ydsRecommendProfitResolver.js"
import { formatTransparencyPrice } from "./ydsStockPickTransparency.js"
import { daysBetweenPickDates, resolvePickLifecycleView } from "./ydsPickLifecycleEngine.js"
import { todayDateKey } from "./ydsPortfolioTradesStorage.js"

/** @typedef {'all' | 'active' | 'profit' | 'loss' | 'ended'} HubHistoryViewFilterId */

/** @type {ReadonlyArray<{ id: HubHistoryViewFilterId; label: string }>} */
export const HUB_HISTORY_VIEW_FILTERS = [
  { id: "all", label: "전체" },
  { id: "active", label: "진행중" },
  { id: "profit", label: "수익중" },
  { id: "loss", label: "손실중" },
  { id: "ended", label: "종료" },
]

/** @param {string | null | undefined} dateKey */
export function formatHubHistoryDateDot(dateKey) {
  const d = String(dateKey ?? "").slice(0, 10)
  if (d.length < 10) return "—"
  return `${d.slice(0, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`
}

/** @param {import("./ydsValidationStorage.js").ValidationPickRecord} pick */
function resolveAiGradeLabel(pick) {
  const snap = pick.recommendSnapshot
  const q = snap?.qualityGrade ?? pick.qualityGrade ?? "—"
  const t = snap?.timingGrade ?? pick.timingGrade ?? "—"
  if (q === "—" && t === "—") return "—"
  return `${q} · ${t}`
}

/** @param {import("./ydsValidationStorage.js").ValidationPickRecord} pick */
function resolveReasonOneLine(pick) {
  const rationales = pick.recommendSnapshot?.recommendRationales ?? []
  const first = rationales.find((r) => r?.text)?.text
  if (first) return String(first).slice(0, 72)
  const guide = pick.recommendSnapshot?.actionGuide?.summary
  if (guide) return String(guide).slice(0, 72)
  const strategy = pick.strategyLabel ?? pick.recommendSnapshot?.marketStateLabel
  if (strategy && strategy !== "—") return String(strategy).slice(0, 72)
  return "—"
}

/** @param {number | null | undefined} returnPct */
export function resolveHubReturnTone(returnPct) {
  if (returnPct == null || returnPct === 0) return "muted"
  return returnPct > 0 ? "up" : "down"
}

/**
 * @param {Array<{
 *   pickId: string
 *   lifecycleId: string
 *   returnPct: number | null
 *   isAiBestPick: boolean
 * }>} rows
 */
function resolveTopReturnPickId(rows) {
  let topId = null
  let topRet = null
  for (const row of rows) {
    if (row.lifecycleId !== "active") continue
    if (row.returnPct == null || !Number.isFinite(row.returnPct)) continue
    if (topRet == null || row.returnPct > topRet) {
      topRet = row.returnPct
      topId = row.pickId
    }
  }
  return topId
}

/**
 * @param {Array<{
 *   pickId: string
 *   lifecycleId: string
 *   returnPct: number | null
 *   isAiBestPick: boolean
 * }>} rows
 * @param {string} pickId
 */
function buildHubHistoryBadges(rows, pickId) {
  const row = rows.find((r) => r.pickId === pickId)
  if (!row) return []
  const topReturnPickId = resolveTopReturnPickId(rows)
  /** @type {{ emoji: string; label: string; tone: string }[]} */
  const badges = []
  if (row.lifecycleId === "active") {
    badges.push({ emoji: "🟢", label: "진행중", tone: "active" })
  }
  if (topReturnPickId === pickId) {
    badges.push({ emoji: "🏆", label: "최고수익", tone: "success" })
  }
  if (row.returnPct != null && row.returnPct < 0) {
    badges.push({ emoji: "🔴", label: "손실", tone: "failure" })
  }
  if (row.isAiBestPick) {
    badges.push({ emoji: "⭐", label: "AI Best Pick", tone: "highlight" })
  }
  return badges
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} pick
 * @param {number | null | undefined} livePrice
 * @param {string | undefined} liveName
 */
function buildHubHistoryBaseRow(pick, livePrice, liveName) {
  const country = pick.country === "KR" ? "KR" : "US"
  const today = todayDateKey()
  const stockStub = {
    ticker: pick.ticker,
    country,
    snapshot: livePrice != null ? { price: livePrice } : null,
  }
  const profit = buildRecommendProfitView(stockStub, pick)
  const lifecycleId = pick.lifecycleId ?? "active"
  const lifecycle = resolvePickLifecycleView(lifecycleId)
  const daysSince = daysBetweenPickDates(pick.recommendedAt, today)

  return {
    pickId: pick.id,
    ticker: pick.ticker,
    name: liveName ?? pick.name ?? pick.ticker,
    recommendedAt: pick.recommendedAt,
    recommendedAtLabel: formatHubHistoryDateDot(pick.recommendedAt),
    recommendedPrice: profit.recommendPrice,
    recommendedPriceLabel:
      profit.recommendPrice != null
        ? formatTransparencyPrice(profit.recommendPrice, country)
        : "—",
    currentPrice: profit.currentPrice,
    currentPriceLabel:
      profit.currentPrice != null
        ? formatTransparencyPrice(profit.currentPrice, country)
        : "—",
    returnPct: profit.returnPct,
    returnLabel: formatRecommendProfitLabel(profit.returnPct),
    returnTone: resolveHubReturnTone(profit.returnPct),
    daysSinceRecommend: daysSince,
    elapsedLabel: `D+${daysSince}`,
    aiGradeLabel: resolveAiGradeLabel(pick),
    reasonLine: resolveReasonOneLine(pick),
    lifecycleId,
    statusLabel: `${lifecycle.emoji} ${lifecycle.label}`,
    statusTone: lifecycle.tone,
    resultBadge: `${lifecycle.badgeEmoji} ${lifecycle.badgeLabel}`,
    isAiBestPick: Boolean(pick.isTop3 || (pick.rank > 0 && pick.rank <= 3)),
    closedAt: pick.closedAt ?? null,
    closeReason: pick.closeReason ?? null,
    badges: /** @type {{ emoji: string; label: string; tone: string }[]} */ ([]),
  }
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView[]} stocks
 */
export function buildHubHistoryViewRows(stocks = []) {
  const picks = loadValidationPicks()
    .slice()
    .sort((a, b) => b.recommendedAt.localeCompare(a.recommendedAt))

  const priceByKey = new Map(
    stocks.map((s) => {
      const country = s.country === "KR" ? "KR" : "US"
      return [
        `${country}:${String(s.ticker).toUpperCase()}`,
        Number(s.snapshot?.price ?? s.snapshot?.close),
      ]
    }),
  )
  const nameByKey = new Map(
    stocks.map((s) => {
      const country = s.country === "KR" ? "KR" : "US"
      return [`${country}:${String(s.ticker).toUpperCase()}`, s.name]
    }),
  )

  const baseRows = picks.map((pick) => {
    const key = `${pick.country}:${String(pick.ticker).toUpperCase()}`
    return buildHubHistoryBaseRow(
      pick,
      priceByKey.get(key) ?? pick.currentPrice ?? null,
      nameByKey.get(key),
    )
  })

  return baseRows.map((row) => ({
    ...row,
    badges: buildHubHistoryBadges(baseRows, row.pickId),
  }))
}

/**
 * @param {ReturnType<typeof buildHubHistoryViewRows>} rows
 * @param {HubHistoryViewFilterId} filterId
 */
export function filterHubHistoryViewRows(rows, filterId) {
  if (filterId === "all") return rows
  if (filterId === "active") return rows.filter((r) => r.lifecycleId === "active")
  if (filterId === "profit") {
    return rows.filter(
      (r) => r.lifecycleId === "active" && r.returnPct != null && r.returnPct > 0,
    )
  }
  if (filterId === "loss") {
    return rows.filter(
      (r) => r.lifecycleId === "active" && r.returnPct != null && r.returnPct < 0,
    )
  }
  if (filterId === "ended") return rows.filter((r) => r.lifecycleId !== "active")
  return rows
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord[]} [picks]
 * @param {import("./ydsStockPickModel.js").StockPickView[]} [stocks]
 */
export function buildRecommendPerfSummaryCards(picks, stocks = []) {
  const allPicks = picks ?? loadValidationPicks()
  const rows = buildHubHistoryViewRows(stocks)
  const today = todayDateKey()

  const activeCount = rows.filter((r) => r.lifecycleId === "active").length
  const returns = rows
    .map((r) => r.returnPct)
    .filter((v) => v != null && Number.isFinite(v))
  const avgReturn =
    returns.length > 0
      ? Math.round((returns.reduce((s, v) => s + v, 0) / returns.length) * 10) / 10
      : null

  const closed = rows.filter((r) => r.lifecycleId === "targetHit" || r.lifecycleId === "stopLoss")
  const successClosed = closed.filter((r) => r.lifecycleId === "targetHit").length
  const winRate =
    closed.length > 0 ? Math.round((successClosed / closed.length) * 1000) / 10 : null

  let bestPick = null
  let worstPick = null
  for (const row of rows) {
    if (row.returnPct == null || !Number.isFinite(row.returnPct)) continue
    if (!bestPick || row.returnPct > bestPick.returnPct) bestPick = row
    if (!worstPick || row.returnPct < worstPick.returnPct) worstPick = row
  }

  return {
    totalCount: allPicks.length,
    activeCount,
    avgReturn,
    avgReturnLabel: formatRecommendProfitLabel(avgReturn),
    winRate,
    winRateLabel: winRate != null ? `${winRate}%` : "—",
    bestPick: bestPick
      ? {
          name: bestPick.name,
          ticker: bestPick.ticker,
          returnPct: bestPick.returnPct,
          returnLabel: bestPick.returnLabel,
        }
      : null,
    worstPick: worstPick
      ? {
          name: worstPick.name,
          ticker: worstPick.ticker,
          returnPct: worstPick.returnPct,
          returnLabel: worstPick.returnLabel,
        }
      : null,
    asOfDate: today,
  }
}
