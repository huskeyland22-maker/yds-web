import { useMemo } from "react"
import { useAppDataStore } from "../../store/appDataStore.js"
import { computePanicV2 } from "../../panic-v2/index.js"
import { latestPanicV2DynamicScore } from "../../panic-v2/panicV2Dynamic.js"
import { resolvePanicV2Status } from "../../panic-v2/panicV2Status.js"
import { CORE_METRICS } from "../../utils/panicDeskMetrics.js"
import { formatMetricValue } from "../macroCycleChartUtils.js"
import PanicMetricRow from "./PanicMetricRow.jsx"

function fmt(key, v) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return formatMetricValue(key, Number(v))
}

/** 핵심 4지표 고정 순서: 1행 VIX·FG, 2행 P/C·HY */
const CORE_ROW_ORDER = ["vix", "fearGreed", "putCall", "highYield"]

/**
 * @param {{ panicData: object | null; historyRows?: object[] }} props
 */
export default function PanicCoreMetricsBlock({ panicData, historyRows = [] }) {
  const v2SyncStatus = useAppDataStore((s) => s.panicHistoryV2SyncStatus)
  const levelV2 = useMemo(() => computePanicV2(panicData), [panicData])

  const displayScore = useMemo(() => {
    const dynamic = historyRows.length >= 8 ? latestPanicV2DynamicScore(historyRows) : null
    if (dynamic != null) return dynamic
    return levelV2.score
  }, [historyRows, levelV2.score])

  const status = useMemo(() => resolvePanicV2Status(displayScore), [displayScore])

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
          label="패닉지수"
          value={
            displayScore != null
              ? String(displayScore)
              : v2SyncStatus === "backfilling"
                ? "백필중"
                : "데이터 준비중"
          }
          accent="#22d3ee"
          variant="highlight"
        />
        <PanicMetricRow
          label="상태"
          value={
            status?.label ??
            (v2SyncStatus === "backfilling" ? "백필중" : displayScore == null ? "준비중" : "—")
          }
          accent="#94a3b8"
          variant="highlight"
        />
      </div>
    </section>
  )
}
