import { buildConfidenceExplain } from "../../trading-zone/ydsConfidenceExplain.js"

/**
 * @param {{
 *   confidenceScore?: number | null
 *   bullSimilarity?: number | null
 *   regimeId?: string | null
 *   priA?: number | null
 *   priB?: number | null
 *   patternSimilarity?: number | null
 * }} props
 */
export default function ConfidenceExplainPanel(props) {
  const block = buildConfidenceExplain(props)
  if (block.score == null) return null

  return (
    <div className="yds-confidence-explain" aria-label="신뢰도 구성">
      <p className="yds-confidence-explain__summary">{block.summary}</p>
      <ul className="yds-confidence-explain__list">
        {block.components.map((c) => (
          <li key={c.id}>
            <span className="yds-confidence-explain__label">{c.label}</span>
            <span className="yds-confidence-explain__weight">비중 {c.weight}%</span>
            <span className="yds-confidence-explain__pct font-mono tabular-nums">
              {typeof c.pct === "number" ? `${c.pct}%` : c.pct}
            </span>
          </li>
        ))}
      </ul>
      <p className="yds-confidence-explain__note">{block.note}</p>
    </div>
  )
}
