/**
 * @param {{
 *   ctx: import("../../content/ydsMarketAdapter.js").YdsMarketAdapterContext
 *   displayLimit: number
 * }} props
 */
export default function YdsStockPickMarketRegimeBanner({ ctx, displayLimit }) {
  if (!ctx?.ready) return null

  const limitLabel = Number.isFinite(displayLimit) ? `TOP${displayLimit}` : "전체"
  const positionLabel = ctx.marketPositionLabel
    ? `${ctx.marketPositionEmoji} ${ctx.marketPositionLabel}구간`
    : `${ctx.macroEmoji} ${ctx.macroLabel}`

  return (
    <section className="yds-spick-regime-banner" aria-label="시장상태 연동">
      <p className="yds-spick-regime-banner__head">
        <span className="yds-spick-regime-banner__emoji">{ctx.marketPositionEmoji ?? ctx.macroEmoji}</span>
        <strong>{positionLabel}</strong>
        <span className="yds-spick-regime-banner__score font-mono tabular-nums">
          패닉 {ctx.ydsScore ?? "—"}
        </span>
      </p>
      <p className="yds-spick-regime-banner__copy">
        패닉 {ctx.macroEmoji} {ctx.macroLabel} · 매수 강도 보조 · {limitLabel} 노출
      </p>
    </section>
  )
}
