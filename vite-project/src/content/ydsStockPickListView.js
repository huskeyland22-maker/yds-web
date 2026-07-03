/**
 * 종목추천 리스트 · 테이블 · TOP5 카드 공통 표시 데이터
 */

import {
  countValidationPicksByTicker,
  findValidationPickByTicker,
} from "./ydsPickValidationLink.js"
import { formatTransparencyPrice } from "./ydsStockPickTransparency.js"
import { resolveRecommendStatusView } from "./ydsStockPickRecommendColors.js"
import { formatPerfPct } from "./ydsPickPerformanceEngine.js"
import {
  buildRecommendProfitView,
  logRecommendProfitTrace,
  formatRecommendProfitLabel,
} from "./ydsRecommendProfitResolver.js"
import { daysBetweenPickDates } from "./ydsPickLifecycleEngine.js"
import { todayDateKey } from "./ydsPortfolioTradesStorage.js"
import { getRecommendScoreDelta } from "./ydsStockPickScoreHistory.js"
import {
  estimateHoldPeriodLabel,
  estimateUpsidePct,
} from "./ydsStockPickDashboardEngine.js"
import { formatHubHistoryDateMMDD } from "./ydsStockPickHubHistoryGroupEngine.js"

/** @typedef {import("./ydsStockPickModel.js").StockPickView} StockPickView */

export { formatHubHistoryDateMMDD as formatPickDateMMDD }

/** @param {number} score */
export function confidenceDisplayTier(score) {
  if (!Number.isFinite(score)) return { label: "—", tone: "muted", min: 0 }
  if (score >= 90) return { label: "매우 높음", tone: "very-high", min: 90 }
  if (score >= 80) return { label: "높음", tone: "high", min: 80 }
  if (score >= 70) return { label: "보통", tone: "mid", min: 70 }
  if (score >= 60) return { label: "주의", tone: "warn", min: 60 }
  return { label: "낮음", tone: "low", min: 0 }
}

/** @param {StockPickView} stock */
export function resolveAiScore(stock) {
  return Math.round(
    stock.trustReport?.recommendScore ??
      stock.recommendEngine?.compositeScore ??
      stock.v4Score?.finalRankScore ??
      stock.score ??
      0,
  )
}

/** @param {StockPickView} stock */
export function resolveRecommendGradeLabel(stock) {
  const v4 = stock.v4Score
  if (!v4) return "—"
  const q = v4.qualityDisplayGrade ?? v4.qualityGrade ?? "—"
  const t = v4.timingGrade ?? "—"
  return `${q} · ${t}`
}

/** @param {StockPickView} stock */
export function resolveRecommendGradeSort(stock) {
  const v4 = stock.v4Score
  if (!v4) return 0
  return (v4.finalRankScore ?? v4.total ?? 0) + (v4.quality ?? 0) * 0.01
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord | null} pick
 * @param {number | null} currentReturn
 */
function resolvePickReturnExtremes(pick, currentReturn) {
  let maxRet = currentReturn
  let minRet = currentReturn
  for (const v of Object.values(pick?.horizons ?? {})) {
    if (v != null && Number.isFinite(v)) {
      if (maxRet == null || v > maxRet) maxRet = v
      if (minRet == null || v < minRet) minRet = v
    }
  }
  if (pick?.finalReturnPct != null && Number.isFinite(pick.finalReturnPct)) {
    if (maxRet == null || pick.finalReturnPct > maxRet) maxRet = pick.finalReturnPct
    if (minRet == null || pick.finalReturnPct < minRet) minRet = pick.finalReturnPct
  }
  return { maxRet, minRet, mdd: minRet }
}

/** @param {StockPickView} stock */
export function buildStockPickListRow(stock) {
  const country = stock.country === "KR" ? "KR" : "US"
  const pick = findValidationPickByTicker(stock.ticker, country)
  const profit = buildRecommendProfitView(stock, pick)
  const recPrice = profit.recommendPrice
  const currentRaw = profit.currentPrice
  const returnPct = profit.returnPct

  logRecommendProfitTrace({
    ticker: stock.ticker,
    recommendPrice: recPrice,
    currentPrice: currentRaw,
    profitPercent: returnPct,
    source: pick?.currentPrice != null ? "validation-pick" : "live-snapshot",
    stage: "list-row",
  })
  const recStatus = resolveRecommendStatusView(stock)
  const conf = stock.trustReport?.aiConfidence
  const { maxRet, mdd } = resolvePickReturnExtremes(pick, returnPct)
  const recommendedAt = pick?.recommendedAt ? String(pick.recommendedAt).slice(0, 10) : null
  const today = todayDateKey()
  const daysSinceRecommend = recommendedAt
    ? daysBetweenPickDates(recommendedAt, today)
    : null
  const scoreDelta = getRecommendScoreDelta(stock.ticker)
  const aiDelta =
    scoreDelta?.delta != null && Number.isFinite(scoreDelta.delta) ? scoreDelta.delta : null
  const upside = estimateUpsidePct(stock, Math.max(0, (stock.rank ?? 1) - 1))
  const holdPeriod = estimateHoldPeriodLabel(recStatus.id)
  const recommendCount = countValidationPicksByTicker(stock.ticker, country)

  return {
    ticker: stock.ticker,
    name: stock.name,
    aiScore: resolveAiScore(stock),
    recommendGrade: resolveRecommendGradeLabel(stock),
    recommendGradeSort: resolveRecommendGradeSort(stock),
    recommendStatusId: recStatus.id,
    statusLabel: recStatus.label,
    statusTone: recStatus.tone,
    sector: stock.sectorLabel || stock.sector || "—",
    recommendedAt,
    recommendedAtLabel: formatHubHistoryDateMMDD(recommendedAt),
    daysSinceRecommend,
    recommendedPrice: recPrice,
    recommendedPriceLabel:
      recPrice != null ? formatTransparencyPrice(recPrice, country) : "—",
    currentPriceLabel: formatTransparencyPrice(currentRaw, country),
    returnPct,
    returnLabel: formatRecommendProfitLabel(returnPct),
    maxReturnPct: maxRet,
    maxReturnLabel: formatPerfPct(maxRet),
    mddPct: mdd,
    mddLabel: formatPerfPct(mdd),
    aiDelta,
    aiDeltaLabel:
      aiDelta == null
        ? "—"
        : aiDelta > 0
          ? `+${aiDelta}`
          : aiDelta < 0
            ? `${aiDelta}`
            : "0",
    recommendCount,
    confidenceScore: conf?.score ?? null,
    confidenceTier: conf ? confidenceDisplayTier(conf.score) : null,
    expectedReturnPct: upside,
    expectedReturnLabel: formatPerfPct(upside),
    holdPeriodLabel: holdPeriod,
    rank: stock.rank,
  }
}

/** @typedef {keyof ReturnType<typeof buildStockPickListRow> | 'name'} StockPickListSortKey */

/** @type {ReadonlyArray<{ id: StockPickListSortKey; label: string; defaultVisible?: boolean }>} */
export const STOCK_PICK_TABLE_COLUMNS = [
  { id: "name", label: "종목", defaultVisible: true },
  { id: "aiScore", label: "AI", defaultVisible: true },
  { id: "recommendGrade", label: "등급", defaultVisible: true },
  { id: "recommendStatusId", label: "상태", defaultVisible: true },
  { id: "recommendedAt", label: "추천일", defaultVisible: true },
  { id: "daysSinceRecommend", label: "경과일", defaultVisible: true },
  { id: "recommendedPrice", label: "추천가", defaultVisible: true },
  { id: "currentPriceLabel", label: "현재가", defaultVisible: true },
  { id: "maxReturnPct", label: "최고수익", defaultVisible: true },
  { id: "returnPct", label: "현재수익", defaultVisible: true },
  { id: "mddPct", label: "MDD", defaultVisible: true },
  { id: "aiDelta", label: "AI 변화", defaultVisible: true },
  { id: "sector", label: "섹터", defaultVisible: false },
  { id: "recommendCount", label: "추천횟수", defaultVisible: true },
]

const COLUMN_STORAGE_KEY = "yds-spick-table-columns"

/** @returns {Set<StockPickListSortKey>} */
export function loadStockPickTableColumnPrefs() {
  if (typeof localStorage === "undefined") {
    return new Set(
      STOCK_PICK_TABLE_COLUMNS.filter((c) => c.defaultVisible !== false).map((c) => c.id),
    )
  }
  try {
    const raw = localStorage.getItem(COLUMN_STORAGE_KEY)
    if (!raw) {
      return new Set(
        STOCK_PICK_TABLE_COLUMNS.filter((c) => c.defaultVisible !== false).map((c) => c.id),
      )
    }
    const ids = JSON.parse(raw)
    if (!Array.isArray(ids) || !ids.length) {
      return new Set(
        STOCK_PICK_TABLE_COLUMNS.filter((c) => c.defaultVisible !== false).map((c) => c.id),
      )
    }
    return new Set(ids)
  } catch {
    return new Set(
      STOCK_PICK_TABLE_COLUMNS.filter((c) => c.defaultVisible !== false).map((c) => c.id),
    )
  }
}

/** @param {Set<StockPickListSortKey>} cols */
export function saveStockPickTableColumnPrefs(cols) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify([...cols]))
}

/**
 * @param {StockPickView[]} stocks
 * @param {StockPickListSortKey} sortKey
 * @param {'asc' | 'desc'} direction
 */
export function sortStockPickList(stocks, sortKey, direction = "desc") {
  const sign = direction === "asc" ? 1 : -1
  return stocks.slice().sort((a, b) => {
    const ra = buildStockPickListRow(a)
    const rb = buildStockPickListRow(b)
    let av
    let bv
    if (sortKey === "name") {
      av = ra.name
      bv = rb.name
      const diff = String(av).localeCompare(String(bv), "ko")
      return diff * sign
    }
    if (sortKey === "recommendStatusId") {
      av = ra.statusLabel
      bv = rb.statusLabel
      const diff = String(av).localeCompare(String(bv), "ko")
      return diff * sign
    }
    if (sortKey === "recommendedAt") {
      av = ra.recommendedAt ?? ""
      bv = rb.recommendedAt ?? ""
      const diff = String(av).localeCompare(String(bv))
      return diff * sign
    }
    if (sortKey === "currentPriceLabel") {
      av = Number(a.snapshot?.price ?? a.snapshot?.close) || 0
      bv = Number(b.snapshot?.price ?? b.snapshot?.close) || 0
    } else {
      av = ra[sortKey]
      bv = rb[sortKey]
    }
    const aNum = av == null || av === "—" ? -9999 : Number(av)
    const bNum = bv == null || bv === "—" ? -9999 : Number(bv)
    let diff = aNum - bNum
    if (diff === 0) diff = ra.aiScore - rb.aiScore
    return diff * sign
  })
}
