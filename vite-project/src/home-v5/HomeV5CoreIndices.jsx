/**
 * @param {import("./homeV5DeskModel.js").HomeV5CoreCardModel} props
 */
function CoreHudCard({
  key: cardKey,
  kind,
  role,
  symbol,
  value,
  dataStatusLabel,
  policyHint,
  trendLine,
  trendDir,
  accentColor,
}) {
  const isStrategy = kind === "strategy"
  const style = accentColor ? { "--home-v5-hud-accent": accentColor } : undefined

  return (
    <article
      className={[
        "home-v5-hud-card",
        `home-v5-hud-card--${cardKey}`,
        isStrategy ? "home-v5-hud-card--strategy" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      <span className="home-v5-hud-card__top-bar" aria-hidden="true" />
      <p className="home-v5-hud-card__role">
        {isStrategy || !symbol ? (
          role
        ) : (
          <>
            <span className="home-v5-hud-card__role-ko">{role}</span>
            <span className="home-v5-hud-card__role-en">{symbol}</span>
          </>
        )}
      </p>
      <p className={`home-v5-hud-card__value${isStrategy ? " home-v5-hud-card__value--regime" : ""}`}>{value}</p>
      {!isStrategy ? (
        <>
          <p className="home-v5-hud-card__data-status">{dataStatusLabel ?? "—"}</p>
          <p className="home-v5-hud-card__policy-hint">{policyHint ?? "—"}</p>
        </>
      ) : (
        <p className={`home-v5-hud-card__trend home-v5-hud-card__trend--${trendDir}`}>{trendLine ?? policyHint ?? "—"}</p>
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
