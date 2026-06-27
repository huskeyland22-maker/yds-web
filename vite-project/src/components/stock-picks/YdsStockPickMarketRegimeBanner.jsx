/**
 * @param {{
 *   ctx: import("../../content/ydsMarketAdapter.js").YdsMarketAdapterContext
 *   displayLimit: number
 *   compact?: boolean
 * }} props
 */
export default function YdsStockPickMarketRegimeBanner({ ctx, displayLimit, compact = false }) {
  if (!ctx?.ready) return null

  const limitLabel = Number.isFinite(displayLimit) ? `TOP${displayLimit}` : "전체"
  const positionEmoji = ctx.marketPositionEmoji ?? ctx.macroEmoji
  const positionLabel = ctx.marketPositionLabel
    ? `${positionEmoji} ${ctx.marketPositionLabel}`
    : `${ctx.macroEmoji} ${ctx.macroLabel}`
  const macroLabel = ctx.macroLabel || "중립"
  const buyIntensity = Number.isFinite(ctx.buyIntensityPct) ? ctx.buyIntensityPct : 0

  return (
    <div
      className={[
        "yds-spick-regime-banner",
        compact ? "yds-spick-regime-banner--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="시장상태 연동"
    >
      <p className="yds-spick-regime-banner__head">
        <strong>{positionLabel}</strong>
        <span className="yds-spick-regime-banner__meta font-mono tabular-nums">
          {macroLabel} · 매수 {buyIntensity}% · {limitLabel}
        </span>
      </p>
      {!compact ? (
        <p className="yds-spick-regime-banner__guide">
          현재는 급한 매수보다 관심 종목 수집 단계
        </p>
      ) : null}
    </div>
  )
}
