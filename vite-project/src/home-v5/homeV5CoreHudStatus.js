import { getStatus } from "../utils/panicIndicatorStatus.js"

/** @param {"fearGreed" | "vix" | "bofa"} key @param {unknown} value */
export function resolveCoreHudStatusLabel(key, value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return "—"

  if (key === "fearGreed") {
    if (n >= 75) return "과열"
    if (n >= 60) return "탐욕"
    if (n <= 25) return "공포"
    if (n <= 40) return "경계"
    return "관망"
  }

  if (key === "vix") {
    const label = getStatus("vix", n).label
    if (label === "안정") return "정상"
    return label === "-" ? "—" : label
  }

  if (key === "bofa") {
    const label = getStatus("bofa", n).label
    if (label === "정상") return "중립"
    if (label === "경계") return "과열 경계"
    return label === "-" ? "—" : label
  }

  return "—"
}
