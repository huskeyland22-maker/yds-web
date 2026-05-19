/**
 * @param {{ report?: import("../utils/panicMarketReportEngine.js").PanicMarketReport | null; loading?: boolean }} props
 */

const SUMMARY_CARD =
  "flex min-h-[3.25rem] flex-col justify-center rounded-md border border-white/[0.08] bg-[#070a10]/90 px-2 py-1.5 text-center"

function clipLine(text, max = 10) {
  if (text == null || text === "") return "—"
  const s = String(text).replace(/\s+/g, " ").trim()
  const first = s.split(/[.,\n·|]/)[0]?.trim() ?? s
  if (first.length <= max) return first
  return `${first.slice(0, max)}…`
}

function riskSummary(report) {
  const risks = Array.isArray(report?.risks) ? report.risks : report?.risk ? [report.risk] : []
  const raw = risks[0] ?? report?.risk_note ?? report?.risk ?? ""
  const t = String(raw)
  if (/낮음|안정|제한|완화/i.test(t)) return "낮음"
  if (/높음|경계|확대|스트레스|급등/i.test(t)) return "높음"
  if (/보통|중립/i.test(t)) return "보통"
  return clipLine(t, 6)
}

function greedLabel(report) {
  const view = String(report?.market_view ?? report?.marketView ?? "")
  if (/탐욕|과열|greed/i.test(view)) return "탐욕"
  if (/공포|fear/i.test(view)) return "공포"
  if (report?.regimeLabel) {
    if (/탐욕|과열/.test(report.regimeLabel)) return "탐욕"
    if (/공포/.test(report.regimeLabel)) return "공포"
  }
  if (report?.actionMode === "Risk-on") return "탐욕"
  if (report?.actionMode === "Risk-off") return "공포"
  return "중립"
}

function shortStrategyValue(report) {
  const raw = report?.shortTerm ?? report?.short_strategy ?? ""
  const t = String(raw)
  if (/눌림/.test(t)) return "눌림 가능"
  if (/매수/.test(t)) return "매수 검토"
  if (/자제|축소|방어/.test(t)) return "방어"
  return clipLine(t, 8)
}

function midStrategyValue(report) {
  const raw = report?.midTerm ?? report?.mid_strategy ?? ""
  const t = String(raw)
  if (/비중/.test(t)) return "비중확대"
  if (/분할|회복/.test(t)) return "분할"
  if (/축소|방어/.test(t)) return "비중축소"
  return clipLine(t, 8)
}

/** @param {import("../utils/panicMarketReportEngine.js").PanicMarketReport} report */
function buildSummaryCards(report) {
  return [
    { label: "시장상태", value: clipLine(report.regimeLabel || report.market_view, 8) },
    { label: "탐욕", value: greedLabel(report) },
    { label: "단기", value: shortStrategyValue(report) },
    { label: "리스크", value: riskSummary(report) },
  ]
}

export default function PanicMarketReportPanel({ report = null, loading = false }) {
  if (loading) {
    return (
      <div className="border-t border-white/[0.06] px-2.5 py-2">
        <p className="m-0 text-[10px] text-slate-500">시장 리포트 생성 중…</p>
      </div>
    )
  }

  if (!report?.summary) {
    return (
      <div className="border-t border-white/[0.06] px-2.5 py-2">
        <p className="m-0 text-[10px] text-slate-500">9대 지표 저장 후 오늘 시장 리포트가 자동 생성됩니다.</p>
      </div>
    )
  }

  const cards = buildSummaryCards(report)

  return (
    <div className="border-t border-violet-500/15 bg-violet-500/[0.03] px-2 py-2 sm:px-2.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5 border-l-2 border-violet-400/50 pl-2">
        <p className="m-0 text-[11px] font-bold text-slate-200">오늘 시장 리포트</p>
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

      <div className="grid grid-cols-4 gap-1">
        {cards.map((c) => (
          <article key={c.label} className={SUMMARY_CARD}>
            <p className="m-0 text-[8px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className="m-0 mt-0.5 text-[11px] font-bold leading-tight text-slate-100">{c.value}</p>
          </article>
        ))}
      </div>

      <p className="m-0 mt-1 text-center text-[9px] text-slate-500">
        중기 {midStrategyValue(report)}
        {report.priority_sector || report.sector
          ? ` · ${clipLine(report.priority_sector || report.sector, 12)}`
          : ""}
      </p>

      {report.summary ? (
        <p className="m-0 mt-1 line-clamp-2 text-[9px] leading-snug text-slate-500">{report.summary}</p>
      ) : null}
    </div>
  )
}
