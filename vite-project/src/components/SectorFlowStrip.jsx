/**
 * 섹터·인프라 흐름 스트립 — 미세한 모션, 기관형 톤.
 */
const FLOW_LABELS = ["반도체", "HBM · 메모리", "전력망", "DC · 냉각", "AI 인프라", "코리아 플로우"]

export default function SectorFlowStrip() {
  const line = FLOW_LABELS.join("  →  ")
  return (
    <div
      className="overflow-hidden rounded-lg border border-white/[0.05] bg-black/25 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      aria-hidden
    >
      <div className="yds-flow-strip-track flex w-max gap-0">
        <div className="yds-flow-strip-content flex shrink-0 items-center gap-6 px-4 text-[10px] tracking-wide text-slate-500">
          <span className="text-[9px] font-semibold tracking-[0.12em] text-slate-600">섹터 로테이션</span>
          <span className="text-slate-400">{line}</span>
        </div>
        <div className="yds-flow-strip-content flex shrink-0 items-center gap-6 px-4 text-[10px] tracking-wide text-slate-500">
          <span className="text-[9px] font-semibold tracking-[0.12em] text-slate-600">섹터 로테이션</span>
          <span className="text-slate-400">{line}</span>
        </div>
      </div>
    </div>
  )
}
