/**
 * @param {{ report: import("../../content/ydsStockPickRecommendHistory.js").ReturnType<typeof import("../../content/ydsStockPickRecommendHistory.js").buildStockPickRecommendHistoryReport>; embedded?: boolean; className?: string }} props
 */
export default function YdsStockPickRecommendHistory({ report, embedded = false, className = "" }) {
  if (!report?.visible) return null

  return (
    <section
      className={[
        "yds-spick-rec-history",
        embedded ? "yds-spick-rec-history--embedded" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={report.title}
    >
      <p className="yds-spick-rec-history__title">{report.title}</p>

      <dl className="yds-spick-rec-history__summary">
        <div>
          <dt>최초 추천일</dt>
          <dd className="font-mono tabular-nums">{report.firstRecommendedAt ?? "—"}</dd>
        </div>
        <div>
          <dt>추천 유지일수</dt>
          <dd>{report.daysHeld != null ? `${report.daysHeld}일` : "—"}</dd>
        </div>
        <div>
          <dt>점수 변화</dt>
          <dd className="font-mono tabular-nums">{report.scoreDeltaLabel}</dd>
        </div>
        <div>
          <dt>최고 수익률</dt>
          <dd className="font-mono tabular-nums">{report.maxReturnLabel}</dd>
        </div>
        <div>
          <dt>현재 수익률</dt>
          <dd className="font-mono tabular-nums">{report.currentReturnLabel}</dd>
        </div>
        <div>
          <dt>상태</dt>
          <dd>
            <span className={`yds-spick-rec-history__status yds-spick-rec-history__status--${report.status.id}`}>
              {report.status.label}
            </span>
          </dd>
        </div>
      </dl>

      {report.timeline.length ? (
        <ol className="yds-spick-rec-history__timeline">
          {report.timeline.map((item, index) => (
            <li key={`${item.date}-${item.score}`} className="yds-spick-rec-history__node">
              {index > 0 ? <span className="yds-spick-rec-history__arrow" aria-hidden>↓</span> : null}
              <div className="yds-spick-rec-history__node-body">
                <span className="yds-spick-rec-history__date font-mono tabular-nums">
                  {item.dateLabel}
                </span>
                <span className="yds-spick-rec-history__opinion">{item.opinion}</span>
                <strong className="yds-spick-rec-history__score font-mono tabular-nums">
                  {item.score}점
                </strong>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}
