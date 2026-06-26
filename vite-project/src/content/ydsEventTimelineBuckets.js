/**
 * 이벤트 — 오늘 / 내일 / 이번주 / 이번달 타임라인 버킷
 */

import {
  addCalendarDaysLocal,
  localCalendarDateKey,
  parseCalendarDateKey,
} from "../utils/calendarDateUtils.js"

/**
 * @param {string} dateKey YYYY-MM-DD
 */
function endOfCalendarWeek(dateKey) {
  const d = parseCalendarDateKey(dateKey)
  if (!d) return dateKey
  const day = d.getDay()
  const daysUntilSunday = day === 0 ? 0 : 7 - day
  return addCalendarDaysLocal(dateKey, daysUntilSunday)
}

/**
 * @param {string} dateKey YYYY-MM-DD
 */
function endOfCalendarMonth(dateKey) {
  const d = parseCalendarDateKey(dateKey)
  if (!d) return dateKey
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0)
  return localCalendarDateKey(last)
}

/**
 * @typedef {{
 *   id: 'today' | 'tomorrow' | 'week' | 'month'
 *   label: string
 *   items: Array<Record<string, unknown>>
 * }} EventTimelineBucket
 */

/**
 * @param {Array<{ date: string } & Record<string, unknown>>} flatItems
 * @param {Date} [refDate]
 * @returns {EventTimelineBucket[]}
 */
export function bucketEventsByTimeline(flatItems, refDate = new Date()) {
  const today = localCalendarDateKey(refDate)
  const tomorrow = addCalendarDaysLocal(today, 1)
  const weekEnd = endOfCalendarWeek(today)
  const monthEnd = endOfCalendarMonth(today)

  /** @type {EventTimelineBucket[]} */
  const buckets = [
    { id: "today", label: "오늘", items: [] },
    { id: "tomorrow", label: "내일", items: [] },
    { id: "week", label: "이번주", items: [] },
    { id: "month", label: "이번달", items: [] },
  ]

  const sorted = [...flatItems].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  )

  for (const event of sorted) {
    const d = String(event.date ?? "").slice(0, 10)
    if (!d || d < today) continue

    if (d === today) {
      buckets[0].items.push(event)
    } else if (d === tomorrow) {
      buckets[1].items.push(event)
    } else if (d <= weekEnd) {
      buckets[2].items.push(event)
    } else if (d <= monthEnd) {
      buckets[3].items.push(event)
    }
  }

  return buckets.filter((bucket) => bucket.items.length > 0)
}
