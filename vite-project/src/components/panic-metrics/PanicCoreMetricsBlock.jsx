import { useMemo, useState } from "react"
import { computePanicV2 } from "../../panic-v2/index.js"
import { CORE_METRICS } from "../../utils/panicDeskMetrics.js"
import { formatMetricValue } from "../macroCycleChartUtils.js"
import PanicMetricRow from "./PanicMetricRow.jsx"

function fmt(key, v) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return formatMetricValue(key, Number(v))
}

/**
 * @param {{ panicData: object | null; legacyScore?: number | null }} props
 */
export default function PanicCoreMetricsBlock({ panicData, legacyScore = null }) {
  const [explainOpen, setExplainOpen] = useState(false)
  const v2 = useMemo(() => computePanicV2(panicData), [panicData])
  const status = v2.status

  return (
    <section className="panic-core-block trading-card-shell overflow-hidden border border-white/[0.1] p-px">
      <div className="panic-metric-rows-grid">
        {CORE_METRICS.map((m) => (
          <PanicMetricRow
            key={m.key}
            label={m.label}
            value={fmt(m.key, panicData?.[m.key])}
            accent={m.accent}
            variant="core"
          />
        ))}
        <PanicMetricRow
          label="패닉지수"
          value={v2.score != null ? String(v2.score) : "—"}
          accent="#22d3ee"
          variant="highlight"
          fullWidth
        />
        <PanicMetricRow
          label="상태"
          value={status?.label ?? "—"}
          accent="#94a3b8"
          variant="highlight"
          fullWidth
        />
      </div>

      {v2.score != null ? (
        <button
          type="button"
          className="panic-core-block__explain-btn"
          aria-expanded={explainOpen}
          onClick={() => setExplainOpen((o) => !o)}
        >
          왜 {v2.score}인가 {explainOpen ? "−" : "+"}
        </button>
      ) : null}

      {explainOpen && v2.score != null ? (
        <div className="panic-core-block__explain">
          <p className="m-0 text-[9px] text-slate-500">
            9지표 가중 (핵심 70 + 전문가 30) · V2
            {legacyScore != null ? ` · 기존 ${legacyScore}` : ""}
          </p>
          <div className="panic-core-block__chips">
            {v2.metrics
              .filter((m) => !m.missing)
              .map((m) => (
                <span key={m.key} className="panic-core-block__chip">
                  {m.shortLabel} {m.contributionLabel}
                </span>
              ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
