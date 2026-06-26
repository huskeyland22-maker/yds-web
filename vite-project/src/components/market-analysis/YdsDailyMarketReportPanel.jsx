import { useMemo, useState } from "react"
import {
  buildDailyMarketReport,
  downloadTextFile,
  openPrintableReport,
} from "../../content/ydsDailyMarketReportEngine.js"

/**
 * @param {{
 *   panicData?: object | null
 *   historyRows?: object[]
 *   cycleFlow?: import("../../content/ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   dualLiquidity?: import("../../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   weekEvents?: object | null
 *   picks?: { ticker: string; name: string; score?: number }[]
 *   etfContext?: object | null
 *   className?: string
 * }} props
 */
export default function YdsDailyMarketReportPanel({
  panicData = null,
  historyRows = [],
  cycleFlow = null,
  dualLiquidity = null,
  weekEvents = null,
  picks = [],
  etfContext = null,
  className = "",
}) {
  const [open, setOpen] = useState(false)

  const report = useMemo(
    () =>
      buildDailyMarketReport({
        panicData,
        historyRows,
        cycleFlow,
        dualLiquidity,
        weekEvents,
        picks,
        etfContext,
      }),
    [panicData, historyRows, cycleFlow, dualLiquidity, weekEvents, picks, etfContext],
  )

  const today = new Date().toISOString().slice(0, 10)

  return (
    <section
      className={["yds-daily-market-report", className].filter(Boolean).join(" ")}
      aria-label="종합 시장 리포트"
    >
      <div className="yds-daily-market-report__actions">
        <button
          type="button"
          className="yds-daily-market-report__btn yds-daily-market-report__btn--primary"
          onClick={() => setOpen((v) => !v)}
        >
          AI 종합 시장 리포트 {open ? "닫기" : "생성"}
        </button>
        <button
          type="button"
          className="yds-daily-market-report__btn"
          onClick={() => downloadTextFile(report.markdown, `yds-market-report-${today}.md`)}
        >
          Markdown
        </button>
        <button
          type="button"
          className="yds-daily-market-report__btn"
          onClick={() => openPrintableReport(report.html)}
        >
          PDF (인쇄)
        </button>
      </div>

      {open ? (
        <pre className="yds-daily-market-report__preview">{report.markdown}</pre>
      ) : null}
    </section>
  )
}
