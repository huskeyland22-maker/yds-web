import { useMemo } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildV3ProductionSimulationReport,
  formatCurrentMarketInputs,
  V3_PRODUCTION_SIMULATION_NOTE,
} from "../../trading-zone/ydsV3ProductionSimulation.js"

function verdictYesNo(pass) {
  return pass ? "✓ 통과" : "✗ 미달"
}

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 *   latestPanic?: Record<string, unknown> | null
 * }} props
 */
export default function YdsV3ProductionSimulationSection({
  events = YDS_VALIDATION_EVENT_DATASET,
  latestCycleRow = null,
  latestPanic = null,
}) {
  const latestSnapshot = useMemo(() => {
    if (latestPanic && typeof latestPanic === "object") {
      return {
        vix: latestPanic.vix,
        fearGreed: latestPanic.fearGreed,
        bofa: latestPanic.bofa,
        putCall: latestPanic.putCall,
        highYield: latestPanic.highYield,
        date: latestPanic.tradeDate ?? latestPanic.updatedAt ?? null,
        source: "panic-live",
      }
    }
    if (latestCycleRow) {
      const panic = panicDataFromCycleRow(latestCycleRow)
      if (panic) {
        return { ...latestCycleRow, ...panic, source: "cycle-history" }
      }
    }
    return null
  }, [latestCycleRow, latestPanic])

  const report = useMemo(
    () => buildV3ProductionSimulationReport(events, { latestSnapshot }),
    [events, latestSnapshot],
  )

  const { comparisonRows, currentMarket, goalValidation, verdict, thresholds, notes } = report
  const inputRows = formatCurrentMarketInputs(currentMarket)

  return (
    <section
      className="panic-validation-panel yds-v3-prod-sim"
      aria-labelledby="yds-v3-prod-sim-title"
    >
      <h2 id="yds-v3-prod-sim-title" className="panic-validation-panel__h2">
        V3 프로덕션 영향도 시뮬레이션
      </h2>
      <p className="panic-validation-panel__note">
        VIX V3 전체 엔진 교체 전 영향도 검증 · `getFinalScore` 프로덕션 미변경 · 검증 페이지 전용
      </p>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">역사 6건 + 현재 — 현재 엔진 vs V3</p>
        <table className="panic-validation-year-table panic-validation-year-table--vs yds-panic-validation__table">
          <thead>
            <tr>
              <th scope="col">대상</th>
              <th scope="col">현재 YDS</th>
              <th scope="col">현재 단계</th>
              <th scope="col">V3 YDS</th>
              <th scope="col">V3 단계</th>
              <th scope="col">Δ</th>
              <th scope="col">근거</th>
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row) => (
              <tr
                key={row.id}
                className={row.stageChanged ? "yds-engine-candidate__row-changed" : ""}
              >
                <td>{row.name}</td>
                <td className="font-mono tabular-nums">{row.currentYds ?? "—"}</td>
                <td>{row.currentStageLabel}</td>
                <td className="font-mono tabular-nums yds-engine-candidate__v3-score">
                  {row.v3Yds ?? "—"}
                </td>
                <td>{row.v3StageLabel}</td>
                <td className="font-mono tabular-nums">
                  {row.delta != null ? (row.delta > 0 ? `+${row.delta}` : row.delta) : "—"}
                </td>
                <td className="font-mono tabular-nums text-[12px]">
                  {row.kind === "current"
                    ? `${currentMarket.source} · ${currentMarket.asOfDate ?? "—"}`
                    : `${row.peakMilestone ?? "—"} · ${row.peakDate ?? "—"}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {currentMarket.ydsComputable ? (
        <article className="yds-v3-prod-sim__current" aria-label="현재 시장 입력값">
          <p className="m-0 panic-validation-panel__h3">현재 최신 데이터 입력 · 단계 변화</p>
          <table className="panic-validation-year-table yds-v3-prod-sim__input-table">
            <thead>
              <tr>
                <th scope="col">VIX</th>
                <th scope="col">CNN</th>
                <th scope="col">BofA</th>
                <th scope="col">HY</th>
                <th scope="col">Put/Call</th>
                <th scope="col">현재 YDS</th>
                <th scope="col">V3 YDS</th>
                <th scope="col">단계 변화</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {inputRows.map((cell) => (
                  <td key={cell.key} className="font-mono tabular-nums">
                    {cell.value}
                  </td>
                ))}
                <td className="font-mono tabular-nums">{currentMarket.currentYds}</td>
                <td className="font-mono tabular-nums yds-engine-candidate__v3-score">
                  {currentMarket.v3Yds}
                </td>
                <td>
                  {currentMarket.stageChanged
                    ? `${currentMarket.currentStageLabel} → ${currentMarket.v3StageLabel}`
                    : `${currentMarket.currentStageLabel} (유지)`}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="m-0 yds-event-detail__hint">
            데이터 출처: {currentMarket.source}
            {currentMarket.asOfDate ? ` · ${currentMarket.asOfDate}` : ""}
          </p>
        </article>
      ) : (
        <p className="m-0 yds-event-detail__hint">
          live/cycle 5지표 없음 — extended history fallback도 계산 불가
        </p>
      )}

      <article className="yds-v3-prod-sim__goals" aria-label="목표 검증">
        <p className="m-0 panic-validation-panel__h3">목표 검증</p>
        <ol className="yds-engine-candidate__check-list">
          <li>
            <strong>리먼·코로나 ≥{thresholds.historicPanicMin}</strong> —{" "}
            {verdictYesNo(goalValidation.lehmanCovidHistoric.pass)}
            <span className="yds-engine-candidate__check-detail">
              {goalValidation.lehmanCovidHistoric.detail}
            </span>
          </li>
          <li>
            <strong>
              관세 {thresholds.tariffRange[0]}~{thresholds.tariffRange[1]}
            </strong>{" "}
            — {verdictYesNo(goalValidation.tariffPanicBuy.pass)}
            <span className="yds-engine-candidate__check-detail">
              {goalValidation.tariffPanicBuy.detail}
            </span>
          </li>
          <li>
            <strong>
              엔캐리 {thresholds.yenRange[0]}~{thresholds.yenRange[1]}
            </strong>{" "}
            — {verdictYesNo(goalValidation.yenPosition.pass)}
            <span className="yds-engine-candidate__check-detail">
              {goalValidation.yenPosition.detail}
            </span>
          </li>
          <li>
            <strong>
              긴축/SVB {thresholds.moderateRange[0]}~{thresholds.moderateRange[1]}
            </strong>{" "}
            — {verdictYesNo(goalValidation.moderateEvents.pass)}
            <span className="yds-engine-candidate__check-detail">
              {goalValidation.moderateEvents.detail}
            </span>
          </li>
          <li>
            <strong>현재 시장 안정 (V3≤{thresholds.currentV3Max}, |Δ|≤
            {thresholds.currentDeltaMax})</strong> —{" "}
            {verdictYesNo(goalValidation.currentMarketStable.pass)}
            <span className="yds-engine-candidate__check-detail">
              {goalValidation.currentMarketStable.detail}
            </span>
          </li>
          <li>
            <strong>자연 순서</strong> — {verdictYesNo(goalValidation.naturalOrder.pass)}
            <span className="yds-engine-candidate__check-detail">
              {goalValidation.naturalOrder.detail}
            </span>
          </li>
        </ol>
      </article>

      <article
        className={`yds-engine-candidate__verdict yds-engine-candidate__verdict--${verdict.id === "production_ready" ? "adopt" : "needs_validation"}`}
        aria-label="프로덕션 반영 판정"
      >
        <p className="m-0 panic-validation-panel__h3">프로덕션 반영 판정</p>
        <p className="m-0 yds-engine-candidate__verdict-label">
          {verdict.emoji} {verdict.label}
        </p>
        <p className="m-0 yds-engine-candidate__verdict-summary">
          {verdict.summary} ({verdict.passCount}/{verdict.totalChecks} 통과)
        </p>
      </article>

      <ul className="yds-engine-candidate__notes">
        <li>{V3_PRODUCTION_SIMULATION_NOTE}</li>
        {notes.slice(1).map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  )
}
