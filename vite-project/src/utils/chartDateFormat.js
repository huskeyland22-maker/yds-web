/**
 * lightweight-charts · 패닉 데스크 차트 공통 날짜 포맷 (ko locale 비사용 — MM/DD·YYYY.MM.DD 고정).
 */

/** @param {string | null | undefined} dayKey */
function partsFromDayKey(dayKey) {
  if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null
  const [year, month, day] = dayKey.split("-").map((x) => Number(x))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return { year, month, day }
}

/**
 * @param {unknown} time lightweight-charts Time (YYYY-MM-DD | BusinessDay | unix)
 * @returns {string | null}
 */
export function chartTimeToDayKey(time) {
  if (time == null) return null
  if (typeof time === "string") {
    return /^\d{4}-\d{2}-\d{2}$/.test(time) ? time : null
  }
  if (typeof time === "number") {
    const d = new Date(time * 1000)
    if (Number.isNaN(d.getTime())) return null
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }
  if (typeof time === "object" && "year" in time && "month" in time && "day" in time) {
    const { year, month, day } = time
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }
  return null
}

/** @param {string | null | undefined} dayKey */
export function formatChartTooltip(dayKey) {
  const p = partsFromDayKey(dayKey)
  if (!p) return dayKey ?? "—"
  const mm = String(p.month).padStart(2, "0")
  const dd = String(p.day).padStart(2, "0")
  return `${p.year}.${mm}.${dd}`
}

/** @param {string | null | undefined} dayKey */
export function formatChartAxisMd(dayKey) {
  const p = partsFromDayKey(dayKey)
  if (!p) return ""
  return `${String(p.month).padStart(2, "0")}/${String(p.day).padStart(2, "0")}`
}

/** @param {string | null | undefined} dayKey */
export function formatChartAxisYmd(dayKey) {
  const p = partsFromDayKey(dayKey)
  if (!p) return ""
  const mm = String(p.month).padStart(2, "0")
  const dd = String(p.day).padStart(2, "0")
  return `${p.year}.${mm}.${dd}`
}

/**
 * x축 tick — 모바일·compact MM/DD, 넓은 데스크톱 YYYY.MM.DD.
 * @param {string | null | undefined} dayKey
 * @param {{ mobile?: boolean; compact?: boolean }} [opts]
 */
export function formatChartAxisTick(dayKey, opts = {}) {
  if (!dayKey) return ""
  if (opts.mobile || opts.compact) return formatChartAxisMd(dayKey)
  return formatChartAxisYmd(dayKey)
}

/** @param {string} yyyymmdd */
export function yyyymmddToDayKey(yyyymmdd) {
  const s = String(yyyymmdd ?? "")
  if (!/^\d{8}$/.test(s)) return null
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}
