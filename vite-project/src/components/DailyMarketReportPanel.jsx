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
      <section className="daily-report-v2 daily-report-v2--compact" aria-label="시장 요약">
        <p className="m-0 daily-report-v2__placeholder cycle-aux-line">리포트 생성 중…</p>
      </section>
    )
  }

  if (!report.ready) {
    return (
      <section className="daily-report-v2 daily-report-v2--compact" aria-label="시장 요약">
        <p className="m-0 daily-report-v2__placeholder cycle-aux-line">
          Cycle·패닉 입력 후 자동 생성됩니다.
        </p>
      </section>
    )
  }

  const { marketToday, actionLine } = report
  const leaders =
    marketToday.leaders && marketToday.leaders !== "—"
      ? marketToday.leaders.replace(/\s*유지\s*$/u, "").trim()
      : "—"

  return (
    <section className="daily-report-v2 daily-report-v2--compact" aria-label="시장 요약">
      <header className="daily-report-v2__head">
        <p className="m-0 cycle-eyebrow text-cyan-200/95">시장 요약</p>
      </header>

      <div className="daily-report-v2__grid daily-report-v2__grid--summary">
        <article className="daily-report-v2__card daily-report-v2__card--accent">
          <div className="daily-report-v2__card-body">
            <ReportRow label="시장" value={marketToday.market} />
            <ReportRow label="행동" value={actionLine} valueClass="daily-report-v2__value--emph" />
            <ReportRow label="채권" value={marketToday.bond} valueClass="daily-report-v2__value--amber" />
            <ReportRow label="현금" value={report.actionToday.cash} valueClass="font-mono tabular-nums" />
            <ReportRow label="리더" value={leaders} valueClass="daily-report-v2__value--cyan" />
          </div>
        </article>

        <article className="daily-report-v2__card daily-report-v2__card--brief">
          <p className="m-0 daily-report-v2__brief-compact">{report.oneLinerCompact}</p>
        </article>
      </div>
    </section>
  )
}
