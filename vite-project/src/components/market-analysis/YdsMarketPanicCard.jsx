import { useMemo } from "react"
import { resolveEventLayer } from "../../content/ydsEventLayer.js"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"
import { resolveMarketLevelRegime } from "../../content/ydsRegimeLayer.js"
import { resolveMarketState } from "../../content/ydsStateEngine.js"
import {
  MARKET_LABEL_PANIC_INTENSITY,
  resolveMarketStageSnapshot,
} from "../../content/ydsMarketStageLabels.js"
import { PANIC_INDEX_CORE_HISTORY_METRICS } from "../../utils/panicDeskMetrics.js"
import { getFinalScore } from "../../utils/tradingScores.js"
import YdsLayerStackIndicator from "./YdsLayerStackIndicator.jsx"

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function formatMetric(key, value) {
  if (!Number.isFinite(value)) return "—"
  if (key === "fearGreed") return String(Math.round(value))
  if (key === "bofa") return value.toFixed(1)
  if (key === "vix") return value.toFixed(1)
  return value.toFixed(1)
}

/**
 * 패닉 강도 — 핵심 지표 · 이벤트 (간결)
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string; embedded?: boolean }} props
 */
export default function YdsMarketPanicCard({
  panicData = null,
  historyRows = [],
  className = "",
  embedded = false,
}) {
  const model = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null
    const rounded = Math.max(0, Math.min(100, Math.round(score)))
    const momentum = resolveMomentumLayer(panicData, historyRows)
    const snapshot = resolveMarketStageSnapshot(rounded, momentum)
    if (!snapshot.panic) return null

    const eventLayer = resolveEventLayer(panicData, historyRows)
    const levelRegime = resolveMarketLevelRegime(panicData, historyRows, momentum)
    const marketState = resolveMarketState(panicData, historyRows, momentum)

    const metrics = PANIC_INDEX_CORE_HISTORY_METRICS.map((m) => {
      const field = m.key === "fearGreed" ? "fearGreed" : m.key
      const value = toNum(panicData[field])
      return {
        key: m.key,
        label: m.shortLabel ?? m.chartLabel,
        display: formatMetric(m.key, value),
        accent: m.accent,
      }
    })

    const topEvent = eventLayer.events[0] ?? null

    return {
      ydsScore: rounded,
      panic: snapshot.panic,
      metrics,
      topEvent,
      momentum,
      eventLayer,
      levelRegime,
      marketState,
    }
  }, [panicData, historyRows])

  if (!model) return null

  const { ydsScore, metrics, topEvent, momentum, eventLayer, levelRegime, marketState } = model

  const scoreCard = (
    <article
      className={[
        "yds-market-hero__score-card",
        "yds-market-hero__score-card--panic",
        embedded ? "yds-market-hero__score-card--embedded" : "yds-market-hero__score-card--solo",
      ].join(" ")}
      aria-label={MARKET_LABEL_PANIC_INTENSITY}
    >
      <p className="yds-market-hero__card-label">{MARKET_LABEL_PANIC_INTENSITY}</p>

      <div className="yds-market-hero__metrics-grid" aria-label="핵심 지표">
        {metrics.map((m) => (
          <div key={m.key} className="yds-market-hero__metric" style={{ "--metric-accent": m.accent }}>
            <span className="yds-market-hero__metric-label">{m.label}</span>
            <span className="yds-market-hero__metric-value font-mono tabular-nums">{m.display}</span>
          </div>
        ))}
      </div>

      {topEvent ? (
        <p className="yds-market-hero__event-line">
          <span className="yds-market-hero__event-tag">이벤트</span> {topEvent.title}
        </p>
      ) : null}

      <details className="yds-market-hero__fold">
        <summary className="yds-market-hero__fold-summary">근거 보기</summary>
        <ul className="yds-market-hero__evidence-list">
          {metrics.map((m) => (
            <li key={m.key}>
              <span>{m.label}</span>
              <span className="font-mono tabular-nums">{m.display}</span>
            </li>
          ))}
          <li>
            <span>이벤트</span>
            <span>{topEvent?.title ?? "—"}</span>
          </li>
        </ul>
      </details>

      <details className="yds-market-hero__fold">
        <summary className="yds-market-hero__fold-summary">세부 분석</summary>
        <YdsLayerStackIndicator
          compact
          levelLabel={
            marketState
              ? `${marketState.emoji} ${marketState.label}`
              : levelRegime?.level
                ? `${levelRegime.level.emoji} ${levelRegime.level.label}`
                : null
          }
          regimeLabel={
            levelRegime?.regime
              ? `${levelRegime.regime.emoji} ${levelRegime.regime.label}`
              : null
          }
          ydsScore={ydsScore}
          momentumLevel={momentum.level}
          eventLevel={eventLayer.level}
        />
      </details>
    </article>
  )

  if (embedded) {
    return scoreCard
  }

  return (
    <section className={["yds-market-panic-card", className].filter(Boolean).join(" ")}>
      <h2 className="yds-market-desk__block-label">{MARKET_LABEL_PANIC_INTENSITY}</h2>
      {scoreCard}
    </section>
  )
}
