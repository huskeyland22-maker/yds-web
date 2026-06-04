import { useMemo } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import { buildPrecursorEnginePhase27Report } from "../../trading-zone/ydsPrecursorEnginePhase27.js"
import {
  buildPaperTradingFromEntryRadar,
  PAPER_TRADING_LABEL,
  PAPER_TRADING_PIPELINE,
} from "../../trading-zone/ydsPaperTradingEngine.js"
import PaperTradingPanel from "../trading/PaperTradingPanel.jsx"

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 *   historyRows?: object[]
 * }} props
 */
export default function YdsPaperTradingPhase285Section({
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

  const entryRadar = useMemo(
    () =>
      buildPrecursorEnginePhase27Report(events, {
        latestSnapshot,
        extraRows: historyRows,
      }),
    [events, latestSnapshot, historyRows],
  )

  const exportJson = useMemo(
    () =>
      JSON.stringify(
        buildPaperTradingFromEntryRadar(entryRadar, { sync: true }).exportForTradingJournal,
        null,
        2,
      ),
    [entryRadar],
  )

  return (
    <section
      className="panic-validation-panel yds-paper-trading-p285"
      aria-labelledby="yds-paper-trading-p285-title"
    >
      <h2 id="yds-paper-trading-p285-title" className="panic-validation-panel__h2">
        {PAPER_TRADING_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        Entry Radar A 자동 · B 선택 · 가상매매 OPEN/CLOSED · 독립 모듈
      </p>

      <PaperTradingPanel entryRadar={entryRadar} />

      <div className="yds-paper-trading-p285__block">
        <h3 className="yds-paper-trading-p285__h3">향후 연결</h3>
        <ol className="yds-paper-trading-p285__pipeline">
          {PAPER_TRADING_PIPELINE.map((step, i) => (
            <li key={step.id}>
              <span>{step.label}</span>
              <span
                className={
                  step.status === "active"
                    ? "yds-paper-trading-p285__pipe--active"
                    : "yds-paper-trading-p285__pipe--planned"
                }
              >
                {step.status === "active" ? "활성" : "예정"}
              </span>
              {i < PAPER_TRADING_PIPELINE.length - 1 ? (
                <span className="yds-paper-trading-p285__pipe-arrow" aria-hidden>
                  ↓
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <pre className="yds-paper-trading-p285__export-json">{exportJson}</pre>
      </div>
    </section>
  )
}
