/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   variant?: 'card' | 'inline'
 * }} props
 */
export default function YdsStockPickInsightStrip({ stock, variant = "card" }) {
  const meta = stock.pickMeta
  if (!meta) return null

  const rankChange = meta.rankChange

  return (
    <div
      className={[
        "yds-spick-insight",
        variant === "inline" ? "yds-spick-insight--inline" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {meta.sectorRank ? (
        <span className="yds-spick-insight__sector-rank">{meta.sectorRank.display}</span>
      ) : null}

      {rankChange ? (
        <span className="yds-spick-insight__rank-change">
          {rankChange.emoji} {rankChange.label}
        </span>
      ) : null}

      {meta.rankTrack?.deltaDisplay ? (
        <span className="yds-spick-insight__rank-delta font-mono tabular-nums">
          {meta.rankTrack.deltaDisplay}
        </span>
      ) : null}

      {meta.longHoldCandidate ? (
        <span className="yds-spick-insight__long-hold">🏆 장기보유 후보</span>
      ) : null}

      {meta.reliability ? (
        <span className="yds-spick-insight__reliability" title={meta.reliability.label}>
          {meta.reliability.display}
        </span>
      ) : null}

      {meta.finalAction ? (
        <span className="yds-spick-insight__final-action">
          {meta.finalAction.emoji} {meta.finalAction.label}
        </span>
      ) : null}
    </div>
  )
}
