import {
  ENGINE_LINK_CARD_ORDER,
  ENGINE_LINK_HORIZON_DOT,
} from "../../trading-zone/tradingZoneEngineLink.js"
import {
  resolveHorizonStatusLabel,
  resolveHorizonStatusTone,
} from "../../trading-zone/marketPolicyEngine.js"

/**
 * @param {{
 *   link: import("../../trading-zone/tradingZoneEngineLink.js").TradingZoneEngineLink
 *   marketPolicy?: {
 *     marketState?: string
 *     riskLevel?: string
 *     marketTransition?: { changed?: boolean; directionTag?: string; transitionStrength?: string } | null
 *     actionLines?: { primary?: string; caution?: string; execution?: string }
 *     actionPolicy?: { items?: { key: string; icon: string; text: string; level: string }[] }
 *   } | null
 *   hideTitle?: boolean
 * }} props
 */
export default function TacticalEngineLinkBar({ link, marketPolicy = null, hideTitle = false }) {
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

  const actionLines = marketPolicy?.actionLines ?? link.actionLines ?? null
  const transitionConfidence = marketPolicy?.marketTransition?.transitionConfidence ?? 0
  const showTransition = marketPolicy?.marketTransition?.changed && transitionConfidence >= 40
  const actionRowsRaw = actionLines
    ? [
        { key: "primary", icon: "🟢", text: actionLines.primary ?? "", tone: "allow" },
        { key: "execution", icon: "🧭", text: actionLines.execution ?? "", tone: "allow" },
        { key: "caution", icon: "⚠", text: actionLines.caution ?? "", tone: "warn" },
      ].filter((row) => row.text)
    : (marketPolicy?.actionPolicy?.items?.length ? marketPolicy.actionPolicy.items : link.actions).map((line) => {
        const text = typeof line === "string" ? line : line.text
        const level = typeof line === "string" ? (/제한|축소|경계/.test(line) ? "danger" : "safe") : line.level
        const tone = level === "danger" ? "warn" : level === "caution" ? "warn" : "allow"
        const icon = typeof line === "string" ? (tone === "warn" ? "⚠" : "🟢") : line.icon
        return { key: typeof line === "string" ? line : line.key, icon, text, tone }
      })
  const actionRows = (() => {
    const seen = new Set()
    return actionRowsRaw.filter((row) => {
      const normalized = String(row.text ?? "").replace(/\s+/g, " ").trim()
      if (!normalized || seen.has(normalized)) return false
      seen.add(normalized)
      return true
    }).slice(0, 3)
  })()

  return (
    <div className="tactical-zone-engine-link" aria-label="시장 엔진 연계">
      <div className="tactical-zone-engine-link__market-card">
        <p className="m-0 tactical-zone-engine-link__market-head">현재 시장 상태</p>
        <div className="tactical-zone-engine-link__status-grid">
          {orderedCards.map((c) => {
            const hint = c.scoreHint ?? c.action
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
                <span className="tactical-zone-market-status__top-bar" aria-hidden />
                <p className="m-0 tactical-zone-market-status__period">
                  <span className="tactical-zone-market-status__dot" aria-hidden>
                    {dot}
                  </span>
                  {c.period} {horizonLabel}
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

      {actionRows.length || link.macroStage ? (
        <div className="tactical-zone-engine-link__action-card tactical-zone-engine-link__action-card--emphasis tactical-zone-engine-link__action-card--slim">
          {actionRows.length ? (
            <>
              <p className="m-0 tactical-zone-engine-link__action-head">현재 행동</p>
              {showTransition ? (
                <p className="m-0 tactical-zone-engine-link__macro-stage">
                  <span className="tactical-zone-engine-link__macro-stage-head">변화:</span>
                  <span className="tactical-zone-engine-link__macro-stage-val">
                    {transitionConfidence >= 85 ? "🚨 강한 변화 감지 " : ""}
                    {marketPolicy.marketTransition.directionTag} ({transitionConfidence})
                  </span>
                </p>
              ) : null}
              <ul className="tactical-zone-engine-link__action-list m-0 list-none p-0">
                {actionRows.map((row) => {
                  const label = row.text.replace(/\s*\/\s*/g, "·").replace(/\s+/g, " ").trim()
                  return (
                    <li
                      key={row.key}
                      className={[
                        "tactical-zone-engine-link__action-line",
                        `tactical-zone-engine-link__action-line--${row.tone}`,
                      ].join(" ")}
                    >
                      <span className="tactical-zone-engine-link__action-icon" aria-hidden>
                        {row.icon}
                      </span>
                      <span>{label}</span>
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
