/**
 * Panic Index V2 구성 — VIX / CNN / Cboe Total P/C
 */

import { buildPanicScoreV2Breakdown, getPanicScoreV2 } from "../utils/tradingScores.js"

/**
 * @typedef {{
 *   id: string
 *   label: string
 *   value: number | null
 *   display: string
 *   missing: boolean
 *   source?: string
 *   rawValue?: number | null
 *   score?: number | null
 * }} PanicCompositionLine
 */

/**
 * @typedef {{
 *   visible: boolean
 *   incomplete: boolean
 *   totalScore: number | null
 *   lines: PanicCompositionLine[]
 *   updatedAt: string | null
 *   asOfDate: string | null
 * }} PanicScoreCompositionReport
 */

/** @param {unknown} v */
function hasMetricValue(v) {
  if (v == null || v === "") return false
  const n = Number(v)
  return Number.isFinite(n)
}

/** @param {unknown} v */
function formatRaw(v) {
  if (!hasMetricValue(v)) return "—"
  const n = Number(v)
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 100) / 100)
}

/**
 * @param {object | null | undefined} panicData
 * @returns {PanicScoreCompositionReport}
 */
export function buildPanicScoreCompositionReport(panicData) {
  if (!panicData) {
    return {
      visible: false,
      incomplete: true,
      totalScore: null,
      lines: [],
      updatedAt: null,
      asOfDate: null,
    }
  }

  const breakdown = buildPanicScoreV2Breakdown(panicData)
  const totalScore = getPanicScoreV2(panicData)

  /** @type {PanicCompositionLine[]} */
  const lines = (breakdown?.lines ?? []).map((line) => {
    const missing = line.value == null || line.score == null
    return {
      id: line.id,
      label: line.label,
      value: line.score,
      rawValue: line.value,
      score: line.score,
      source: line.source,
      display: missing
        ? "데이터 없음"
        : `${formatRaw(line.value)} · Score ${Math.round(line.score)}`,
      missing,
    }
  })

  const updatedAt =
    panicData.updatedAt ??
    panicData.date ??
    (panicData.__syncedAt ? String(panicData.__syncedAt) : null)

  const asOfRaw = panicData.date ?? panicData.asOfDate ?? panicData.updatedAt ?? null
  const asOfDate =
    asOfRaw && /^\d{4}-\d{2}-\d{2}/.test(String(asOfRaw))
      ? String(asOfRaw).slice(0, 10)
      : null

  const incomplete = totalScore == null

  return {
    visible: true,
    incomplete,
    totalScore,
    lines,
    updatedAt: updatedAt ? String(updatedAt) : null,
    asOfDate,
  }
}
