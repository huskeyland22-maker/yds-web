import { useMemo } from "react"
import { MARKET_LABEL_PANIC_INTENSITY } from "../../content/ydsMarketStageLabels.js"
import { resolvePanicActionView } from "../../content/ydsPanicActionView.js"
import { getFinalScore } from "../../utils/tradingScores.js"

/**
 * 패닉 강도 — 투자 행동 판단 (YDS 점수)
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string; embedded?: boolean }} props
 */
export default function YdsMarketPanicCard({
  panicData = null,
  historyRows: _historyRows = [],
  className = "",
  embedded = false,
}) {
  const view = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null
    return resolvePanicActionView(Math.round(score))
  }, [panicData])

  if (!view) return null

  const scoreCard = (
    <article
      className={[
        "yds-market-hero__score-card",
        "yds-market-hero__score-card--panic",
        embedded ? "yds-market-hero__score-card--embedded" : "yds-market-hero__score-card--solo",
      ].join(" ")}
      aria-label={`${MARKET_LABEL_PANIC_INTENSITY} ${view.score}`}
    >
      <p className="yds-market-hero__card-label">{MARKET_LABEL_PANIC_INTENSITY}</p>

      <p className="yds-market-hero__score-hero font-mono tabular-nums">{view.scoreDisplay}</p>

      <div className="yds-market-hero__stage-row">
        <p className="yds-market-hero__section-label">현재 단계</p>
        <p
          className="yds-market-hero__stage-value"
          style={{ "--hero-color": view.currentStage.color }}
        >
          {view.currentLine}
        </p>
      </div>

      {view.nextLine ? (
        <div className="yds-market-hero__stage-row">
          <p className="yds-market-hero__section-label">다음 단계</p>
          <p className="yds-market-hero__next-line yds-market-hero__next-line--inline">
            {view.nextLine}
          </p>
        </div>
      ) : null}

      <div className="yds-market-hero__position-block yds-market-hero__position-block--rail">
        <div className="yds-market-hero__rail" aria-label="패닉 강도 단계">
          {view.rail.map((step) => (
            <span
              key={step.id}
              className={[
                "yds-market-hero__chip",
                step.active ? "yds-market-hero__chip--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={step.active ? { "--chip-color": step.color } : undefined}
            >
              {step.emoji} {step.label}
            </span>
          ))}
        </div>
      </div>
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
