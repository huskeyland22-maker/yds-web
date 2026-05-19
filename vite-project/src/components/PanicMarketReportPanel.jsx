import {
  AlertTriangle,
  BarChart3,
  Target,
  TrendingUp,
} from "lucide-react"
import { formatMetricValue } from "./macroCycleChartUtils.js"

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
    gradient: "from-amber-500/15 via-orange-600/8 to-[#1a0f08]",
    border: "border-amber-400/30",
    glow: "shadow-[0_0_12px_rgba(251,146,60,0.14)]",
    iconClass: "text-amber-300",
    labelClass: "text-amber-200/70",
    headlineClass: "text-amber-50",
    Icon: TrendingUp,
    emoji: "\uD83D\uDD25",
    radial: "radial-gradient(circle, rgba(251,191,36,0.18) 0%, transparent 70%)",
  },
  short: {
    gradient: "from-cyan-500/15 via-sky-600/8 to-[#061018]",
    border: "border-cyan-400/30",
    glow: "shadow-[0_0_12px_rgba(34,211,238,0.12)]",
    iconClass: "text-cyan-300",
    labelClass: "text-cyan-200/70",
    headlineClass: "text-cyan-50",
    Icon: Target,
    emoji: "\uD83C\uDFAF",
    radial: "radial-gradient(circle, rgba(34,211,238,0.15) 0%, transparent 70%)",
  },
  mid: {
    gradient: "from-emerald-500/15 via-green-600/8 to-[#061210]",
    border: "border-emerald-400/28",
    glow: "shadow-[0_0_12px_rgba(52,211,153,0.12)]",
    iconClass: "text-emerald-300",
    labelClass: "text-emerald-200/70",
    headlineClass: "text-emerald-50",
    Icon: BarChart3,
    emoji: "\uD83D\uDCC8",
    radial: "radial-gradient(circle, rgba(52,211,153,0.15) 0%, transparent 70%)",
  },
  risk: {
    gradient: "from-orange-500/15 via-red-600/10 to-[#180a08]",
    border: "border-orange-400/30",
    glow: "shadow-[0_0_12px_rgba(249,115,22,0.14)]",
    iconClass: "text-orange-300",
    labelClass: "text-orange-200/70",
    headlineClass: "text-orange-50",
    Icon: AlertTriangle,
    emoji: "\u26A0",
    radial: "radial-gradient(circle, rgba(249,115,22,0.16) 0%, transparent 70%)",
  },
}

function clipLine(text, max = 14) {
  if (text == null || text === "") return "\u2014"
  const s = String(text).replace(/\s+/g, " ").trim()
  const first = s.split(/[.,\n|]/)[0]?.trim() ?? s
  if (first.length <= max) return first
  return `${first.slice(0, max)}\u2026`
}

function buildCards(report, panicData) {
  const fg = panicData?.fearGreed
  const pc = panicData?.putCall
  const mode = report?.actionMode ?? "\u2014"
  const sector = clipLine(report?.priority_sector || report?.sector, 12)

  const marketHead =
    report?.regimeLabel ||
    (fg != null && Number.isFinite(Number(fg)) ? `\uD0D0\uC6B0\uAE50\uAD6C\uAC04` : clipLine(report?.market_view, 8))
  const marketFoot =
    fg != null && Number.isFinite(Number(fg))
      ? `\uACF5\uD3EC\uD0D0\uC6B0 ${Math.round(Number(fg))}`
      : mode

  const shortHead = clipLine(report?.shortTerm || report?.short_strategy, 10) || "\uB9E4\uC218 \uAC80\uD1A0"
  const shortFoot = clipLine(report?.short_strategy || report?.shortTerm, 16) || "\uB2E8\uAE30 \uB204\uB98C"

  const midHead = clipLine(report?.midTerm || report?.mid_strategy, 10) || "\uBE44\uC911 \uD655\uB300"
  const midFoot = sector !== "\u2014" ? `${sector}` : "\uC911\uAE30 ETF+\uC131\uC7A5"

  const riskHead = clipLine(
    Array.isArray(report?.risks) ? report.risks[0] : report?.risk_note || report?.risk,
    10,
  ) || "\uB9AC\uC2A4\uD06C"
  const riskFoot =
    pc != null && Number.isFinite(Number(pc))
      ? `\uD1B1\uCF5C ${formatMetricValue("putCall", Number(pc))}`
      : clipLine(report?.risk_note, 14)

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
  const { Icon, emoji } = theme

  return (
    <article
      className={[
        "group relative flex h-[130px] flex-col overflow-hidden rounded-2xl border p-4 transition duration-200",
        "hover:-translate-y-0.5",
        theme.border,
        theme.glow,
      ].join(" ")}
    >
      <div
        className={["pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90", theme.gradient].join(" ")}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-4 -top-4 h-12 w-12 rounded-full opacity-25 blur-xl"
        style={{ background: theme.radial }}
        aria-hidden
      />

      <div className="relative flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1">
          <Icon className={["h-5 w-5 shrink-0", theme.iconClass].join(" ")} strokeWidth={2} aria-hidden />
          <p className={["m-0 truncate text-[10px] font-semibold uppercase tracking-wide", theme.labelClass].join(" ")}>
            {label}
          </p>
        </div>
        <span className="text-[14px]" aria-hidden>
          {emoji}
        </span>
      </div>

      <p
        className={[
          "relative m-0 mt-1 line-clamp-2 text-[24px] font-bold leading-tight tracking-tight",
          theme.headlineClass,
        ].join(" ")}
        title={headline}
      >
        {headline}
      </p>

      <p className="relative m-0 mt-auto line-clamp-2 text-[10px] leading-snug text-slate-400">{detail}</p>
    </article>
  )
}

export default function PanicMarketReportPanel({ report = null, loading = false, panicData = null }) {
  if (loading) {
    return (
      <div className="border-t border-white/[0.06] px-4 py-2">
        <p className="m-0 text-[10px] text-slate-500">\uC2DC\uC7A5 \uB9AC\uD3EC\uD2B8 \uC0DD\uC131 \uC911\u2026</p>
      </div>
    )
  }

  if (!report?.summary) {
    return (
      <div className="border-t border-white/[0.06] px-4 py-2">
        <p className="m-0 text-[10px] text-slate-500">
          9\uB300 \uC9C0\uD45C \uC800\uC7A5 \uD6C4 \uC624\uB298 \uC2DC\uC7A5 \uB9AC\uD3EC\uD2B8\uAC00 \uC790\uB3D9 \uC0DD\uC131\uB429\uB2C8\uB2E4.
        </p>
      </div>
    )
  }

  const cards = buildCards(report, panicData)

  return (
    <div className="border-t border-violet-500/12 bg-violet-500/[0.02] px-2 py-2 sm:px-2.5">
      <p className="m-0 mb-1.5 border-l-2 border-violet-400/45 pl-2 text-[11px] font-bold text-slate-200">
        \uC624\uB298 \uC2DC\uC7A5 \uB9AC\uD3EC\uD2B8
      </p>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {cards.map((c) => (
          <ReportTerminalCard key={c.id} id={c.id} label={c.label} headline={c.headline} detail={c.detail} />
        ))}
      </div>

      {report.summary ? (
        <p className="m-0 mt-1 line-clamp-1 text-[9px] leading-snug text-slate-500">{report.summary}</p>
      ) : null}
    </div>
  )
}
