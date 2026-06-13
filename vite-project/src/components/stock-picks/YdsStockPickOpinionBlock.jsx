/**
 * @param {{
 *   opinion?: import("../../content/ydsStockPickOpinion.js").StockPickOpinion | null
 *   variant?: 'detail' | 'why'
 * }} props
 */
export default function YdsStockPickOpinionBlock({ opinion = null, variant = "detail" }) {
  if (!opinion?.bullets?.length && !opinion?.action) return null

  return (
    <section
      className={[
        "yds-spick-opinion",
        variant === "why" ? "yds-spick-opinion--why" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="YDS 투자 의견"
    >
      <h3 className="yds-spick-opinion__title">YDS 투자 의견</h3>
      <p className="yds-spick-opinion__headline">{opinion.headline}</p>
      {opinion.bullets.length ? (
        <ul className="yds-spick-opinion__bullets">
          {opinion.bullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {opinion.action ? <p className="yds-spick-opinion__action">{opinion.action}</p> : null}
    </section>
  )
}
