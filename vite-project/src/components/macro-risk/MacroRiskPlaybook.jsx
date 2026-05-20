import { scoreBandLabel } from "../../macro-risk/macroRiskUiTone.js"

/**
 * 실전 행동 전용 OS 플레이북 (스냅샷 기반 추론).
 * @param {{ snapshot: import("../../macro-risk/engine.js").MacroRiskSnapshot }} props
 */
export default function MacroRiskPlaybook({ snapshot }) {
  const s = Number(snapshot.score)
  const rate = snapshot.pillars.find((p) => p.id === "rate")
  const infl = snapshot.pillars.find((p) => p.id === "inflation")
  const rateN = rate?.score ?? 50
  const inflN = infl?.score ?? 50

  const longStance = !Number.isFinite(s) ? "관망" : s >= 75 ? "방어" : s >= 55 ? "균형·선별" : "기회 탐색"
  const shortStance =
    snapshot.triggers.some((t) => t.active && (t.id === "rate_repricing_event" || t.id === "rate_shock"))
      ? "눌림 대기"
      : snapshot.triggers.some((t) => t.active && t.id === "dollar_pressure")
        ? "변동성 회피"
        : "비중 유지"

  const cash = !Number.isFinite(s) ? "—" : s >= 80 ? "20~30" : s >= 60 ? "18~28" : s >= 40 ? "12~22" : "8~15"
  const sector = rateN >= 58 && inflN < 68 ? "방어/현금흐름" : rateN >= 62 ? "방어·배당" : "혼합"
  const tacticShort = snapshot.tactical.replace(/\s*접근\s*$/u, "").trim() || "보수"
  const ban = "성장 추격"

  const cells = [
    { k: "장기", v: longStance },
    { k: "단기", v: shortStance },
    { k: "현금", v: cash },
    { k: "섹터", v: sector },
    { k: "전술", v: tacticShort },
    { k: "금지", v: ban },
  ]

  return (
    <section className="trading-card-shell px-4 py-4">
      <p className="m-0 text-[9px] font-semibold tracking-[0.18em] text-slate-500">MARKET PLAYBOOK</p>
      <p className="m-0 mt-0.5 text-[9px] text-slate-500">
        Macro {Number.isFinite(s) ? Math.round(s) : "—"} · {scoreBandLabel(s)}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {cells.map((row) => (
          <div
            key={row.k}
            className="flex h-20 flex-col justify-center rounded-lg border border-white/[0.07] bg-black/22 px-2 py-1.5"
          >
            <p className="m-0 text-[8px] font-semibold uppercase tracking-wide text-slate-500">{row.k}</p>
            <p className="m-0 mt-0.5 line-clamp-2 text-[11px] font-bold leading-tight text-slate-100">{row.v}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
