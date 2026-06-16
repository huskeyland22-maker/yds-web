/**
 * @param {{
 *   stats: ReturnType<import("../../content/ydsStockPickLoadStats.js").computeStockPickLoadStats>
 *   lastSyncAt?: string | null
 *   fromCache?: boolean
 *   loading?: boolean
 * }} props
 */
export default function YdsStockPickLoadBanner({
  stats,
  lastSyncAt = null,
  fromCache = false,
  loading = false,
}) {
  if (loading && stats.totalLive === 0) {
    return (
      <div className="yds-spick-load-banner yds-spick-load-banner--loading" role="status">
        <span className="yds-spick-load-banner__headline">실시간 데이터 로드 중…</span>
      </div>
    )
  }

  const updated = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : null

  return (
    <div
      className={[
        "yds-spick-load-banner",
        "yds-spick-load-banner--ok",
      ].join(" ")}
      role="status"
    >
      <span className="yds-spick-load-banner__headline">실시간 데이터</span>
      <span className="yds-spick-load-banner__row">
        <span className="yds-spick-load-banner__country">미국 {stats.live.US}개</span>
        <span className="yds-spick-load-banner__sep" aria-hidden>
          ·
        </span>
        <span className="yds-spick-load-banner__country">한국 {stats.live.KR}개</span>
      </span>
      {updated ? (
        <span className="yds-spick-load-banner__note">
          마지막 갱신 {updated}
          {fromCache ? " · 캐시" : ""}
        </span>
      ) : null}
    </div>
  )
}
