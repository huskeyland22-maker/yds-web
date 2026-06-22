/**
 * @param {{ report: import("../../content/ydsDashboardActionGuide.js").DashboardActionGuideReport }} props
 */
export default function YdsDashboardActionGuide({ report }) {
  if (!report?.visible || !report.checklist.length) return null

  return (
    <section
      className="yds-desk-brief yds-desk-brief--action"
      aria-labelledby="desk-action-guide-title"
    >
      <p className="yds-desk-brief__kicker">Institutional Note · Action</p>
      <h2 id="desk-action-guide-title" className="yds-desk-brief__title">
        {report.title}
      </h2>

      <dl className="yds-desk-brief__context">
        <div className="yds-desk-brief__ctx">
          <dt>현재 시장 상태</dt>
          <dd>{report.marketState}</dd>
        </div>
        <div className="yds-desk-brief__ctx yds-desk-brief__ctx--metric">
          <dt>패닉</dt>
          <dd className="font-mono tabular-nums">
            {report.panicScore != null ? report.panicScore : "—"}
          </dd>
        </div>
        <div className="yds-desk-brief__ctx yds-desk-brief__ctx--metric">
          <dt>유동성</dt>
          <dd className="font-mono tabular-nums">
            {report.liquidityScore != null ? report.liquidityScore : "—"}
          </dd>
        </div>
      </dl>

      <div className="yds-desk-brief__guide">
        <h3 className="yds-desk-brief__guide-label">행동 가이드</h3>
        <ul className="yds-desk-brief__checklist">
          {report.checklist.map((line) => (
            <li key={line} className="yds-desk-brief__check">
              <span className="yds-desk-brief__check-mark" aria-hidden>
                ✓
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
