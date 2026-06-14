/**
 * @param {{
 *   ctx: import("../../content/ydsMarketAdapter.js").YdsMarketAdapterContext
 *   displayLimit: number
 * }} props
 */
export default function YdsStockPickMarketRegimeBanner({ ctx, displayLimit }) {
  if (!ctx?.ready) return null

  const limitLabel = Number.isFinite(displayLimit) ? `TOP${displayLimit}` : "전체"

  return (
    <section className="yds-spick-regime-banner" aria-label="시장상태 연동">
      <p className="yds-spick-regime-banner__head">
        <span className="yds-spick-regime-banner__emoji">{ctx.macroEmoji}</span>
        <strong>{ctx.macroLabel}</strong>
        <span className="yds-spick-regime-banner__score font-mono tabular-nums">
          패닉 {ctx.ydsScore}
        </span>
      </p>
      <p className="yds-spick-regime-banner__copy">
        {ctx.strategyEmoji} {ctx.strategyLabel} · {limitLabel} 노출
      </p>
    </section>
  )
}
