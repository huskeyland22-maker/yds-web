import { useMemo } from "react"
import { Link } from "react-router-dom"
import { MARKET_LABEL_MARKET_STATE } from "../../content/ydsMarketStageLabels.js"
import { resolveMarketStateCenterView } from "../../content/ydsMarketStateCenter.js"
import { buildMarketPositionTimeline } from "../../content/ydsMarketPositionTimeline.js"

/**
 * V7 — 시장 상태 메인 카드 (70~80% 폭)
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string; embedded?: boolean }} props
 */
export default function YdsMarketStatePrimaryPanel({
  panicData = null,
  historyRows = [],
  className = "",
  embedded = false,
}) {
  const view = useMemo(() => resolveMarketStateCenterView(panicData), [panicData])
  const timeline = useMemo(() => buildMarketPositionTimeline(historyRows, 5), [historyRows])

  if (!view) return null

  const currentStep = timeline[timeline.length - 1] ?? null
  const phaseLabel = currentStep?.phase ?? "안정화"
  const prevScore = timeline.length > 1 ? timeline[timeline.length - 2]?.score ?? null : null
  const delta = prevScore != null ? view.positionScore - prevScore : 0
  const deltaSign = delta > 0 ? "▲" : delta < 0 ? "▼" : "•"
  const deltaText = `${deltaSign} ${delta >= 0 ? "+" : ""}${delta}`
  const pickPublicLabel = Number.isFinite(view.pickLimit)
    ? `${view.pickLimitLabel} 공개`
    : "전체 공개"

  const card = (
    <div className="yds-market-state-primary yds-market-state-primary--v7">
      <div className="yds-market-state-primary__hero">
        <p className="yds-market-state-primary__title">{MARKET_LABEL_MARKET_STATE}</p>
        <p className="yds-market-state-primary__score font-mono tabular-nums">
          {view.positionScore}
        </p>
        <p
          className="yds-market-state-primary__zone-label"
          style={{ "--hero-color": view.position.color }}
        >
          {view.position.emoji} {view.position.label} {phaseLabel}
        </p>
        <p className="yds-market-state-primary__delta">
          전일 대비 <span className="font-mono tabular-nums">{deltaText}</span>
        </p>
      </div>

      <article className="yds-market-state-primary__strategy" aria-label="현재 전략">
        <p className="yds-market-state-primary__layer-tag">현재 전략</p>
        <ul className="yds-market-state-primary__actions">
          {view.actions.map((item) => (
            <li key={item} className="yds-market-state-primary__action-item">
              ✓ {item}
            </li>
          ))}
        </ul>
      </article>

      <div className="yds-market-state-primary__pick-bridge">
        <p className="yds-market-state-primary__pick-line">
          {view.position.label}구간 · <strong>{pickPublicLabel}</strong>
        </p>
        <Link to="/stock-picks" className="yds-market-state-primary__pick-link">
          종목추천 보기 →
        </Link>
      </div>
    </div>
  )

  if (embedded) return card

  return (
    <section className={["yds-market-state-primary-wrap", className].filter(Boolean).join(" ")}>
      {card}
    </section>
  )
}
