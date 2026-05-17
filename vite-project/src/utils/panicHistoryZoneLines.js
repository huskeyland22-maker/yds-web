/**
 * 히스토리 차트 구간선 (극단·중립 밴드)
 */
import { MOOD_SPECTRUM } from "./panicDeskMood.js"

/** @typedef {{ y?: number; y1: number; y2: number; label: string; color: string; area?: boolean }} MetricZoneBand */

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
  if (metricKey === "vix") {
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
  if (metricKey === "highYield") {
    return [
      { y1: 0, y2: 3, label: "신용안정", color: "#22c55e", area: true },
      { y1: 3, y2: 5.5, label: "경계", color: "#f97316", area: true },
      { y1: 5.5, y2: 15, label: "스트레스", color: "#ef4444", area: true },
    ]
  }
  return []
}

/** @param {string} metricKey @returns {number[]} */
export function metricZoneLineYs(metricKey) {
  if (metricKey === "fearGreed") return [20, 40, 60, 80]
  if (metricKey === "vix") return [15, 20, 30]
  if (metricKey === "putCall") return [0.55, 0.85]
  if (metricKey === "highYield") return [3, 5.5]
  return []
}
