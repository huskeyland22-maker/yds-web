/**
 * 시장 엔진 히스토리 — 국면/이벤트 날짜 로그
 */

/**
 * @param {{
 *   title: string
 *   entries: { axisLabel: string; primary: string; secondary?: string | null; toneId?: string }[]
 *   emptyText?: string
 * }} props
 */
export default function PanicEngineHistoryLog({ title, entries, emptyText = "기록 없음" }) {
  if (!entries.length) {
    return (
      <div className="panic-engine-log" aria-label={title}>
        <p className="panic-engine-log__title m-0">{title}</p>
        <p className="panic-engine-log__empty m-0">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="panic-engine-log" aria-label={title}>
      <p className="panic-engine-log__title m-0">{title}</p>
      <ul className="panic-engine-log__list m-0 list-none p-0">
        {entries.map((entry) => (
          <li
            key={`${entry.axisLabel}-${entry.primary}`}
            className={["panic-engine-log__item", entry.toneId ? `panic-engine-log__item--${entry.toneId}` : ""].join(
              " ",
            )}
            title={entry.secondary ? `${entry.primary} · ${entry.secondary}` : entry.primary}
          >
            <span className="panic-engine-log__date font-mono tabular-nums">{entry.axisLabel}</span>
            <span className="panic-engine-log__primary">{entry.primary}</span>
            {entry.secondary ? <span className="panic-engine-log__secondary">({entry.secondary})</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
