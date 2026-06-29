import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { HUB_HISTORY_LIMIT_STEPS, resolveHubHistoryLimit } from "../../content/ydsStockPickHubHistoryEngine.js"

/**
 * @param {{
 *   report: import("../../content/ydsStockPickTrustEngine.js").ReturnType<typeof import("../../content/ydsStockPickTrustEngine.js").buildStockPickHubHistoryReport>
 *   className?: string
 * }} props
 */
export default function YdsStockPickHubHistory({ report, className = "" }) {
  const [limitStep, setLimitStep] = useState(0)

  const limit = resolveHubHistoryLimit(limitStep)
  const total = report?.rows?.length ?? 0

  const visibleRows = useMemo(() => {
    if (!report?.rows?.length) return []
    if (limit === Infinity) return report.rows
    return report.rows.slice(0, limit)
  }, [report?.rows, limit])

  if (!report?.visible || !total) return null

  const atMax = limitStep >= HUB_HISTORY_LIMIT_STEPS.length - 1
  const currentLimit = HUB_HISTORY_LIMIT_STEPS[limitStep]
  const canExpand = !atMax && total > currentLimit

  const nextStep = HUB_HISTORY_LIMIT_STEPS[limitStep + 1]
  const expandLabel =
    nextStep === Infinity ? "더보기 ▼ (전체)" : `더보기 ▼ (${nextStep}건)`

  return (
    <section
      className={["yds-spick-section", "yds-spick-hub-history", className].filter(Boolean).join(" ")}
      aria-label={report.title}
    >
      <div className="yds-spick-hub-history__head">
        <h2 className="yds-spick-section__title yds-spick-section__title--tier">
          {report.title}
        </h2>
        <span className="yds-spick-hub-history__count font-mono tabular-nums">
          {visibleRows.length}/{total}건
        </span>
      </div>

      <div className="yds-spick-hub-history__scroll yds-spick-hub-table-scroll">
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
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={`${row.ticker}-${row.recommendedAt}`}>
                <td className="font-mono tabular-nums">{String(row.recommendedAt).slice(0, 10)}</td>
                <td>{row.name}</td>
                <td className="font-mono tabular-nums">{row.recommendedPrice ?? "—"}</td>
                <td className="font-mono tabular-nums">{row.currentPrice ?? "—"}</td>
                <td className="font-mono tabular-nums">{row.returnLabel}</td>
                <td className="font-mono tabular-nums">{row.maxReturnLabel}</td>
                <td className="font-mono tabular-nums">{row.minReturnLabel}</td>
                <td>{row.statusLabel}</td>
                <td>
                  {row.pickId ? (
                    <Link
                      to={`/performance-validation/pick/${encodeURIComponent(row.pickId)}`}
                      className="yds-spick-hub-history__link"
                    >
                      상세
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canExpand ? (
        <button
          type="button"
          className="yds-spick-hub-history__more"
          onClick={() => setLimitStep((s) => s + 1)}
        >
          {expandLabel}
        </button>
      ) : atMax && limitStep > 0 ? (
        <button
          type="button"
          className="yds-spick-hub-history__more"
          onClick={() => setLimitStep(0)}
        >
          접기 ▲
        </button>
      ) : null}
    </section>
  )
}
