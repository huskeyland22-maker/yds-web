/**
 * @param {{
 *   opinion?: import("../../content/ydsStockPickOpinion.js").StockPickOpinion | null
 *   variant?: 'detail' | 'why' | 'practical'
 * }} props
 */
export default function YdsStockPickOpinionBlock({ opinion = null, variant = "detail" }) {
  if (!opinion) return null

  const isPractical = variant === "detail" || variant === "practical"
  const practicalBullets = isPractical ? opinion.bullets.slice(0, 1) : opinion.bullets
  const stockHeadline = String(opinion.headline ?? "").replace(/^\[(.*)\]$/, "$1")

  return (
    <section
      className={[
        "yds-spick-opinion",
        variant === "why" ? "yds-spick-opinion--why" : "",
        isPractical ? "yds-spick-opinion--practical" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="YDS 투자의견"
    >
      <h3 className="yds-spick-opinion__title">
        YDS 투자의견
      </h3>
      <p className="yds-spick-opinion__headline">{stockHeadline || opinion.headline}</p>

      {isPractical && opinion.qualityLine ? (
        <p className="yds-spick-opinion__quality">{opinion.qualityLine}</p>
      ) : null}

      {practicalBullets.length ? (
        <ul className="yds-spick-opinion__bullets">
          {practicalBullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      {isPractical && opinion.timingLine ? (
        <p className="yds-spick-opinion__timing">{opinion.timingLine}</p>
      ) : null}

      {!isPractical && (opinion.summary || opinion.action) ? (
        <p className="yds-spick-opinion__action">{opinion.summary || opinion.action}</p>
      ) : null}

      {isPractical ? (
        <div className="yds-spick-opinion__actions">
          {opinion.holderAction ? (
            <p className="yds-spick-opinion__holder">{opinion.holderAction}</p>
          ) : null}
          {opinion.nonHolderAction ? (
            <p className="yds-spick-opinion__nonholder">{opinion.nonHolderAction}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
