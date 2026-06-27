/**
 * @param {{
 *   report: import("../../content/ydsStockPickTrustEngine.js").ReturnType<typeof import("../../content/ydsStockPickTrustEngine.js").buildStockPickHubHistoryReport>
 *   className?: string
 * }} props
 */
export default function YdsStockPickHubHistory({ report, className = "" }) {
  if (!report?.visible || !report.rows?.length) return null

  return (
    <section
      className={["yds-spick-section", "yds-spick-hub-history", className].filter(Boolean).join(" ")}
      aria-label={report.title}
    >
      <h2 className="yds-spick-section__title yds-spick-section__title--tier">⑤ {report.title}</h2>
      <div className="yds-spick-hub-history__scroll">
        <table className="yds-spick-hub-history__table">
          <thead>
            <tr>
              <th scope="col">추천일</th>
              <th scope="col">종목</th>
              <th scope="col">추천가</th>
              <th scope="col">현재가</th>
              <th scope="col">수익률</th>
              <th scope="col">최고</th>
              <th scope="col">최대손실</th>
              <th scope="col">상태</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={`${row.ticker}-${row.recommendedAt}`}>
                <td className="font-mono tabular-nums">{String(row.recommendedAt).slice(0, 10)}</td>
                <td>{row.name}</td>
                <td className="font-mono tabular-nums">{row.recommendedPrice ?? "—"}</td>
                <td className="font-mono tabular-nums">{row.currentPrice ?? "—"}</td>
                <td className="font-mono tabular-nums">{row.returnLabel}</td>
                <td className="font-mono tabular-nums">{row.maxReturnLabel}</td>
                <td className="font-mono tabular-nums">{row.minReturnLabel}</td>
                <td>{row.statusLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
