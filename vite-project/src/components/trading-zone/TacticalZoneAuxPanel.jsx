import { buildAuxIndicatorDetail } from "../../trading-zone/tradingZoneAuxIndicators.js"
import { TRADING_ZONE_STANDARD_AUX } from "../../trading-zone/tacticalTradingZoneData.js"

/**
 * @param {{
 *   position: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition
 *   stockEvaluation?: import("../../trading-zone/tradingZoneStockEvaluation.js").TradingZoneStockEvaluation | null
 * }} props
 */
export default function TacticalZoneAuxPanel({ position, stockEvaluation = null }) {
  const strip =
    stockEvaluation?.dataReady && stockEvaluation.auxStrip?.length
      ? stockEvaluation.auxStrip
      : null

  if (strip?.length) {
    return (
      <div className="tactical-zone-aux-strip" role="list" aria-label="보조지표">
        {strip.map((item) => (
          <span
            key={item.key}
            className={[
              "tactical-zone-aux-metric",
              item.tone ? `tactical-zone-aux-metric--${item.tone}` : "",
            ].join(" ")}
            role="listitem"
          >
            <span className="tactical-zone-aux-metric__key">{item.key}</span>
            <span className="tactical-zone-aux-metric__val">{item.display}</span>
          </span>
        ))}
      </div>
    )
  }

  const fallback = TRADING_ZONE_STANDARD_AUX.map((tag) => {
    const detail = buildAuxIndicatorDetail(position, tag)
    if (!detail) return null
    const firstLine = detail.lines[0]?.text ?? detail.headlineText
    const display =
      tag === "RSI" && firstLine
        ? firstLine.replace(/[^\d]/g, "").slice(0, 3) || "—"
        : detail.statusIcon === "🟢"
          ? "▲"
          : detail.statusIcon === "🔴"
            ? "▼"
            : "→"
    const tone =
      display === "▲" ? "up" : display === "▼" ? "down" : ("flat")
    return { key: tag, display, tone }
  }).filter(Boolean)

  if (!fallback.length) {
    return <p className="m-0 tactical-zone-aux-strip__pending">보조지표 데이터 준비 중</p>
  }

  return (
    <div className="tactical-zone-aux-strip" role="list" aria-label="보조지표">
      {fallback.map((item) => (
        <span
          key={item.key}
          className={[
            "tactical-zone-aux-metric",
            item.tone ? `tactical-zone-aux-metric--${item.tone}` : "",
          ].join(" ")}
          role="listitem"
        >
          <span className="tactical-zone-aux-metric__key">{item.key}</span>
          <span className="tactical-zone-aux-metric__val">{item.display}</span>
        </span>
      ))}
    </div>
  )
}
