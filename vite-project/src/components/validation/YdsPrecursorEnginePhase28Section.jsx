import { useMemo } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase28Report,
  PRECURSOR_ENGINE_PHASE28_LABEL,
  TRADING_JOURNAL_PIPELINE,
} from "../../trading-zone/ydsPrecursorEnginePhase28.js"
import { loadPrecursorTradingJournal } from "../../trading-zone/ydsPrecursorTradingJournalStorage.js"
import TradingJournalPanel from "../trading/TradingJournalPanel.jsx"

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 *   historyRows?: object[]
 * }} props
 */
export default function YdsPrecursorEnginePhase28Section({
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

  const report = useMemo(() => {
    const stored = loadPrecursorTradingJournal()
    return buildPrecursorEnginePhase28Report(events, {
      latestSnapshot,
      extraRows: historyRows,
      trades: stored.trades,
    })
  }, [events, latestSnapshot, historyRows])

  const { notes, exportForPerformanceDashboard, pipeline } = report

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p28"
      aria-labelledby="yds-precursor-engine-p28-title"
    >
      <h2 id="yds-precursor-engine-p28-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE28_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        Entry Radar 추천 종목의 실제 진입·청산 기록 · TradingView 스타일 테이블
      </p>

      <TradingJournalPanel journal={report} />

      <div className="yds-precursor-engine-p28__block">
        <h3 className="yds-precursor-engine-p28__h3">향후 연결</h3>
        <ol className="yds-precursor-engine-p28__pipeline">
          {TRADING_JOURNAL_PIPELINE.map((step, i) => (
            <li key={step.id}>
              <span>{step.label}</span>
              <span
                className={
                  step.status === "active"
                    ? "yds-precursor-engine-p28__pipe--active"
                    : "yds-precursor-engine-p28__pipe--planned"
                }
              >
                {step.status === "active" ? "활성" : "예정"}
              </span>
              {i < pipeline.length - 1 ? (
                <span className="yds-precursor-engine-p28__pipe-arrow" aria-hidden>
                  ↓
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <pre className="yds-precursor-engine-p28__export-json">
          {JSON.stringify(exportForPerformanceDashboard, null, 2)}
        </pre>
      </div>

      <ul className="panic-validation-panel__footnotes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
