import { useMemo, useState } from "react"
import { buildMarketStateChangeTimeline } from "../../content/ydsMarketStateRecentChanges.js"

/**
 * @param {{
 *   segment: import("../../content/ydsMarketStateRecentChanges.js").MarketStateTimelineSegment
 *   pinned?: boolean
 *   showConnector?: boolean
 * }} props
 */
function MarketStateTimelineCard({ segment, pinned = false, showConnector = false }) {
  return (
    <li
      className={[
        "yds-market-state-timeline__item",
        segment.isCurrent ? "yds-market-state-timeline__item--current" : "",
        pinned ? "yds-market-state-timeline__item--pinned" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--state-color": segment.color }}
    >
      <div className="yds-market-state-timeline__rail" aria-hidden>
        {segment.isCurrent || pinned ? (
          <span className="yds-market-state-timeline__dot">●</span>
        ) : (
          <span className="yds-market-state-timeline__node" />
        )}
        {showConnector ? <span className="yds-market-state-timeline__connector" /> : null}
      </div>

      <article className="yds-market-state-timeline__card">
        <div className="yds-market-state-timeline__head">
          <span className="yds-market-state-timeline__label">{segment.label}</span>
          <div className="yds-market-state-timeline__head-meta">
            {segment.isCurrent ? (
              <span className="yds-market-state-timeline__badge">진행중</span>
            ) : null}
            <span className="yds-market-state-timeline__duration">{segment.durationLabel}</span>
          </div>
        </div>

        <p className="yds-market-state-timeline__dates">{segment.dateRangeLabel}</p>

        {segment.scoreRows.length ? (
          <dl className="yds-market-state-timeline__scores">
            {segment.scoreRows.map((row) => (
              <div key={row.key}>
                <dt>{row.label}</dt>
                <dd className="font-mono tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {segment.investmentActionLines.length ? (
          <div className="yds-market-state-timeline__action">
            {segment.investmentActionLines.map((line) => (
              <p key={line} className="yds-market-state-timeline__action-line">
                {line}
              </p>
            ))}
          </div>
        ) : null}
      </article>
    </li>
  )
}

/**
 * @param {{
 *   segment: import("../../content/ydsMarketStateRecentChanges.js").MarketStateTimelineSegment
 * }} props
 */
function MarketStateMiniCard({ segment }) {
  const scoreLine = segment.scoreRows.map((row) => `${row.label} ${row.value}`).join(" · ")
  const actionLine = segment.investmentActionLines[0] ?? segment.investmentAction ?? ""

  return (
    <article
      className={[
        "yds-market-state-mini-card",
        segment.isCurrent ? "yds-market-state-mini-card--current" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--state-color": segment.color }}
    >
      <div className="yds-market-state-mini-card__head">
        <span className="yds-market-state-mini-card__label">{segment.label}</span>
        <span className="yds-market-state-mini-card__duration">{segment.durationLabel}</span>
        {segment.isCurrent ? (
          <span className="yds-market-state-mini-card__badge">진행중</span>
        ) : null}
      </div>
      {scoreLine ? (
        <p className="yds-market-state-mini-card__scores font-mono tabular-nums">{scoreLine}</p>
      ) : null}
      {actionLine ? (
        <p className="yds-market-state-mini-card__action">"{actionLine}"</p>
      ) : null}
    </article>
  )
}

/**
 * @param {{
 *   historyRows?: object[]
 *   cycleFlow?: import("../../content/ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   panicData?: object | null
 *   dualLiquidity?: import("../../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   etfContext?: { qqqPrices?: Record<string, number>; spyPrices?: Record<string, number> } | null
 *   variant?: "default" | "mini"
 *   className?: string
 * }} props
 */
export default function YdsMarketStateRecentChanges({
  historyRows = [],
  cycleFlow = null,
  panicData = null,
  dualLiquidity = null,
  etfContext = null,
  variant = "default",
  className = "",
}) {
  const [pastOpen, setPastOpen] = useState(false)

  const report = useMemo(
    () =>
      buildMarketStateChangeTimeline(historyRows, cycleFlow, panicData, dualLiquidity, {
        etfContext,
      }),
    [historyRows, cycleFlow, panicData, dualLiquidity, etfContext],
  )

  const layout = useMemo(() => {
    const segs = report.segments ?? []
    if (!segs.length) {
      return { current: null, recent: null, hidden: [] }
    }
    const current = segs[segs.length - 1]
    const recent = segs.length >= 2 ? segs[segs.length - 2] : null
    const hidden = segs.length > 2 ? segs.slice(0, -2) : []
    return { current, recent, hidden }
  }, [report.segments])

  if (!report.visible || !layout.current) return null

  const { cycleStrip, summary, hiddenSegmentCount } = report
  const isMini = variant === "mini"

  if (isMini) {
    return (
      <section
        className={[
          "yds-desk-card",
          "yds-market-state-history-mini",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={report.title}
      >
        <h3 className="yds-desk-card__title">{report.title}</h3>
        <div className="yds-market-state-history-mini__list">
          {layout.recent ? <MarketStateMiniCard segment={layout.recent} /> : null}
          <MarketStateMiniCard segment={layout.current} />
        </div>

        {hiddenSegmentCount > 0 ? (
          <details
            className="yds-market-state-timeline__past yds-market-state-history-mini__past"
            open={pastOpen}
            onToggle={(e) => setPastOpen(e.currentTarget.open)}
          >
            <summary className="yds-market-state-timeline__past-summary">
              이전 상태 보기 ({hiddenSegmentCount}개)
            </summary>
            <div className="yds-market-state-history-mini__list yds-market-state-history-mini__list--past">
              {[...layout.hidden].reverse().map((seg) => (
                <MarketStateMiniCard key={`${seg.startDate}-${seg.label}`} segment={seg} />
              ))}
            </div>
          </details>
        ) : null}

        <p className="yds-market-state-history-mini__footer font-mono tabular-nums">
          현재 {summary.currentDurationDays}일 · 30일 전환 {summary.transitionCount30d}회
        </p>
      </section>
    )
  }

  return (
    <section
      className={[
        "yds-market-state-timeline",
        "yds-market-state-timeline--rich",
        "yds-market-state-timeline--compact",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={report.title}
    >
      <p className="yds-market-state-timeline__title">{report.title}</p>

      <div className="yds-market-state-cycle-strip" aria-label="시장 사이클">
        <div className="yds-market-state-cycle-strip__track">
          {cycleStrip.stages.map((stage, index) => {
            const isCurrent = stage.id === cycleStrip.currentId
            return (
              <div
                key={stage.id}
                className={[
                  "yds-market-state-cycle-strip__step",
                  isCurrent ? "yds-market-state-cycle-strip__step--current" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ "--cycle-color": stage.color }}
              >
                {index > 0 ? (
                  <span className="yds-market-state-cycle-strip__dash" aria-hidden>
                    ─
                  </span>
                ) : null}
                <span className="yds-market-state-cycle-strip__label">{stage.label}</span>
                {isCurrent ? (
                  <span className="yds-market-state-cycle-strip__marker">▲ 현재</span>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <ol className="yds-market-state-timeline__list yds-market-state-timeline__list--visible">
        <MarketStateTimelineCard
          segment={layout.current}
          pinned
          showConnector={Boolean(layout.recent || hiddenSegmentCount > 0)}
        />
        {layout.recent ? (
          <MarketStateTimelineCard
            segment={layout.recent}
            showConnector={hiddenSegmentCount > 0 && pastOpen}
          />
        ) : null}
      </ol>

      {hiddenSegmentCount > 0 ? (
        <details
          className="yds-market-state-timeline__past"
          open={pastOpen}
          onToggle={(e) => setPastOpen(e.currentTarget.open)}
        >
          <summary className="yds-market-state-timeline__past-summary">
            이전 상태 보기 ({hiddenSegmentCount}개)
          </summary>
          <ol className="yds-market-state-timeline__list yds-market-state-timeline__list--past">
            {[...layout.hidden].reverse().map((seg, index) => (
              <MarketStateTimelineCard
                key={`${seg.startDate}-${seg.label}`}
                segment={seg}
                showConnector={index < layout.hidden.length - 1}
              />
            ))}
          </ol>
        </details>
      ) : null}

      <p className="yds-market-state-timeline__footer-summary font-mono tabular-nums">
        현재 단계 지속 {summary.currentDurationDays}일 · 최근 30일 전환{" "}
        {summary.transitionCount30d}회
      </p>
    </section>
  )
}
