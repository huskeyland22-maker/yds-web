/**
 * @param {import("./homeV5DeskModel.js").HomeV5CoreCardModel} props
 */
function CoreHudCard({
  key: cardKey,
  kind,
  role,
  symbol,
  value,
  timelineText,
  timelineTextMobile,
  changeDeltaText,
  changeDeltaTextMobile,
  dataStatusLabel,
  policyHint,
  recentChangeLabel,
  recentChangeTone,
  trendLine,
  trendArrow,
  trendDir,
  stageId,
  accentColor,
}) {
  const isStrategy = kind === "strategy"
  const style = accentColor ? { "--home-v5-hud-accent": accentColor } : undefined
  const statusActionParts = [dataStatusLabel, policyHint].filter((v) => v && v !== "—")

  return (
    <article
      className={[
        "home-v5-hud-card",
        `home-v5-hud-card--${cardKey}`,
        isStrategy ? "home-v5-hud-card--strategy" : "home-v5-hud-card--metric",
        isStrategy && stageId ? `home-v5-hud-card--stage-${stageId}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      title={!isStrategy ? (trendLine ?? undefined) : undefined}
    >
      <span className="home-v5-hud-card__top-bar" aria-hidden="true" />
      {!isStrategy ? (
        <>
          <header className="home-v5-hud-card__head">
            <p className="home-v5-hud-card__role">
              <span className="home-v5-hud-card__role-ko">{role}</span>
              <span className="home-v5-hud-card__role-en">{symbol}</span>
            </p>
            <span
              className={`home-v5-hud-card__trend-arrow home-v5-hud-card__trend-arrow--${trendDir}`}
              aria-hidden="true"
            >
              {trendArrow ?? "→"}
            </span>
          </header>
          <div className="home-v5-hud-card__hero">
            <p className="home-v5-hud-card__value">{value}</p>
            <p className={`home-v5-hud-card__change-delta home-v5-hud-card__change-delta--${trendDir}`}>
              <span className="home-v5-hud-card__change-arrow-inline" aria-hidden="true">
                {trendArrow ?? "→"}
              </span>
              <span className="home-v5-hud-card__change-delta-full">{changeDeltaText ?? "—"}</span>
              <span className="home-v5-hud-card__change-delta-mobile">
                {changeDeltaTextMobile ?? changeDeltaText ?? "—"}
              </span>
            </p>
          </div>
          <p className="home-v5-hud-card__timeline" title={trendLine ?? timelineText ?? "최근 10일 · 2일 간격"}>
            <span className="home-v5-hud-card__timeline-full">{timelineText ?? "—"}</span>
            <span className="home-v5-hud-card__timeline-mobile">
              {timelineTextMobile ?? timelineText ?? "—"}
            </span>
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
          <p
            className={`home-v5-hud-card__recent-change home-v5-hud-card__recent-change--${recentChangeTone ?? "flat"}`}
            title={recentChangeLabel ?? undefined}
          >
            {recentChangeLabel ?? "—"}
          </p>
        </>
      ) : (
        <>
          <p className="home-v5-hud-card__role">{role}</p>
          <p className="home-v5-hud-card__value home-v5-hud-card__value--stage">{value}</p>
          <p className="home-v5-hud-card__stage-action">{policyHint ?? "—"}</p>
          <p
            className={[
              "home-v5-hud-card__stage-transition",
              `home-v5-hud-card__stage-transition--${recentChangeTone ?? "flat"}`,
            ].join(" ")}
          >
            {recentChangeLabel ?? "—"}
          </p>
        </>
      )}
    </article>
  )
}

/**
 * @param {{ cards: import("./homeV5DeskModel.js").HomeV5CoreCardModel[] }} props
 */
export default function HomeV5CoreIndices({ cards }) {
  return (
    <div className="home-v5-core-grid home-v5-core-grid--hero home-v5-core-grid--hud">
      {cards.map((card) => (
        <CoreHudCard key={card.key} {...card} />
      ))}
    </div>
  )
}
