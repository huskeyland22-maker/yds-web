import { useMemo } from "react"
import { MARKET_LABEL_MARKET_STATE } from "../../content/ydsMarketStageLabels.js"
import { resolveMarketPositionView } from "../../content/ydsMarketPositionEngine.js"

/**
 * 시장 상태 — 시장 위치 진단 (CNN · VIX · BofA)
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string; embedded?: boolean }} props
 */
export default function YdsMarketStateCard({
  panicData = null,
  historyRows: _historyRows = [],
  className = "",
  embedded = false,
}) {
  const view = useMemo(() => resolveMarketPositionView(panicData), [panicData])

  if (!view) return null

  const { position, nav, metricsLine } = view

  const scoreCard = (
    <article
      className={[
        "yds-market-hero__score-card",
        "yds-market-hero__score-card--state",
        embedded ? "yds-market-hero__score-card--embedded" : "yds-market-hero__score-card--solo",
      ].join(" ")}
      aria-label={`${MARKET_LABEL_MARKET_STATE} ${position.label}`}
    >
      <p className="yds-market-hero__card-label">{MARKET_LABEL_MARKET_STATE}</p>

      <div className="yds-market-hero__position-block yds-market-hero__position-block--lead">
        <p className="yds-market-hero__section-label">현재 위치</p>
        <p
          className="yds-market-hero__status yds-market-hero__status--hero"
          style={{ "--hero-color": position.color }}
        >
          <span aria-hidden>{position.emoji}</span> {position.label}
        </p>
      </div>

      {position.descriptions.length ? (
        <ul className="yds-market-hero__desc-list">
          {position.descriptions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      {metricsLine ? (
        <p className="yds-market-hero__metrics-inline font-mono tabular-nums">{metricsLine}</p>
      ) : null}

      {nav.next ? (
        <div className="yds-market-hero__next-block">
          <p className="yds-market-hero__section-label">다음 단계</p>
          <p className="yds-market-hero__next-line">{nav.nextLine}</p>
        </div>
      ) : null}
    </article>
  )

  if (embedded) {
    return scoreCard
  }

  return (
    <section className={["yds-market-state-card", className].filter(Boolean).join(" ")}>
      <h2 className="yds-market-desk__block-label">{MARKET_LABEL_MARKET_STATE}</h2>
      {scoreCard}
    </section>
  )
}
