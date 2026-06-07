import { useMemo } from "react"
import { resolveUnifiedMarketRegime } from "../../content/ydsStateEngine.js"

/**
 * V2.0 UX — 단일 Market Regime 카드 (State + Regime 통합)
 */
export default function YdsMarketRegimeCard({
  panicData = null,
  historyRows = [],
  momentumData = null,
  compact = false,
}) {
  const regime = useMemo(
    () => resolveUnifiedMarketRegime(panicData, historyRows, momentumData),
    [panicData, historyRows, momentumData],
  )

  if (!regime) return null

  return (
    <article
      className={["yds-market-regime", compact ? "yds-market-regime--compact" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-label="Market Regime"
    >
      {!compact ? <p className="yds-market-regime__tag">Market Regime</p> : null}
      <p
        className="yds-market-regime__title"
        style={{ "--regime-color": regime.color }}
      >
        {regime.emoji} {regime.label}
      </p>
      {regime.contextLines.length ? (
        <ul className="yds-market-regime__context">
          {regime.contextLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {!compact ? (
        <p className="yds-market-regime__metric font-mono tabular-nums">
          CNN {Math.round(regime.cnn ?? 0)} · BofA {(regime.bofa ?? 0).toFixed(1)}
        </p>
      ) : null}
    </article>
  )
}
