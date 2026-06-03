import { resolveConfidenceLabel } from "../../trading-zone/ydsPrecursorEnginePhase16.js"

/**
 * @param {{ report: ReturnType<import("../../trading-zone/ydsPrecursorEnginePhase16.js").buildPrecursorEnginePhase16Report>; compact?: boolean }} props
 */
export default function YdsPrecursorConfidencePanel({ report, compact = false }) {
  const { confidence, narrative } = report
  const label =
    confidence.label ?? resolveConfidenceLabel(confidence.score)

  if (compact) {
    return (
      <div className="yds-precursor-confidence yds-precursor-confidence--compact">
        <span className={`yds-precursor-confidence__badge yds-precursor-confidence__badge--${label.tone}`}>
          신뢰도 {confidence.score}% · {label.label}
        </span>
      </div>
    )
  }

  return (
    <section className="yds-precursor-confidence" aria-label="신뢰도 및 시장 해석">
      <div className="yds-precursor-confidence__head">
        <p className="m-0 yds-precursor-confidence__title">신뢰도 · 시장 해석</p>
        <div className={`yds-precursor-confidence__score yds-precursor-confidence__score--${label.tone}`}>
          <span className="yds-precursor-confidence__pct font-mono tabular-nums">{confidence.score}%</span>
          <span className="yds-precursor-confidence__label">{label.label}</span>
        </div>
      </div>

      <ul className="yds-precursor-confidence__components" aria-label="신뢰도 구성">
        {confidence.components.map((c) => (
          <li key={c.key} className="yds-precursor-confidence__component">
            <span className="yds-precursor-confidence__component-name">{c.label}</span>
            <span className="yds-precursor-confidence__component-bar">
              <span
                className="yds-precursor-confidence__component-fill"
                style={{ width: `${c.score}%` }}
              />
            </span>
            <span className="yds-precursor-confidence__component-score font-mono tabular-nums">
              {c.score}
            </span>
          </li>
        ))}
      </ul>

      <article className="yds-precursor-confidence__narrative" aria-label="Market Narrative">
        {narrative.paragraphs.map((p) => (
          <p key={p} className="m-0 yds-precursor-confidence__narrative-line">
            {p}
          </p>
        ))}
      </article>
    </section>
  )
}
