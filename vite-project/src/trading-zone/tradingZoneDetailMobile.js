/** @type {Record<string, string>} */
export const STAGE_STATUS_SHORT = {
  interest: "관망",
  pullback: "관망",
  trend: "추세유지",
  takeProfit: "익절",
  risk: "방어",
}

/**
 * @param {{ dateLabel?: string }[]} segments
 */
export function formatStagePathDateOnly(segments) {
  if (!Array.isArray(segments) || !segments.length) return "—"
  const dates = segments
    .map((s) => String(s.dateLabel ?? "").trim())
    .filter((d) => d && d !== "—")
  if (!dates.length) return "—"
  return dates.join(" → ")
}
