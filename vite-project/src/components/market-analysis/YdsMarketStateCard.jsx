import { useMemo } from "react"
import { MACRO_V1_STATUS_BANDS, resolveMacroV1Status } from "../../panic-v2/panicMacroV1Status.js"
import { YDS_FEAR_CYCLE_RAIL } from "../../content/ydsCyclePhilosophy.js"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"
import {
  MARKET_LABEL_MARKET_STATE,
  marketPanicLabelForMacroStage,
  resolveMarketStageSnapshot,
} from "../../content/ydsMarketStageLabels.js"
import { getFinalScore } from "../../utils/tradingScores.js"
import { resolveYdsStageNavigation } from "../../utils/ydsStageNavigation.js"

/**
 * 시장 상태 — 현재 위치 · 다음 단계 (3초 이해용)
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string; embedded?: boolean }} props
 */
export default function YdsMarketStateCard({
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
    const fearStage = resolveMacroV1Status(rounded)
    const nav = resolveYdsStageNavigation(rounded)
    if (!snapshot?.panic || !fearStage || !nav) return null

    const nextLabel = nav.nextStage
      ? marketPanicLabelForMacroStage(nav.nextStage.id) ?? nav.nextStage.label
      : null
    const nextLine = nav.nextStage
      ? nav.pointsToNext === 0
        ? `${nextLabel} 진입 임박`
        : `${nextLabel}까지 +${nav.pointsToNext}점`
      : nav.nextLine

    return {
      ydsScore: rounded,
      panic: snapshot.panic,
      fearStage,
      nav,
      nextLine,
    }
  }, [panicData, historyRows])

  if (!model) return null

  const { ydsScore, panic, fearStage, nextLine, nav } = model

  const scoreCard = (
    <article
      className={[
        "yds-market-hero__score-card",
        "yds-market-hero__score-card--state",
        embedded ? "yds-market-hero__score-card--embedded" : "yds-market-hero__score-card--solo",
      ].join(" ")}
      aria-label={`${MARKET_LABEL_MARKET_STATE} ${panic.label}`}
    >
      <p className="yds-market-hero__card-label">{MARKET_LABEL_MARKET_STATE}</p>

      <div className="yds-market-hero__priority">
        <p className="yds-market-hero__status yds-market-hero__status--hero" style={{ "--hero-color": panic.color }}>
          <span aria-hidden>{panic.emoji}</span> {panic.label}
        </p>
        <p className="yds-market-hero__panic-score-line font-mono tabular-nums">
          패닉점수 <strong>{ydsScore}</strong>
        </p>
      </div>

      <div className="yds-market-hero__position-block">
        <p className="yds-market-hero__section-label">현재 위치</p>
        <div className="yds-market-hero__rail" aria-hidden>
          {YDS_FEAR_CYCLE_RAIL.map((step) => {
            const active = step.id === fearStage.id
            const band = MACRO_V1_STATUS_BANDS.find((b) => b.id === step.id)
            return (
              <span
                key={step.id}
                className={[
                  "yds-market-hero__chip",
                  active ? "yds-market-hero__chip--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={active ? { "--chip-color": band?.color ?? "#94a3b8" } : undefined}
              >
                {step.emoji} {step.short}
              </span>
            )
          })}
        </div>
        <p className="yds-market-hero__position-value" style={{ "--hero-color": fearStage.color }}>
          <span aria-hidden>{fearStage.emoji}</span> {fearStage.label}
        </p>
      </div>

      {nav.nextStage ? (
        <div className="yds-market-hero__next-block">
          <p className="yds-market-hero__section-label">다음 단계</p>
          <p className="yds-market-hero__next-line">{nextLine}</p>
        </div>
      ) : null}
    </article>
  )

  if (embedded) {
    return scoreCard
  }

  return (
    <section className={["yds-market-state-card", className].filter(Boolean).join(" ")}>
      <h2 className="yds-market-desk__block-label">{MARKET_LABEL_MARKET_STATE}</h2>
      {scoreCard}
    </section>
  )
}
