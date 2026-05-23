/**
 * 실전(관심종목) 독립 타점 엔진 — SOXX·NDX·VVIX·VIX·MOVE·F&G
 * 0~100 (높을수록 관심·우호)
 */
import { normalizePanicV2Metric } from "../panic-v2/normalizeMetrics.js"
import { pickMetricValue } from "./panicMarketActionEngine.js"

/** @typedef {{
 *   horizon: "tactical"
 *   label: string
 *   score: number
 *   status: string
 *   metricsUsed: string[]
 *   componentScores: { label: string; key: string; raw: number; score: number }[]
 * }} TacticalTimingSignal
 */

/** @param {number | null} panicNorm @param {boolean} invert */
function toInterestScore(panicNorm, invert = true) {
  if (panicNorm == null || !Number.isFinite(panicNorm)) return null
  const n = invert ? 100 - panicNorm : panicNorm
  return Math.round(Math.max(0, Math.min(100, n)))
}

/** @param {number} v */
function tacticalFearGreedInterest(v) {
  if (v <= 22) return 78
  if (v <= 35) return 70
  if (v <= 48) return 64
  if (v <= 62) return 56
  if (v <= 75) return 44
  if (v <= 85) return 30
  return 18
}

/** @param {string} key @param {number} raw */
function tacticalMetricInterestScore(key, raw) {
  if (key === "fearGreed") return tacticalFearGreedInterest(raw)
  const panicNorm = normalizePanicV2Metric(key, raw)
  if (key === "ndxDistance" || key === "soxxDistance") {
    return toInterestScore(panicNorm, false)
  }
  if (key === "vix" || key === "vvix" || key === "move") {
    return toInterestScore(panicNorm, true)
  }
  return null
}

/** @param {number} score */
export function resolveTacticalInterestStatus(score) {
  if (score >= 80) return "강한 관심"
  if (score >= 60) return "관심 유지"
  if (score >= 40) return "관망"
  if (score >= 20) return "경계"
  return "위험"
}

/**
 * @param {object | null | undefined} panicData
 * @returns {TacticalTimingSignal | null}
 */
export function computeTacticalTiming(panicData) {
  if (!panicData || typeof panicData !== "object") return null

  const defs = [
    { key: "soxxDistance", label: "SOXX" },
    { key: "ndxDistance", label: "NDX" },
    { key: "vvix", label: "VVIX" },
    { key: "vix", label: "VIX" },
    { key: "move", label: "MOVE" },
    { key: "fearGreed", label: "F&G" },
  ]

  /** @type {{ label: string; key: string; raw: number; score: number }[]} */
  const componentScores = []
  for (const { key, label } of defs) {
    const raw = pickMetricValue(panicData, key)
    if (raw == null) continue
    const score = tacticalMetricInterestScore(key, raw)
    if (score == null) continue
    componentScores.push({ label, key, raw, score })
  }

  if (componentScores.length < 3) return null

  const avgScore =
    componentScores.reduce((sum, c) => sum + c.score, 0) / componentScores.length
  const score = Math.round(avgScore)

  return {
    horizon: "tactical",
    label: "실전",
    score,
    status: resolveTacticalInterestStatus(score),
    metricsUsed: componentScores.map((c) => c.label),
    componentScores,
  }
}

/**
 * @param {object | null | undefined} panicData
 */
export function buildTacticalTimingScoreDebug(panicData) {
  const signal = computeTacticalTiming(panicData)
  return {
    rawTacticalScore: signal?.score ?? null,
    rawWatchScore: signal?.score ?? null,
    engine: "panicTacticalTimingEngine",
    source: {
      metrics: signal?.metricsUsed ?? [],
      components: signal?.componentScores ?? [],
    },
    normalization: "Math.round(avg(componentInterestScores)); VIX/VVIX/MOVE invert V2 panic norm",
    clamp: {
      horizonFinalScore: { applied: false },
      componentScores: { applied: true, formula: "piecewise + invert; result clamped 0–100 per component" },
    },
  }
}
