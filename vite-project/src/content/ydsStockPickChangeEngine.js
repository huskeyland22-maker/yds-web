/**
 * YDS 추천 종목 변화 추적 — 점수·등급·위치·변화 배지
 */

import {
  getFieldDeltaForDays,
  getGradeSnapshotForDays,
  getPositionSnapshotForDays,
  getScoreDeltaForDays,
  readScoreHistory,
} from "./ydsStockPickScoreHistory.js"
import { STOCK_POSITION_VIEWS } from "./ydsStockPositionEngine.js"
import { marketEnvToGrade } from "./ydsStockPickV5Insights.js"

/** @typedef {'surge' | 'rising' | 'hold' | 'weakening' | 'warn'} ChangeBadgeId */

/**
 * @typedef {{
 *   id: ChangeBadgeId
 *   label: string
 *   tone: string
 * }} ChangeBadgeView
 */

/**
 * @typedef {{
 *   label: string
 *   from: string
 *   to: string
 *   direction: 'up' | 'down' | 'flat'
 *   display: string
 * }} GradeChangeView
 */

/** @type {Record<string, number>} */
const GRADE_RANK = {
  "A+": 6,
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  F: 1,
}

/** @param {string} g */
function gradeRank(g) {
  return GRADE_RANK[g] ?? 0
}

/** @param {import("./ydsStockPickScoreHistory.js").ScoreDeltaView | null} d */
function fmtDeltaShort(d) {
  if (!d || d.delta == null) return null
  const sign = d.delta > 0 ? "+" : d.delta < 0 ? "" : "+"
  return d.delta === 0 ? "+0" : `${sign}${d.delta}`
}

/** @param {import("./ydsStockPickScoreHistory.js").ScoreDeltaView | null} d */
function fmtDeltaArrow(d) {
  if (!d || d.delta == null) return null
  if (d.delta === 0) return "→ 0"
  const sign = d.delta > 0 ? "+" : ""
  return `${d.delta > 0 ? "▲" : "▼"} ${sign}${d.delta}`
}

/**
 * @param {string | null | undefined} from
 * @param {string | null | undefined} to
 */
function gradeDirection(from, to) {
  if (!from || !to || from === to) return "flat"
  return gradeRank(to) > gradeRank(from) ? "up" : "down"
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {Record<string, unknown>} [history]
 */
export function buildStockPickChangeReport(stock, history = readScoreHistory()) {
  const ticker = stock.ticker
  const v4 = stock.v4Score

  const day1 = getScoreDeltaForDays(ticker, 1, history)
  const day5 = getScoreDeltaForDays(ticker, 5, history)
  const day20 = getScoreDeltaForDays(ticker, 20, history)

  const qualityGrade =
    v4?.qualityDisplayGrade ?? v4?.qualityGrade ?? "C"
  const timingGrade = v4?.timingGrade ?? "C"
  const marketFitGrade =
    stock.pickMeta?.marketFitGrade ??
    marketEnvToGrade(stock.scoreBreakdown?.marketEnv ?? 0, 15)

  const gradeChanges = buildGradeChanges(stock, history, {
    qualityGrade,
    timingGrade,
    marketFitGrade,
  })

  const positionChange = buildPositionChange(stock, history)

  const changeBadge = resolveChangeBadge(day1, day5, day20, gradeChanges, positionChange)

  return {
    day1,
    day5,
    day20,
    day1Display: fmtDeltaShort(day1),
    day5Display: fmtDeltaShort(day5),
    day20Display: fmtDeltaShort(day20),
    day1Arrow: fmtDeltaArrow(day1),
    gradeChanges,
    positionChange,
    changeBadge,
    totalScore: Math.round(v4?.finalRankScore ?? v4?.total ?? stock.score ?? 0),
  }
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {Record<string, unknown>} history
 * @param {{ qualityGrade: string; timingGrade: string; marketFitGrade: string }} current
 */
function buildGradeChanges(stock, history, current) {
  /** @type {GradeChangeView[]} */
  const changes = []

  const prev5 = getGradeSnapshotForDays(stock.ticker, 5, history)
  const prev1 = getGradeSnapshotForDays(stock.ticker, 1, history)
  const prev = prev1?.qualityGrade ? prev1 : prev5

  if (!prev) return changes

  const items = [
    { key: "quality", label: "기업품질", from: prev.qualityGrade, to: current.qualityGrade },
    { key: "timing", label: "타이밍", from: prev.timingGrade, to: current.timingGrade },
    { key: "marketFit", label: "시장적합", from: prev.marketFitGrade, to: current.marketFitGrade },
  ]

  for (const item of items) {
    if (!item.from || !item.to || item.from === item.to) continue
    const direction = gradeDirection(item.from, item.to)
    changes.push({
      label: item.label,
      from: item.from,
      to: item.to,
      direction,
      display: `${item.from} → ${item.to}`,
    })
  }

  return changes.slice(0, 3)
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {Record<string, unknown>} history
 */
function buildPositionChange(stock, history) {
  const currentId = stock.pickMeta?.positionState?.id ?? null
  const current =
    currentId && STOCK_POSITION_VIEWS[currentId]
      ? STOCK_POSITION_VIEWS[currentId].label
      : stock.pickMeta?.positionState?.label ?? null

  const prevSnap = getPositionSnapshotForDays(stock.ticker, 1, history)
  if (!prevSnap?.positionId || !currentId || prevSnap.positionId === currentId) {
    return null
  }

  let fromLabel = STOCK_POSITION_VIEWS[prevSnap.positionId]?.label ?? prevSnap.positionId
  let toLabel = current ?? currentId

  if (prevSnap.positionId === "overheat" && (currentId === "pullback" || currentId === "sideways")) {
    toLabel = "조정"
  }

  return {
    fromId: prevSnap.positionId,
    toId: currentId,
    fromLabel,
    toLabel,
    display: `${fromLabel} → ${toLabel}`,
  }
}

/**
 * @param {import("./ydsStockPickScoreHistory.js").ScoreDeltaView | null} day1
 * @param {import("./ydsStockPickScoreHistory.js").ScoreDeltaView | null} day5
 * @param {import("./ydsStockPickScoreHistory.js").ScoreDeltaView | null} day20
 * @param {GradeChangeView[]} gradeChanges
 * @param {ReturnType<typeof buildPositionChange> | null} positionChange
 * @returns {ChangeBadgeView}
 */
function resolveChangeBadge(day1, day5, day20, gradeChanges, positionChange) {
  const d1 = day1?.delta ?? 0
  const d5 = day5?.delta ?? 0
  const d20 = day20?.delta ?? 0
  const gradeDown = gradeChanges.some((g) => g.direction === "down")
  const toDownturn =
    positionChange?.toId === "downturn" || positionChange?.toId === "overheat"

  if (d1 <= -5 || d20 <= -8 || (gradeDown && d1 <= -2) || toDownturn) {
    return { id: "warn", label: "경고", tone: "red" }
  }
  if (d1 >= 5 || d5 >= 8) {
    return { id: "surge", label: "급상승", tone: "surge" }
  }
  if (d1 >= 2 || d5 >= 3) {
    return { id: "rising", label: "상승중", tone: "rising" }
  }
  if (d1 <= -2 || d5 <= -3) {
    return { id: "weakening", label: "하락중", tone: "weakening" }
  }
  return { id: "hold", label: "유지", tone: "hold" }
}
