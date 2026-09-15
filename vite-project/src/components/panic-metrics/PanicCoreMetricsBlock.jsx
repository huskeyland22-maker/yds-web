import { useMemo } from "react"
import { CORE_METRICS } from "../../utils/panicDeskMetrics.js"
import {
  getPanicScoreV2,
  resolvePanicIndexStatus,
} from "../../utils/tradingScores.js"
import { formatMetricValue } from "../macroCycleChartUtils.js"
import PanicMetricRow from "./PanicMetricRow.jsx"

function fmt(key, v) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return formatMetricValue(key, Number(v))
}

const CORE_ROW_ORDER = ["vix", "fearGreed", "putCall"]

/**
 * Panic Index 핵심 3지표
 * @param {{ panicData: object | null; historyRows?: object[] }} props
 */
export default function PanicCoreMetricsBlock({ panicData, historyRows: _historyRows = [] }) {
  const displayScore = useMemo(() => getPanicScoreV2(panicData), [panicData])
  const status = useMemo(() => resolvePanicIndexStatus(displayScore), [displayScore])

  const coreByKey = useMemo(() => {
    const map = new Map(CORE_METRICS.map((m) => [m.key, m]))
    return CORE_ROW_ORDER.map((k) => map.get(k)).filter(Boolean)
  }, [])

  return (
    <section className="panic-core-block trading-card-shell overflow-hidden border border-white/[0.1] p-px">
      <div className="panic-core-grid">
        {coreByKey.map((m) => (
          <PanicMetricRow
            key={m.key}
            label={m.label}
            value={fmt(m.key, panicData?.[m.key])}
            accent={m.accent}
            variant="core"
          />
        ))}
        <PanicMetricRow
          label="Panic Index"
          value={displayScore != null ? String(displayScore) : "데이터 입력 필요"}
          accent="#22d3ee"
          variant="highlight"
        />
        <PanicMetricRow
          label="상태"
          value={status?.label ?? (displayScore == null ? "입력 필요" : "—")}
          accent="#94a3b8"
          variant="highlight"
        />
      </div>
    </section>
  )
}
