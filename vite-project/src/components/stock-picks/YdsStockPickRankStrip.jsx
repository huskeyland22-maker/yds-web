/**
 * @param {{
 *   track: import("../../content/ydsStockPickRankTrack.js").RankTrackView | null | undefined
 *   className?: string
 * }} props
 */
export default function YdsStockPickRankStrip({ track, className = "" }) {
  if (!track?.currentRank) return null

  return (
    <div className={["yds-spick-rank-track", className].filter(Boolean).join(" ")} aria-label="순위 변동">
      <span className="yds-spick-rank-track__rank font-mono tabular-nums">{track.rankDisplay}</span>
      {track.deltaDisplay ? (
        <span
          className={[
            "yds-spick-rank-track__delta font-mono tabular-nums",
            track.delta != null && track.delta > 0 ? "yds-spick-rank-track__delta--up" : "",
            track.delta != null && track.delta < 0 ? "yds-spick-rank-track__delta--down" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {track.deltaDisplay}
        </span>
      ) : null}
      <span className={`yds-spick-rank-track__badge yds-spick-rank-track__badge--${track.badge.tone}`}>
        {track.badge.label}
      </span>
    </div>
  )
}
