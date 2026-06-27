/**
 * @param {{
 *   report: import("../../content/ydsStockPickDashboardEngine.js").ReturnType<typeof import("../../content/ydsStockPickDashboardEngine.js").buildStockPickInvestDashboard>
 *   className?: string
 * }} props
 */
export default function YdsStockPickInvestDashboard({ report, className = "" }) {
  if (!report?.visible) return null

  const items = [
    { label: "추천종목", value: report.recommendCount },
    { label: "매수가능", value: report.buyPossible, tone: "buy" },
    { label: "관찰", value: report.watchCount, tone: "watch" },
    { label: "추천금지", value: report.prohibitedCount, tone: "exclude" },
    { label: "평균 AI", value: report.avgAiScore ?? "—" },
    { label: "강한 섹터", value: report.strongestSector },
    { label: "약한 섹터", value: report.weakestSector },
    { label: "오늘 변화", value: report.changeSummary, wide: true },
    { label: "상승", value: report.risingCount, tone: "up" },
    { label: "하락", value: report.fallingCount, tone: "down" },
    { label: "신규진입", value: report.newEntryCount },
    { label: "제외", value: report.excludedCount, tone: "exclude" },
  ]

  return (
    <section
      className={["yds-spick-invest-dash", className].filter(Boolean).join(" ")}
      aria-label={report.title}
    >
      <h2 className="yds-spick-invest-dash__title">{report.title}</h2>
      <dl className="yds-spick-invest-dash__grid">
        {items.map((item) => (
          <div
            key={item.label}
            className={[
              "yds-spick-invest-dash__cell",
              item.wide ? "yds-spick-invest-dash__cell--wide" : "",
              item.tone ? `yds-spick-invest-dash__cell--${item.tone}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <dt>{item.label}</dt>
            <dd className="font-mono tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
