/**
 * 패닉 API 필드: 숫자(flat) 또는 { value, dataDate?, updatedAt?, sourceStatus?, fallbackUsed? }.
 * @param {unknown} v
 * @returns {number}
 */
export function panicMetricNumber(v) {
  if (v === null || v === undefined || v === "") return NaN
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN
  if (typeof v === "object" && v !== null && "value" in v) {
    const inner = v.value
    if (inner === null || inner === undefined || inner === "") return NaN
    const n = Number(inner)
    return Number.isFinite(n) ? n : NaN
  }
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

/**
 * @param {unknown} v
 * @returns {{ dataDate?: string; updatedAt?: string; sourceStatus?: string; fallbackUsed?: boolean } | null}
 */
export function panicMetricMeta(v) {
  if (!v || typeof v !== "object" || !("value" in v)) return null
  const dataDate = v.dataDate ?? v.lastUpdated ?? undefined
  return {
    dataDate: typeof dataDate === "string" ? dataDate : undefined,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : undefined,
    sourceStatus: typeof v.sourceStatus === "string" ? v.sourceStatus : undefined,
    fallbackUsed: Boolean(v.fallbackUsed),
  }
}

/**
 * @param {unknown} v
 * @returns {string[]}
 */
export function panicMetricFooterLines(v) {
  const meta = panicMetricMeta(v)
  if (!meta) return []
  const lines = []
  if (meta.dataDate) lines.push(`기준일: ${meta.dataDate}`)
  if (meta.updatedAt) lines.push(`업데이트: ${meta.updatedAt}`)
  if (meta.fallbackUsed || meta.sourceStatus === "fallback") {
    lines.push("최신 미수신 · 이전 확정값 유지")
  }
  return lines
}
