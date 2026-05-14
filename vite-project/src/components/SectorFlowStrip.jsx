/**
 * 섹터·인프라 흐름 스트립 — 미세한 모션, 기관형 톤.
 */
const FLOW_LABELS = ["Semis", "HBM / Memory", "Power grid", "DC · Cooling", "AI infra", "Korea flow"]

export default function SectorFlowStrip() {
  const line = FLOW_LABELS.join("  →  ")
  return (
    <div
      className="overflow-hidden rounded-lg border border-white/[0.05] bg-black/25 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      aria-hidden
    >
      <div className="yds-flow-strip-track flex w-max gap-0">
        <div className="yds-flow-strip-content flex shrink-0 items-center gap-6 px-4 font-mono text-[10px] tracking-wide text-slate-500">
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">Rotation</span>
          <span className="text-slate-400">{line}</span>
        </div>
        <div className="yds-flow-strip-content flex shrink-0 items-center gap-6 px-4 font-mono text-[10px] tracking-wide text-slate-500">
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">Rotation</span>
          <span className="text-slate-400">{line}</span>
        </div>
      </div>
    </div>
  )
}
