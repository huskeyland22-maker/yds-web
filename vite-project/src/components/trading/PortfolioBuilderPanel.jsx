import { useMemo, useState } from "react"
import { buildPortfolioBuilderFromPrecursorContext } from "../../trading-zone/ydsPortfolioBuilderEngine.js"

/**
 * @param {{
 *   sectorRadar: ReturnType<typeof import("../../trading-zone/ydsPrecursorEnginePhase25.js").buildSectorRadarFromPrecursorContext>
 *   stockRadar: ReturnType<typeof import("../../trading-zone/ydsPrecursorEnginePhase26.js").buildStockRadarFromPrecursorContext>
 *   entryRadar: ReturnType<typeof import("../../trading-zone/ydsPrecursorEnginePhase27.js").buildEntryRadarFromPrecursorContext>
 *   convictionEngine: ReturnType<typeof import("../../trading-zone/ydsConvictionEngine.js").buildConvictionEngineFromPrecursorContext>
 *   actionGuide?: { current?: { label?: string; emoji?: string }; currentStageId?: string | null; oneLiner?: string }
 *   compact?: boolean
 * }} props
 */
export default function PortfolioBuilderPanel({
  sectorRadar,
  stockRadar,
  entryRadar,
  convictionEngine,
  actionGuide,
  compact = false,
}) {
  const [riskMode, setRiskMode] = useState(
    /** @type {import("../../trading-zone/ydsPortfolioBuilderEngine.js").PortfolioRiskModeId} */ ("neutral"),
  )

  const report = useMemo(
    () =>
      buildPortfolioBuilderFromPrecursorContext({
        sectorRadar,
        stockRadar,
        entryRadar,
        convictionEngine,
        actionGuide,
        riskMode,
      }),
    [sectorRadar, stockRadar, entryRadar, convictionEngine, actionGuide, riskMode],
  )

  const { topPortfolio, sectorBreakdown, summary, allocation, stage, stageAllocationTable } = report

  if (!report.available) {
    return <p className="yds-portfolio-builder__empty">추천 포트폴리오를 산출할 수 없습니다.</p>
  }

  return (
    <div className={`yds-portfolio-builder${compact ? " yds-portfolio-builder--compact" : ""}`}>
      <div className="yds-portfolio-builder__risk" role="tablist" aria-label="리스크 모드">
        {report.riskModes.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={riskMode === m.id}
            className={riskMode === m.id ? "is-active" : ""}
            onClick={() => setRiskMode(/** @type {typeof riskMode} */ (m.id))}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="yds-portfolio-builder__risk-note">{report.riskModeSummary}</p>

      {stage && allocation ? (
        <div className="yds-portfolio-builder__macro">
          <span className="yds-portfolio-builder__stage">{stage.display}</span>
          <span>{allocation.summary}</span>
          <span className="yds-portfolio-builder__action">
            {report.actionGuide.emoji} {report.actionGuide.label}
          </span>
        </div>
      ) : null}

      <div className="yds-portfolio-builder__kpis" aria-label="포트폴리오 요약">
        <span>종목 {summary.holdingCount}</span>
        <span>섹터 {summary.sectorCount}</span>
        <span>현금 {summary.cashDisplay}</span>
        <span>예상 변동성 {summary.expectedVolatilityDisplay}</span>
      </div>

      {!compact ? (
        <div className="yds-portfolio-builder__stage-table-wrap">
          <table className="yds-portfolio-builder__stage-table">
            <thead>
              <tr>
                <th>행동 단계</th>
                <th>주식</th>
                <th>현금</th>
              </tr>
            </thead>
            <tbody>
              {stageAllocationTable.map((row) => (
                <tr key={row.stageId} className={row.active ? "is-active" : ""}>
                  <td>
                    {row.emoji} {row.shortLabel}
                  </td>
                  <td className="font-mono tabular-nums">{row.stockLabel}</td>
                  <td className="font-mono tabular-nums">{row.cashLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <h3 className="yds-portfolio-builder__h3">Top Portfolio</h3>
      <div className="yds-portfolio-builder__table-wrap">
        <table className="yds-portfolio-builder__table">
          <thead>
            <tr>
              <th>종목</th>
              <th>비중</th>
              <th>섹터</th>
              <th>확신도</th>
              <th>★</th>
              <th>진입</th>
            </tr>
          </thead>
          <tbody>
            {topPortfolio.map((row) => (
              <tr key={row.id} className={`yds-portfolio-builder__row--${row.tierId}`}>
                <td className="yds-portfolio-builder__name">{row.name}</td>
                <td className="font-mono tabular-nums yds-portfolio-builder__weight">{row.weightDisplay}</td>
                <td>{row.sectorLabel}</td>
                <td className="font-mono tabular-nums">{row.convictionDisplay}</td>
                <td className="yds-portfolio-builder__stars">{row.stars.display}</td>
                <td>
                  <span className={`yds-portfolio-builder__grade yds-portfolio-builder__grade--${row.entryGrade}`}>
                    {row.entryGrade}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="yds-portfolio-builder__h3">섹터 분산</h3>
      <ul className="yds-portfolio-builder__sectors">
        {sectorBreakdown.map((s) => (
          <li key={s.sectorId}>
            <span>{s.label}</span>
            <span className="font-mono tabular-nums">{s.weightDisplay}</span>
            <span className="yds-portfolio-builder__sector-n">{s.count}종목</span>
          </li>
        ))}
      </ul>

      <div className="yds-portfolio-builder__cash-bar" aria-label="현금 비중">
        <span
          className="yds-portfolio-builder__cash-bar-stock"
          style={{ width: `${allocation?.stockPct ?? 0}%` }}
        />
        <span
          className="yds-portfolio-builder__cash-bar-cash"
          style={{ width: `${allocation?.cashPct ?? 0}%` }}
        />
      </div>
      <p className="yds-portfolio-builder__cash-label">
        주식 슬리브 {summary.stockSleeveDisplay} · 현금 {summary.cashDisplay}
      </p>
    </div>
  )
}
