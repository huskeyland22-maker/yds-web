const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/** @returns {string} YYYY-MM-DD in Asia/Seoul */
export function kstCalendarKey(date = new Date()) {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })
}

function kstDateTimeParts(updatedAt) {
  if (updatedAt == null) return null
  const d = new Date(updatedAt)
  if (Number.isNaN(d.getTime())) return null
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  return Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]))
}

/**
 * @param {string | number | Date | null | undefined} updatedAt
 * @returns {string | null} e.g. "2026.05.16 15:37 KST"
 */
export function formatDataBasisKst(updatedAt) {
  const parts = kstDateTimeParts(updatedAt)
  if (!parts) return null
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute} KST`
}

/**
 * @param {string | number | Date | null | undefined} updatedAt
 * @returns {string | null} e.g. "2026.05.16 · 21:00 KST"
 */
export function formatDataBasisKstLine(updatedAt) {
  const parts = kstDateTimeParts(updatedAt)
  if (!parts) return null
  return `${parts.year}.${parts.month}.${parts.day} · ${parts.hour}:${parts.minute} KST`
}

/**
 * @param {number | null | undefined} ageMs
 * @returns {string | null} e.g. "21시간 전", "2일 전"
 */
export function formatAgeKo(ageMs) {
  if (ageMs == null || !Number.isFinite(ageMs) || ageMs < 0) return null
  const min = Math.floor(ageMs / (60 * 1000))
  if (min < 1) return "방금 전"
  const hr = Math.floor(ageMs / HOUR_MS)
  if (hr < 1) return `${min}분 전`
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  return `${day}일 전`
}

/**
 * @param {number | null | undefined} ageMs
 * @returns {string | null} e.g. "17h old", "2d old"
 */
export function formatAgeOldEn(ageMs) {
  if (ageMs == null || !Number.isFinite(ageMs) || ageMs < 0) return null
  const hr = Math.floor(ageMs / HOUR_MS)
  if (hr < 24) return `${Math.max(1, hr)}h old`
  const day = Math.floor(hr / 24)
  return `${day}d old`
}

/** @deprecated use formatAgeOldEn */
export function formatRelativeAgeEn(ageMs) {
  return formatAgeOldEn(ageMs)?.replace(" old", " ago") ?? null
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

/**
 * Stale display tier for UI coloring.
 * @param {number | null | undefined} ageMs
 * @returns {"hidden"|"fresh"|"aging"|"warn"|"critical"}
 */
export function staleDisplayTier(ageMs) {
  if (ageMs == null || !Number.isFinite(ageMs) || ageMs < 4 * HOUR_MS) return "hidden"
  if (ageMs >= 2 * DAY_MS) return "critical"
  if (ageMs >= DAY_MS) return "warn"
  return "aging"
}

/** @param {"hidden"|"fresh"|"aging"|"warn"|"critical"} tier */
export function staleAgeAccentClassName(tier) {
  switch (tier) {
    case "critical":
      return "text-rose-300"
    case "warn":
      return "text-orange-300"
    case "aging":
      return "text-amber-200/90"
    default:
      return "text-cyan-400"
  }
}

/** @param {"hidden"|"fresh"|"aging"|"warn"|"critical"} tier */
export function staleTierClassName(tier) {
  switch (tier) {
    case "critical":
      return "border-rose-500/40 bg-rose-500/10 text-rose-200/95"
    case "warn":
      return "border-orange-500/40 bg-orange-500/10 text-orange-200/95"
    case "aging":
      return "border-amber-500/30 bg-amber-500/[0.07] text-amber-200/85"
    default:
      return "border-white/10 bg-white/[0.03] text-slate-400"
  }
}
