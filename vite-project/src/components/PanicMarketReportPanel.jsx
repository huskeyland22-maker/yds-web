/**
 * @param {{ report?: import("../utils/panicMarketReportEngine.js").PanicMarketReport | null; loading?: boolean }} props
 */
export default function PanicMarketReportPanel({ report = null, loading = false }) {
  if (loading) {
    return (
      <div className="border-t border-white/[0.06] px-3 py-3">
        <p className="m-0 text-[10px] text-slate-500">시장 리포트 생성 중…</p>
      </div>
    )
  }

  if (!report?.summary) {
    return (
      <div className="border-t border-white/[0.06] px-3 py-2.5">
        <p className="m-0 text-[10px] text-slate-500">9대 지표 저장 후 오늘 시장 리포트가 자동 생성됩니다.</p>
      </div>
    )
  }

  const risks = Array.isArray(report.risks) ? report.risks : report.risk ? [report.risk] : []

  return (
    <div className="border-t border-violet-500/15 bg-violet-500/[0.03] px-2.5 py-3 sm:px-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 border-l-2 border-violet-400/50 pl-2">
        <p className="m-0 text-[11px] font-bold text-slate-200">오늘 시장 리포트</p>
        {report.regimeLabel ? (
          <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-px text-[9px] font-semibold text-slate-300">
            {report.regimeLabel}
          </span>
        ) : null}
        {report.actionMode ? (
          <span className="rounded border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-px text-[9px] font-bold text-cyan-200">
            {report.actionMode}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
        <article className="rounded-md border border-white/[0.08] bg-[#070a10]/80 px-2.5 py-2 sm:col-span-2">
          <p className="m-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">시장 요약</p>
          <p className="m-0 mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-300">{report.summary}</p>
        </article>

        <ReportCell label="단기 전략" value={report.shortTerm} />
        <ReportCell label="중기 전략" value={report.midTerm} />
        <ReportCell label="장기 전략" value={report.longTerm} />

        <article className="rounded-md border border-white/[0.08] bg-[#070a10]/80 px-2.5 py-2">
          <p className="m-0 text-[9px] font-semibold tracking-wide text-slate-500">리스크</p>
          <ul className="m-0 mt-1 list-none space-y-0.5 p-0">
            {risks.map((r) => (
              <li key={r} className="text-[10px] leading-snug text-orange-200/90">
                · {r}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-md border border-white/[0.08] bg-[#070a10]/80 px-2.5 py-2">
          <p className="m-0 text-[9px] font-semibold tracking-wide text-slate-500">우위 섹터</p>
          <p className="m-0 mt-1 text-[11px] leading-snug text-cyan-200/90">{report.sector}</p>
        </article>
      </div>
    </div>
  )
}

/** @param {{ label: string; value?: string }} props */
function ReportCell({ label, value }) {
  return (
    <article className="rounded-md border border-white/[0.08] bg-[#070a10]/80 px-2.5 py-2">
      <p className="m-0 text-[9px] font-semibold tracking-wide text-slate-500">{label}</p>
      <p className="m-0 mt-1 text-[11px] leading-snug text-slate-200">{value ?? "—"}</p>
    </article>
  )
}
