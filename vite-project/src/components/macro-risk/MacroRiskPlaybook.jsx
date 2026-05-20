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
      ? "성장주 추격 금지 · 눌림 대기"
      : snapshot.triggers.some((t) => t.active && t.id === "dollar_pressure")
        ? "리스크 축소 · 변동성 회피"
        : "비중 유지 · 추세 확인"

  const cash =
    !Number.isFinite(s) ? "—" : s >= 80 ? "20~30%" : s >= 60 ? "15~25%" : s >= 40 ? "10~20%" : "5~15%"
  const sector = rateN >= 58 && inflN < 68 ? "가치·퀄리티 우세" : rateN >= 62 ? "방어·현금흐름" : "혼합·대형주"
  const tactic = snapshot.tactical

  const rows = [
    { k: "장기", v: longStance },
    { k: "단기", v: shortStance },
    { k: "현금", v: cash },
    { k: "섹터", v: sector },
    { k: "전술", v: tactic },
  ]

  return (
    <section className="trading-card-shell px-3 py-3 sm:px-4 sm:py-3.5">
      <p className="m-0 text-[9px] font-semibold tracking-[0.18em] text-slate-500">MARKET PLAYBOOK</p>
      <p className="m-0 mt-1 text-[10px] text-slate-500">
        Macro {Number.isFinite(s) ? Math.round(s) : "—"} · {scoreBandLabel(s)}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.k}
            className="rounded-lg border border-white/[0.07] bg-black/22 px-3 py-2.5"
          >
            <p className="m-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">{row.k}</p>
            <p className="m-0 mt-1 text-[12px] font-semibold leading-snug text-slate-100">{row.v}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
