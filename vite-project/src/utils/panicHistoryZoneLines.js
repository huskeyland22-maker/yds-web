/**
 * 히스토리 차트 구간선 (극단·중립 밴드)
 */
import { MOOD_SPECTRUM } from "./panicDeskMood.js"

/** @typedef {{ y?: number; y1: number; y2: number; label: string; color: string; area?: boolean }} MetricZoneBand */

/** 구간 배경 — 라인 우선 (기존 0.07 대비 ~80% 감소) */
export const ZONE_BAND_FILL_OPACITY = 0.014

/** @param {string} metricKey @returns {MetricZoneBand[]} */
export function metricZoneBands(metricKey) {
  if (metricKey === "fearGreed") {
    return MOOD_SPECTRUM.map((m, i) => ({
      y1: m.min,
      y2: i === MOOD_SPECTRUM.length - 1 ? 100 : m.max,
      label: m.label,
      color: m.color,
      area: true,
    }))
  }
  if (metricKey === "vix" || metricKey === "vxn") {
    return [
      { y1: 0, y2: 15, label: "극저변동", color: "#38bdf8", area: true },
      { y1: 15, y2: 20, label: "안정", color: "#22c55e", area: true },
      { y1: 20, y2: 30, label: "경계", color: "#f97316", area: true },
      { y1: 30, y2: 80, label: "공포", color: "#ef4444", area: true },
    ]
  }
  if (metricKey === "putCall") {
    return [
      { y1: 0, y2: 0.55, label: "콜과열", color: "#f97316", area: true },
      { y1: 0.55, y2: 0.85, label: "중립", color: "#94a3b8", area: true },
      { y1: 0.85, y2: 1.5, label: "풋쏠림", color: "#ef4444", area: true },
    ]
  }
  if (metricKey === "highYield" || metricKey === "hyOas") {
    return [
      { y1: 0, y2: 3, label: "신용안정", color: "#22c55e", area: true },
      { y1: 3, y2: 5.5, label: "경계", color: "#f97316", area: true },
      { y1: 5.5, y2: 15, label: "스트레스", color: "#ef4444", area: true },
    ]
  }
  if (metricKey === "bofa") {
    return [
      { y1: 0, y2: 2, label: "극도 공포", color: "#ef4444", area: true },
      { y1: 2, y2: 4, label: "공포", color: "#f97316", area: true },
      { y1: 4, y2: 6, label: "중립", color: "#94a3b8", area: true },
      { y1: 6, y2: 8, label: "탐욕", color: "#38bdf8", area: true },
      { y1: 8, y2: 10, label: "극도 탐욕", color: "#a78bfa", area: true },
    ]
  }
  if (metricKey === "move") {
    return [
      { y1: 0, y2: 90, label: "안정", color: "#22c55e", area: true },
      { y1: 90, y2: 110, label: "경계", color: "#f97316", area: true },
      { y1: 110, y2: 250, label: "위험", color: "#ef4444", area: true },
    ]
  }
  if (metricKey === "skew") {
    return [
      { y1: 100, y2: 125, label: "낮음", color: "#22c55e", area: true },
      { y1: 125, y2: 140, label: "보통", color: "#94a3b8", area: true },
      { y1: 140, y2: 180, label: "꼬리위험", color: "#ef4444", area: true },
    ]
  }
  if (metricKey === "gsBullBear") {
    return [
      { y1: 0, y2: 25, label: "극도 약세", color: "#ef4444", area: true },
      { y1: 25, y2: 40, label: "약세", color: "#f97316", area: true },
      { y1: 40, y2: 60, label: "중립", color: "#94a3b8", area: true },
      { y1: 60, y2: 75, label: "강세", color: "#38bdf8", area: true },
      { y1: 75, y2: 100, label: "극도 강세", color: "#a78bfa", area: true },
    ]
  }
  return []
}

/** @param {MetricZoneBand[]} bands */
export function zoneBandMidpoints(bands) {
  return bands.map((b) => ({
    y: (b.y1 + b.y2) / 2,
    label: b.label,
    color: b.color,
  }))
}

/** @param {string} metricKey @returns {number[]} */
export function metricZoneLineYs(metricKey) {
  if (metricKey === "fearGreed") return [20, 40, 60, 80]
  if (metricKey === "vix" || metricKey === "vxn") return [15, 20, 30]
  if (metricKey === "putCall") return [0.55, 0.85]
  if (metricKey === "highYield" || metricKey === "hyOas") return [3, 5.5]
  if (metricKey === "bofa") return [2, 4, 6, 8]
  if (metricKey === "move") return [90, 110]
  if (metricKey === "skew") return [125, 140]
  if (metricKey === "gsBullBear") return [25, 40, 60, 75]
  return []
}
