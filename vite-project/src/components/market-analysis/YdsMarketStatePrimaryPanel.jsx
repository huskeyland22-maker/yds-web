import { useMemo } from "react"
import { MARKET_LABEL_MARKET_STATE } from "../../content/ydsMarketStageLabels.js"
import { resolveMarketStateCenterView } from "../../content/ydsMarketStateCenter.js"
import YdsMarketDeskMiniCard from "./YdsMarketDeskMiniCard.jsx"

/**
 * 시장 상태 (메인) — 점수 · 구간 · 전략 · 추천 행동
 * @param {{ panicData?: object | null; className?: string; embedded?: boolean }} props
 */
export default function YdsMarketStatePrimaryPanel({
  panicData = null,
  className = "",
  embedded = false,
}) {
  const view = useMemo(() => resolveMarketStateCenterView(panicData), [panicData])
  if (!view) return null

  const card = (
    <div className="yds-market-state-primary">
      <YdsMarketDeskMiniCard
        title={MARKET_LABEL_MARKET_STATE}
        score={view.positionScore}
        stages={view.positionRail}
        variant="state"
        embedded={embedded}
        ariaLabel={`${MARKET_LABEL_MARKET_STATE} ${view.positionScore}, ${view.position.label} 구간`}
      />

      <div className="yds-market-state-primary__zone">
        <p
          className="yds-market-state-primary__zone-label"
          style={{ "--hero-color": view.position.color }}
        >
          {view.position.emoji} {view.position.label}구간
        </p>
        {view.position.descriptions?.length ? (
          <p className="yds-market-state-primary__zone-hint">
            {view.position.descriptions.join(" · ")}
          </p>
        ) : null}
      </div>

      <article className="yds-market-state-primary__strategy" aria-label="현재 전략">
        <p className="yds-market-state-primary__layer-tag">현재 전략</p>
        <p className="yds-market-state-primary__strategy-line">{view.strategy}</p>
        <ul className="yds-market-state-primary__actions">
          {view.actions.map((item) => (
            <li key={item} className="yds-market-state-primary__action-item">
              ✓ {item}
            </li>
          ))}
        </ul>
      </article>
    </div>
  )

  if (embedded) return card

  return (
    <section className={["yds-market-state-primary-wrap", className].filter(Boolean).join(" ")}>
      {card}
    </section>
  )
}
