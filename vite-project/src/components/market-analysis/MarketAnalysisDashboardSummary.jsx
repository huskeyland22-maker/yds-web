import { buildDashboardSummaryViewModel } from "../../trading-zone/ydsDashboardSummaryPresentation.js"
import { formatSectorRadarScore } from "../../trading-zone/ydsPrecursorEnginePhase25.js"
import { formatEntryRadarScore } from "../../trading-zone/ydsPrecursorEnginePhase27.js"

/**
 * @param {{
 *   actionStageHero: Parameters<typeof buildDashboardSummaryViewModel>[0]["actionStageHero"]
 *   actionGuide?: Parameters<typeof buildDashboardSummaryViewModel>[0]["actionGuide"]
 *   marketEnvironment?: Parameters<typeof buildDashboardSummaryViewModel>[0]["marketEnvironment"]
 *   sectorRadar: Parameters<typeof buildDashboardSummaryViewModel>[0]["sectorRadar"]
 *   entryRadar: Parameters<typeof buildDashboardSummaryViewModel>[0]["entryRadar"]
 *   portfolio: Parameters<typeof buildDashboardSummaryViewModel>[0]["portfolio"]
 * }} props
 */
export default function MarketAnalysisDashboardSummary(props) {
  const summary = buildDashboardSummaryViewModel(props)

  if (!summary.available) {
    return null
  }

  const { currentStatus, allocation } = summary
  const stockPct = allocation.stockPct ?? 0
  const cashPct = allocation.cashPct ?? 100

  return (
    <section
      className={[
        "yds-dash-summary",
        currentStatus.stageId ? `yds-dash-summary--${currentStatus.stageId}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--dash-stage-color": currentStatus.color }}
      aria-label="5초 요약"
    >
      <p className="yds-dash-summary__kicker">5초 요약</p>

      <div className="yds-dash-summary__grid">
        <article className="yds-dash-summary__card yds-dash-summary__card--status">
          <span className="yds-dash-summary__key">현재 상태</span>
          <strong className="yds-dash-summary__status-val">
            <span className="yds-dash-summary__status-emoji" aria-hidden>
              {currentStatus.emoji}
            </span>
            {currentStatus.label}
          </strong>
          {currentStatus.environmentLabel ? (
            <span className="yds-dash-summary__env">
              {currentStatus.environmentEmoji} 시장 {currentStatus.environmentLabel}
            </span>
          ) : null}
        </article>

        <article className="yds-dash-summary__card yds-dash-summary__card--action">
          <span className="yds-dash-summary__key">추천 행동</span>
          <strong className="yds-dash-summary__action-val">{summary.recommendedAction}</strong>
        </article>

        <article className="yds-dash-summary__card yds-dash-summary__card--sectors">
          <span className="yds-dash-summary__key">추천 섹터 Top3</span>
          {summary.hasSectors ? (
            <ol className="yds-dash-summary__list">
              {summary.topSectors.map((s) => (
                <li key={s.id}>
                  <span className="yds-dash-summary__rank">{s.rank}</span>
                  <span className="yds-dash-summary__name">{s.label}</span>
                  <span className="yds-dash-summary__score font-mono tabular-nums">
                    {formatSectorRadarScore(s.score)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="yds-dash-summary__empty">—</p>
          )}
        </article>

        <article className="yds-dash-summary__card yds-dash-summary__card--entries">
          <span className="yds-dash-summary__key">실전 후보 Top3</span>
          {summary.hasCandidates ? (
            <ol className="yds-dash-summary__list">
              {summary.topEntryCandidates.map((c, i) => (
                <li key={c.id}>
                  <span className="yds-dash-summary__rank">{i + 1}</span>
                  <span className="yds-dash-summary__name">{c.name}</span>
                  <span className="yds-dash-summary__meta">
                    <span className={`yds-dash-summary__grade yds-dash-summary__grade--${c.grade}`}>
                      {c.grade}
                    </span>
                    <span className="yds-dash-summary__score font-mono tabular-nums">
                      {formatEntryRadarScore(c.entryScore)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="yds-dash-summary__empty">—</p>
          )}
        </article>

        <article className="yds-dash-summary__card yds-dash-summary__card--alloc yds-dash-summary__card--wide">
          <span className="yds-dash-summary__key">권장 비중</span>
          <div className="yds-dash-summary__alloc-row">
            <div className="yds-dash-summary__alloc-pill yds-dash-summary__alloc-pill--stock">
              <span className="yds-dash-summary__alloc-label">주식</span>
              <strong className="font-mono tabular-nums">{stockPct}%</strong>
            </div>
            <div className="yds-dash-summary__alloc-pill yds-dash-summary__alloc-pill--cash">
              <span className="yds-dash-summary__alloc-label">현금</span>
              <strong className="font-mono tabular-nums">{cashPct}%</strong>
            </div>
          </div>
          <div
            className="yds-dash-summary__alloc-bar"
            role="img"
            aria-label={`주식 ${stockPct}% 현금 ${cashPct}%`}
          >
            <span className="yds-dash-summary__alloc-bar-stock" style={{ width: `${stockPct}%` }} />
            <span className="yds-dash-summary__alloc-bar-cash" style={{ width: `${cashPct}%` }} />
          </div>
        </article>
      </div>
    </section>
  )
}
