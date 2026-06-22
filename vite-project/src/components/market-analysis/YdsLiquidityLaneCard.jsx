/**
 * @param {{
 *   lane: import("../../market-os/liquidityDualEngine.js").LiquidityLaneCard
 *   loading?: boolean
 * }} props
 */
export default function YdsLiquidityLaneCard({ lane, loading = false }) {
  const score = lane.score
  const scorePct = score != null ? Math.max(0, Math.min(100, score)) : 0
  const tone = lane.band.tone
  const contributionTotal = lane.contributions.reduce((sum, row) => sum + row.contribution, 0)

  return (
    <article className="yds-liquidity-lane">
      <div className="yds-liquidity-lane__head">
        <h3 className="yds-liquidity-lane__title">{lane.title}</h3>
        <div className="yds-liquidity-lane__score-row">
          <span className="yds-liquidity-lane__score font-mono tabular-nums">
            {score != null ? `${score}점` : loading ? "수집 중" : "—"}
          </span>
          <span className={`yds-liquidity-lane__badge yds-liquidity-lane__badge--${tone}`}>
            {lane.band.label}
          </span>
        </div>
      </div>

      <div
        className={["yds-liquidity-lane__bar", `yds-liquidity-lane__bar--${tone}`].join(" ")}
        role="meter"
        aria-label={`${lane.title} 점수`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score ?? undefined}
      >
        <span className="yds-liquidity-lane__bar-fill" style={{ width: `${scorePct}%` }} />
      </div>

      <section className="yds-liquidity-lane__report-block">
        <h4 className="yds-liquidity-lane__report-label">{lane.environmentLabel}</h4>
        <ul className="yds-liquidity-lane__factors">
          {lane.environment.map((factor) => (
            <li
              key={`${factor.label}-${factor.detail ?? ""}`}
              className={[
                "yds-liquidity-lane__factor",
                factor.tone === "ok" ? "yds-liquidity-lane__factor--ok" : "yds-liquidity-lane__factor--warn",
              ].join(" ")}
            >
              <span className="yds-liquidity-lane__factor-mark" aria-hidden>
                {factor.tone === "ok" ? "✓" : "△"}
              </span>
              <span className="yds-liquidity-lane__factor-text">
                <span className="yds-liquidity-lane__factor-label">{factor.label}</span>
                {factor.detail ? (
                  <span className="yds-liquidity-lane__factor-detail">{factor.detail}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="yds-liquidity-lane__report-block">
        <h4 className="yds-liquidity-lane__report-label">시장 영향</h4>
        <ul className="yds-liquidity-lane__impact-list">
          {lane.marketImpacts.map((line) => (
            <li key={line} className="yds-liquidity-lane__impact-item">
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="yds-liquidity-lane__report-block yds-liquidity-lane__report-block--interpret">
        <h4 className="yds-liquidity-lane__report-label">투자 해석</h4>
        <div className="yds-liquidity-lane__interpret">
          {lane.investmentLines.map((line) => (
            <p key={line} className="yds-liquidity-lane__interpret-line">
              {line}
            </p>
          ))}
        </div>
      </section>

      <section className="yds-liquidity-lane__report-block">
        <h4 className="yds-liquidity-lane__report-label">행동 가이드</h4>
        <ul className="yds-liquidity-lane__action-list">
          {lane.laneActions.map((line) => (
            <li key={line} className="yds-liquidity-lane__action-item">
              <span className="yds-liquidity-lane__action-mark" aria-hidden>
                ✓
              </span>
              {line}
            </li>
          ))}
        </ul>
      </section>

      {lane.scoreExplain ? (
        <section className="yds-liquidity-lane__report-block yds-liquidity-lane__report-block--explain">
          <h4 className="yds-liquidity-lane__report-label">점수 해설</h4>
          <p className="yds-liquidity-lane__score-explain">{lane.scoreExplain}</p>
        </section>
      ) : null}

      <div className="yds-liquidity-lane__breakdown">
        <p className="yds-liquidity-lane__breakdown-title">세부 기여도</p>
        <ul className="yds-liquidity-lane__contrib-list">
          {lane.contributions.map((row) => (
            <li key={row.id} className="yds-liquidity-lane__contrib-row">
              <div className="yds-liquidity-lane__contrib-meta">
                <span className="yds-liquidity-lane__contrib-label" title={row.tooltip}>
                  {row.label}
                  <span className="yds-liquidity-lane__contrib-help" aria-label={row.tooltip}>
                    ?
                  </span>
                </span>
                <span
                  className={[
                    "yds-liquidity-lane__contrib-val",
                    "font-mono",
                    "tabular-nums",
                    `yds-liquidity-lane__contrib-val--${row.tone}`,
                  ].join(" ")}
                >
                  +{row.contribution}
                </span>
              </div>
              <div className="yds-liquidity-lane__contrib-bar" aria-hidden>
                <span
                  className={[
                    "yds-liquidity-lane__contrib-bar-fill",
                    `yds-liquidity-lane__contrib-bar-fill--${row.tone}`,
                  ].join(" ")}
                  style={{ width: `${row.barPct}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        {score != null ? (
          <p className="yds-liquidity-lane__contrib-total font-mono tabular-nums">
            총점 <strong>{contributionTotal}</strong>
          </p>
        ) : null}
      </div>
    </article>
  )
}
