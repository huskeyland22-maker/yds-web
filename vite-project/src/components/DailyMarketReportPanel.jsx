import { useMemo } from "react"
import { buildDailyMarketReport } from "../utils/buildDailyMarketReport.js"
import { actionModeBadgeClass } from "../utils/panicMarketActionEngine.js"

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

  const horizonRows = [
    { label: "단기", value: report.shortTerm },
    { label: "중기", value: report.midTerm },
    { label: "장기", value: report.longTerm },
  ]

  return (
    <section className="daily-market-report" aria-label="YDS Daily Market Report">
      <header className="daily-market-report__head">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[9px] font-bold tracking-[0.14em] text-cyan-300/80">
            YDS DAILY MARKET REPORT
          </p>
          <p className="m-0 mt-0.5 text-[13px] font-bold leading-snug text-slate-50">
            {report.marketStatus}
          </p>
        </div>
        <span
          className={[
            "shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] font-bold",
            actionModeBadgeClass(
              report.actionMode === "Risk ON"
                ? "Risk-on"
                : report.actionMode === "Risk OFF"
                  ? "Risk-off"
                  : "Neutral",
            ),
          ].join(" ")}
        >
          {report.actionMode}
        </span>
      </header>

      <div className="daily-market-report__context">
        <p className="m-0 daily-market-report__context-line">
          <span className="daily-market-report__ctx-label">Cycle</span>
          <span className="daily-market-report__ctx-value">{report.cycleLine}</span>
        </p>
        <p className="m-0 daily-market-report__context-line">
          <span className="daily-market-report__ctx-label">채권</span>
          <span className="daily-market-report__ctx-value">{report.bondLine}</span>
        </p>
      </div>

      <div className="daily-market-report__horizons">
        {horizonRows.map((row) => (
          <div key={row.label} className="daily-market-report__horizon">
            <span className="daily-market-report__horizon-label">{row.label}</span>
            <span className="daily-market-report__horizon-value">{row.value}</span>
          </div>
        ))}
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
          <span className="daily-market-report__action-label">주의 섹터</span>
          <span className="daily-market-report__action-value text-amber-200/90">
            {report.cautionSectors}
          </span>
        </div>
        <div className="daily-market-report__action-row">
          <span className="daily-market-report__action-label">관심 섹터</span>
          <span className="daily-market-report__action-value text-cyan-200/90">
            {report.watchSectors}
          </span>
        </div>
      </div>
    </section>
  )
}
