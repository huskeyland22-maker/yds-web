/**
 * 경제 캘린더 — 발표일(YYYY-MM-DD) 그대로 표시 · 로컬 달력 연산
 * UTC toISOString()으로 날짜를 바꾸지 않음
 */

/** @param {Date} [d] */
export function localCalendarDateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * @param {string} dateKey YYYY-MM-DD
 * @param {number} days
 */
export function addCalendarDaysLocal(dateKey, days) {
  const d = parseCalendarDateKey(dateKey)
  if (!d) return dateKey
  d.setDate(d.getDate() + days)
  return localCalendarDateKey(d)
}

/**
 * @param {string} dateKey
 * @returns {Date | null}
 */
export function parseCalendarDateKey(dateKey) {
  const key = String(dateKey ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null
  const d = new Date(`${key}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * @param {string} dateKey YYYY-MM-DD
 * @returns {string} MM/DD
 */
export function formatCalendarMonthDay(dateKey) {
  const key = String(dateKey ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return key
  return `${key.slice(5, 7)}/${key.slice(8, 10)}`
}

/**
 * @param {string} dateKey
 * @param {string} [locale]
 */
export function formatCalendarWeekdayShort(dateKey, locale = "ko-KR") {
  const d = parseCalendarDateKey(dateKey)
  if (!d) return ""
  return d.toLocaleDateString(locale, { weekday: "short" })
}
