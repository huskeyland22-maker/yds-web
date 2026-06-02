import { formatMetric, YDS_MILESTONE_STEP_LABEL } from "../../trading-zone/ydsHistoricalEventTypes.js"

const ROWS = [
  { key: "vix", label: "VIX" },
  { key: "cnn", label: "CNN" },
  { key: "bofa", label: "BofA" },
  { key: "highYield", label: "HY" },
  { key: "putCall", label: "Put/Call" },
]

/**
 * @param {{ breakdown: import("../../trading-zone/ydsScoreBreakdown.js").ReturnType<import("../../trading-zone/ydsScoreBreakdown.js").buildYdsScoreBreakdown> }} props
 */
export default function YdsScoreBreakdownTable({ breakdown }) {
  if (!breakdown?.computable) {
    return <p className="m-0 yds-event-detail__hint">YDS 계산 불가 — 핵심 5지표 미입력</p>
  }

  return (
    <div className="yds-score-breakdown">
      <p className="m-0 yds-score-breakdown__formula font-mono tabular-nums">
        최종 YDS {breakdown.finalYds}
        {breakdown.stage ? ` · ${breakdown.stage.emoji} ${breakdown.stage.label}` : ""}
      </p>
      <p className="m-0 yds-score-breakdown__meta font-mono tabular-nums">
        단기 {breakdown.shortScore} × {Math.round(breakdown.weights.wShort * 100)}% + 중기 {breakdown.midScore} ×{" "}
        {Math.round(breakdown.weights.wMid * 100)}% = 합산 {breakdown.sumContributions}
      </p>
      <p className="m-0 yds-score-breakdown__meta">{breakdown.weightNote}</p>
      <table className="panic-validation-year-table panic-validation-year-table--vs yds-score-breakdown__table">
        <thead>
          <tr>
            <th scope="col">지표</th>
            <th scope="col">입력값</th>
            <th scope="col">정규화(0~100)</th>
            <th scope="col">최종 기여도</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const inputKey = row.key === "cnn" ? "fearGreed" : row.key
            const inputVal = breakdown.inputs?.[inputKey]
            return (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td className="font-mono tabular-nums">{formatMetric(inputVal, row.key === "cnn" ? 0 : 1)}</td>
                <td className="font-mono tabular-nums">
                  {formatMetric(breakdown.componentScores?.[row.key], 1)}
                </td>
                <td className="font-mono tabular-nums yds-score-breakdown__contrib">
                  +{formatMetric(breakdown.contributions?.[row.key], 1)}
                </td>
              </tr>
            )
          })}
          <tr className="yds-score-breakdown__total-row">
            <td colSpan={3}>합계 (반올림 전 기여도 합)</td>
            <td className="font-mono tabular-nums">≈ {formatMetric(breakdown.sumContributions, 1)}</td>
          </tr>
        </tbody>
      </table>
      {breakdown.insights?.length ? (
        <ul className="yds-score-breakdown__insights">
          {breakdown.insights.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/**
 * @param {{ title: string, breakdown: ReturnType<typeof import("../../trading-zone/ydsScoreBreakdown.js").buildMilestoneBreakdown> }} props
 */
export function YdsClimaxAnalysisCard({ title, breakdown }) {
  return (
    <article className="yds-score-breakdown-card">
      <p className="m-0 yds-score-breakdown-card__title">{title}</p>
      {breakdown.date && (
        <p className="m-0 yds-score-breakdown-card__date font-mono tabular-nums">
          {YDS_MILESTONE_STEP_LABEL[breakdown.milestoneKey] ?? breakdown.milestoneKey} · {breakdown.date}
        </p>
      )}
      <YdsScoreBreakdownTable breakdown={breakdown} />
    </article>
  )
}
