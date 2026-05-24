import {
  ENGINE_LINK_CARD_ORDER,
  ENGINE_LINK_HORIZON_DOT,
} from "../../trading-zone/tradingZoneEngineLink.js"

/**
 * @param {{ link: import("../../trading-zone/tradingZoneEngineLink.js").TradingZoneEngineLink }} props
 */
export default function TacticalEngineLinkBar({ link }) {
  if (!link.ready) {
    return (
      <div className="tactical-zone-engine-link tactical-zone-engine-link--pending">
        <p className="m-0 tactical-zone-engine-link__section-title">시장 엔진 연계</p>
        <p className="m-0 mt-1 text-[13px] text-slate-500">패닉·사이클 입력 후 연동</p>
      </div>
    )
  }

  const cardById = Object.fromEntries(link.cards.map((c) => [c.id, c]))
  const orderedCards = ENGINE_LINK_CARD_ORDER.map((id) => cardById[id]).filter(Boolean)
  const actionLine = link.actionSummary || ""

  return (
    <div className="tactical-zone-engine-link" aria-label="시장 엔진 연계">
      <p className="m-0 tactical-zone-engine-link__section-title">시장 엔진 연계</p>

      <div className="tactical-zone-engine-link__market-card">
        <p className="m-0 tactical-zone-engine-link__market-head">현재 시장 상태</p>
        <div className="tactical-zone-engine-link__status-grid">
          {orderedCards.map((c) => {
            const hint = c.scoreHint ?? c.action
            const dot = ENGINE_LINK_HORIZON_DOT[c.id] ?? "⚪"
            return (
              <div key={c.id} className="tactical-zone-market-status">
                <p className="m-0 tactical-zone-market-status__line font-mono tabular-nums">
                  <span className="tactical-zone-market-status__dot" aria-hidden>
                    {dot}
                  </span>
                  <span className="tactical-zone-market-status__label">{c.period}</span>
                  <span className="tactical-zone-market-status__score">{c.score ?? "—"}</span>
                  <span className="tactical-zone-market-status__hint">{hint}</span>
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {actionLine ? (
        <div className="tactical-zone-engine-link__action-card tactical-zone-engine-link__action-card--emphasis tactical-zone-engine-link__action-card--slim">
          <p className="m-0 tactical-zone-engine-link__action-head">현재 행동</p>
          <p className="m-0 tactical-zone-engine-link__action-oneline">{actionLine}</p>
        </div>
      ) : null}
    </div>
  )
}
