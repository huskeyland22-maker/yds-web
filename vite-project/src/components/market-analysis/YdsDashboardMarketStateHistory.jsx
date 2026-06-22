/**
 * @param {{ report: import("../../content/ydsMarketStateHistory.js").MarketStateHistoryReport }} props
 */
export default function YdsDashboardMarketStateHistory({ report }) {
  if (!report?.visible) return null

  return (
    <section
      className="yds-desk-brief yds-desk-brief--state-history"
      aria-labelledby="desk-state-history-title"
    >
      <p className="yds-desk-brief__kicker">Strategy · Cycle Transition</p>
      <h2 id="desk-state-history-title" className="yds-desk-brief__title">
        시장상태 변화
      </h2>
      <p className="yds-desk-brief__state-window">최근 {report.windowDays}일</p>

      <div className="yds-desk-brief__state-summary">
        <p className="yds-desk-brief__state-summary-label">현재</p>
        <p className="yds-desk-brief__state-summary-line">{report.summaryLine}</p>
        <p className="yds-desk-brief__state-summary-sub">{report.summarySub}</p>
      </div>

      <ol className="yds-desk-brief__timeline" aria-label="시장상태 일별 타임라인">
        {report.entries.map((entry) => (
          <li key={entry.date} className="yds-desk-brief__timeline-item">
            <span className="yds-desk-brief__timeline-date font-mono tabular-nums">
              {entry.dateShort}
            </span>
            <span
              className={`yds-desk-brief__timeline-state yds-desk-brief__timeline-state--${entry.positionId}`}
            >
              {entry.stateLabel}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
