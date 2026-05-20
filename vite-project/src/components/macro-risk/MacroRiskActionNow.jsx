/**
 * @param {{ snapshot: import("../../macro-risk/engine.js").MacroRiskSnapshot }} props
 */
export default function MacroRiskActionNow({ snapshot }) {
  const s = Number(snapshot.score)
  const rateTrig = snapshot.triggers.some(
    (t) => t.active && (t.id === "rate_repricing_event" || t.id === "rate_shock"),
  )

  const today = rateTrig ? "추격 금지" : s >= 60 ? "추격 금지" : "추세 확인"
  const ai = rateTrig ? "눌림 대기" : "선별 관망"
  const cash = !Number.isFinite(s) ? "—" : s >= 80 ? "20~30" : s >= 60 ? "18~28" : "12~22"
  const riskWatch = rateTrig ? "금리 우선" : s >= 70 ? "유동성 감시" : "금리 추세"

  const rows = [
    { k: "오늘", v: today },
    { k: "AI", v: ai },
    { k: "현금", v: cash },
    { k: "리스크", v: riskWatch },
  ]

  return (
    <section className="rounded-xl border border-cyan-400/35 bg-gradient-to-br from-cyan-500/12 via-slate-900/90 to-black/50 px-3 py-2.5 shadow-[0_0_20px_rgba(34,211,238,0.12)] ring-1 ring-cyan-400/20 backdrop-blur-md sm:px-4">
      <p className="m-0 text-[9px] font-bold tracking-[0.22em] text-cyan-100">ACTION NOW</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map((row) => (
          <div
            key={row.k}
            className="min-w-0 rounded-lg border border-white/[0.1] bg-black/35 px-2.5 py-2 shadow-inner"
          >
            <p className="m-0 text-[8px] font-semibold uppercase tracking-wide text-cyan-200/70">{row.k}</p>
            <p className="m-0 mt-0.5 truncate text-[11px] font-bold leading-tight text-white">{row.v}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
