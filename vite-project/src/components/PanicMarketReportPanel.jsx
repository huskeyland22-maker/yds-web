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
      <div className="report-section">
        <p className="m-0 text-[12px] text-slate-500">{"\uC2DC\uC7A5 \uB9AC\uD3EC\uD2B8 \uC0DD\uC131 \uC911\u2026"}</p>
      </div>
    )
  }

  if (!report?.summary) {
    return (
      <div className="report-section">
        <p className="m-0 text-[12px] text-slate-500">
          {"9\uB300 \uC9C0\uD45C \uC800\uC7A5 \uD6C4 \uC624\uB298 \uC2DC\uC7A5 \uB9AC\uD3EC\uD2B8\uAC00 \uC790\uB3D9 \uC0DD\uC131\uB429\uB2C8\uB2E4."}
        </p>
      </div>
    )
  }

  const cards = buildActionReportCards(report, panicData)
  const strategyBrief = buildStrategyBrief(report, panicData)
  const briefLines = strategyBrief.split(" ? ").filter(Boolean)

  return (
    <div className="report-section">
      <div className="ai-brief" role="note" aria-label={"\uC624\uB298 \uC804\uB7B5 \uBE0C\uB9AC\uD551"}>
        <p className="ai-brief__title">
          <span className="mr-1" aria-hidden>
            {"\uD83E\uDDE0"}
          </span>
          {"\uC624\uB298 \uC804\uB7B5 \uBE0C\uB9AC\uD551"}
        </p>
        <p className="ai-brief__body line-clamp-2 sm:line-clamp-1">
          {briefLines.length > 1 ? briefLines.join(" ? ") : strategyBrief}
        </p>
      </div>

      <p className="m-0 mt-2 mb-1 text-[10px] font-semibold text-slate-400/90">{"\uC624\uB298 \uC2DC\uC7A5 \uB9AC\uD3EC\uD2B8"}</p>

      <div className="report-grid">
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
