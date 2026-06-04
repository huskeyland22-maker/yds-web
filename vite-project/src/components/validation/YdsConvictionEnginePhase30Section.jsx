import { useMemo } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildConvictionEngineReport,
  CONVICTION_ENGINE_LABEL,
  CONVICTION_ENGINE_PIPELINE,
} from "../../trading-zone/ydsConvictionEngine.js"
import ConvictionEnginePanel from "../trading/ConvictionEnginePanel.jsx"

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 *   historyRows?: object[]
 * }} props
 */
export default function YdsConvictionEnginePhase30Section({
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
      buildConvictionEngineReport(events, {
        latestSnapshot,
        extraRows: historyRows,
      }),
    [events, latestSnapshot, historyRows],
  )

  return (
    <section
      className="panic-validation-panel yds-conviction-p30"
      aria-labelledby="yds-conviction-p30-title"
    >
      <h2 id="yds-conviction-p30-title" className="panic-validation-panel__h2">
        {CONVICTION_ENGINE_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        Stock·Entry·Sector Radar + 시장 위치 + 신뢰도 → 확신도·추천 비중 자동 산출
      </p>

      <ConvictionEnginePanel conviction={report} />

      <div className="yds-conviction-p30__block">
        <h3 className="yds-conviction-p30__h3">향후 연결</h3>
        <ol className="yds-conviction-p30__pipeline">
          {CONVICTION_ENGINE_PIPELINE.filter((s) =>
            ["conviction-engine", "portfolio-builder", "live-account"].includes(s.id),
          ).map((step, i, arr) => (
            <li key={step.id}>
              <span>{step.label}</span>
              <span
                className={
                  step.status === "active"
                    ? "yds-conviction-p30__pipe--active"
                    : "yds-conviction-p30__pipe--planned"
                }
              >
                {step.status === "active" ? "활성" : "예정"}
              </span>
              {i < arr.length - 1 ? (
                <span className="yds-conviction-p30__pipe-arrow" aria-hidden>
                  ↓
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <pre className="yds-conviction-p30__export-json">
          {JSON.stringify(report.exportForPortfolioBuilder, null, 2)}
        </pre>
      </div>

      <ul className="panic-validation-panel__footnotes">
        {report.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
