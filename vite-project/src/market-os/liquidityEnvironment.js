/**
 * 유동성 환경 카드 — DXY · MOVE 기반 판정 (채권 지표 UI와 분리)
 */

import { getBondLiquiditySpotCache } from "../macro-risk/bondLiquiditySpotCache.js"

/** @typedef {'down'|'flat'|'up'|'sharp_up'} DxyTrend */
/** @typedef {'stable'|'up'|'sharp_up'|'down'} MoveTrend */
/** @typedef {'favorable'|'neutral'|'tightening'|'alert'} LiquidityVerdictId */

const STALE_SUFFIX = "(최근 저장값)"

const DXY_UP_PCT = 0.15
const DXY_SHARP_PCT = 0.5
const DXY_DOWN_PCT = -0.15

const MOVE_STABLE_MAX = 109
const MOVE_UP_MIN = 110
const MOVE_SHARP_MIN = 130

/** @type {Record<LiquidityVerdictId, { id: LiquidityVerdictId; label: string; tone: string }>} */
export const LIQUIDITY_VERDICTS = {
  favorable: { id: "favorable", label: "유동성 우호", tone: "favorable" },
  neutral: { id: "neutral", label: "유동성 중립", tone: "neutral" },
  tightening: { id: "tightening", label: "유동성 긴축", tone: "tightening" },
  alert: { id: "alert", label: "유동성 경계", tone: "alert" },
}

/**
 * @typedef {{
 *   value: number
 *   display: string
 *   trend: DxyTrend | MoveTrend
 *   arrow: "↑" | "↓" | null
 *   stale: boolean
 * }} LiquidityMetricSide
 */

/**
 * @typedef {{
 *   dxy: LiquidityMetricSide | null
 *   move: LiquidityMetricSide | null
 *   verdict: (typeof LIQUIDITY_VERDICTS)[LiquidityVerdictId]
 *   summary: string
 *   hasPartialData: boolean
 * }} LiquidityEnvironmentCard
 */

/** @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot @param {string} key */
function metricRow(snapshot, key) {
  const rows = [
    ...(snapshot?.tieredMetrics?.tier1 ?? []),
    ...(snapshot?.tieredMetrics?.tier2 ?? []),
  ]
  return rows.find((r) => r.key === key) ?? null
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @returns {{ value: number; stale: boolean; row: object | null } | null}
 */
function resolveDxySpot(snapshot) {
  const row = snapshot ? metricRow(snapshot, "DXY") : null
  const raw = row?.current != null && Number.isFinite(Number(row.current)) ? Number(row.current) : null
  if (raw != null && raw > 0) return { value: raw, stale: false, row }

  const cached = getBondLiquiditySpotCache("DXY")
  if (cached != null) return { value: cached, stale: true, row: null }

  return null
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @param {number | null | undefined} panicMove
 * @returns {{ value: number; stale: boolean; row: object | null } | null}
 */
function resolveMoveSpot(snapshot, panicMove) {
  const panic = Number(panicMove)
  if (Number.isFinite(panic) && panic > 0) {
    return { value: panic, stale: false, row: snapshot ? metricRow(snapshot, "MOVE") : null }
  }

  const row = snapshot ? metricRow(snapshot, "MOVE") : null
  const raw = row?.current != null && Number.isFinite(Number(row.current)) ? Number(row.current) : null
  if (raw != null && raw > 0) return { value: raw, stale: false, row }

  const cached = getBondLiquiditySpotCache("MOVE")
  if (cached != null) return { value: cached, stale: true, row: null }

  return null
}

/** @param {object | null} row @returns {DxyTrend} */
function classifyDxyTrend(row) {
  const change1D = Number(row?.change1D)
  const slope = row?.slope ?? "flat"

  if (Number.isFinite(change1D) && change1D > DXY_SHARP_PCT) return "sharp_up"
  if (slope === "up" && Number.isFinite(change1D) && change1D > 0.35) return "sharp_up"
  if (slope === "down" || (Number.isFinite(change1D) && change1D < DXY_DOWN_PCT)) return "down"
  if (slope === "up" || (Number.isFinite(change1D) && change1D > DXY_UP_PCT)) return "up"
  return "flat"
}

/**
 * @param {number} value
 * @param {object | null} row
 * @returns {MoveTrend}
 */
function classifyMoveTrend(value, row) {
  const slope = row?.slope ?? "flat"
  const change5D = Number(row?.change5D)
  const change20D = Number(row?.change20D)

  if (value >= MOVE_SHARP_MIN) return "sharp_up"
  if (slope === "up" && (value >= 125 || (Number.isFinite(change20D) && change20D >= 15))) return "sharp_up"
  if (value >= MOVE_UP_MIN || slope === "up" || (Number.isFinite(change5D) && change5D >= 8)) return "up"
  if (value <= 85 || slope === "down") return "down"
  if (value <= MOVE_STABLE_MAX) return "stable"
  return "stable"
}

/**
 * @param {DxyTrend | null} dxyTrend
 * @param {MoveTrend | null} moveTrend
 * @returns {(typeof LIQUIDITY_VERDICTS)[LiquidityVerdictId]}
 */
export function resolveLiquidityVerdict(dxyTrend, moveTrend) {
  const dxy = dxyTrend ?? "flat"
  const move = moveTrend === "down" ? "stable" : (moveTrend ?? "stable")

  if (dxy === "sharp_up" && move === "sharp_up") return LIQUIDITY_VERDICTS.alert
  if (dxy === "up" && move === "up") return LIQUIDITY_VERDICTS.tightening
  if (dxy === "down" && move === "stable") return LIQUIDITY_VERDICTS.favorable
  if (dxy === "flat" && move === "stable") return LIQUIDITY_VERDICTS.neutral

  if (dxy === "sharp_up" || move === "sharp_up") return LIQUIDITY_VERDICTS.alert
  if (dxy === "up" || move === "up") return LIQUIDITY_VERDICTS.tightening
  if (dxy === "down") return LIQUIDITY_VERDICTS.favorable
  return LIQUIDITY_VERDICTS.neutral
}

/** @param {DxyTrend} trend @returns {string} */
function dxySummaryPhrase(trend) {
  if (trend === "down") return "달러 압력 완화"
  if (trend === "up") return "달러 강세 지속"
  if (trend === "sharp_up") return "달러 급등 압력"
  return "달러 압력 보통"
}

/** @param {MoveTrend} trend @returns {string} */
function moveSummaryPhrase(trend) {
  if (trend === "down" || trend === "stable") return "채권 변동성 완화"
  if (trend === "sharp_up") return "채권 변동성 급등"
  return "채권 변동성 확대"
}

/**
 * @param {DxyTrend | null} dxyTrend
 * @param {MoveTrend | null} moveTrend
 * @param {(typeof LIQUIDITY_VERDICTS)[LiquidityVerdictId]} verdict
 */
function buildLiquiditySummary(dxyTrend, moveTrend, verdict) {
  const dxyPart = dxySummaryPhrase(dxyTrend ?? "flat")
  if (verdict.id === "tightening") return `${dxyPart} · 유동성 긴축 주의`
  if (verdict.id === "alert") return `${dxyPart} · 유동성 경계 주의`
  const movePart = moveSummaryPhrase(moveTrend === "down" ? "stable" : (moveTrend ?? "stable"))
  return `${dxyPart} · ${movePart}`
}

/** @param {DxyTrend | MoveTrend} trend @param {"dxy"|"move"} kind */
function trendArrow(trend, kind) {
  if (kind === "dxy") {
    if (trend === "up" || trend === "sharp_up") return "↑"
    if (trend === "down") return "↓"
    return null
  }
  if (trend === "up" || trend === "sharp_up") return "↑"
  if (trend === "down") return "↓"
  return null
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @param {number | null | undefined} panicMove
 * @param {(key: string, n: number | null, fmt?: string) => string} formatValue
 * @returns {LiquidityEnvironmentCard}
 */
export function buildLiquidityEnvironmentCard(snapshot, panicMove, formatValue) {
  const dxySpot = resolveDxySpot(snapshot)
  const moveSpot = resolveMoveSpot(snapshot, panicMove)

  /** @type {LiquidityMetricSide | null} */
  let dxy = null
  /** @type {LiquidityMetricSide | null} */
  let move = null
  /** @type {DxyTrend | null} */
  let dxyTrend = null
  /** @type {MoveTrend | null} */
  let moveTrend = null

  if (dxySpot) {
    dxyTrend = classifyDxyTrend(dxySpot.row)
    let display = formatValue("DXY", dxySpot.value, "level")
    if (dxySpot.stale) display = `${display} ${STALE_SUFFIX}`
    dxy = {
      value: dxySpot.value,
      display,
      trend: dxyTrend,
      arrow: trendArrow(dxyTrend, "dxy"),
      stale: dxySpot.stale,
    }
  }

  if (moveSpot) {
    moveTrend = classifyMoveTrend(moveSpot.value, moveSpot.row)
    let display = formatValue("MOVE", moveSpot.value, "index")
    if (moveSpot.stale) display = `${display} ${STALE_SUFFIX}`
    move = {
      value: moveSpot.value,
      display,
      trend: moveTrend,
      arrow: trendArrow(moveTrend, "move"),
      stale: moveSpot.stale,
    }
  }

  const verdict = resolveLiquidityVerdict(dxyTrend, moveTrend)
  const summary = buildLiquiditySummary(dxyTrend, moveTrend, verdict)

  return {
    dxy,
    move,
    verdict,
    summary,
    hasPartialData: Boolean(dxy) !== Boolean(move),
  }
}
