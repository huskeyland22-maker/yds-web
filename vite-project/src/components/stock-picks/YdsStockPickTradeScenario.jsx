/**
 * @param {{ report: import("../../content/ydsStockPickTradeScenario.js").ReturnType<typeof import("../../content/ydsStockPickTradeScenario.js").buildStockPickTradeScenarioReport> | import("../../content/ydsStockPickAiAnalysisEngine.js").ReturnType<typeof import("../../content/ydsStockPickAiAnalysisEngine.js").buildAiInvestmentScenarios>; embedded?: boolean; enhanced?: boolean; className?: string }} props
 */
export default function YdsStockPickTradeScenario({ report, embedded = false, enhanced = false, className = "" }) {
  if (!report?.visible) return null

  return (
    <section
      className={[
        "yds-spick-scenario",
        embedded ? "yds-spick-scenario--embedded" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={report.title}
    >
      <p className="yds-spick-scenario__title">{report.title}</p>
      <div className="yds-spick-scenario__grid">
        {report.scenarios.map((item) => (
          <article
            key={item.id}
            className={`yds-spick-scenario__card yds-spick-scenario__card--${item.id}`}
          >
            <div className="yds-spick-scenario__card-head">
              <h4 className="yds-spick-scenario__card-title">{item.label}</h4>
              <span className="yds-spick-scenario__prob font-mono tabular-nums">
                {item.probability}%
              </span>
            </div>
            {enhanced && item.action ? (
              <p className="yds-spick-scenario__line">
                추천 행동 <span>{item.action}</span>
              </p>
            ) : null}
            {(enhanced ? item.targetLabel ?? item.target : item.target) ? (
              <p className="yds-spick-scenario__line">
                목표가{" "}
                <span className="font-mono tabular-nums">
                  {enhanced ? item.targetLabel ?? item.target : item.target}
                </span>
              </p>
            ) : null}
            {!enhanced && item.range ? (
              <p className="yds-spick-scenario__line">
                예상 범위 <span className="font-mono tabular-nums">{item.range}</span>
              </p>
            ) : null}
            {(enhanced ? item.stopLabel ?? item.stop : item.stop) ? (
              <p className="yds-spick-scenario__line">
                손절 기준{" "}
                <span className="font-mono tabular-nums">
                  {enhanced ? item.stopLabel ?? item.stop : item.stop}
                </span>
              </p>
            ) : null}
            {enhanced && item.holdPeriod ? (
              <p className="yds-spick-scenario__line">
                예상 보유기간 <span>{item.holdPeriod}</span>
              </p>
            ) : null}
            {!enhanced ? <p className="yds-spick-scenario__action">✓ {item.action}</p> : null}
          </article>
        ))}
      </div>
    </section>
  )
}
