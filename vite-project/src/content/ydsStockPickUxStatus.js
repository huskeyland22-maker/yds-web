/**
 * 종목추천 UX — 3단계 행동 지침 상태
 */

/** @typedef {'buy' | 'wait' | 'noChase'} StockPickUxStatusId */

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
  buy: {
    id: "buy",
    emoji: "🟢",
    label: "매수 가능",
    tooltip: "현재 조건상 분할매수 가능",
  },
  wait: {
    id: "wait",
    emoji: "🟡",
    label: "눌림 대기",
    tooltip: "좋은 종목이나 진입 타이밍 대기",
  },
  noChase: {
    id: "noChase",
    emoji: "🔴",
    label: "추격 금지",
    tooltip: "단기 급등으로 위험 대비 보상 불리",
  },
}

/**
 * @param {import("./ydsStockActionEngine.js").StockActionStatusId | string | undefined} statusId
 * @returns {StockPickUxStatusId}
 */
export function mapEngineStatusToUxId(statusId) {
  if (statusId === "overheat") return "noChase"
  if (statusId === "trend") return "buy"
  if (statusId === "dip" || statusId === "interest") return "wait"
  return "wait"
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView | { stockStatus?: { id?: string }; statusDiag?: { statusId?: string } }} stock
 * @returns {StockPickUxStatusView}
 */
export function resolveStockPickUxStatus(stock) {
  const statusId =
    stock.stockStatus?.id ?? stock.statusDiag?.statusId ?? "interest"
  const uxId = mapEngineStatusToUxId(statusId)

  if (uxId === "buy") {
    const total = stock.scores?.totalScore ?? 0
    if (total < 55) return STOCK_PICK_UX_STATUS.wait
  }

  return STOCK_PICK_UX_STATUS[uxId]
}

/**
 * @param {StockPickUxStatusId} uxId
 * @returns {StockPickUxStatusView}
 */
export function getUxStatusById(uxId) {
  return STOCK_PICK_UX_STATUS[uxId] ?? STOCK_PICK_UX_STATUS.wait
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
  const scores = stock.scores ?? {}
  const statusId = stock.stockStatus?.id ?? stock.statusDiag?.statusId

  if (
    fallback.length < limit &&
    (stock.sector === "ai" || stock.sector === "semiconductor") &&
    (scores.totalScore ?? 0) >= 75
  ) {
    fallback.push("AI 점수 상위")
  }
  if (fallback.length < limit && statusId === "trend") {
    fallback.push("추세 유지")
  }
  if (fallback.length < limit && scores.volumeScore >= 60) {
    fallback.push("거래량 증가")
  }
  if (fallback.length < limit && statusId === "dip") {
    fallback.push("단기 과열 해소 중")
  }
  if (fallback.length < limit && statusId === "interest") {
    fallback.push("지지구간 접근")
  }
  if (fallback.length < limit && scores.trendScore >= 65) {
    fallback.push("장기 추세 양호")
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
    (a, b) => (b.scores?.totalScore ?? 0) - (a.scores?.totalScore ?? 0),
  )[0]
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @returns {number | null}
 */
export function getStockPickTotalScore(stock) {
  const score = stock.scores?.totalScore ?? stock.score
  return Number.isFinite(score) ? Math.round(score) : null
}
