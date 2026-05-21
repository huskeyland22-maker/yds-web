import { useMemo } from "react"
import { buildDailyMarketReport } from "../utils/buildDailyMarketReport.js"

/**
 * @param {{ label: string; value: string; valueClass?: string }} props
 */
function ReportRow({ label, value, valueClass = "" }) {
  return (
    <div className="daily-report-v2__row">
      <span className="daily-report-v2__label">{label}</span>
      <span className={["daily-report-v2__value", valueClass].filter(Boolean).join(" ")}>{value}</span>
    </div>
  )
}

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
      <section className="daily-report-v2" aria-label="YDS Daily Market Report">
        <p className="m-0 px-3 py-4 text-[10px] text-slate-500">리포트 생성 중…</p>
      </section>
    )
  }

  if (!report.ready) {
    return (
      <section className="daily-report-v2" aria-label="YDS Daily Market Report">
        <p className="m-0 px-3 py-4 text-[10px] text-slate-500">
          Cycle·패닉 입력 후 자동 생성됩니다.
        </p>
      </section>
    )
  }

  const { marketToday, actionToday, strategy, sectors, oneLiner } = report

  return (
    <section className="daily-report-v2" aria-label="YDS Daily Market Report">
      <header className="daily-report-v2__head">
        <p className="m-0 text-[9px] font-bold tracking-[0.14em] text-cyan-300/80">
          YDS DAILY MARKET REPORT
        </p>
      </header>

      <div className="daily-report-v2__block">
        <p className="m-0 daily-report-v2__block-title">1. 오늘 시장</p>
        <ReportRow label="시장" value={marketToday.market} />
        <ReportRow label="채권" value={marketToday.bond} valueClass="text-amber-200/90" />
        <ReportRow label="리더" value={marketToday.leaders} valueClass="text-cyan-200/90" />
      </div>

      <div className="daily-report-v2__block daily-report-v2__block--accent">
        <p className="m-0 daily-report-v2__block-title">오늘 행동</p>
        <div className="daily-report-v2__action-lines">
          <p className="m-0 daily-report-v2__action-line">{actionToday.today}</p>
          <p className="m-0 daily-report-v2__action-line">
            <span className="daily-report-v2__action-prefix">AI</span> {actionToday.ai}
          </p>
          <p className="m-0 daily-report-v2__action-line font-mono tabular-nums">
            <span className="daily-report-v2__action-prefix">현금</span> {actionToday.cash}
          </p>
          <p className="m-0 daily-report-v2__action-line text-amber-200/95">
            {actionToday.rate}
          </p>
        </div>
      </div>

      <div className="daily-report-v2__block">
        <p className="m-0 daily-report-v2__block-title">3. 실전 전략</p>
        <ReportRow label="단기" value={strategy.short} />
        <ReportRow label="중기" value={strategy.mid} />
        <ReportRow label="장기" value={strategy.long} />
        <ReportRow label="실전" value={strategy.practical} valueClass="font-semibold text-slate-50" />
      </div>

      <div className="daily-report-v2__block">
        <p className="m-0 daily-report-v2__block-title">4. 관심 섹터</p>
        <ReportRow
          label="리더"
          value={sectors.leaders.length ? sectors.leaders.join(" · ") : "—"}
          valueClass="text-cyan-200/90"
        />
        <ReportRow
          label="주의"
          value={sectors.caution.join(" · ")}
          valueClass="text-amber-200/90"
        />
      </div>

      <div className="daily-report-v2__brief">
        <p className="m-0 daily-report-v2__block-title">5. 한줄 브리핑</p>
        {oneLiner.map((line) => (
          <p key={line} className="m-0 daily-report-v2__brief-line">
            {line}
          </p>
        ))}
      </div>
    </section>
  )
}
