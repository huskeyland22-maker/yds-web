/**
 * @param {import("./homeV5DeskModel.js").HomeV5CoreCardModel} props
 */
function CoreIndexCard({
  key: cardKey,
  role,
  symbol,
  value,
  trendLine,
  trendDir,
  caption,
  sparkline,
}) {
  return (
    <article className={`home-v5-core-card home-v5-core-card--${cardKey}`}>
      <div className="home-v5-core-card__body">
        <p className="home-v5-core-card__label">
          <span className="home-v5-core-card__dot" aria-hidden="true" />
          {role}
        </p>
        <p className="home-v5-core-card__symbol">{symbol}</p>
        <p className="home-v5-core-card__value">{value}</p>
        <p
          className={`home-v5-core-card__trend home-v5-core-card__trend--${trendDir}`}
          aria-label={`최근 7일 추세 ${trendLine}`}
        >
          {trendLine}
        </p>
        <p className="home-v5-core-card__caption">{caption}</p>
        {sparkline ? (
          <p className="home-v5-core-card__spark" aria-hidden="true">
            {sparkline}
          </p>
        ) : null}
      </div>
    </article>
  )
}

/**
 * @param {{ cards: import("./homeV5DeskModel.js").HomeV5CoreCardModel[] }} props
 */
export default function HomeV5CoreIndices({ cards }) {
  return (
    <div className="home-v5-core-grid home-v5-core-grid--hero">
      {cards.map((card) => (
        <CoreIndexCard key={card.key} {...card} />
      ))}
    </div>
  )
}
