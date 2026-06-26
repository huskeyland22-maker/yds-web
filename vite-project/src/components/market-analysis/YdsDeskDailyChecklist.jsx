import { useCallback, useEffect, useMemo, useState } from "react"
import {
  buildDeskDailyChecklistReport,
  loadDeskDailyChecklist,
  saveDeskDailyChecklist,
} from "../../content/ydsDeskDailyChecklist.js"
import { localCalendarDateKey } from "../../utils/calendarDateUtils.js"
import YdsDeskCard from "./YdsDeskCard.jsx"

/**
 * @param {{ className?: string }} props
 */
export default function YdsDeskDailyChecklist({ className = "" }) {
  const [state, setState] = useState(() => loadDeskDailyChecklist())

  useEffect(() => {
    const today = localCalendarDateKey()
    if (state.date !== today) {
      const fresh = loadDeskDailyChecklist()
      setState(fresh)
    }
  }, [state.date])

  const report = useMemo(() => buildDeskDailyChecklistReport(state), [state])

  const toggleItem = useCallback((id) => {
    setState((prev) => {
      const today = localCalendarDateKey()
      const base = prev.date === today ? prev : loadDeskDailyChecklist()
      const next = {
        date: today,
        items: { ...base.items, [id]: !base.items[id] },
      }
      saveDeskDailyChecklist(next)
      return next
    })
  }, [])

  if (!report.visible) return null

  return (
    <YdsDeskCard
      title={report.title}
      titleId="desk-daily-checklist-title"
      className={["yds-desk-checklist-card", className].filter(Boolean).join(" ")}
    >
      <ul className="yds-desk-checklist">
        {report.items.map((item) => (
          <li key={item.id} className="yds-desk-checklist__item">
            <label className="yds-desk-checklist__label">
              <input
                type="checkbox"
                className="yds-desk-checklist__input"
                checked={item.checked}
                onChange={() => toggleItem(item.id)}
              />
              <span
                className={[
                  "yds-desk-checklist__box",
                  item.checked ? "yds-desk-checklist__box--checked" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-hidden
              >
                {item.checked ? "☑" : "☐"}
              </span>
              <span
                className={[
                  "yds-desk-checklist__text",
                  item.checked ? "yds-desk-checklist__text--done" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {item.label}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </YdsDeskCard>
  )
}
