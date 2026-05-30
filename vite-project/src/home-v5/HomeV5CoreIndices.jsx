import HomeV5CoreStrategyBar from "./HomeV5CoreStrategyBar.jsx"

/**
 * @param {import("./homeV5DeskModel.js").HomeV5CoreCardModel} props
 */
function CoreHudCard({
  key: cardKey,
  symbol,
  value,
  timelineText,
  timelineTextMobile,
  changeDeltaText,
  changeDeltaTextMobile,
  dataStatusLabel,
  policyHint,
  trendLine,
  trendArrow,
  trendDir,
}) {
  const statusActionParts = [dataStatusLabel, policyHint].filter((v) => v && v !== "—")
  const deltaDisplay = changeDeltaTextMobile ?? changeDeltaText ?? "—"

  return (
    <article
      className={["home-v5-hud-card", "home-v5-hud-card--metric", `home-v5-hud-card--${cardKey}`].join(" ")}
      title={trendLine ?? undefined}
    >
      <header className="home-v5-hud-card__head">
        <p className="home-v5-hud-card__symbol">{symbol}</p>
        <p
          className={`home-v5-hud-card__change-delta home-v5-hud-card__change-delta--head home-v5-hud-card__change-delta--${trendDir}`}
          aria-label={`최근 변화 ${deltaDisplay}`}
        >
          <span className="home-v5-hud-card__change-arrow-inline" aria-hidden="true">
            {trendArrow ?? "→"}
          </span>
          <span className="home-v5-hud-card__change-delta-full">{changeDeltaText ?? "—"}</span>
          <span className="home-v5-hud-card__change-delta-mobile">{deltaDisplay}</span>
        </p>
      </header>
      <p className="home-v5-hud-card__value">{value}</p>
      <p className="home-v5-hud-card__timeline" title={trendLine ?? timelineText ?? "최근 10일 · 2일 간격"}>
        <span className="home-v5-hud-card__timeline-full">{timelineText ?? "—"}</span>
        <span className="home-v5-hud-card__timeline-mobile">{timelineTextMobile ?? timelineText ?? "—"}</span>
      </p>
      <p
        className="home-v5-hud-card__status-action"
        title={statusActionParts.length ? statusActionParts.join(" · ") : undefined}
      >
        {statusActionParts.length ? (
          <>
            <span className="home-v5-hud-card__status-action-s">{statusActionParts[0]}</span>
            {statusActionParts[1] ? (
              <>
                <span className="home-v5-hud-card__status-action-sep"> · </span>
                <span className="home-v5-hud-card__status-action-a">{statusActionParts[1]}</span>
              </>
            ) : null}
          </>
        ) : (
          "—"
        )}
      </p>
    </article>
  )
}

/**
 * @param {{
 *   cards: import("./homeV5DeskModel.js").HomeV5CoreCardModel[]
 *   strategyBar?: import("./homeV5DeskModel.js").HomeV5StrategyStatusBarModel | null
 * }} props
 */
export default function HomeV5CoreIndices({ cards, strategyBar = null }) {
  const metrics = cards.filter((card) => card.kind === "metric")

  return (
    <div className="home-v5-core-stack">
      <div className="home-v5-core-grid home-v5-core-grid--hero home-v5-core-grid--hud home-v5-core-grid--metrics">
        {metrics.map((card) => (
          <CoreHudCard key={card.key} {...card} />
        ))}
      </div>
      {strategyBar ? <HomeV5CoreStrategyBar bar={strategyBar} /> : null}
    </div>
  )
}
