import {
  ENGINE_LINK_CARD_ORDER,
  ENGINE_LINK_HORIZON_DOT,
} from "../../trading-zone/tradingZoneEngineLink.js"

/**
 * @param {{ link: import("../../trading-zone/tradingZoneEngineLink.js").TradingZoneEngineLink; hideTitle?: boolean }} props
 */
export default function TacticalEngineLinkBar({ link, hideTitle = false }) {
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
  const statusLabel = (card) => {
    const score = Number(card?.score)
    if (card?.id === "short") return score >= 65 ? "우호" : score >= 45 ? "경계" : "약세"
    if (card?.id === "mid") return score >= 62 ? "비중확대" : score >= 45 ? "중립" : "방어"
    if (card?.id === "long") return score >= 60 ? "우호" : score >= 42 ? "중립" : "보수"
    return score >= 62 ? "우호" : score >= 45 ? "중립" : "경계"
  }

  return (
    <div className="tactical-zone-engine-link" aria-label="시장 엔진 연계">
      <div className="tactical-zone-engine-link__market-card">
        <p className="m-0 tactical-zone-engine-link__market-head">현재 시장 상태</p>
        <div className="tactical-zone-engine-link__status-grid">
          {orderedCards.map((c) => {
            const hint = c.scoreHint ?? c.action
            const dot = ENGINE_LINK_HORIZON_DOT[c.id] ?? "⚪"
            return (
              <div key={c.id} className="tactical-zone-market-status" data-horizon={c.id}>
                <span className="tactical-zone-market-status__top-bar" aria-hidden />
                <p className="m-0 tactical-zone-market-status__period">
                  <span className="tactical-zone-market-status__dot" aria-hidden>
                    {dot}
                  </span>
                  {c.period} {statusLabel(c)}
                </p>
                <p className="m-0 tactical-zone-market-status__score font-mono tabular-nums">
                  {c.score ?? "—"}
                </p>
                <p className="m-0 tactical-zone-market-status__label">{hint}</p>
              </div>
            )
          })}
        </div>
      </div>

      {link.actions.length || link.macroStage ? (
        <div className="tactical-zone-engine-link__action-card tactical-zone-engine-link__action-card--emphasis tactical-zone-engine-link__action-card--slim">
          {link.actions.length ? (
            <>
              <p className="m-0 tactical-zone-engine-link__action-head">현재 행동</p>
              <ul className="tactical-zone-engine-link__action-list m-0 list-none p-0">
                {link.actions.map((line) => {
                  const isRestrict = /제한|축소|경계/.test(line)
                  const tone = isRestrict ? "warn" : "allow"
                  const icon = isRestrict ? "⚠" : "🟢"
                  const text = line.replace(/\s*\/\s*/g, "·").replace(/\s+/g, " ").trim()
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
                      <span>{text}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : null}
          {link.macroStage ? (
            <p className="m-0 tactical-zone-engine-link__macro-stage">
              <span className="tactical-zone-engine-link__macro-stage-head">거시단계:</span>
              <span className="tactical-zone-engine-link__macro-stage-val">
                <span aria-hidden>{link.macroStage.emoji}</span> {link.macroStage.label}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
