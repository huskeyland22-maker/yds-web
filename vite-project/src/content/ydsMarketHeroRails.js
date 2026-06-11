/**
 * 시장분석 상단 카드 — 가로 단계 레일 표시 전용 (내부 band/stage ID 유지)
 */

/** @type {Array<{ id: string; emoji: string; label: string; color: string }>} */
export const PANIC_HERO_RAIL_STAGES = [
  { id: "noFear", emoji: "⚪", label: "관망", color: "#e2e8f0" },
  { id: "lowFear", emoji: "🟢", label: "관심", color: "#22c55e" },
  { id: "interest", emoji: "🟡", label: "준비", color: "#eab308" },
  { id: "dca", emoji: "🟠", label: "분할진입", color: "#f97316" },
  { id: "lifePoint", emoji: "🔴", label: "적극매수", color: "#ef4444" },
]
