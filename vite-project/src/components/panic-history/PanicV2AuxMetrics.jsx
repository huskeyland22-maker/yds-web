import { PANIC_V2_CHART_DETAIL_METRICS } from "../../panic-v2/weights.js"

/**
 * 실전 V2 — 보조지표 토글 (VIX·VVIX·NDX·SOXX)
 * @param {{
 *   open: boolean
 *   onToggle: () => void
 *   scoreSelected: boolean
 *   detailMetric: string | null
 *   metricCounts: Record<string, number>
 *   onSelectScore: () => void
 *   onSelectMetric: (key: string) => void
 * }} props
 */
export default function PanicV2AuxMetrics({
  open,
  onToggle,
  scoreSelected,
  detailMetric,
  metricCounts,
  onSelectScore,
  onSelectMetric,
}) {
  return (
    <div className="panic-v2-aux-metrics">
      <button
        type="button"
        onClick={onToggle}
        className={[
          "panic-history-tab panic-history-tab--aux-toggle inline-flex items-center rounded-md border px-1.5 py-0.5",
          open
            ? "border-sky-400/25 bg-sky-500/10 text-sky-100"
            : "border-transparent bg-transparent text-slate-500 hover:text-slate-300",
        ].join(" ")}
        aria-expanded={open}
        aria-controls="panic-v2-aux-metrics"
      >
        <span className="whitespace-nowrap text-[9px] font-semibold">{open ? "보조지표 −" : "보조지표 +"}</span>
      </button>
      {open ? (
        <div
          id="panic-v2-aux-metrics"
          className="panic-v2-aux-metrics__list mt-0.5 flex flex-wrap gap-0.5"
          role="group"
          aria-label="V2 보조 지표"
        >
          <button
            type="button"
            onClick={onSelectScore}
            className={[
              "panic-v2-aux-metric-btn rounded px-1.5 py-0.5 text-[9px] font-semibold tabular-nums",
              scoreSelected ? "panic-v2-aux-metric-btn--active" : "panic-v2-aux-metric-btn--idle",
            ].join(" ")}
          >
            점수
          </button>
          {PANIC_V2_CHART_DETAIL_METRICS.map((m) => {
            const ready = (metricCounts[m.key] ?? 0) > 0
            const selected = detailMetric === m.key
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => onSelectMetric(m.key)}
                className={[
                  "panic-v2-aux-metric-btn inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold",
                  selected ? "panic-v2-aux-metric-btn--active" : "panic-v2-aux-metric-btn--idle",
                  !ready ? "panic-v2-aux-metric-btn--pending" : "",
                ].join(" ")}
                title={ready ? `${m.tabLabel} · ${metricCounts[m.key]}일` : `${m.tabLabel} · 히스토리 준비중`}
              >
                <span>{m.tabLabel}</span>
                {!ready ? (
                  <span className="panic-v2-aux-metric__badge" aria-label="준비중">
                    준비중
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
