import { useMemo } from "react"
import { buildDailyMarketReport } from "../utils/buildDailyMarketReport.js"

/**
 * @param {{
 *   panicData?: object | null
 *   cycleScore?: number | null
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 *   loading?: boolean
 * }} props
 */
export default function DailyMarketReportPanel({
  panicData = null,
  cycleScore = null,
  snapshot = null,
  loading = false,
}) {
  const report = useMemo(
    () => buildDailyMarketReport({ panicData, cycleScore, snapshot }),
    [panicData, cycleScore, snapshot],
  )

  if (loading && !report.ready) {
    return (
      <section className="daily-market-report" aria-label="YDS Daily Market Report">
        <p className="m-0 px-3 py-4 text-[10px] text-slate-500">통합 브리핑 생성 중…</p>
      </section>
    )
  }

  if (!report.ready) {
    return (
      <section className="daily-market-report" aria-label="YDS Daily Market Report">
        <p className="m-0 px-3 py-4 text-[10px] text-slate-500">
          Cycle·패닉·채권(10Y·30Y·DXY) 입력 후 자동 생성됩니다.
        </p>
      </section>
    )
  }

  return (
    <section className="daily-market-report" aria-label="YDS Daily Market Report">
      <header className="daily-market-report__head">
        <p className="m-0 text-[9px] font-bold tracking-[0.14em] text-cyan-300/80">
          YDS DAILY MARKET REPORT
        </p>
      </header>

      <div className="daily-market-report__status-block">
        <p className="m-0 daily-market-report__status-title">상태</p>
        <div className="daily-market-report__status-pills" role="list">
          {report.statusPills.map((pill) => (
            <span key={pill} className="daily-market-report__status-pill" role="listitem">
              {pill}
            </span>
          ))}
        </div>
      </div>

      <div className="daily-market-report__actions">
        <div className="daily-market-report__action-row">
          <span className="daily-market-report__action-label">실전</span>
          <span className="daily-market-report__action-value">{report.practicalAction}</span>
        </div>
        <div className="daily-market-report__action-row">
          <span className="daily-market-report__action-label">현금</span>
          <span className="daily-market-report__action-value font-mono tabular-nums">
            {report.cashAllocation}
          </span>
        </div>
        <div className="daily-market-report__action-row">
          <span className="daily-market-report__action-label">관심</span>
          <span className="daily-market-report__action-value text-cyan-200/90">
            {report.watchSectors}
          </span>
        </div>
        <div className="daily-market-report__action-row">
          <span className="daily-market-report__action-label">주의</span>
          <span className="daily-market-report__action-value text-amber-200/90">
            {report.cautionSectors}
          </span>
        </div>
      </div>
    </section>
  )
}
