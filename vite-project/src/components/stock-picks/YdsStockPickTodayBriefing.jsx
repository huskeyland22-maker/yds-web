/**
 * @param {{
 *   report: import("../../content/ydsStockPickTrustEngine.js").ReturnType<typeof import("../../content/ydsStockPickTrustEngine.js").buildTodayRecommendBriefing>
 *   className?: string
 * }} props
 */
export default function YdsStockPickTodayBriefing({ report, className = "" }) {
  if (!report?.visible || !report.lines?.length) return null

  return (
    <section
      className={["yds-spick-section", "yds-spick-section--briefing", className].filter(Boolean).join(" ")}
      aria-label={report.title}
    >
      <h2 className="yds-spick-section__title yds-spick-section__title--tier">① {report.title}</h2>
      <div className="yds-spick-briefing">
        {report.lines.map((line) => (
          <p key={line} className="yds-spick-briefing__line">
            {line}
          </p>
        ))}
      </div>
    </section>
  )
}
