/**
 * @param {{
 *   name: string
 *   stars: string
 *   status: { emoji: string; label: string }
 * }} props
 */
export default function YdsStockPickStatusCard({ name, stars, status }) {
  return (
    <article className="yds-spick-card">
      <p className="yds-spick-card__stars" aria-label={`YDS 점수 ${stars}`}>
        {stars}
      </p>
      <h3 className="yds-spick-card__name">{name}</h3>
      <p className="yds-spick-card__status">
        {status.emoji} {status.label}
      </p>
    </article>
  )
}
