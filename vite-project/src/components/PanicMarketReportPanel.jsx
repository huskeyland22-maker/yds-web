import { buildActionReportCards, buildStrategyBrief } from "../utils/panicMarketReportDisplay.js"

/**
 * @param {{
 *   report?: import("../utils/panicMarketReportEngine.js").PanicMarketReport | null
 *   loading?: boolean
 *   panicData?: object | null
 * }} props
 */

/** @typedef {import("../utils/panicMarketReportDisplay.js").ActionReportCardId} ReportCardId */

const CARD_VARIANT = {
  market: "report-card--cyan",
  short: "report-card--orange",
  mid: "report-card--green",
  risk: "report-card--red",
}

/**
 * @param {{ id: ReportCardId; label: string; emoji: string; headline: string; detail: string }} props
 */
function ActionReportCard({ id, label, emoji, headline, detail }) {
  return (
    <article className={["report-card", CARD_VARIANT[id]].filter(Boolean).join(" ")}>
      <p className="report-card__label">
        <span className="mr-0.5" aria-hidden>
          {emoji}
        </span>
        {label}
      </p>
      <p className="report-card__headline line-clamp-1" title={headline}>
        {headline}
      </p>
      <p className="report-card__detail line-clamp-1" title={detail}>
        {detail}
      </p>
    </article>
  )
}

export default function PanicMarketReportPanel({ report = null, loading = false, panicData = null }) {
  if (loading) {
    return (
      <div className="border-t border-white/[0.06] px-4 py-2">
        <p className="m-0 text-[10px] text-slate-500">{"\uC2DC\uC7A5 \uB9AC\uD3EC\uD2B8 \uC0DD\uC131 \uC911\u2026"}</p>
      </div>
    )
  }

  if (!report?.summary) {
    return (
      <div className="border-t border-white/[0.06] px-4 py-2">
        <p className="m-0 text-[10px] text-slate-500">
          {"9\uB300 \uC9C0\uD45C \uC800\uC7A5 \uD6C4 \uC624\uB298 \uC2DC\uC7A5 \uB9AC\uD3EC\uD2B8\uAC00 \uC790\uB3D9 \uC0DD\uC131\uB429\uB2C8\uB2E4."}
        </p>
      </div>
    )
  }

  const cards = buildActionReportCards(report, panicData)
  const strategyBrief = buildStrategyBrief(report, panicData)

  return (
    <div className="report-section border-t border-cyan-500/10 bg-cyan-500/[0.02] px-2 sm:px-2.5">
      <p className="m-0 mb-1 border-l-2 border-cyan-400/45 pl-2 text-[10px] font-semibold text-slate-200/90">
        {"\uC624\uB298 \uC2DC\uC7A5 \uB9AC\uD3EC\uD2B8"}
      </p>

      <p className="report-strategy-brief line-clamp-3 sm:line-clamp-2">
        <span className="mr-1" aria-hidden>
          {"\uD83E\uDDE0"}
        </span>
        <span className="font-semibold text-cyan-200/90">{"\uC624\uB298 \uC804\uB7B5:"}</span> {strategyBrief}
      </p>

      <div className="report-grid grid grid-cols-2 sm:grid-cols-4">
        {cards.map((c) => (
          <ActionReportCard
            key={c.id}
            id={c.id}
            label={c.label}
            emoji={c.emoji}
            headline={c.headline}
            detail={c.detail}
          />
        ))}
      </div>
    </div>
  )
}
