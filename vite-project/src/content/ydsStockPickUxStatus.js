/**
 * V4 — 5단계 추천 상태 (품질×타이밍 매트릭스)
 */

/** @typedef {'aggressiveBuy' | 'buy' | 'scaleIn' | 'watch' | 'noChase'} StockPickUxStatusId */

/**
 * @typedef {{
 *   id: StockPickUxStatusId
 *   emoji: string
 *   label: string
 *   tooltip: string
 * }} StockPickUxStatusView
 */

/** @type {Record<StockPickUxStatusId, StockPickUxStatusView>} */
export const STOCK_PICK_UX_STATUS = {
  aggressiveBuy: {
    id: "aggressiveBuy",
    emoji: "🔥",
    label: "적극매수",
    tooltip: "기업품질·타이밍 모두 우수 — 분할매수 적극 검토",
  },
  buy: {
    id: "buy",
    emoji: "🟢",
    label: "매수가능",
    tooltip: "좋은 기업 + 양호한 타이밍 — 분할매수 가능",
  },
  scaleIn: {
    id: "scaleIn",
    emoji: "🟡",
    label: "분할진입",
    tooltip: "좋은 기업이나 타이밍 보통 — 소량 분할 접근",
  },
  watch: {
    id: "watch",
    emoji: "⚪",
    label: "관망",
    tooltip: "기업은 양호하나 지금은 진입 대기",
  },
  noChase: {
    id: "noChase",
    emoji: "🔴",
    label: "추격금지",
    tooltip: "타이밍 불리 — 신규 추격매수 금지",
  },
}

/** @deprecated V4 이전 3단계 ID — localStorage 호환 */
const LEGACY_UX_MAP = {
  buy: "buy",
  wait: "scaleIn",
  noChase: "noChase",
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView | { v4Score?: { recommendStatusId?: string }; stockStatus?: { id?: string }; statusDiag?: { statusId?: string } }} stock
 * @returns {StockPickUxStatusView}
 */
export function resolveStockPickUxStatus(stock) {
  const v4Id = stock.v4Score?.recommendStatusId
  if (v4Id && STOCK_PICK_UX_STATUS[v4Id]) {
    return STOCK_PICK_UX_STATUS[v4Id]
  }

  const statusId =
    stock.stockStatus?.id ?? stock.statusDiag?.statusId ?? "interest"
  if (statusId === "overheat") return STOCK_PICK_UX_STATUS.noChase
  if (statusId === "trend") return STOCK_PICK_UX_STATUS.buy
  if (statusId === "dip") return STOCK_PICK_UX_STATUS.scaleIn
  return STOCK_PICK_UX_STATUS.watch
}

/**
 * @param {StockPickUxStatusId | string} uxId
 * @returns {StockPickUxStatusView}
 */
export function getUxStatusById(uxId) {
  const mapped = LEGACY_UX_MAP[uxId] ?? uxId
  return STOCK_PICK_UX_STATUS[mapped] ?? STOCK_PICK_UX_STATUS.watch
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {number} [limit]
 * @returns {string[]}
 */
export function buildTodaySignalReasons(stock, limit = 3) {
  const fromDetail = (stock.recommendReasonsDetail ?? stock.recommendReasons ?? [])
    .map((r) => r.text)
    .filter(Boolean)

  if (fromDetail.length >= limit) {
    return fromDetail.slice(0, limit)
  }

  const fallback = [...fromDetail]
  const v4 = stock.v4Score

  if (fallback.length < limit && v4?.qualityGrade === "A") {
    fallback.push("기업품질 A")
  }
  if (fallback.length < limit && v4?.timingGrade === "A") {
    fallback.push("타이밍 A")
  }
  if (fallback.length < limit && v4?.recommendStatusId === "aggressiveBuy") {
    fallback.push("적극매수 구간")
  }
  if (fallback.length < limit && stock.stockStatus?.id === "trend") {
    fallback.push("추세 유지")
  }
  if (fallback.length < limit && (stock.scores?.volumeScore ?? 0) >= 13) {
    fallback.push("거래량 증가")
  }

  return fallback.slice(0, limit)
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView[]} stocks
 * @param {'US' | 'KR'} countryId
 * @returns {import("./ydsStockPickModel.js").StockPickView | null}
 */
export function pickTodaySignalStock(stocks, countryId) {
  const candidates = stocks.filter(
    (s) => s.dataSource === "live" && s.country === countryId,
  )
  if (!candidates.length) return null

  return [...candidates].sort(
    (a, b) => (b.v4Score?.finalRankScore ?? 0) - (a.v4Score?.finalRankScore ?? 0),
  )[0]
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @returns {number | null}
 */
export function getStockPickTotalScore(stock) {
  const v4Total = stock.v4Score?.total ?? stock.scoreBreakdown?.total
  if (Number.isFinite(v4Total)) return Math.round(v4Total)
  const phase3 = stock.scoreBreakdown?.total
  if (Number.isFinite(phase3)) return Math.round(phase3)
  const score = stock.scores?.totalScore ?? stock.score
  return Number.isFinite(score) ? Math.round(score) : null
}

/** @param {import("./ydsStockPickModel.js").StockPickView} stock */
export function getStockPickFinalRankScore(stock) {
  const v = stock.v4Score?.finalRankScore
  return Number.isFinite(v) ? v : null
}
