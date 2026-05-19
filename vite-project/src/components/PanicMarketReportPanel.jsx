import {
  AlertTriangle,
  BarChart3,
  Target,
  TrendingUp,
} from "lucide-react"

/**
 * @param {{ report?: import("../utils/panicMarketReportEngine.js").PanicMarketReport | null; loading?: boolean }} props
 */

/** @typedef {'market' | 'short' | 'mid' | 'risk'} ReportCardId */

const CARD_THEMES = {
  market: {
    gradient: "from-amber-500/30 via-orange-600/15 to-[#1a0f08]",
    border: "border-amber-400/40",
    glow: "shadow-[0_0_22px_rgba(251,146,60,0.22),inset_0_1px_0_rgba(251,191,36,0.12)]",
    hoverGlow: "group-hover:shadow-[0_0_28px_rgba(251,146,60,0.35),0_4px_20px_rgba(0,0,0,0.35)]",
    iconClass: "text-amber-300",
    labelClass: "text-amber-200/75",
    valueClass: "text-amber-50",
    Icon: TrendingUp,
    emoji: "\uD83D\uDD25",
    radial: "radial-gradient(circle, rgba(251,191,36,0.45) 0%, transparent 70%)",
  },
  short: {
    gradient: "from-cyan-500/28 via-sky-600/12 to-[#061018]",
    border: "border-cyan-400/40",
    glow: "shadow-[0_0_22px_rgba(34,211,238,0.2),inset_0_1px_0_rgba(103,232,249,0.1)]",
    hoverGlow: "group-hover:shadow-[0_0_28px_rgba(34,211,238,0.32),0_4px_20px_rgba(0,0,0,0.35)]",
    iconClass: "text-cyan-300",
    labelClass: "text-cyan-200/75",
    valueClass: "text-cyan-50",
    Icon: Target,
    emoji: "\uD83C\uDFAF",
    radial: "radial-gradient(circle, rgba(34,211,238,0.4) 0%, transparent 70%)",
  },
  mid: {
    gradient: "from-emerald-500/28 via-green-600/12 to-[#061210]",
    border: "border-emerald-400/38",
    glow: "shadow-[0_0_22px_rgba(52,211,153,0.2),inset_0_1px_0_rgba(110,231,183,0.1)]",
    hoverGlow: "group-hover:shadow-[0_0_28px_rgba(52,211,153,0.32),0_4px_20px_rgba(0,0,0,0.35)]",
    iconClass: "text-emerald-300",
    labelClass: "text-emerald-200/75",
    valueClass: "text-emerald-50",
    Icon: BarChart3,
    emoji: "\uD83D\uDCC8",
    radial: "radial-gradient(circle, rgba(52,211,153,0.4) 0%, transparent 70%)",
  },
  risk: {
    gradient: "from-orange-500/30 via-red-600/18 to-[#180a08]",
    border: "border-orange-400/42",
    glow: "shadow-[0_0_22px_rgba(249,115,22,0.22),inset_0_1px_0_rgba(251,146,60,0.1)]",
    hoverGlow: "group-hover:shadow-[0_0_28px_rgba(239,68,68,0.3),0_4px_20px_rgba(0,0,0,0.35)]",
    iconClass: "text-orange-300",
    labelClass: "text-orange-200/75",
    valueClass: "text-orange-50",
    Icon: AlertTriangle,
    emoji: "\u26A0",
    radial: "radial-gradient(circle, rgba(249,115,22,0.45) 0%, transparent 70%)",
  },
}

function clipLine(text, max = 12) {
  if (text == null || text === "") return "\u2014"
  const s = String(text).replace(/\s+/g, " ").trim()
  const first = s.split(/[.,\n|]/)[0]?.trim() ?? s
  if (first.length <= max) return first
  return `${first.slice(0, max)}\u2026`
}

function riskSummary(report) {
  const risks = Array.isArray(report?.risks) ? report.risks : report?.risk ? [report.risk] : []
  const raw = risks[0] ?? report?.risk_note ?? report?.risk ?? ""
  const t = String(raw)
  if (/\uB0AE\uC74C|\uC548\uC815|\uC81C\uD55C|\uC644\uD654/i.test(t)) return "\uB0AE\uC74C"
  if (/\uB192\uC74C|\uACBD\uACC4|\uD655\uB300|\uC2A4\uD2B8\uB808\uC2A4|\uAE09\uB4F1/i.test(t)) return "\uB192\uC74C"
  if (/\uBCF4\uD1B5|\uC911\uB9BD/i.test(t)) return "\uBCF4\uD1B5"
  return clipLine(t, 6)
}

function greedLabel(report) {
  const view = String(report?.market_view ?? report?.marketView ?? "")
  if (/\uD0D0\uC6B0\uAE50|\uACFC\uC5F4|greed/i.test(view)) return "\uD0D0\uC6B0\uAE50"
  if (/\uACF5\uD3EC|fear/i.test(view)) return "\uACF5\uD3EC"
  if (report?.regimeLabel) {
    if (/\uD0D0\uC6B0\uAE50|\uACFC\uC5F4/.test(report.regimeLabel)) return "\uD0D0\uC6B0\uAE50"
    if (/\uACF5\uD3EC/.test(report.regimeLabel)) return "\uACF5\uD3EC"
  }
  if (report?.actionMode === "Risk-on") return "\uD0D0\uC6B0\uAE50"
  if (report?.actionMode === "Risk-off") return "\uACF5\uD3EC"
  return "\uC911\uB9BD"
}

function shortStrategyValue(report) {
  const raw = report?.shortTerm ?? report?.short_strategy ?? ""
  const t = String(raw)
  if (/\uB204\uB98C/.test(t)) return "\uB204\uB98C \uAC00\uB2A5"
  if (/\uB9E4\uC218/.test(t)) return "\uB9E4\uC218 \uAC80\uD1A0"
  if (/\uC790\uC81C|\uCD95\uC18C|\uBC29\uC5B4/.test(t)) return "\uBC29\uC5B4"
  return clipLine(t, 8)
}

function midStrategyValue(report) {
  const raw = report?.midTerm ?? report?.mid_strategy ?? ""
  const t = String(raw)
  if (/\uBE44\uC911/.test(t)) return "\uBE44\uC911 \uD655\uB300"
  if (/\uBD84\uD560|\uD68C\uBCF5/.test(t)) return "\uBD84\uD560"
  if (/\uCD95\uC18C|\uBC29\uC5B4/.test(t)) return "\uBE44\uC911\uCD95\uC18C"
  return clipLine(t, 8)
}

function marketStateValue(report) {
  const greed = greedLabel(report)
  if (greed !== "\uC911\uB9BD") return greed
  return clipLine(report.regimeLabel || report.market_view, 8)
}

function riskDisplayValue(report) {
  const risks = Array.isArray(report?.risks) ? report.risks : report?.risk ? [report.risk] : []
  const raw = [risks.join(" "), report?.risk_note, report?.risk].filter(Boolean).join(" ")
  const t = String(raw)
  if (/\uD1B1|put\s*\/?\s*call|p\/c/i.test(t)) return "\uD1B1\uCF5C \uACFC\uC5F4"
  return riskSummary(report)
}

/** @param {import("../utils/panicMarketReportEngine.js").PanicMarketReport} report */
function buildSummaryCards(report) {
  return [
    { id: "market", label: "\uC2DC\uC7A5\uC0C1\uD0DC", value: marketStateValue(report) },
    { id: "short", label: "\uB2E8\uAE30", value: shortStrategyValue(report) },
    { id: "mid", label: "\uC911\uAE30", value: midStrategyValue(report) },
    { id: "risk", label: "\uB9AC\uC2A4\uD06C", value: riskDisplayValue(report) },
  ]
}

/**
 * @param {{ id: ReportCardId; label: string; value: string }} props
 */
function ReportTerminalCard({ id, label, value }) {
  const theme = CARD_THEMES[id]
  const { Icon, emoji } = theme

  return (
    <article
      className={[
        "group relative flex h-[94px] min-h-[90px] max-h-[100px] flex-col justify-between overflow-hidden",
        "rounded-2xl border px-2 py-2 transition duration-200",
        "hover:-translate-y-0.5",
        theme.border,
        theme.glow,
        theme.hoverGlow,
      ].join(" ")}
    >
      <div
        className={["pointer-events-none absolute inset-0 bg-gradient-to-br", theme.gradient].join(" ")}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-3 -top-3 h-14 w-14 rounded-full opacity-40 blur-2xl"
        style={{ background: theme.radial }}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-1">
        <p className={["m-0 text-[9px] font-semibold uppercase tracking-[0.12em]", theme.labelClass].join(" ")}>
          {label}
        </p>
        <Icon className={["h-3.5 w-3.5 shrink-0 opacity-90", theme.iconClass].join(" ")} strokeWidth={2.25} aria-hidden />
      </div>
      <p
        className={[
          "relative m-0 truncate text-[22px] font-bold leading-[1.1] tracking-tight",
          theme.valueClass,
        ].join(" ")}
        title={value}
      >
        <span className="mr-0.5 text-[18px] not-italic" aria-hidden>
          {emoji}
        </span>
        {value}
      </p>
    </article>
  )
}

export default function PanicMarketReportPanel({ report = null, loading = false }) {
  if (loading) {
    return (
      <div className="border-t border-white/[0.06] px-2.5 py-2">
        <p className="m-0 text-[10px] text-slate-500">\uC2DC\uC7A5 \uB9AC\uD3EC\uD2B8 \uC0DD\uC131 \uC911\u2026</p>
      </div>
    )
  }

  if (!report?.summary) {
    return (
      <div className="border-t border-white/[0.06] px-2.5 py-2">
        <p className="m-0 text-[10px] text-slate-500">9\uB300 \uC9C0\uD45C \uC800\uC7A5 \uD6C4 \uC624\uB298 \uC2DC\uC7A5 \uB9AC\uD3EC\uD2B8\uAC00 \uC790\uB3D9 \uC0DD\uC131\uB429\uB2C8\uB2E4.</p>
      </div>
    )
  }

  const cards = buildSummaryCards(report)

  return (
    <div className="border-t border-violet-500/15 bg-violet-500/[0.03] px-2 py-2 sm:px-2.5">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 border-l-2 border-violet-400/50 pl-2">
        <p className="m-0 text-[11px] font-bold text-slate-200">\uC624\uB298 \uC2DC\uC7A5 \uB9AC\uD3EC\uD2B8</p>
        {report.regimeLabel ? (
          <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-px text-[8px] font-semibold text-slate-400">
            {report.regimeLabel}
          </span>
        ) : null}
        {report.actionMode ? (
          <span className="rounded border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-px text-[8px] font-bold text-cyan-200">
            {report.actionMode}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {cards.map((c) => (
          <ReportTerminalCard key={c.id} id={c.id} label={c.label} value={c.value} />
        ))}
      </div>

      {report.priority_sector || report.sector ? (
        <p className="m-0 mt-1.5 text-center text-[9px] text-slate-500">
          \uC6B0\uC120 \uC139\uD130 \u00B7{" "}
          <span className="text-cyan-200/85">{clipLine(report.priority_sector || report.sector, 14)}</span>
        </p>
      ) : null}

      {report.summary ? (
        <p className="m-0 mt-1 line-clamp-2 text-[9px] leading-snug text-slate-500">{report.summary}</p>
      ) : null}
    </div>
  )
}
