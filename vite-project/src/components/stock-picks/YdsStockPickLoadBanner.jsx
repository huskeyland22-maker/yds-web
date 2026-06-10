import { formatStockPickLoadBanner } from "../../content/ydsStockPickLoadStats.js"

/**
 * @param {{
 *   stats: ReturnType<import("../../content/ydsStockPickLoadStats.js").computeStockPickLoadStats>
 *   loading?: boolean
 * }} props
 */
export default function YdsStockPickLoadBanner({ stats, loading = false }) {
  if (loading && stats.totalLive === 0) {
    return (
      <div className="yds-spick-load-banner yds-spick-load-banner--loading" role="status">
        <span className="yds-spick-load-banner__headline">실데이터 로드 중…</span>
      </div>
    )
  }

  const view = formatStockPickLoadBanner(stats)

  return (
    <div
      className={[
        "yds-spick-load-banner",
        stats.complete ? "yds-spick-load-banner--ok" : "yds-spick-load-banner--partial",
      ].join(" ")}
      role="status"
    >
      <span className="yds-spick-load-banner__headline">{view.headline}</span>
      <span className="yds-spick-load-banner__row">
        <span className="yds-spick-load-banner__country">미국 {view.us}</span>
        <span className="yds-spick-load-banner__sep" aria-hidden>
          ·
        </span>
        <span className="yds-spick-load-banner__country">한국 {view.kr}</span>
      </span>
      {view.note ? <span className="yds-spick-load-banner__note">{view.note}</span> : null}
    </div>
  )
}
