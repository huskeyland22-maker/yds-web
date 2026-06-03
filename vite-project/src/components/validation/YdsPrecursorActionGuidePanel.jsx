import { getPrecursorMetricDisplay } from "../../trading-zone/ydsPrecursorMetricDisplay.js"
import { formatMetric } from "../../trading-zone/ydsHistoricalEventTypes.js"

/**
 * @param {{ report: ReturnType<import("../../trading-zone/ydsPrecursorEnginePhase15.js").buildPrecursorEnginePhase15Report> }} props
 */
export default function YdsPrecursorActionGuidePanel({ report }) {
  const { currentAction, recommendedAction, rationale, oneLiner, trend30 } = report

  return (
    <div className="yds-precursor-action-guide">
      <article
        className={`yds-precursor-action-guide__hero yds-precursor-action-guide__hero--${currentAction.id}`}
        aria-label="현재 행동"
      >
        <span className="yds-precursor-action-guide__hero-emoji">{currentAction.emoji}</span>
        <div>
          <p className="m-0 yds-precursor-action-guide__hero-label">현재 행동</p>
          <p className="m-0 yds-precursor-action-guide__hero-action">{currentAction.label}</p>
        </div>
      </article>

      <p className="yds-precursor-action-guide__oneliner">{oneLiner}</p>

      <article className="yds-precursor-action-guide__block" aria-label="추천 행동">
        <p className="m-0 yds-precursor-action-guide__block-title">추천 행동 · 비중</p>
        <p className="m-0 yds-precursor-action-guide__alloc">{recommendedAction.allocation}</p>
        <p className="m-0 yds-precursor-action-guide__alloc-sub">{recommendedAction.disclaimer}</p>
      </article>

      <article className="yds-precursor-action-guide__block" aria-label="행동 근거">
        <p className="m-0 yds-precursor-action-guide__block-title">행동 근거</p>
        <ul className="yds-precursor-action-guide__rationale">
          {rationale.map((r) => (
            <li key={r.key}>
              <span className="yds-precursor-action-guide__rationale-key">{r.label}</span>
              <span>{r.line}</span>
            </li>
          ))}
        </ul>
      </article>

      <article className="yds-precursor-action-guide__block" aria-label="30일 행동 추세">
        <p className="m-0 yds-precursor-action-guide__block-title">최근 30일 행동 변화</p>
        {trend30.hasPast ? (
          <p className="m-0 yds-precursor-action-guide__trend">
            {trend30.pastDate}: {trend30.pastAction} → {trend30.currentAction}
            <span
              className={`yds-precursor-action-guide__trend-dir yds-precursor-action-guide__trend-dir--${trend30.direction.id}`}
            >
              {" "}
              · {trend30.direction.label}
            </span>
          </p>
        ) : (
          <p className="m-0 yds-precursor-action-guide__trend-muted">{trend30.direction.label}</p>
        )}
      </article>
    </div>
  )
}

/** @param {string} key */
export function MetricLabel({ metricKey, className = "" }) {
  const m = getPrecursorMetricDisplay(metricKey)
  return (
    <span className={className} title={m.hint}>
      {m.label}
    </span>
  )
}

export function fmtScore(v, d = 0) {
  if (v == null || !Number.isFinite(v)) return "—"
  return formatMetric(v, d)
}
