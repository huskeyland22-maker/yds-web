const STALE_AFTER_MS = Number(process.env.PANIC_STALE_AFTER_MS) || 6 * 60 * 60 * 1000

export function computePanicServeMeta(rows, data) {
  const times = (Array.isArray(rows) ? rows : [])
    .map((r) => Date.parse(String(r.updated_at || "")))
    .filter((n) => Number.isFinite(n))
  const maxTs = times.length ? Math.max(...times) : null
  const updatedAt = data?.updatedAt || (maxTs ? new Date(maxTs).toISOString() : null)
  const ageMs = updatedAt ? Math.max(0, Date.now() - Date.parse(updatedAt)) : null
  const sources = [...new Set((rows || []).map((r) => r.source).filter(Boolean))]
  return {
    updatedAt,
    ageMs,
    isStale: ageMs != null ? ageMs > STALE_AFTER_MS : true,
    rowCount: Array.isArray(rows) ? rows.length : 0,
    sources,
    staleAfterMs: STALE_AFTER_MS,
  }
}
