/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   variant?: 'card' | 'inline'
 * }} props
 */
export default function YdsStockPickInsightStrip({ stock, variant = "card" }) {
  const meta = stock.pickMeta
  if (!meta) return null

  const dayDelta = meta.scoreDeltas?.day1
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
      {meta.pricePosition ? (
        <span className="yds-spick-insight__position">
          현재 위치 {meta.pricePosition.emoji} {meta.pricePosition.label}
        </span>
      ) : null}

      {meta.sectorRank ? (
        <span className="yds-spick-insight__sector-rank">{meta.sectorRank.display}</span>
      ) : null}

      {dayDelta?.display ? (
        <span
          className={[
            "yds-spick-insight__delta font-mono tabular-nums",
            dayDelta.direction === "up" ? "yds-spick-insight__delta--up" : "",
            dayDelta.direction === "down" ? "yds-spick-insight__delta--down" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {dayDelta.display}
        </span>
      ) : null}

      {meta.scoreDeltas?.day7?.display ? (
        <span className="yds-spick-insight__delta-sub font-mono tabular-nums">
          7일 {meta.scoreDeltas.day7.display}
        </span>
      ) : null}

      {rankChange ? (
        <span className="yds-spick-insight__rank-change">
          {rankChange.emoji} {rankChange.label}
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
