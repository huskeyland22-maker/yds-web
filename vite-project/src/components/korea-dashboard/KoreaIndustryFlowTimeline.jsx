import { KOREA_INDUSTRY_FLOW_TIMELINE } from "../../data/koreaGrowthSectorMap.js"

/**
 * @param {{
 *   selectedId: string | null
 *   onSelect: (sectorId: string) => void
 * }} props
 */
export default function KoreaIndustryFlowTimeline({ selectedId, onSelect }) {
  return (
    <section className="korea-flow-timeline" aria-label="산업 흐름 타임라인">
      <header className="mb-3 flex items-end justify-between gap-2">
        <div>
          <p className="m-0 font-mono text-[8px] uppercase tracking-[0.18em] text-slate-500">Flow</p>
          <h2 className="m-0 mt-0.5 text-xs font-semibold text-slate-200">산업 흐름 타임라인</h2>
        </div>
        <p className="m-0 text-[9px] text-slate-600">AI CAPEX → 전력 → 원전 → 로봇 → 방산</p>
      </header>

      <div className="korea-flow-track">
        {KOREA_INDUSTRY_FLOW_TIMELINE.map((step, i) => {
          const active = selectedId === step.sectorId
          return (
            <div key={step.sectorId} className="korea-flow-step-wrap flex min-w-0 flex-1 items-center">
              {i > 0 ? <span className="korea-flow-arrow shrink-0" aria-hidden /> : null}
              <button
                type="button"
                onClick={() => onSelect(step.sectorId)}
                className={["korea-flow-step", active ? "is-active" : ""].filter(Boolean).join(" ")}
              >
                <span className="block text-[10px] font-semibold text-slate-200 md:text-[11px]">{step.label}</span>
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
