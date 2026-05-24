import { useMemo } from "react"
import {
  TRADING_ZONE_STANDARD_AUX,
} from "../../trading-zone/tacticalTradingZoneData.js"
import { buildAuxIndicatorDetail } from "../../trading-zone/tradingZoneAuxIndicators.js"

/**
 * @param {{
 *   position: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition
 *   activeAux: Set<string>
 *   expandedAux: string | null
 *   onToggle: (key: string) => void
 * }} props
 */
export default function TacticalZoneAuxPanel({ position, activeAux, expandedAux, onToggle }) {
  const detail = useMemo(() => {
    if (!expandedAux) return null
    return buildAuxIndicatorDetail(position, expandedAux)
  }, [position, expandedAux])

  return (
    <div className="tactical-zone-aux-panel">
      <div className="tactical-zone-aux-panel__tags" role="group" aria-label="보조지표 선택">
        {TRADING_ZONE_STANDARD_AUX.map((tag) => {
          const isSelected = expandedAux === tag
          const isMonitored = activeAux.has(tag)
          return (
            <button
              key={tag}
              type="button"
              className={[
                "tactical-zone-aux-tag",
                isSelected ? "tactical-zone-aux-tag--active" : "tactical-zone-aux-tag--idle",
                isMonitored && !isSelected ? "tactical-zone-aux-tag--monitored" : "",
              ].join(" ")}
              aria-pressed={isSelected}
              aria-expanded={isSelected}
              onClick={() => onToggle(tag)}
            >
              {tag}
            </button>
          )
        })}
      </div>

      <div
        className={[
          "tactical-zone-aux-panel__slot",
          detail ? "tactical-zone-aux-panel__slot--visible" : "",
        ].join(" ")}
        aria-hidden={!detail}
      >
        <div
          className={[
            "tactical-zone-aux-detail",
            detail ? "tactical-zone-aux-detail--visible" : "",
          ].join(" ")}
          data-tone={detail?.statusTone ?? "warn"}
          role="region"
          aria-label={detail ? `${detail.title} 상세` : undefined}
        >
          {detail ? (
            <div className="tactical-zone-aux-detail__inner">
              <p className="m-0 tactical-zone-aux-detail__headline">
                {detail.statusIcon ? (
                  <span className="tactical-zone-aux-detail__icon" aria-hidden>
                    {detail.statusIcon}{" "}
                  </span>
                ) : null}
                {detail.headlineText}
              </p>
              {detail.lines.length > 0 ? (
                <ul className="m-0 list-none p-0 tactical-zone-aux-detail__lines">
                  {detail.lines.map((line) => (
                    <li key={line.text} className="tactical-zone-aux-detail__line">
                      {line.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
