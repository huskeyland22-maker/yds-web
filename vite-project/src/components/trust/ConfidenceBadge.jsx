/**
 * @param {{ level: string; tone?: 'high' | 'mid' | 'low' | 'warn'; score?: number | null }} props
 */
export default function ConfidenceBadge({ level, tone = "mid", score = null }) {
  return (
    <span className={`yds-confidence-badge yds-confidence-badge--${tone}`} title={score != null ? `신뢰도 ${score}%` : undefined}>
      신뢰도 · {level}
    </span>
  )
}
