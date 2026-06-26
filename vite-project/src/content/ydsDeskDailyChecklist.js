/**
 * 오늘의 체크리스트 — 날짜별 localStorage
 */

import { localCalendarDateKey } from "../utils/calendarDateUtils.js"

const STORAGE_KEY = "yds-desk-daily-checklist-v1"

/** @typedef {'vix' | 'panic' | 'state' | 'picks' | 'events'} DeskChecklistItemId */

/**
 * @typedef {{
 *   id: DeskChecklistItemId
 *   label: string
 *   checked: boolean
 * }} DeskChecklistItem
 */

export const DESK_CHECKLIST_DEFS = /** @type {ReadonlyArray<{ id: DeskChecklistItemId; label: string }>} */ ([
  { id: "vix", label: "VIX 확인" },
  { id: "panic", label: "패닉 점수 변화" },
  { id: "state", label: "시장 상태 변화" },
  { id: "picks", label: "추천 종목 변동" },
  { id: "events", label: "주요 경제 이벤트 확인" },
])

/**
 * @typedef {{
 *   date: string
 *   items: Record<DeskChecklistItemId, boolean>
 * }} DeskChecklistState
 */

/** @returns {DeskChecklistState} */
function emptyState(date = localCalendarDateKey()) {
  return {
    date,
    items: {
      vix: false,
      panic: false,
      state: false,
      picks: false,
      events: false,
    },
  }
}

/** @returns {DeskChecklistState} */
export function loadDeskDailyChecklist() {
  const today = localCalendarDateKey()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState(today)
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return emptyState(today)
    if (parsed.date !== today) return emptyState(today)
    const base = emptyState(today)
    for (const def of DESK_CHECKLIST_DEFS) {
      base.items[def.id] = Boolean(parsed.items?.[def.id])
    }
    return base
  } catch {
    return emptyState(today)
  }
}

/** @param {DeskChecklistState} state */
export function saveDeskDailyChecklist(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota */
  }
}

/** @param {DeskChecklistState} state @returns {DeskChecklistItem[]} */
export function deskChecklistItems(state) {
  return DESK_CHECKLIST_DEFS.map((def) => ({
    id: def.id,
    label: def.label,
    checked: Boolean(state.items[def.id]),
  }))
}

/**
 * @typedef {{
 *   visible: boolean
 *   title: string
 *   dateLabel: string
 *   items: DeskChecklistItem[]
 * }} DeskDailyChecklistReport
 */

/** @param {DeskChecklistState} state */
export function buildDeskDailyChecklistReport(state) {
  const today = localCalendarDateKey()
  return {
    visible: true,
    title: "오늘 체크",
    dateLabel: today,
    items: deskChecklistItems(state.date === today ? state : emptyState(today)),
  }
}
