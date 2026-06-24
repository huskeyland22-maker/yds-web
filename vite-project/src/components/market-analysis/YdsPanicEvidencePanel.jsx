import { useMemo } from "react"
import { buildPanicEvidenceReport } from "../../content/ydsPanicEvidenceEngine.js"
import { buildPanicIntensityInterpretation } from "../../content/ydsPanicIntensityInterpretation.js"
import { getFinalScore } from "../../utils/tradingScores.js"

/**
 * @param {{
 *   panicData?: object | null
 *   className?: string
 * }} props
 */
export default function YdsPanicEvidencePanel({ panicData = null, className = "" }) {
  const report = useMemo(() => buildPanicEvidenceReport(panicData), [panicData])
  const score = useMemo(() => {
    if (!panicData) return null
    const s = getFinalScore(panicData)
    return Number.isFinite(s) ? Math.round(s) : null
  }, [panicData])
  const interpretation = useMemo(
    () => (score != null ? buildPanicIntensityInterpretation(score) : null),
    [score],
  )

  if (!report.hasData) return null

  return (
    <details
      className={["yds-panic-evidence", className].filter(Boolean).join(" ")}
      aria-label="패닉 근거"
    >
      <summary className="yds-panic-evidence__summary">
        <span className="yds-panic-evidence__summary-title">패닉 근거</span>
        {score != null && interpretation ? (
          <span className="yds-panic-evidence__summary-meta font-mono tabular-nums">
            {score} · {interpretation.label}
          </span>
        ) : null}
      </summary>

      <dl className="yds-panic-evidence__list">
        {report.metrics.map((metric) => (
          <div key={metric.id} className="yds-panic-evidence__row">
            <dt className="yds-panic-evidence__key">{metric.label}</dt>
            <dd className="yds-panic-evidence__val font-mono tabular-nums">{metric.value}</dd>
            <dd className="yds-panic-evidence__brief">{metric.brief}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
