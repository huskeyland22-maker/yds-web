import {
  MACRO_MARKET_STATUS_BAR,
  TACTICAL_ACTION_STATUS_BAR,
  resolveStatusBarIndex,
} from "../../panic-v2/panicEngineStatusUi.js"

/**
 * 거시 V1 / 실전 V2 공통 — 가로 5단계 상태바 + ▲
 * @param {{
 *   segments: { id: string; label: string; emoji: string }[]
 *   activeIndex: number
 * }} props
 */
function PanicEngineStatusBar({ segments, activeIndex }) {
  return (
    <div className="panic-engine-status-bar" role="list" aria-label="상태 구간">
      {segments.map((seg, i) => (
        <span key={seg.id} className="panic-engine-status-bar__segment" role="listitem">
          {i > 0 ? <span className="panic-engine-status-bar__sep" aria-hidden>─</span> : null}
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
 *     hint?: string
 *     eventLabel?: string
 *     bandLabel?: string
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
  const currentLabel = status?.badge ?? status?.eventLabel ?? status?.bandLabel ?? "—"
  const hint = status?.hint ?? ""

  return (
    <div
      className={[
        "panic-engine-status-panel",
        variant === "macro" ? "panic-engine-status-panel--macro" : "panic-engine-status-panel--tactical",
      ].join(" ")}
    >
      <div className="panic-engine-status-panel__grid">
        <div className="panic-engine-status-panel__score-block">
          <span className="panic-engine-status-panel__score-label">{scoreLabel}</span>
          <p className="panic-engine-status-panel__score m-0 font-mono tabular-nums">{score}</p>
        </div>

        <div className="panic-engine-status-panel__bar-wrap">
          <PanicEngineStatusBar
            segments={barSegments}
            activeIndex={activeBarIndex >= 0 ? activeBarIndex : 0}
          />
        </div>

        <div className="panic-engine-status-panel__badge-block">
          <p className="panic-engine-status-panel__badge-title m-0">현재</p>
          <p className="panic-engine-status-panel__badge-value m-0">{currentLabel}</p>
          {hint ? <p className="panic-engine-status-panel__hint m-0">{hint}</p> : null}
        </div>
      </div>
    </div>
  )
}

export { MACRO_MARKET_STATUS_BAR, TACTICAL_ACTION_STATUS_BAR, resolveStatusBarIndex }
