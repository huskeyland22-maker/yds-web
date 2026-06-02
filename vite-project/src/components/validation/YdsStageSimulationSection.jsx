import { useMemo } from "react"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildStageSimulationReport,
  CURRENT_HIGH_FEAR_BANDS_NOTE,
  EXPERIMENTAL_YDS_STAGE_BANDS,
  formatSimulationStage,
} from "../../trading-zone/ydsScoreStageSimulation.js"

/**
 * @param {{ events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[] }} props
 */
export default function YdsStageSimulationSection({ events = YDS_VALIDATION_EVENT_DATASET }) {
  const report = useMemo(() => buildStageSimulationReport(events), [events])
  const { rows, summary, notes } = report

  return (
    <section
      className="panic-validation-panel yds-stage-simulation"
      aria-labelledby="yds-stage-simulation-title"
    >
      <h2 id="yds-stage-simulation-title" className="panic-validation-panel__h2">
        YDS 구간 시뮬레이션
      </h2>
      <p className="panic-validation-panel__note">
        구간 시뮬레이션 모드 · `getFinalScore` 엔진 미변경 · 검증 페이지 전용
      </p>

      <article className="yds-stage-simulation__bands" aria-label="실험 구간 정의">
        <p className="m-0 panic-validation-panel__h3">실험 구간 (60점 이상)</p>
        <ul className="yds-stage-simulation__band-list">
          {EXPERIMENTAL_YDS_STAGE_BANDS.filter((b) => b.min >= 60).map((band) => (
            <li key={band.id} className="font-mono tabular-nums">
              {band.emoji} {band.min}~{band.max} {band.label}
            </li>
          ))}
        </ul>
        <p className="m-0 yds-event-detail__hint">{CURRENT_HIGH_FEAR_BANDS_NOTE}</p>
      </article>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">이벤트별 최고 YDS · 단계 비교</p>
        <p className="m-0 panic-validation-panel__note">
          단계 변경 {summary.changedCount}건 / 유지 {summary.unchangedCount}건 (표본 {summary.compared}건)
        </p>
        <table className="panic-validation-year-table panic-validation-year-table--vs yds-panic-validation__table">
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col">최고 YDS</th>
              <th scope="col">현재 단계</th>
              <th scope="col">실험 단계</th>
              <th scope="col">변경</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.stageChanged ? "yds-stage-simulation__row-changed" : ""}>
                <td>{row.name}</td>
                <td className="font-mono tabular-nums">{row.maxYds}</td>
                <td>{formatSimulationStage(row.currentStage)}</td>
                <td>{formatSimulationStage(row.experimentalStage)}</td>
                <td>{row.stageChanged ? "변경" : "동일"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="yds-stage-simulation__notes">
        {notes.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  )
}
