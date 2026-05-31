import { resolveConfidenceGrade } from "../../trading-zone/tradingZoneConfidenceGrade.js"

/**
 * @param {{
 *   score: number | null | undefined
 *   compact?: boolean
 *   className?: string
 * }} props
 */
export default function TacticalConfidenceGrade({ score, compact = false, className = "" }) {
  const grade = resolveConfidenceGrade(score)
  if (!Number.isFinite(grade.score)) return null

  return (
    <span
      className={["tactical-confidence-grade", compact ? "tactical-confidence-grade--compact" : "", className]
        .filter(Boolean)
        .join(" ")}
      title={`신뢰도 ${grade.score} · ${grade.letter} (${grade.threshold}+)`}
    >
      <span className="tactical-confidence-grade__score font-mono tabular-nums">{grade.score}</span>
      {!compact ? (
        <span className="tactical-confidence-grade__letter">{grade.letter}</span>
      ) : null}
      <span className="tactical-confidence-grade__stars" aria-label={`등급 ${grade.letter}`}>
        {grade.stars}
      </span>
    </span>
  )
}
