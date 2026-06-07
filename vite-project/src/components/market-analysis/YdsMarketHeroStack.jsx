import { useMemo } from "react"
import { resolveTodayActions } from "../../content/ydsActionGuide.js"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"
import { resolveOverheatLayer } from "../../content/ydsOverheatLayer.js"
import { resolveEventLayer } from "../../content/ydsEventLayer.js"
import {
  resolveMomentumPositionLabel,
  resolveYdsStatusSnapshot,
} from "../../content/ydsStatusLabels.js"
import { resolveUnifiedMarketRegime } from "../../content/ydsStateEngine.js"
import { getFinalScore } from "../../utils/tradingScores.js"
import YdsEventLayerCard from "./YdsEventLayerCard.jsx"
import YdsPanicDistanceCard from "./YdsPanicDistanceCard.jsx"
import YdsHeroQuickRead from "./YdsHeroQuickRead.jsx"
import YdsMarketRegimeCard from "./YdsMarketRegimeCard.jsx"
import YdsDataSourceBadge from "./YdsDataSourceBadge.jsx"

/**
 * V2.0 UX Hero — Quick Read → Why → Action → Details
 */
export default function YdsMarketHeroStack({ panicData = null, historyRows = [], scorecardByType = null }) {
  const view = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null

    const momentumData = resolveMomentumLayer(panicData, historyRows)
    const overheat = resolveOverheatLayer(panicData)
    const snapshot = resolveYdsStatusSnapshot(Math.round(score), momentumData)
    const momentum = resolveMomentumPositionLabel(momentumData)
    const actions = resolveTodayActions(Math.round(score), momentumData)
    const eventLayer = resolveEventLayer(panicData, historyRows)
    const unifiedRegime = resolveUnifiedMarketRegime(panicData, historyRows, momentumData)
    if (!snapshot.cycle || !snapshot.panic || !actions || !overheat) return null

    return {
      ...snapshot,
      momentumData,
      momentum,
      overheat,
      actions,
      eventLayer,
      unifiedRegime,
    }
  }, [panicData, historyRows])

  if (!view) return null

  const {
    cycle,
    panic,
    ydsScore,
    headline,
    momentum,
    momentumData,
    overheat,
    actions,
    unifiedRegime,
  } = view
  const momentumActive = momentum.tier !== "calm"
  const overheatActive = overheat.id !== "normal"
  const hideOverheat =
    !overheatActive ||
    unifiedRegime?.id === "overheatUnwind" ||
    unifiedRegime?.id === "correction"

  return (
    <section className="yds-market-hero" aria-label="YDS 시장 Hero">
      <div className="yds-market-hero__header">
        <span className="yds-market-hero__header-spacer" aria-hidden />
        <YdsDataSourceBadge />
      </div>

      {/* ① 현재 위치 + 행동 (5초) */}
      <YdsHeroQuickRead
        cycle={cycle}
        actions={actions}
        panicData={panicData}
        historyRows={historyRows}
        momentumData={momentumData}
        panicDistanceSlot={
          <YdsPanicDistanceCard
            score={ydsScore}
            panicLabel={panic.label}
            panicEmoji={panic.emoji}
            compact
          />
        }
      />

      {/* ② 왜 그렇게 판단하는가 */}
      <div className="yds-market-hero__why" aria-label="판단 근거">
        <YdsMarketRegimeCard
          panicData={panicData}
          historyRows={historyRows}
          momentumData={momentumData}
        />
        {momentumActive ? (
          <article
            className={[
              "yds-market-hero__momentum-card",
              "yds-market-hero__momentum-card--active",
              momentum.tier === "riskOff" ? "yds-market-hero__momentum-card--risk" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label="단기 Momentum"
          >
            <p className="yds-market-hero__layer-tag">Momentum · 단기 변화</p>
            <p
              className="yds-market-hero__momentum-title"
              style={{ "--hero-color": momentum.color }}
            >
              {momentum.emoji} {momentum.title}
            </p>
            <p className="yds-market-hero__momentum-detail">{momentum.detail}</p>
          </article>
        ) : null}
        {headline ? (
          <p className="yds-market-hero__headline yds-market-hero__headline--why">
            {headline.emoji} {headline.text}
          </p>
        ) : null}
      </div>

      {/* ③ 세부 근거 */}
      <details className="yds-market-hero__details">
        <summary className="yds-market-hero__details-toggle">세부 근거</summary>
        <div className="yds-market-hero__details-body">
          <div className="yds-market-hero__long-term">
            <article className="yds-market-hero__score-card" aria-label={`사이클 위치 ${cycle.score}`}>
              <p className="yds-market-hero__card-label">사이클 위치</p>
              <p className="yds-market-hero__score font-mono tabular-nums">{cycle.score}</p>
              <p className="yds-market-hero__status" style={{ "--hero-color": cycle.color }}>
                {cycle.emoji} {cycle.label}
              </p>
            </article>
            <article className="yds-market-hero__score-card" aria-label={`패닉 강도 ${ydsScore}`}>
              <p className="yds-market-hero__card-label">패닉 강도</p>
              <p className="yds-market-hero__score font-mono tabular-nums">{ydsScore}</p>
              <p className="yds-market-hero__status" style={{ "--hero-color": panic.color }}>
                {panic.emoji} {panic.label}
              </p>
            </article>
          </div>

          {!hideOverheat ? (
            <article
              className={[
                "yds-market-hero__overheat-card",
                "yds-market-hero__overheat-card--active",
                overheat.level === "critical" ? "yds-market-hero__overheat-card--critical" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label="Overheat Layer"
            >
              <p className="yds-market-hero__layer-tag">Overheat · 언제 덜어내는가</p>
              <p
                className="yds-market-hero__overheat-title"
                style={{ "--hero-color": overheat.color }}
              >
                {overheat.emoji} {overheat.label}
              </p>
              <p className="yds-market-hero__overheat-summary">{overheat.summary}</p>
              <p className="yds-market-hero__overheat-action">{overheat.action}</p>
            </article>
          ) : null}

          {momentumActive ? (
            <p className="yds-market-hero__momentum-metric font-mono tabular-nums">
              {momentumData.cnnDelta3d != null ? (
                <>
                  CNN {momentumData.cnnDelta3d > 0 ? "+" : ""}
                  {Math.round(momentumData.cnnDelta3d)}p
                  {momentumData.bofaDelta2w != null ? (
                    <span className="yds-market-hero__momentum-metric-sep">
                      {" "}
                      · BofA {momentumData.bofaDelta2w > 0 ? "+" : ""}
                      {momentumData.bofaDelta2w.toFixed(1)}
                    </span>
                  ) : null}
                </>
              ) : null}
            </p>
          ) : null}

          <YdsEventLayerCard
            panicData={panicData}
            historyRows={historyRows}
            embedded
            scorecardByType={scorecardByType}
          />
        </div>
      </details>
    </section>
  )
}
