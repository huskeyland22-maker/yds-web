/** Deterministic timing tone per local value-map.html (no API). */

export function timingSignalForItem(item, sectionLabel) {
  const key = String(item?.code || item?.name || "")
  let score = 0
  for (let i = 0; i < key.length; i++) score += key.charCodeAt(i)
  if (sectionLabel === "수요단") score += 7
  if (sectionLabel === "생산단") score += 3
  const bucket = score % 3
  if (bucket === 0) return { tone: "good", label: "추세강" }
  if (bucket === 1) return { tone: "wait", label: "눌림대기" }
  return { tone: "hot", label: "과열주의" }
}

export function timingBadgeClass(tone) {
  if (tone === "good") return "border-emerald-300/40 bg-emerald-500/12 text-emerald-100"
  if (tone === "hot") return "border-rose-300/40 bg-rose-500/12 text-rose-100"
  return "border-amber-300/40 bg-amber-500/12 text-amber-100"
}
