/**
 * @param {number | null | undefined} ageMs
 * @returns {string | null} e.g. "3h ago", "1d ago"
 */
export function formatRelativeAgeEn(ageMs) {
  if (ageMs == null || !Number.isFinite(ageMs) || ageMs < 0) return null
  const sec = Math.floor(ageMs / 1000)
  if (sec < 45) return "now"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  const week = Math.floor(day / 7)
  return `${week}w ago`
}

/**
 * @param {string | number | Date | null | undefined} updatedAt
 * @param {number} [nowMs]
 * @returns {number | null}
 */
export function ageMsFromUpdatedAt(updatedAt, nowMs = Date.now()) {
  if (updatedAt == null) return null
  const t = new Date(updatedAt).getTime()
  if (!Number.isFinite(t)) return null
  return Math.max(0, nowMs - t)
}
