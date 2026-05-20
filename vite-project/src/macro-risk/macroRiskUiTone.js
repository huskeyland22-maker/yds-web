/**
 * Macro Risk OS — score band → text / Tailwind utility classes (0–30 green … 80+ red).
 */

/** @param {number} score */
export function scoreBandLabel(score) {
  const s = Number(score)
  if (!Number.isFinite(s)) return "데이터 대기"
  if (s < 30) return "안정권"
  if (s < 60) return "주의권"
  if (s < 80) return "경계권"
  return "위험 상단"
}

/** @param {number} score */
export function scoreTextClass(score) {
  const s = Number(score)
  if (!Number.isFinite(s)) return "text-slate-400"
  if (s < 30) return "text-emerald-300"
  if (s < 60) return "text-amber-200"
  if (s < 80) return "text-orange-300"
  return "text-rose-300"
}

/** @param {number} score */
export function scoreBarClass(score) {
  const s = Number(score)
  if (!Number.isFinite(s)) return "from-slate-600 to-slate-500"
  if (s < 30) return "from-emerald-600 to-emerald-400"
  if (s < 60) return "from-amber-700 to-amber-400"
  if (s < 80) return "from-orange-700 to-orange-400"
  return "from-rose-700 to-rose-400"
}

/** @param {number} score */
export function scoreRingClass(score) {
  const s = Number(score)
  if (!Number.isFinite(s)) return "text-slate-500"
  if (s < 30) return "text-emerald-400"
  if (s < 60) return "text-amber-300"
  if (s < 80) return "text-orange-400"
  return "text-rose-400"
}
