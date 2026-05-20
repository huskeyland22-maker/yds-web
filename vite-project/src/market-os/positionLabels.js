/**
 * Cycle / Macro 점수 → 위치·진행률 (Market OS 통합·Position 카드 공용)
 */

/** @param {number|null|undefined} score */
export function resolveCyclePosition(score) {
  if (!Number.isFinite(Number(score)))
    return { position: "데이터 대기", phaseLine: "—", emoji: "⚪" }
  const s = Number(score)
  if (s <= 15) return { position: "극단 공포", phaseLine: "극단 공포", emoji: "🟢🟢🟢" }
  if (s <= 30) return { position: s >= 22 ? "공포 후반" : "공포", phaseLine: "공포 후반", emoji: "🟢" }
  if (s <= 45) return { position: "중립", phaseLine: "중립 전환", emoji: "🟡" }
  if (s <= 60) return { position: "과열", phaseLine: "과열", emoji: "🟠" }
  return { position: "극단 과열", phaseLine: "극단 과열", emoji: "🔴" }
}

/** @param {number|null|undefined} score */
export function resolveMacroPosition(score) {
  if (!Number.isFinite(Number(score)))
    return { position: "데이터 대기", phaseLine: "—", emoji: "⚪" }
  const s = Number(score)
  if (s <= 20) return { position: "유동성 우호", phaseLine: "유동성 우호", emoji: "🟢" }
  if (s <= 40) return { position: "중립", phaseLine: "중립", emoji: "🟡" }
  if (s <= 60) return { position: "압박", phaseLine: "압박", emoji: "🟠" }
  if (s <= 80) return { position: "위험", phaseLine: "위험", emoji: "🔴" }
  return { position: "금리 재평가", phaseLine: "금리 재평가", emoji: "🔴🔴" }
}

/** 공포 → 중립(30) 진행률 */
/** @param {number|null|undefined} cycleScore */
export function fearProgressPct(cycleScore) {
  if (!Number.isFinite(Number(cycleScore))) return null
  const s = Number(cycleScore)
  return s <= 30 ? Math.round((s / 30) * 100) : 100
}

/** 위험 구간(60~) 진행률 */
/**
 * @typedef {{ score: number|null; pct: number|null; variant: "cycle"|"macro" }} PositionMapSlot
 */

/** @param {number|null|undefined} macroScore */
export function dangerProgressPct(macroScore) {
  if (!Number.isFinite(Number(macroScore))) return null
  const s = Number(macroScore)
  return Math.round(Math.min(100, Math.max(0, ((s - 60) / 40) * 100)))
}
