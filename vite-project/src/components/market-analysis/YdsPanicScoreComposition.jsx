import { useMemo } from "react"
import { buildPanicScoreCompositionReport } from "../../content/ydsPanicScoreComposition.js"

/** @param {string | null} iso */
function formatUpdatedAt(iso) {
  if (!iso) return null
  const raw = String(iso)
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(`${raw.slice(0, 10)}T12:00:00`)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    }
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * @param {{ panicData?: object | null; className?: string }} props
 */
export default function YdsPanicScoreComposition({ panicData = null, className = "" }) {
  const report = useMemo(() => buildPanicScoreCompositionReport(panicData), [panicData])

  if (!report.visible) return null

  const updatedLabel = formatUpdatedAt(report.updatedAt)

  return (
    <section
      className={["yds-panic-composition", className].filter(Boolean).join(" ")}
      aria-label="패닉 점수 구성"
    >
      <p className="yds-panic-composition__title">패닉 점수 구성</p>
      <ul className="yds-panic-composition__list">
        {report.lines.map((line) => (
          <li key={line.id} className="yds-panic-composition__row">
            <span className="yds-panic-composition__label">{line.label}</span>
            <span
              className={[
                "yds-panic-composition__value",
                "font-mono",
                "tabular-nums",
                line.missing ? "yds-panic-composition__value--missing" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {line.display}
            </span>
          </li>
        ))}
      </ul>
      <div className="yds-panic-composition__divider" aria-hidden />
      <div className="yds-panic-composition__total">
        <span className="yds-panic-composition__total-label">총점</span>
        <strong className="yds-panic-composition__total-value font-mono tabular-nums">
          {report.totalScore}
        </strong>
      </div>
      {updatedLabel ? (
        <p className="yds-panic-composition__updated">마지막 업데이트 {updatedLabel}</p>
      ) : null}
    </section>
  )
}
