import {
  CONVICTION_TIER_BANDS,
  formatConvictionScore,
} from "../../trading-zone/ydsConvictionEngine.js"

/**
 * @param {{
 *   conviction: ReturnType<import("../../trading-zone/ydsConvictionEngine.js").buildConvictionEngineFromPrecursorContext>
 *   compact?: boolean
 * }} props
 */
export default function ConvictionEnginePanel({ conviction, compact = false }) {
  if (!conviction?.available) {
    return <p className="yds-conviction__empty">확신도를 산출할 수 없습니다.</p>
  }

  const { convictions, summary, scoreWeightsDisplay, inputs } = conviction
  const showExcluded = !compact

  const visible = showExcluded
    ? convictions
    : convictions.filter((r) => !r.excluded)

  return (
    <div className={`yds-conviction${compact ? " yds-conviction--compact" : ""}`}>
      <p className="yds-conviction__weights">{scoreWeightsDisplay}</p>
      <div className="yds-conviction__summary" aria-label="확신도 요약">
        <span>핵심 {summary.core}</span>
        <span>주력 {summary.main}</span>
        <span>관찰 {summary.watch}</span>
        <span>제외 {summary.excluded}</span>
        <span>비중 합 {summary.weightAllocatedDisplay}</span>
      </div>
      <p className="yds-conviction__inputs">
        시장 {inputs.marketPosition.label} · 신뢰도 {inputs.confidence.score}% (
        {inputs.confidence.label})
      </p>

      <div className="yds-conviction__tier-legend" aria-label="확신도 구간">
        {CONVICTION_TIER_BANDS.map((band) => (
          <span key={band.id} className={`yds-conviction__tier-chip yds-conviction__tier-chip--${band.id}`}>
            {band.summary}
          </span>
        ))}
      </div>

      <div className="yds-conviction__table-wrap">
        <table className="yds-conviction__table">
          <thead>
            <tr>
              <th>종목</th>
              <th>점수</th>
              <th>진입</th>
              <th>확신도</th>
              <th aria-label="별점">★</th>
              <th>구간</th>
              <th>추천 비중</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.id}
                className={[
                  `yds-conviction__row--${row.tier.id}`,
                  row.excluded ? "yds-conviction__row--excluded" : "",
                ].join(" ")}
              >
                <td className="yds-conviction__name">{row.name}</td>
                <td className="font-mono tabular-nums">{formatConvictionScore(row.score)}</td>
                <td>
                  <span className={`yds-conviction__grade yds-conviction__grade--${row.entryGrade}`}>
                    {row.entryGrade}
                  </span>
                </td>
                <td className="font-mono tabular-nums yds-conviction__conviction">
                  {row.convictionDisplay}
                </td>
                <td className="yds-conviction__stars" aria-label={row.stars.ariaLabel}>
                  {row.stars.display}
                </td>
                <td className="yds-conviction__tier-label">{row.tier.label}</td>
                <td className="font-mono tabular-nums yds-conviction__weight">
                  {row.recommendedWeightDisplay}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
