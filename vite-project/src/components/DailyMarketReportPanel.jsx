import { useMemo } from "react"
import { buildDailyMarketReport, buildMarketStatusPills } from "../utils/buildDailyMarketReport.js"

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

  const pills = useMemo(() => buildMarketStatusPills(report), [report])

  if (loading && !report.ready) {
    return (
      <div className="market-status-bar" role="status" aria-label="시장 상태">
        <span className="market-status-bar__pill market-status-bar__pill--muted">리포트 생성 중…</span>
      </div>
    )
  }

  if (!report.ready) {
    return (
      <div className="market-status-bar" role="status" aria-label="시장 상태">
        <span className="market-status-bar__pill market-status-bar__pill--muted">
          Cycle·패닉 입력 후 자동 생성
        </span>
      </div>
    )
  }

  return (
    <div className="market-status-bar" role="status" aria-label="시장 상태">
      {pills.map((text) => (
        <span key={text} className="market-status-bar__pill">
          {text}
        </span>
      ))}
    </div>
  )
}
