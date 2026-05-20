import { scoreBandLabel } from "../../macro-risk/macroRiskUiTone.js"

/**
 * @param {{ snapshot: import("../../macro-risk/engine.js").MacroRiskSnapshot }} props
 */
export default function MacroRiskPlaybook({ snapshot }) {
  const s = Number(snapshot.score)
  const rate = snapshot.pillars.find((p) => p.id === "rate")
  const infl = snapshot.pillars.find((p) => p.id === "inflation")
  const rateN = rate?.score ?? 50
  const inflN = infl?.score ?? 50

  const longStance = !Number.isFinite(s) ? "관망" : s >= 75 ? "방어" : s >= 55 ? "균형" : "기회"
  const shortStance =
    snapshot.triggers.some((t) => t.active && (t.id === "rate_repricing_event" || t.id === "rate_shock"))
      ? "눌림대기"
      : "비중유지"

  const cash = !Number.isFinite(s) ? "—" : s >= 80 ? "20~30" : s >= 60 ? "18~28" : "12~22"
  const sector = rateN >= 58 && inflN < 68 ? "방어/현금흐름" : rateN >= 62 ? "방어배당" : "혼합"
  const tacticShort = snapshot.tactical.replace(/\s*접근\s*$/u, "").trim() || "보수"
  const ban = "성장추격"

  const cells = [
    { k: "장기", v: longStance },
    { k: "단기", v: shortStance },
    { k: "현금", v: cash },
    { k: "전술", v: tacticShort },
    { k: "섹터", v: sector },
    { k: "금지", v: ban },
  ]

  return (
    <section className="trading-card-shell px-4 py-3">
      <p className="m-0 text-[9px] font-semibold tracking-[0.18em] text-slate-500">MARKET PLAYBOOK</p>
      <p className="m-0 mt-0.5 text-[8px] text-slate-600">
        Macro {Number.isFinite(s) ? Math.round(s) : "—"} · {scoreBandLabel(s)}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {cells.map((row) => (
          <div
            key={row.k}
            className="flex h-[70px] flex-col justify-center rounded-md border border-white/[0.07] bg-black/22 px-2.5 py-2"
          >
            <p className="m-0 text-[8px] font-semibold uppercase tracking-wide text-slate-500">{row.k}</p>
            <p className="m-0 mt-0.5 line-clamp-2 text-[10px] font-bold leading-tight text-slate-100">{row.v}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
