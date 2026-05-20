/**
 * 행동 최우선 — 플레이북 바로 위, 실전 규칙 요약.
 * @param {{ snapshot: import("../../macro-risk/engine.js").MacroRiskSnapshot }} props
 */
export default function MacroRiskActionNow({ snapshot }) {
  const s = Number(snapshot.score)
  const rateTrig = snapshot.triggers.some(
    (t) => t.active && (t.id === "rate_repricing_event" || t.id === "rate_shock"),
  )

  const today = rateTrig ? "추격 금지" : s >= 60 ? "비중 유지 · 금지" : "추세 확인"
  const ai = rateTrig ? "눌림 대기" : "선별 관망"
  const cash = !Number.isFinite(s) ? "—" : s >= 80 ? "20~30" : s >= 60 ? "18~28" : s >= 40 ? "12~22" : "8~15"
  const riskWatch = rateTrig ? "금리 우선 감시" : s >= 70 ? "유동성·VIX 감시" : "금리 추세 확인"

  const rows = [
    { k: "오늘", v: today },
    { k: "AI", v: ai },
    { k: "현금", v: cash },
    { k: "리스크", v: riskWatch },
  ]

  return (
    <section className="rounded-lg border border-cyan-500/25 bg-gradient-to-br from-cyan-500/[0.07] to-black/40 px-3 py-2.5 backdrop-blur-sm sm:px-4">
      <p className="m-0 text-[9px] font-semibold tracking-[0.2em] text-cyan-200/85">ACTION NOW</p>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {rows.map((row) => (
          <div key={row.k} className="min-w-0">
            <p className="m-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">{row.k}</p>
            <p className="m-0 truncate text-[11px] font-bold leading-tight text-slate-50">{row.v}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
