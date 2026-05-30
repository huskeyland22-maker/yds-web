import {
  ENGINE_LINK_CARD_ORDER,
  ENGINE_LINK_HORIZON_DOT,
} from "../../trading-zone/tradingZoneEngineLink.js"
import {
  resolveHorizonStatusLabel,
  resolveHorizonStatusTone,
} from "../../trading-zone/marketPolicyEngine.js"
import TacticalTodayActionBar from "./TacticalTodayActionBar.jsx"
import TacticalMacroProgress from "./TacticalMacroProgress.jsx"

/**
 * @param {{
 *   link: import("../../trading-zone/tradingZoneEngineLink.js").TradingZoneEngineLink
 *   marketPolicy?: import("../../trading-zone/marketPolicyEngine.js").ReturnType<typeof import("../../trading-zone/marketPolicyEngine.js").buildMarketPolicy> | null
 *   panicScore?: number | null
 *   hideTitle?: boolean
 * }} props
 */
export default function TacticalEngineLinkBar({
  link,
  marketPolicy = null,
  panicScore = null,
  hideTitle = false,
}) {
  if (!link.ready) {
    return (
      <div className="tactical-zone-engine-link tactical-zone-engine-link--pending">
        {!hideTitle ? (
          <p className="m-0 tactical-zone-engine-link__section-title">시장 엔진 연계</p>
        ) : null}
        <p className="m-0 mt-1 text-[13px] text-slate-500">패닉·사이클 입력 후 연동</p>
      </div>
    )
  }

  const cardById = Object.fromEntries(link.cards.map((c) => [c.id, c]))
  const orderedCards = ENGINE_LINK_CARD_ORDER.map((id) => cardById[id]).filter(Boolean)
  const statusLabel = (card) => resolveHorizonStatusLabel(card, marketPolicy?.marketState ?? "neutral")

  const transitionConfidence = marketPolicy?.marketTransition?.transitionConfidence ?? 0
  const showTransition = marketPolicy?.marketTransition?.changed && transitionConfidence >= 40

  return (
    <div className="tactical-zone-engine-link" aria-label="시장 엔진 연계">
      <div className="tactical-zone-engine-link__market-card">
        <p className="m-0 tactical-zone-engine-link__market-head">시장 상태</p>
        <div className="tactical-zone-engine-link__status-grid">
          {orderedCards.map((c) => {
            const dot = ENGINE_LINK_HORIZON_DOT[c.id] ?? "⚪"
            const horizonLabel = statusLabel(c)
            const labelTone = resolveHorizonStatusTone(horizonLabel)
            return (
              <div
                key={c.id}
                className="tactical-zone-market-status"
                data-horizon={c.id}
                data-status-tone={labelTone}
              >
                <p className="m-0 tactical-zone-market-status__score font-mono tabular-nums">
                  {c.score ?? "—"}
                </p>
                <p className="m-0 tactical-zone-market-status__period">
                  <span className="tactical-zone-market-status__dot" aria-hidden>
                    {dot}
                  </span>
                  {c.period}
                </p>
                <p className="m-0 tactical-zone-market-status__label">{horizonLabel}</p>
              </div>
            )
          })}
        </div>
      </div>

      <TacticalTodayActionBar marketPolicy={marketPolicy} />
      <TacticalMacroProgress panicScore={panicScore} />

      {showTransition ? (
        <p className="m-0 tactical-zone-engine-link__transition">
          <span className="tactical-zone-engine-link__transition-head">변화</span>
          <span className="tactical-zone-engine-link__transition-val">
            {transitionConfidence >= 85 ? "🚨 강한 변화 " : ""}
            {marketPolicy?.marketTransition?.directionTag} ({transitionConfidence})
          </span>
        </p>
      ) : null}
    </div>
  )
}
