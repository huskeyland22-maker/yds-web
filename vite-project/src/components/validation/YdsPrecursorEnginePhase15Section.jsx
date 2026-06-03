import { useMemo } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase15Report,
  PRECURSOR_ENGINE_PHASE15_LABEL,
} from "../../trading-zone/ydsPrecursorEnginePhase15.js"
import { loadPrecursorValidationLog } from "../../trading-zone/ydsPrecursorValidationLogStorage.js"
import YdsPrecursorActionGuidePanel from "./YdsPrecursorActionGuidePanel.jsx"

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 * }} props
 */
export default function YdsPrecursorEnginePhase15Section({
  events = YDS_VALIDATION_EVENT_DATASET,
  latestCycleRow = null,
}) {
  const latestSnapshot = useMemo(() => {
    if (!latestCycleRow) return null
    const panic = panicDataFromCycleRow(latestCycleRow)
    if (panic) return { ...latestCycleRow, ...panic, date: latestCycleRow.date ?? panic.updatedAt }
    return latestCycleRow
  }, [latestCycleRow])

  const report = useMemo(
    () =>
      buildPrecursorEnginePhase15Report(events, {
        latestSnapshot,
        log: loadPrecursorValidationLog(),
      }),
    [events, latestSnapshot],
  )

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p15"
      aria-labelledby="yds-precursor-engine-p15-title"
    >
      <h2 id="yds-precursor-engine-p15-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE15_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        시장 위치·조기경보·시장 국면·위험 패턴 → 사용자 행동 가이드 · Phase 0~14 읽기 전용
      </p>
      <YdsPrecursorActionGuidePanel report={report} />
      <ul className="panic-validation-panel__notes">
        {report.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
