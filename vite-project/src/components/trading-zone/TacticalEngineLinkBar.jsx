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
        <p className="m-0 mt-1 text-[8px] text-slate-600">패닉·사이클 입력 후 연동</p>
      </div>
    )
  }

  const cardById = Object.fromEntries(link.cards.map((c) => [c.id, c]))
  const orderedCards = ENGINE_LINK_CARD_ORDER.map((id) => cardById[id]).filter(Boolean)

  return (
    <div className="tactical-zone-engine-link" aria-label="시장 엔진 연계">
      <p className="m-0 tactical-zone-engine-link__section-title">시장 엔진 연계</p>

      <div className="tactical-zone-engine-link__market-card mt-1">
        <p className="m-0 tactical-zone-engine-link__market-head">현재 시장 상태</p>
        <div className="tactical-zone-engine-link__status-grid">
          {orderedCards.map((c) => {
            const hint = c.scoreHint ?? c.action
            return (
              <div key={c.id} className="tactical-zone-market-status">
                <p className="m-0 tactical-zone-market-status__period">
                  <span aria-hidden>{ENGINE_LINK_HORIZON_DOT[c.id] ?? "⚪"}</span> {c.period}
                </p>
                <p className="m-0 tactical-zone-market-status__score font-mono tabular-nums">
                  {c.score ?? "—"}
                </p>
                <p className="m-0 tactical-zone-market-status__hint">{hint}</p>
              </div>
            )
          })}
        </div>
      </div>

      {link.actions.length ? (
        <div className="tactical-zone-engine-link__action-card tactical-zone-engine-link__action-card--emphasis tactical-zone-engine-link__action-card--compact mt-1">
          <p className="m-0 tactical-zone-engine-link__action-head">현재 행동</p>
          <ul className="tactical-zone-engine-link__action-list m-0 list-none p-0">
            {link.actions.map((line) => {
              const isRestrict = /제한|축소|경계/.test(line)
              const tone = isRestrict ? "warn" : "allow"
              const icon = isRestrict ? "⚠" : "🟢"
              return (
                <li
                  key={line}
                  className={[
                    "tactical-zone-engine-link__action-line",
                    `tactical-zone-engine-link__action-line--${tone}`,
                  ].join(" ")}
                >
                  <span className="tactical-zone-engine-link__action-icon" aria-hidden>
                    {icon}
                  </span>
                  <span>{line}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
