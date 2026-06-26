/**
 * 패닉 점수 구성 — getFinalScore 경로 기여도 (데스크 카드)
 */

import { getFinalScore } from "../utils/tradingScores.js"
import { buildYdsScoreBreakdown } from "../trading-zone/ydsScoreBreakdown.js"

/** @typedef {{ id: string; label: string; inputKey: string; contribKey: string }} PanicMetricRowDef */

export const PANIC_COMPOSITION_ROWS = /** @type {PanicMetricRowDef[]} */ ([
  { id: "vix", label: "VIX", inputKey: "vix", contribKey: "vix" },
  { id: "cnn", label: "CNN 공포탐욕", inputKey: "fearGreed", contribKey: "cnn" },
  { id: "bofa", label: "BofA Bull & Bear", inputKey: "bofa", contribKey: "bofa" },
  { id: "putCall", label: "Put/Call", inputKey: "putCall", contribKey: "putCall" },
  { id: "hy", label: "HY Spread", inputKey: "highYield", contribKey: "highYield" },
])

/**
 * @typedef {{
 *   id: string
 *   label: string
 *   value: number | null
 *   display: string
 *   missing: boolean
 * }} PanicCompositionLine
 */

/**
 * @typedef {{
 *   visible: boolean
 *   totalScore: number | null
 *   lines: PanicCompositionLine[]
 *   updatedAt: string | null
 * }} PanicScoreCompositionReport
 */

/** @param {unknown} v */
function hasMetricValue(v) {
  if (v == null || v === "") return false
  const n = Number(v)
  return Number.isFinite(n)
}

/**
 * @param {object | null | undefined} panicData
 * @returns {PanicScoreCompositionReport}
 */
export function buildPanicScoreCompositionReport(panicData) {
  if (!panicData) {
    return { visible: false, totalScore: null, lines: [], updatedAt: null }
  }

  const breakdown = buildYdsScoreBreakdown({
    vix: panicData.vix,
    cnn: panicData.fearGreed,
    bofa: panicData.bofa,
    putCall: panicData.putCall,
    highYield: panicData.highYield,
  })

  const totalRaw = getFinalScore(panicData)
  const totalScore = Number.isFinite(totalRaw) ? Math.round(totalRaw) : null

  /** @type {PanicCompositionLine[]} */
  const lines = PANIC_COMPOSITION_ROWS.map((row) => {
    const raw = panicData[row.inputKey]
    if (!hasMetricValue(raw)) {
      return { id: row.id, label: row.label, value: null, display: "데이터 없음", missing: true }
    }
    const contrib = breakdown.contributions?.[row.contribKey]
    const value = Number.isFinite(contrib) ? Math.round(contrib) : null
    return {
      id: row.id,
      label: row.label,
      value,
      display: value != null ? `+${value}` : "데이터 없음",
      missing: value == null,
    }
  })

  const updatedAt =
    panicData.updatedAt ??
    panicData.date ??
    (panicData.__syncedAt ? String(panicData.__syncedAt) : null)

  return {
    visible: totalScore != null,
    totalScore,
    lines,
    updatedAt: updatedAt ? String(updatedAt) : null,
  }
}
