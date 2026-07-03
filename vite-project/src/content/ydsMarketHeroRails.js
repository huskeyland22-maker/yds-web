/**
 * 시장분석 상단 카드 — 가로 단계 레일 표시 전용 (내부 band/stage ID 유지)
 */

/** @type {Array<{ id: string; emoji: string; label: string; color: string }>} */
export const PANIC_HERO_RAIL_STAGES = [
  { id: "noFear", emoji: "🔵", label: "공포 부족", color: "#3b82f6" },
  { id: "lowFear", emoji: "🟢", label: "약한 공포", color: "#22c55e" },
  { id: "interest", emoji: "🟡", label: "중립", color: "#eab308" },
  { id: "dca", emoji: "🟠", label: "높은 공포", color: "#f97316" },
  { id: "lifePoint", emoji: "🔴", label: "극심한 공포", color: "#ef4444" },
]
