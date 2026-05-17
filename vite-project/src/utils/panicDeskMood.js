/**
 * Fear & Greed 기반 시장 심리 스펙트럼 (대시보드 최상단).
 */

export const MOOD_SPECTRUM = [
  { id: "extreme_fear", label: "극도 공포", min: 0, max: 20, color: "#ef4444" },
  { id: "fear", label: "공포", min: 20, max: 40, color: "#f97316" },
  { id: "neutral", label: "중립", min: 40, max: 60, color: "#94a3b8" },
  { id: "greed", label: "과열", min: 60, max: 80, color: "#38bdf8" },
  { id: "extreme_greed", label: "극도 과열", min: 80, max: 100, color: "#a78bfa" },
]

/**
 * @param {number | null | undefined} fearGreed 0–100
 */
export function resolveMarketMood(fearGreed) {
  const fg = Number(fearGreed)
  if (!Number.isFinite(fg)) {
    return { ...MOOD_SPECTRUM[2], active: false, value: null, index: 2 }
  }
  const clamped = Math.min(100, Math.max(0, fg))
  const idx = MOOD_SPECTRUM.findIndex((m) => clamped >= m.min && clamped < m.max)
  const index = idx >= 0 ? idx : clamped >= 100 ? MOOD_SPECTRUM.length - 1 : 0
  return { ...MOOD_SPECTRUM[index], active: true, value: clamped, index }
}

/** @param {number} index 0..4 */
export function moodPositionPct(fearGreed) {
  const fg = Number(fearGreed)
  if (!Number.isFinite(fg)) return 50
  return Math.min(100, Math.max(0, fg))
}
