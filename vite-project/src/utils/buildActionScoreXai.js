/**
 * YDS 행동점수 XAI 빌더
 */
import { evaluateMetaRisk } from "../core/metaRisk/metaRiskEngine.ts"
import {
  ACTION_SCORE_XAI_ADJUSTMENTS,
  ACTION_SCORE_XAI_CONTEXT,
  horizonXaiConfig,
  panicStatusLabel,
} from "./ydsActionScoreXaiConfig.js"

/**
 * @typedef {{
 *   label: string
 *   statusShort?: string
 *   points: number
 * }} XaiPointLine
 */

/**
 * @typedef {{
 *   score: number
 *   components: XaiPointLine[]
 *   subtotal: number
 * }} XaiBaseBlock
 */

/**
 * @typedef {{
 *   lines: XaiPointLine[]
 *   total: number
 * }} XaiBasisBlock
 */

/**
 * @typedef {{
 *   items: XaiPointLine[]
 *   total: number
 * }} XaiAdjustmentBlock
 */

/**
 * @typedef {{
 *   label: string
 *   points: number | null
 *   showPoints: boolean
 * }} XaiDisplayLine
 */

/**
 * @typedef {{
 *   panicHeading: string
 *   panicStatus: string
 *   contextLines: XaiDisplayLine[]
 * }} XaiDisplayBlock
 */

/**
 * @typedef {{
 *   final: number
 *   base: XaiBaseBlock
 *   basis: XaiBasisBlock
 *   adjustments: XaiAdjustmentBlock
 *   display: XaiDisplayBlock
 *   checksOut: boolean
 * }} ActionScoreXai
 */

/**
 * @param {number} n
 * @returns {number}
 */
function roundPts(n) {
  return Math.round(Number(n) || 0)
}

/**
 * @param {number | null | undefined} cycleScore
 * @param {import('./ydsActionScoreXaiConfig.js').HorizonXaiConfig} cfg
 * @returns {number}
 */
function panicPointsFromIndex(cycleScore, cfg) {
  if (!Number.isFinite(Number(cycleScore))) return 0
  const { neutral, scale, maxAbs } = cfg.panic
  const raw = (neutral - Number(cycleScore)) * scale
  return roundPts(Math.max(-maxAbs, Math.min(maxAbs, raw)))
}

/**
 * @param {import('./buildScoreExplainLayer.js').ExplainDriver[]} bondDrivers
 * @param {boolean} enabled
 * @returns {number}
 */
function bondLiquidityPoints(bondDrivers, enabled) {
  if (!enabled || !bondDrivers?.length) return 0
  return roundPts(bondDrivers.reduce((s, d) => s + (d.points || 0), 0))
}

/**
 * @param {boolean} enabled
 * @returns {number}
 */
function metaRiskPoints(enabled) {
  if (!enabled) return 0
  const state = evaluateMetaRisk()
  const pillars = [state.carryTrade, state.liquidity, state.hedgeFund, state.cta]
  const active = pillars.filter((p) => p.enabled)
  if (!active.length) return 0
  const avg = active.reduce((s, p) => s + (p.score || 0), 0) / active.length
  return roundPts(avg * 0.1)
}

/**
 * @param {boolean} enabled
 * @returns {number}
 */
function encyclePoints(enabled) {
  if (!enabled) return 0
  return 0
}

/**
 * @param {{
 *   horizon: import('./ydsActionScoreXaiConfig.js').ActionScoreHorizon
 *   finalScore: number
 *   drivers: import('./buildScoreExplainLayer.js').ExplainDriver[]
 *   bondDrivers?: import('./buildScoreExplainLayer.js').ExplainDriver[]
 *   cycleScore?: number | null
 * }} input
 * @returns {ActionScoreXai}
 */
export function buildActionScoreXai({
  horizon,
  finalScore,
  drivers,
  bondDrivers = [],
  cycleScore = null,
}) {
  const cfg = horizonXaiConfig(horizon)
  const final = roundPts(finalScore)

  const basisLines = drivers
    .filter((d) => !d.auxiliary)
    .map((d) => ({
      label: d.metricLabel,
      statusShort: d.statusShort,
      points: roundPts(d.points),
    }))

  const basisTotal = roundPts(basisLines.reduce((s, l) => s + l.points, 0))

  /** @type {XaiPointLine[]} */
  const adjItems = []
  for (const def of ACTION_SCORE_XAI_ADJUSTMENTS) {
    if (!def.enabled) continue
    let pts = 0
    if (def.key === "bondLiquidity") pts = bondLiquidityPoints(bondDrivers, true)
    else if (def.key === "metaRisk") pts = metaRiskPoints(true)
    else if (def.key === "encycle") pts = encyclePoints(true)
    adjItems.push({ label: def.label, points: roundPts(pts * (def.weight ?? 1)) })
  }
  const adjustmentTotal = roundPts(adjItems.reduce((s, i) => s + i.points, 0))

  const baseScore = roundPts(cfg.base)
  let panicPoints = roundPts(final - baseScore - basisTotal - adjustmentTotal)
  if (Number.isFinite(Number(cycleScore))) {
    const fromIndex = panicPointsFromIndex(cycleScore, cfg)
    if (fromIndex !== 0 && Math.abs(fromIndex - panicPoints) <= 2) {
      panicPoints = fromIndex
    }
  }

  const baseSubtotal = roundPts(baseScore + panicPoints)
  const recomposed = roundPts(baseSubtotal + basisTotal + adjustmentTotal)
  const checksOut = recomposed === final

  const bondAuxPts = bondLiquidityPoints(bondDrivers, true)
  /** @type {XaiDisplayLine[]} */
  const contextLines = []
  if (bondAuxPts !== 0) {
    contextLines.push({
      label: ACTION_SCORE_XAI_CONTEXT.bondAuxLabel,
      points: bondAuxPts,
      showPoints: true,
    })
  }

  return {
    final,
    base: {
      score: baseScore,
      components: [{ label: "패닉", points: panicPoints }],
      subtotal: baseSubtotal,
    },
    basis: { lines: basisLines, total: basisTotal },
    adjustments: { items: adjItems, total: adjustmentTotal },
    display: {
      panicHeading: "패닉",
      panicStatus: panicStatusLabel(cycleScore, cfg.panic.statusBands),
      contextLines,
    },
    checksOut,
  }
}

/**
 * @param {number} n
 * @returns {string}
 */
export function formatXaiSigned(n) {
  const v = Math.round(Number(n) || 0)
  if (v > 0) return `+${v}`
  return String(v)
}

/**
 * @param {ActionScoreXai} xai
 * @param {'formula' | 'qualitative'} [style]
 * @returns {string}
 */
export function formatActionScoreXaiLine(xai, style = "formula") {
  if (style === "qualitative") {
    const panic = (xai.display.panicStatus || "—").replace(/\s+/g, "")
    return `패닉 ${panic} | 근거합계 ${formatXaiSigned(xai.basis.total)} | 보정 ${formatXaiSigned(xai.adjustments.total)}`
  }
  return `기본${xai.base.subtotal} + 근거${formatXaiSigned(xai.basis.total)} + 보정${formatXaiSigned(xai.adjustments.total)} = 최종${xai.final}`
}
