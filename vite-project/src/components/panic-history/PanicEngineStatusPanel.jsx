import {
  MACRO_MARKET_STATUS_BAR,
  TACTICAL_ACTION_STATUS_BAR,
  resolveStatusBarIndex,
} from "../../panic-v2/panicEngineStatusUi.js"

/**
 * @param {{
 *   segments: { id: string; label: string; emoji: string }[]
 *   activeIndex: number
 *   layout?: "row" | "stack"
 * }} props
 */
function PanicEngineStatusBar({ segments, activeIndex, layout = "row" }) {
  const isStack = layout === "stack"
  return (
    <div
      className={["panic-engine-status-bar", isStack ? "panic-engine-status-bar--stack" : ""].join(" ")}
      role="list"
      aria-label="상태 구간"
    >
      {segments.map((seg, i) => (
        <span key={seg.id} className="panic-engine-status-bar__segment" role="listitem">
          {!isStack && i > 0 ? <span className="panic-engine-status-bar__sep" aria-hidden>─</span> : null}
          <span
            className={[
              "panic-engine-status-bar__chip",
              i === activeIndex ? "panic-engine-status-bar__chip--active" : "",
              `panic-engine-status-bar__chip--${seg.id}`,
            ].join(" ")}
          >
            {i === activeIndex ? (
              <span className="panic-engine-status-bar__marker" aria-hidden>
                ▲
              </span>
            ) : null}
            <span className="panic-engine-status-bar__emoji" aria-hidden>
              {seg.emoji}
            </span>
            <span className="panic-engine-status-bar__label">{seg.label}</span>
          </span>
        </span>
      ))}
    </div>
  )
}

/**
 * @param {{
 *   variant: "macro" | "tactical"
 *   score: number | string
 *   scoreLabel?: string
 *   status: {
 *     badge?: string
 *     title?: string
 *     hint?: string
 *     action?: string
 *     bandLabel?: string
 *     eventLabel?: string
 *   } | null
 *   barSegments: { id: string; label: string; emoji: string; min?: number; max?: number }[]
 *   activeBarIndex: number
 * }} props
 */
export default function PanicEngineStatusPanel({
  variant,
  score,
  scoreLabel = "현재",
  status,
  barSegments,
  activeBarIndex,
}) {
  const badgeTitle = variant === "macro" ? (status?.title ?? "현재 시장") : "현재 행동"
  const badgeValue = status?.badge ?? status?.eventLabel ?? status?.bandLabel ?? "—"
  const hint = status?.hint ?? ""
  const actionLine = variant === "tactical" ? status?.action : null

  return (
    <div
      className={[
        "panic-engine-status-panel",
        variant === "macro" ? "panic-engine-status-panel--macro" : "panic-engine-status-panel--tactical",
      ].join(" ")}
    >
      <div className="panic-engine-status-panel__top">
        <div className="panic-engine-status-panel__score-block">
          <span className="panic-engine-status-panel__score-label">{scoreLabel}</span>
          <p className="panic-engine-status-panel__score m-0 font-mono tabular-nums">{score}</p>
        </div>
        <div className="panic-engine-status-panel__badge-block">
          <p className="panic-engine-status-panel__badge-title m-0">{badgeTitle}</p>
          <p className="panic-engine-status-panel__badge-value m-0">{badgeValue}</p>
          {actionLine ? <p className="panic-engine-status-panel__action m-0">{actionLine}</p> : null}
          {hint ? <p className="panic-engine-status-panel__hint m-0">{hint}</p> : null}
        </div>
      </div>
      <PanicEngineStatusBar
        segments={barSegments}
        activeIndex={activeBarIndex >= 0 ? activeBarIndex : 0}
        layout={variant === "tactical" ? "stack" : "row"}
      />
    </div>
  )
}

export { MACRO_MARKET_STATUS_BAR, TACTICAL_ACTION_STATUS_BAR, resolveStatusBarIndex }
