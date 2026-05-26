/**
 * @param {{ statusLine: string; role: string; valueLine: string; tone: string }} props
 */
function CoreIndexCard({ statusLine, role, valueLine, tone }) {
  return (
    <article className={`home-v5-core-card home-v5-core-card--${tone}`}>
      <div className="home-v5-core-card__body">
        <p className="home-v5-core-card__status">{statusLine}</p>
        <p className="home-v5-core-card__role">{role}</p>
        <p className="home-v5-core-card__value">{valueLine}</p>
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
