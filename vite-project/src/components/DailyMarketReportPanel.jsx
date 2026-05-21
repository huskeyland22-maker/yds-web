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
 * @param {{ title: string; accent?: boolean; className?: string; children: import("react").ReactNode }} props
 */
function ReportCard({ title, accent = false, className = "", children }) {
  return (
    <article
      className={[
        "daily-report-v2__card",
        accent ? "daily-report-v2__card--accent" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="m-0 daily-report-v2__block-title">{title}</p>
      <div className="daily-report-v2__card-body">{children}</div>
    </article>
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
        <p className="m-0 daily-report-v2__placeholder cycle-aux-line">리포트 생성 중…</p>
      </section>
    )
  }

  if (!report.ready) {
    return (
      <section className="daily-report-v2" aria-label="YDS Daily Market Report">
        <p className="m-0 daily-report-v2__placeholder cycle-aux-line">
          Cycle·패닉 입력 후 자동 생성됩니다.
        </p>
      </section>
    )
  }

  const { marketToday, actionToday, strategy, sectors, oneLiner } = report

  return (
    <section className="daily-report-v2" aria-label="YDS Daily Market Report">
      <header className="daily-report-v2__head">
        <p className="m-0 cycle-eyebrow text-cyan-200/95">YDS DAILY MARKET REPORT</p>
      </header>

      <div className="daily-report-v2__grid">
        <ReportCard title="오늘 시장">
          <ReportRow label="시장" value={marketToday.market} />
          <ReportRow label="채권" value={marketToday.bond} valueClass="daily-report-v2__value--amber" />
          <ReportRow label="리더" value={marketToday.leaders} valueClass="daily-report-v2__value--cyan" />
        </ReportCard>

        <ReportCard title="오늘 행동">
          <ReportRow label="오늘" value={actionToday.today} />
          <ReportRow label="AI" value={actionToday.ai} />
          <ReportRow
            label="현금"
            value={actionToday.cash}
            valueClass="font-mono tabular-nums"
          />
          <ReportRow
            label="금리"
            value={actionToday.rate}
            valueClass="daily-report-v2__value--amber"
          />
        </ReportCard>

        <ReportCard title="실전 전략">
          <ReportRow label="단기" value={strategy.short} />
          <ReportRow label="중기" value={strategy.mid} />
          <ReportRow label="장기" value={strategy.long} />
          <ReportRow label="실전" value={strategy.practical} valueClass="daily-report-v2__value--emph" />
        </ReportCard>

        <ReportCard title="관심 섹터">
          <ReportRow
            label="리더"
            value={sectors.leaders.length ? sectors.leaders.join(" · ") : "—"}
            valueClass="daily-report-v2__value--cyan"
          />
          <ReportRow
            label="주의"
            value={sectors.caution.join(" · ")}
            valueClass="daily-report-v2__value--amber"
          />
        </ReportCard>

        <ReportCard title="한줄 브리핑" className="daily-report-v2__card--full">
          <div className="daily-report-v2__brief-lines">
            {oneLiner.map((line) => (
              <p key={line} className="m-0 daily-report-v2__brief-line">
                {line}
              </p>
            ))}
          </div>
        </ReportCard>
      </div>
    </section>
  )
}
