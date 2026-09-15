import { useMemo } from "react"
import { buildPanicScoreCompositionReport } from "../../content/ydsPanicScoreComposition.js"

/**
 * @param {{ panicData?: object | null; className?: string }} props
 */
export default function YdsPanicScoreComposition({ panicData = null, className = "" }) {
  const report = useMemo(() => buildPanicScoreCompositionReport(panicData), [panicData])

  if (!report.visible) return null

  return (
    <section
      className={["yds-panic-composition", className].filter(Boolean).join(" ")}
      aria-label="Panic Index 계산 근거"
    >
      <p className="yds-panic-composition__title">계산 근거</p>
      <ul className="yds-panic-composition__list">
        {report.lines.map((line) => (
          <li key={line.id} className="yds-panic-composition__row">
            <span className="yds-panic-composition__label">
              {line.label}
              {line.source ? (
                <span className="yds-panic-composition__source"> · {line.source}</span>
              ) : null}
            </span>
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
        <span className="yds-panic-composition__total-label">Panic Index</span>
        <strong className="yds-panic-composition__total-value font-mono tabular-nums">
          {report.totalScore != null ? report.totalScore : "—"}
        </strong>
      </div>
      {report.incomplete ? (
        <p className="yds-panic-composition__incomplete">
          일부 지표 데이터가 없어 Panic Index를 계산할 수 없습니다.
        </p>
      ) : null}
      {report.asOfDate ? (
        <p className="yds-panic-composition__updated">기준일: {report.asOfDate}</p>
      ) : null}
    </section>
  )
}
