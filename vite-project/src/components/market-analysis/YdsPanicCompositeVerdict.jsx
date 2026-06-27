import { useMemo } from "react"
import { buildPanicCompositeVerdictReport } from "../../content/ydsPanicCompositeVerdict.js"

/**
 * @param {{
 *   panicData?: object | null
 *   etfContext?: { qqqPrices?: Record<string, number>; spyPrices?: Record<string, number>; asOfDate?: string | null } | null
 *   className?: string
 * }} props
 */
export default function YdsPanicCompositeVerdict({
  panicData = null,
  etfContext = null,
  className = "",
}) {
  const report = useMemo(
    () =>
      buildPanicCompositeVerdictReport(panicData, {
        spyPrices: etfContext?.spyPrices,
        qqqPrices: etfContext?.qqqPrices,
        asOfDate: etfContext?.asOfDate ?? null,
      }),
    [panicData, etfContext],
  )

  if (!report.visible) return null

  return (
    <section
      className={["yds-panic-composite", className].filter(Boolean).join(" ")}
      aria-label={report.title}
    >
      <div className="yds-panic-composite__state" aria-label={report.stateTitle}>
        <p className="yds-panic-composite__state-title">{report.stateTitle}</p>
        <p className="yds-panic-composite__state-line">
          <span className="yds-panic-composite__state-score font-mono tabular-nums">
            {report.psychScore}
          </span>
          <span className="yds-panic-composite__state-label">({report.stateLabel})</span>
        </p>
      </div>

      <dl className="yds-panic-composite__axes">
        <div>
          <dt>패닉</dt>
          <dd>
            {report.psychScore}
            <span className="yds-panic-composite__score-note"> {report.stateLabel}</span>
          </dd>
        </div>
        <div>
          <dt>가격 구조</dt>
          <dd>{report.priceLabel}</dd>
        </div>
        <div>
          <dt>추세</dt>
          <dd>{report.trendLabel}</dd>
        </div>
      </dl>

      <div className={`yds-panic-composite__verdict yds-panic-composite__verdict--${report.verdictId}`}>
        <p className="yds-panic-composite__verdict-head">
          <span className="yds-panic-composite__verdict-label">최종 해석</span>
          <strong>
            {report.verdictEmoji} {report.verdictLabel}
          </strong>
          <span className="yds-panic-composite__stars">{report.buyStrength}</span>
        </p>
        <p className="yds-panic-composite__action">{report.actionLine}</p>
        <div className="yds-panic-composite__narrative">
          {report.narrative.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>

      {report.priceMetrics.length ? (
        <ul className="yds-panic-composite__metrics" aria-label="가격 구조 지표">
          {report.priceMetrics.map((m) => (
            <li key={m.id} className="yds-panic-composite__metric">
              <span>{m.label}</span>
              <span className="font-mono tabular-nums">{m.display}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
