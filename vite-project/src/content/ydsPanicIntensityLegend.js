/**
 * Panic Index UI 범례/차트 구간 — PANIC_INDEX_STAGE_BANDS 단일 소스 어댑터
 * (구 Greed Scale 제거 · 구간/라벨 중복 정의 금지)
 */

import {
  PANIC_INDEX_STAGE_BANDS,
  resolvePanicIndexStatus,
} from "../utils/tradingScores.js"

/**
 * @typedef {{
 *   id: string
 *   index: number
 *   label: string
 *   shortLabel: string
 *   emoji: string
 *   min: number
 *   max: number
 *   color: string
 *   rangeLabel: string
 *   tooltipTitle: string
 *   tooltipText: string
 *   score: number
 * }} PanicIntensityLegendView
 */

/** @type {Array<{
 *   id: string
 *   label: string
 *   shortLabel: string
 *   emoji: string
 *   min: number
 *   max: number
 *   color: string
 *   tooltipText: string
 * }>} */
export const PANIC_INTENSITY_LEGEND_STAGES = PANIC_INDEX_STAGE_BANDS.map((band) => ({
  id: band.id,
  label: band.label,
  shortLabel: band.label,
  emoji: "",
  min: band.min,
  max: band.max,
  color: band.color,
  tooltipText: band.blurb ?? "",
}))

/** @param {number} score */
export function resolvePanicIntensityLegendIndex(score) {
  const status = resolvePanicIndexStatus(score)
  if (!status) return -1
  return PANIC_INDEX_STAGE_BANDS.findIndex((band) => band.id === status.id)
}

/** @returns {typeof PANIC_INTENSITY_LEGEND_STAGES} */
export function panicIntensityLegendStages() {
  return PANIC_INTENSITY_LEGEND_STAGES
}

/**
 * Recharts ReferenceArea용 연속 구간 (0–20 / 20–40 / … / 80–100)
 * 단계 라벨·색은 PANIC_INDEX_STAGE_BANDS와 동일
 * @returns {Array<{ min: number; max: number; color: string; label: string }>}
 */
export function panicIntensityLegendZoneSteps() {
  return PANIC_INDEX_STAGE_BANDS.map((band) => ({
    min: band.min,
    max: band.max === 100 ? 100 : band.max + 1,
    color: band.color,
    label: band.label,
  }))
}

/**
 * @param {number | null | undefined} score
 * @returns {PanicIntensityLegendView | null}
 */
export function buildPanicIntensityLegendView(score) {
  if (score == null || !Number.isFinite(Number(score))) return null
  const rounded = Math.max(0, Math.min(100, Math.round(Number(score))))
  const status = resolvePanicIndexStatus(rounded)
  if (!status) return null
  const index = PANIC_INDEX_STAGE_BANDS.findIndex((band) => band.id === status.id)
  return {
    id: status.id,
    index: index < 0 ? 0 : index,
    label: status.label,
    shortLabel: status.label,
    emoji: "",
    min: status.min,
    max: status.max,
    color: status.color,
    rangeLabel: `${status.min}–${status.max}`,
    tooltipTitle: `${status.label} (${status.min}–${status.max})`,
    tooltipText: status.blurb ?? "",
    score: rounded,
  }
}

/**
 * @param {number | null | undefined} score
 * @returns {string | null}
 */
export function formatPanicIntensityLegendLabel(score) {
  const view = buildPanicIntensityLegendView(score)
  if (!view) return null
  return view.label
}
