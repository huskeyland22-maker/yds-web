import {
  AlertTriangle,
  BarChart3,
  Target,
  TrendingUp,
} from "lucide-react"
import { formatMetricValue } from "./macroCycleChartUtils.js"
import { clipReportLine, renderText } from "../utils/renderReport.js"

/**
 * @param {{
 *   report?: import("../utils/panicMarketReportEngine.js").PanicMarketReport | null
 *   loading?: boolean
 *   panicData?: object | null
 * }} props
 */

/** @typedef {'market' | 'short' | 'mid' | 'risk'} ReportCardId */

const CARD_THEMES = {
  market: {
    gradient: "from-amber-500/12 via-orange-600/6 to-[#1a0f08]",
    border: "border-amber-400/25",
    glow: "shadow-[0_0_4px_rgba(251,146,60,0.1)]",
    hoverGlow: "hover:shadow-[0_0_4px_rgba(251,146,60,0.14)]",
    iconClass: "text-amber-300",
    labelClass: "text-amber-200/80",
    headlineClass: "text-amber-50",
    Icon: TrendingUp,
  },
  short: {
    gradient: "from-cyan-500/12 via-sky-600/6 to-[#061018]",
    border: "border-cyan-400/25",
    glow: "shadow-[0_0_4px_rgba(34,211,238,0.08)]",
    hoverGlow: "hover:shadow-[0_0_4px_rgba(34,211,238,0.12)]",
    iconClass: "text-cyan-300",
    labelClass: "text-cyan-200/80",
    headlineClass: "text-cyan-50",
    Icon: Target,
  },
  mid: {
    gradient: "from-emerald-500/12 via-green-600/6 to-[#061210]",
    border: "border-emerald-400/25",
    glow: "shadow-[0_0_4px_rgba(52,211,153,0.08)]",
    hoverGlow: "hover:shadow-[0_0_4px_rgba(52,211,153,0.12)]",
    iconClass: "text-emerald-300",
    labelClass: "text-emerald-200/80",
    headlineClass: "text-emerald-50",
    Icon: BarChart3,
  },
  risk: {
    gradient: "from-orange-500/12 via-red-600/8 to-[#180a08]",
    border: "border-orange-400/25",
    glow: "shadow-[0_0_4px_rgba(249,115,22,0.1)]",
    hoverGlow: "hover:shadow-[0_0_4px_rgba(249,115,22,0.14)]",
    iconClass: "text-orange-300",
    labelClass: "text-orange-200/80",
    headlineClass: "text-orange-50",
    Icon: AlertTriangle,
  },
}

/** @param {import("../utils/panicMarketReportEngine.js").PanicMarketReport | null} report @param {object | null} panicData */
function buildReportCards(report, panicData) {
  const fg = panicData?.fearGreed
  const pc = panicData?.putCall
  const mode = renderText(report?.actionMode)
  const sector = clipReportLine(report?.priority_sector || report?.sector, 12)

  const marketHead =
    renderText(report?.regimeLabel) !== "\u2014"
      ? renderText(report?.regimeLabel)
      : fg != null && Number.isFinite(Number(fg))
        ? "\uD0D0\uC695\uAD6C\uAC04"
        : clipReportLine(report?.market_view || report?.marketView, 8)
  const marketFoot =
    fg != null && Number.isFinite(Number(fg))
      ? `\uACF5\uD3EC\uD0D0\uC695 ${Math.round(Number(fg))}`
      : mode

  const shortHead = clipReportLine(report?.shortTerm || report?.short_strategy, 10) || "\uB9E4\uC218 \uAC80\uD1A0"
  const shortFoot = clipReportLine(report?.short_strategy || report?.shortTerm, 16) || "\uB2E8\uAE30 \uB204\uB9BC"

  const midHead = clipReportLine(report?.midTerm || report?.mid_strategy, 10) || "\uBE44\uC911 \uD655\uB300"
  const midFoot = sector !== "\u2014" ? sector : "\uC911\uAE30 ETF+\uC131\uC7A5"

  const riskRaw = Array.isArray(report?.risks) ? report.risks[0] : report?.risk_note || report?.risk
  const riskHead = clipReportLine(riskRaw, 10) || "\uB9AC\uC2A4\uD06C"
  const riskFoot =
    pc != null && Number.isFinite(Number(pc))
      ? `\uD48B\uCF5C ${formatMetricValue("putCall", Number(pc))}`
      : clipReportLine(report?.risk_note, 14)

  return [
    { id: "market", label: "\uC2DC\uC7A5\uC0C1\uD0DC", headline: marketHead, detail: marketFoot },
    { id: "short", label: "\uB2E8\uAE30", headline: shortHead, detail: shortFoot },
    { id: "mid", label: "\uC911\uAE30", headline: midHead, detail: midFoot },
    { id: "risk", label: "\uB9AC\uC2A4\uD06C", headline: riskHead, detail: riskFoot },
  ]
}

/**
 * @param {{ id: ReportCardId; label: string; headline: string; detail: string }} props
 */
function ReportTerminalCard({ id, label, headline, detail }) {
  const theme = CARD_THEMES[id]
  const { Icon } = theme

  return (
    <article
      className={[
        "report-card group relative mb-0 flex h-[60px] min-h-[60px] max-h-[60px] flex-col justify-center overflow-hidden rounded-xl border px-3 py-2 pb-0 transition-shadow duration-200",
        theme.border,
        theme.glow,
        theme.hoverGlow,
      ].join(" ")}
    >
      <div
        className={["pointer-events-none absolute inset-0 bg-gradient-to-br opacity-75", theme.gradient].join(" ")}
        aria-hidden
      />
      <div className="relative mb-0.5 flex min-w-0 items-center gap-0.5">
        <Icon className={["h-2.5 w-2.5 shrink-0 opacity-60", theme.iconClass].join(" ")} strokeWidth={2} aria-hidden />
        <p
          className={[
            "m-0 truncate text-[9px] font-semibold uppercase tracking-wide opacity-60",
            theme.labelClass,
          ].join(" ")}
        >
          {label}
        </p>
      </div>

      <p
        className={[
          "relative m-0 line-clamp-1 text-[14px] font-bold leading-none tracking-tight",
          theme.headlineClass,
        ].join(" ")}
        title={headline}
      >
        {headline}
      </p>

      <p className="relative m-0 mb-0 mt-0.5 line-clamp-1 text-[9px] leading-none opacity-70 text-slate-400">{detail}</p>
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

  const cards = buildReportCards(report, panicData)

  return (
    <div className="report-section mt-1 border-t border-violet-500/10 bg-violet-500/[0.015] px-2 pt-1.5 pb-0.5 sm:px-2.5">
      <p className="m-0 mb-0 border-l-2 border-violet-400/40 pl-2 text-[9px] font-semibold text-slate-300/75">
        {"\uC624\uB298 \uC2DC\uC7A5 \uB9AC\uD3EC\uD2B8"}
      </p>

      <div className="report-grid mt-1.5 grid grid-cols-2 items-stretch gap-2 sm:grid-cols-4">
        {cards.map((c) => (
          <ReportTerminalCard key={c.id} id={c.id} label={c.label} headline={c.headline} detail={c.detail} />
        ))}
      </div>

      {report.summary ? (
        <p className="m-0 mt-0.5 line-clamp-1 text-[8px] leading-none text-slate-500/80">{renderText(report.summary)}</p>
      ) : null}
    </div>
  )
}
