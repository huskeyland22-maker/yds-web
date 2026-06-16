/**
 * @param {{
 *   ctx: import("../../content/ydsMarketAdapter.js").YdsMarketAdapterContext
 *   displayLimit: number
 * }} props
 */
export default function YdsStockPickMarketRegimeBanner({ ctx, displayLimit }) {
  if (!ctx?.ready) return null

  const limitLabel = Number.isFinite(displayLimit) ? `TOP${displayLimit}` : "전체"
  const positionEmoji = ctx.marketPositionEmoji ?? ctx.macroEmoji
  const positionLabel = ctx.marketPositionLabel
    ? `${positionEmoji} ${ctx.marketPositionLabel}구간`
    : `${ctx.macroEmoji} ${ctx.macroLabel}`
  const macroLabel = ctx.macroLabel || "중립"
  const buyIntensity = Number.isFinite(ctx.buyIntensityPct) ? ctx.buyIntensityPct : 0

  return (
    <section className="yds-spick-regime-banner" aria-label="시장상태 연동">
      <p className="yds-spick-regime-banner__head">
        <strong>{positionLabel}</strong>
      </p>
      <p className="yds-spick-regime-banner__copy">
        {macroLabel} · 매수 강도 {buyIntensity}% · {limitLabel} 공개
      </p>
      <p className="yds-spick-regime-banner__guide">
        현재는 급한 매수보다 관심 종목 수집 단계
      </p>
    </section>
  )
}
