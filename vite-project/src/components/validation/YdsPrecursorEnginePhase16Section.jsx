import { useMemo } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase16Report,
  PRECURSOR_ENGINE_PHASE16_LABEL,
} from "../../trading-zone/ydsPrecursorEnginePhase16.js"
import YdsPrecursorConfidencePanel from "./YdsPrecursorConfidencePanel.jsx"
import YdsRiskPatternLabel from "./YdsRiskPatternLabel.jsx"

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 * }} props
 */
export default function YdsPrecursorEnginePhase16Section({
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
    () => buildPrecursorEnginePhase16Report(events, { latestSnapshot }),
    [events, latestSnapshot],
  )

  const { context, notes } = report

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p16"
      aria-labelledby="yds-precursor-engine-p16-title"
    >
      <h2 id="yds-precursor-engine-p16-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE16_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        시장 국면·위험 패턴·행동 가이드 신뢰도 · 자동 시장 해석 · Phase 0~15 읽기 전용
      </p>

      <p className="m-0 panic-validation-panel__h3">우세 위험 패턴 (표시)</p>
      <p className="m-0 yds-precursor-engine-p16__pattern-preview">
        <YdsRiskPatternLabel
          patternId={context.pattern.id}
          patternLabel={context.pattern.name}
        />
      </p>

      <YdsPrecursorConfidencePanel report={report} />

      <ul className="panic-validation-panel__notes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
