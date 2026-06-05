import { useMemo } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase27Report,
  ENTRY_GRADE_DEFINITIONS,
  ENTRY_RADAR_PIPELINE,
  ENTRY_RADAR_SCORE_WEIGHTS,
  formatEntryRadarScore,
  PRECURSOR_ENGINE_PHASE27_LABEL,
} from "../../trading-zone/ydsPrecursorEnginePhase27.js"

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 *   historyRows?: object[]
 * }} props
 */
export default function YdsPrecursorEnginePhase27Section({
  events = YDS_VALIDATION_EVENT_DATASET,
  latestCycleRow = null,
  historyRows = [],
}) {
  const latestSnapshot = useMemo(() => {
    if (!latestCycleRow) return null
    const panic = panicDataFromCycleRow(latestCycleRow)
    if (panic) return { ...latestCycleRow, ...panic, date: latestCycleRow.date ?? panic.updatedAt }
    return latestCycleRow
  }, [latestCycleRow])

  const report = useMemo(
    () =>
      buildPrecursorEnginePhase27Report(events, {
        latestSnapshot,
        extraRows: historyRows,
      }),
    [events, latestSnapshot, historyRows],
  )

  const {
    available,
    asOf,
    title,
    scoreWeightsDisplay,
    tradeCandidates,
    gradeDefinitions,
    inputs,
    exportForTradingLog,
    notes,
  } = report

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p27"
      aria-labelledby="yds-precursor-engine-p27-title"
    >
      <h2 id="yds-precursor-engine-p27-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE27_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        종목 추천 → 진입등급 A~D · 지금 들어갈 종목 판단 (읽기 전용)
      </p>
      <p className="yds-precursor-engine-p27__weights">{scoreWeightsDisplay}</p>

      {asOf ? (
        <p className="yds-precursor-engine-p27__asof">기준일 {String(asOf).slice(0, 10)}</p>
      ) : null}

      <div className="yds-precursor-engine-p27__grade-defs">
        {(["A", "B", "C", "D"]).map((g) => (
          <article key={g} className={`yds-precursor-engine-p27__grade-def yds-precursor-engine-p27__grade-def--${g}`}>
            <span className="yds-precursor-engine-p27__grade-letter">{g}</span>
            <p>{gradeDefinitions[g].summary}</p>
          </article>
        ))}
      </div>

      {!available ? (
        <p className="yds-precursor-engine-p27__empty">종목 추천 결과가 없어 진입 신호를 산출할 수 없습니다.</p>
      ) : (
        <>
          <div className="yds-precursor-engine-p27__block">
            <h3 className="yds-precursor-engine-p27__h3">{title}</h3>
            <ul className="yds-precursor-engine-p27__candidate-list">
              {tradeCandidates.map((c) => (
                <li
                  key={c.id}
                  className={`yds-precursor-engine-p27__candidate yds-precursor-engine-p27__candidate--grade-${c.grade.id}`}
                >
                  <div className="yds-precursor-engine-p27__candidate-head">
                    <strong className="yds-precursor-engine-p27__candidate-name">{c.name}</strong>
                    <span className="yds-precursor-engine-p27__candidate-score">
                      점수 {formatEntryRadarScore(c.score)}
                    </span>
                  </div>
                  <div className="yds-precursor-engine-p27__candidate-meta">
                    <span>{c.status.display}</span>
                    <span className="yds-precursor-engine-p27__candidate-grade">
                      진입등급 {c.grade.label}
                    </span>
                  </div>
                  <p className="yds-precursor-engine-p27__candidate-action">{c.grade.actionDisplay}</p>
                  <p className="yds-precursor-engine-p27__candidate-sub">
                    진입점수 {formatEntryRadarScore(c.entryScore)} · {c.marketLabel}
                    {c.tradingStage ? ` · ${c.tradingStage}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <dl className="yds-precursor-engine-p27__inputs">
            <div>
              <dt>YDS</dt>
              <dd>{inputs.stageLabel}</dd>
            </div>
            <div>
              <dt>PRI</dt>
              <dd>
                {inputs.priADisplay} / {inputs.priBDisplay}
              </dd>
            </div>
            <div>
              <dt>섹터</dt>
              <dd>{(inputs.sectorRadarIds ?? []).join(", ") || "—"}</dd>
            </div>
          </dl>

          <div className="yds-precursor-engine-p27__block">
            <h3 className="yds-precursor-engine-p27__h3">향후 연결</h3>
            <ol className="yds-precursor-engine-p27__pipeline">
              {ENTRY_RADAR_PIPELINE.map((step, i) => (
                <li key={step.id}>
                  <span>{step.label}</span>
                  <span
                    className={
                      step.status === "active"
                        ? "yds-precursor-engine-p27__pipe--active"
                        : "yds-precursor-engine-p27__pipe--planned"
                    }
                  >
                    {step.status === "active" ? "활성" : "예정"}
                  </span>
                  {i < ENTRY_RADAR_PIPELINE.length - 1 ? (
                    <span className="yds-precursor-engine-p27__pipe-arrow" aria-hidden>
                      ↓
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            <p className="yds-precursor-engine-p27__weight-note">
              가중치: 시장 {ENTRY_RADAR_SCORE_WEIGHTS.marketFit * 100}% · 종목{" "}
              {ENTRY_RADAR_SCORE_WEIGHTS.stockScore * 100}% · 기술{" "}
              {ENTRY_RADAR_SCORE_WEIGHTS.technicalStatus * 100}% · 리스크{" "}
              {ENTRY_RADAR_SCORE_WEIGHTS.risk * 100}%
            </p>
            <pre className="yds-precursor-engine-p27__export-json">
              {JSON.stringify(exportForTradingLog, null, 2)}
            </pre>
          </div>
        </>
      )}

      <ul className="panic-validation-panel__footnotes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
