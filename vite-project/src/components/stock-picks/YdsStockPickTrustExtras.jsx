/**
 * @param {{
 *   trustReport: import("../../content/ydsStockPickTrustEngine.js").ReturnType<typeof import("../../content/ydsStockPickTrustEngine.js").buildStockPickTrustReport> | null | undefined
 *   embedded?: boolean
 *   className?: string
 * }} props
 */
export default function YdsStockPickTrustExtras({
  trustReport,
  embedded = false,
  className = "",
}) {
  if (!trustReport) return null

  const { aiRisk, aiTracking, tradeStrategy } = trustReport

  return (
    <div
      className={[
        "yds-spick-trust-extras",
        embedded ? "yds-spick-trust-extras--embedded" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {aiRisk?.items?.length ? (
        <section className="yds-spick-trust-extras__block" aria-label={aiRisk.title}>
          <p className="yds-spick-trust-extras__title">{aiRisk.title}</p>
          <ul className="yds-spick-trust-extras__risk-list">
            {aiRisk.items.map((item) => (
              <li key={item.id} className="yds-spick-trust-extras__risk-item">
                <span>{item.text}</span>
                <span
                  className={[
                    "yds-spick-trust-extras__risk-level",
                    `yds-spick-trust-extras__risk-level--${item.level}`,
                  ].join(" ")}
                >
                  {item.level}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {aiTracking?.phaseLabel ? (
        <section className="yds-spick-trust-extras__block" aria-label="AI 추적">
          <p className="yds-spick-trust-extras__title">AI 추적</p>
          <p className="yds-spick-trust-extras__tracking-phase">{aiTracking.phaseLabel}</p>
          {aiTracking.returnLabel ? (
            <p className="yds-spick-trust-extras__tracking-ret font-mono tabular-nums">
              추천 후 {aiTracking.returnLabel}
            </p>
          ) : null}
          {aiTracking.milestones?.length ? (
            <ul className="yds-spick-trust-extras__milestones">
              {aiTracking.milestones.map((m) => (
                <li
                  key={m.pct}
                  className={[
                    "yds-spick-trust-extras__milestone",
                    m.reached ? "yds-spick-trust-extras__milestone--done" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {m.label}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {tradeStrategy?.visible ? (
        <section className="yds-spick-trust-extras__block" aria-label={tradeStrategy.title}>
          <p className="yds-spick-trust-extras__title">{tradeStrategy.title}</p>
          <dl className="yds-spick-trust-extras__strategy">
            <div>
              <dt>1차 진입</dt>
              <dd className="font-mono tabular-nums">{tradeStrategy.entry1}</dd>
            </div>
            <div>
              <dt>2차 진입</dt>
              <dd className="font-mono tabular-nums">{tradeStrategy.entry2}</dd>
            </div>
            <div>
              <dt>추가매수</dt>
              <dd className="font-mono tabular-nums">{tradeStrategy.addBuy}</dd>
            </div>
            <div>
              <dt>익절</dt>
              <dd className="font-mono tabular-nums">{tradeStrategy.takeProfit}</dd>
            </div>
            <div>
              <dt>손절</dt>
              <dd className="font-mono tabular-nums">{tradeStrategy.stopLoss}</dd>
            </div>
            <div>
              <dt>비중</dt>
              <dd className="font-mono tabular-nums">{tradeStrategy.weightPct}%</dd>
            </div>
            <div>
              <dt>목표가</dt>
              <dd className="font-mono tabular-nums">{tradeStrategy.targetPrice}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </div>
  )
}
