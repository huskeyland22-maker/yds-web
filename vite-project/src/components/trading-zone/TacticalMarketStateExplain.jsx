/**
 * @param {{
 *   brief: import("../../trading-zone/tradingZoneMarketStateBrief.js").TradingZoneMarketStateBrief
 *   actionRows: { key: string; icon: string; text: string; tone: string }[]
 * }} props
 */
export default function TacticalMarketStateExplain({ brief, actionRows = [] }) {
  if (!brief?.horizonBreakdowns?.length && !brief?.actionReasons?.length) return null

  return (
    <div className="tz-market-explain">
      {brief.horizonBreakdowns?.length ? (
        <section className="tz-market-explain__section" aria-label="점수 산출 근거">
          <p className="m-0 tz-market-explain__head">📊 점수 산출 근거</p>
          <div className="tz-market-explain__horizons">
            {brief.horizonBreakdowns.map((block) => (
              <div key={block.horizonId} className="tz-score-block" data-horizon={block.horizonId}>
                <p className="m-0 tz-score-block__title">
                  <span>{block.period}</span>
                  <span className="tz-score-block__score font-mono tabular-nums">{block.score ?? "—"}</span>
                </p>
                <ul className="tz-score-block__drivers m-0 list-none p-0">
                  {block.drivers.map((d) => (
                    <li
                      key={`${block.horizonId}-${d.key ?? d.status}`}
                      className={["tz-score-driver", `tz-score-driver--${d.tone}`].join(" ")}
                    >
                      <span className="tz-score-driver__icon" aria-hidden>
                        {d.icon}
                      </span>
                      <span className="tz-score-driver__status">{d.status}</span>
                      <span className="tz-score-driver__pts font-mono tabular-nums">{d.pointsText}</span>
                    </li>
                  ))}
                </ul>
                <p className="m-0 tz-score-block__total font-mono tabular-nums">총점 {block.score ?? "—"}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {brief.actionReasons?.length || brief.actionConclusion ? (
        <section className="tz-market-explain__section" aria-label="행동 이유">
          <p className="m-0 tz-market-explain__head">📌 행동 이유</p>
          <ul className="tz-market-explain__reasons m-0 list-none p-0">
            {brief.actionReasons.map((r) => (
              <li
                key={r.text}
                className={["tz-market-explain__reason", `tz-market-explain__reason--${r.tone}`].join(" ")}
              >
                <span className="tz-market-explain__check" aria-hidden>
                  ✓
                </span>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
          {brief.actionConclusion ? (
            <p className="m-0 tz-market-explain__conclusion">{brief.actionConclusion}</p>
          ) : null}
        </section>
      ) : null}

      {actionRows.length ? (
        <section className="tz-market-explain__section tz-market-explain__section--actions" aria-label="현재 행동">
          <p className="m-0 tz-market-explain__head">현재 행동</p>
          <ul className="tz-market-explain__actions m-0 list-none p-0">
            {actionRows.map((row) => (
              <li
                key={row.key}
                className={[
                  "tz-market-explain__action",
                  `tz-market-explain__action--${row.tone}`,
                ].join(" ")}
              >
                <span className="tz-market-explain__action-icon" aria-hidden>
                  {row.icon}
                </span>
                <span>{row.text.replace(/\s*\/\s*/g, "·").replace(/\s+/g, " ").trim()}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
