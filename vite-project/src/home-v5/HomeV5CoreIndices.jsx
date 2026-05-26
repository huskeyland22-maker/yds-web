/**
 * @param {import("./homeV5DeskModel.js").HomeV5CoreCardModel} props
 */
function CoreIndexCard({ key: cardKey, role, symbol, value }) {
  return (
    <article className={`home-v5-core-card home-v5-core-card--${cardKey}`}>
      <div className="home-v5-core-card__body">
        <p className="home-v5-core-card__label">
          <span className="home-v5-core-card__dot" aria-hidden="true" />
          {role}
        </p>
        <p className="home-v5-core-card__symbol">{symbol}</p>
        <p className="home-v5-core-card__value">{value}</p>
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
