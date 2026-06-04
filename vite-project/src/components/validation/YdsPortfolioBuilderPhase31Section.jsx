import { useMemo } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPortfolioBuilderReport,
  PORTFOLIO_BUILDER_LABEL,
  PORTFOLIO_BUILDER_PIPELINE,
} from "../../trading-zone/ydsPortfolioBuilderEngine.js"
import { buildConvictionEngineReport } from "../../trading-zone/ydsConvictionEngine.js"
import { buildSectorRadarFromPrecursorContext } from "../../trading-zone/ydsPrecursorEnginePhase25.js"
import { buildStockRadarFromPrecursorContext } from "../../trading-zone/ydsPrecursorEnginePhase26.js"
import { buildEntryRadarFromPrecursorContext } from "../../trading-zone/ydsPrecursorEnginePhase27.js"
import { buildPrecursorDashboardBetaReport } from "../../trading-zone/ydsPrecursorEnginePhase12.js"
import { buildPrecursorEnginePhase6Report } from "../../trading-zone/ydsPrecursorEnginePhase6.js"
import { buildPrecursorEnginePhase15Report } from "../../trading-zone/ydsPrecursorEnginePhase15.js"
import { buildPrecursorEnginePhase16Report } from "../../trading-zone/ydsPrecursorEnginePhase16.js"
import { loadPrecursorValidationLog } from "../../trading-zone/ydsPrecursorValidationLogStorage.js"
import PortfolioBuilderPanel from "../trading/PortfolioBuilderPanel.jsx"

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 *   historyRows?: object[]
 * }} props
 */
export default function YdsPortfolioBuilderPhase31Section({
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

  const ctx = useMemo(() => {
    const engineOptions = {
      latestSnapshot,
      extraRows: historyRows,
      log: loadPrecursorValidationLog(),
    }
    const dashboard = buildPrecursorDashboardBetaReport(events, engineOptions)
    const phase6 = buildPrecursorEnginePhase6Report(events, engineOptions)
    const action = buildPrecursorEnginePhase15Report(events, engineOptions)
    const confidenceReport = buildPrecursorEnginePhase16Report(events, engineOptions)
    const sectorRadar = buildSectorRadarFromPrecursorContext({
      dashboard,
      phase6,
      latestSnapshot,
    })
    const stockRadar = buildStockRadarFromPrecursorContext({ dashboard, phase6, sectorRadar })
    const entryRadar = buildEntryRadarFromPrecursorContext({ dashboard, phase6, sectorRadar, stockRadar })
    const convictionEngine = buildConvictionEngineReport(events, { latestSnapshot, extraRows: historyRows })
    return {
      sectorRadar,
      stockRadar,
      entryRadar,
      convictionEngine,
      actionGuide: {
        current: action.currentAction,
        currentStageId: sectorRadar.exportForStockRadar?.stageId ?? null,
        oneLiner: action.oneLiner,
      },
    }
  }, [events, latestSnapshot, historyRows])

  const report = useMemo(
    () => buildPortfolioBuilderReport(events, { latestSnapshot, extraRows: historyRows }),
    [events, latestSnapshot, historyRows],
  )

  return (
    <section
      className="panic-validation-panel yds-portfolio-builder-p31"
      aria-labelledby="yds-portfolio-builder-p31-title"
    >
      <h2 id="yds-portfolio-builder-p31-title" className="panic-validation-panel__h2">
        {PORTFOLIO_BUILDER_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        Conviction + 행동 단계 현금 비중 → 투자 가능 포트폴리오 · 리스크 모드 3종
      </p>

      <PortfolioBuilderPanel
        sectorRadar={ctx.sectorRadar}
        stockRadar={ctx.stockRadar}
        entryRadar={ctx.entryRadar}
        convictionEngine={ctx.convictionEngine}
        actionGuide={ctx.actionGuide}
      />

      <div className="yds-portfolio-builder-p31__block">
        <h3 className="yds-portfolio-builder-p31__h3">향후 연결</h3>
        <ol className="yds-portfolio-builder-p31__pipeline">
          {PORTFOLIO_BUILDER_PIPELINE.filter((s) =>
            ["portfolio-builder", "paper-trading", "performance-dashboard", "live-account"].includes(
              s.id,
            ),
          ).map((step, i, arr) => (
            <li key={step.id}>
              <span>{step.label}</span>
              <span
                className={
                  step.status === "active"
                    ? "yds-portfolio-builder-p31__pipe--active"
                    : "yds-portfolio-builder-p31__pipe--planned"
                }
              >
                {step.status === "active" ? "활성" : "예정"}
              </span>
              {i < arr.length - 1 ? (
                <span className="yds-portfolio-builder-p31__pipe-arrow" aria-hidden>
                  ↓
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <pre className="yds-portfolio-builder-p31__export-json">
          {JSON.stringify(report.exportForPaperTrading, null, 2)}
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
