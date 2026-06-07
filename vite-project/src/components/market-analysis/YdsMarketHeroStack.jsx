import { useMemo } from "react"
import { resolveTodayActions } from "../../content/ydsActionGuide.js"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"
import { resolveOverheatLayer } from "../../content/ydsOverheatLayer.js"
import { resolveEventLayer } from "../../content/ydsEventLayer.js"
import {
  resolveMomentumPositionLabel,
  resolveYdsStatusSnapshot,
} from "../../content/ydsStatusLabels.js"
import { getFinalScore } from "../../utils/tradingScores.js"
import YdsEventLayerCard from "./YdsEventLayerCard.jsx"
import YdsPanicDistanceCard from "./YdsPanicDistanceCard.jsx"
import YdsRegimeLevelCard from "./YdsRegimeLevelCard.jsx"
import YdsDataSourceBadge from "./YdsDataSourceBadge.jsx"

/**
 * V1.3 Hero — 장기(사이클·패닉) → 단기(Momentum) → 해석 → 실행
 * @param {{ panicData?: object | null; historyRows?: object[]; scorecardByType?: import("../../content/ydsEventScorecard.js").EventScorecardMap | null }} props
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
    if (!snapshot.cycle || !snapshot.panic || !actions || !overheat) return null

    return { ...snapshot, momentumData, momentum, overheat, actions, eventLayer }
  }, [panicData, historyRows])

  if (!view) return null

  const { cycle, panic, ydsScore, headline, momentum, momentumData, overheat, actions } = view
  const momentumActive = momentum.tier !== "calm"
  const overheatActive = overheat.id !== "normal"

  return (
    <section className="yds-market-hero" aria-label="YDS 시장 Hero">
      <div className="yds-market-hero__header">
        <span className="yds-market-hero__header-spacer" aria-hidden />
        <YdsDataSourceBadge />
      </div>
      <div className="yds-market-hero__long-term">
        <article
          className="yds-market-hero__score-card"
          aria-label={`사이클 위치 ${cycle.score}`}
        >
          <p className="yds-market-hero__card-label">사이클 위치</p>
          <p className="yds-market-hero__score font-mono tabular-nums">{cycle.score}</p>
          <p
            className="yds-market-hero__status"
            style={{ "--hero-color": cycle.color }}
          >
            {cycle.emoji} {cycle.label}
          </p>
        </article>

        <article
          className="yds-market-hero__score-card"
          aria-label={`패닉 강도 ${ydsScore}`}
        >
          <p className="yds-market-hero__card-label">패닉 강도</p>
          <p className="yds-market-hero__score font-mono tabular-nums">{ydsScore}</p>
          <p
            className="yds-market-hero__status"
            style={{ "--hero-color": panic.color }}
          >
            {panic.emoji} {panic.label}
          </p>
        </article>
      </div>

      <YdsRegimeLevelCard
        panicData={panicData}
        historyRows={historyRows}
        momentumData={momentumData}
      />

      <article
        className={[
          "yds-market-hero__overheat-card",
          overheatActive ? "yds-market-hero__overheat-card--active" : "",
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
        <p className="yds-market-hero__overheat-metric font-mono tabular-nums">
          CNN {Math.round(overheat.cnn)} · BofA {overheat.bofa.toFixed(1)}
        </p>
      </article>

      <article
        className={[
          "yds-market-hero__momentum-card",
          momentumActive ? "yds-market-hero__momentum-card--active" : "",
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
          ) : (
            <span className="yds-market-hero__muted">CNN · BofA 데이터 수집 중</span>
          )}
        </p>
        <p className="yds-market-hero__momentum-detail">{momentum.detail}</p>
      </article>

      <YdsEventLayerCard
        panicData={panicData}
        historyRows={historyRows}
        embedded
        scorecardByType={scorecardByType}
      />

      {headline ? (
        <p className="yds-market-hero__headline">
          {headline.emoji} {headline.text}
        </p>
      ) : null}

      <YdsPanicDistanceCard score={ydsScore} />

      <div className="yds-market-hero__action" aria-label="오늘의 행동">
        <h2 className="yds-market-hero__action-title">오늘의 행동</h2>
        <ul className="yds-market-hero__action-list">
          {actions.actions.map((item) => (
            <li key={item} className="yds-market-hero__action-item">
              ✓ {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
