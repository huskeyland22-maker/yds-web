/**
 * @param {{ report: import("../../content/ydsStockPickTradeScenario.js").ReturnType<typeof import("../../content/ydsStockPickTradeScenario.js").buildStockPickTradeScenarioReport>; embedded?: boolean; className?: string }} props
 */
export default function YdsStockPickTradeScenario({ report, embedded = false, className = "" }) {
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
            {item.target ? (
              <p className="yds-spick-scenario__line">
                목표가 <span className="font-mono tabular-nums">{item.target}</span>
              </p>
            ) : null}
            {item.range ? (
              <p className="yds-spick-scenario__line">
                예상 범위 <span className="font-mono tabular-nums">{item.range}</span>
              </p>
            ) : null}
            {item.stop ? (
              <p className="yds-spick-scenario__line">
                손절 기준 <span className="font-mono tabular-nums">{item.stop}</span>
              </p>
            ) : null}
            <p className="yds-spick-scenario__action">✓ {item.action}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
