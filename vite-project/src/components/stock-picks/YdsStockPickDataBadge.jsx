/**
 * @param {{ mode: 'live' | 'fallback' }} props
 */
export default function YdsStockPickDataBadge({ mode }) {
  const isLive = mode === "live"
  return (
    <span
      className={[
        "yds-spick-data-badge",
        isLive ? "yds-spick-data-badge--live" : "yds-spick-data-badge--fallback",
      ].join(" ")}
      title={isLive ? "실시간 API 시세·지표 반영" : "API 조회 실패 · 오프라인 추정값"}
    >
      {isLive ? "LIVE" : "FALLBACK"}
    </span>
  )
}
