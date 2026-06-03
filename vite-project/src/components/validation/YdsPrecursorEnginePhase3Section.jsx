import { useMemo } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import { PRECURSOR_ENGINE_PHASE2_WARN_PRI_A } from "../../trading-zone/ydsPrecursorEnginePhase2.js"
import {
  buildPrecursorEnginePhase3Report,
  formatPhase3Cell,
  PRECURSOR_ENGINE_PHASE3_LABEL,
} from "../../trading-zone/ydsPrecursorEnginePhase3.js"

function ConfusionMatrixTable({ matrix, title }) {
  if (!matrix) return null
  return (
    <div className="yds-precursor-engine-p3__matrix-wrap">
      <p className="m-0 yds-event-detail__hint">{title}</p>
      <table className="panic-validation-year-table yds-precursor-engine-p3__matrix">
        <thead>
          <tr>
            <th scope="col" />
            {matrix.columns.map((col) => (
              <th key={col} scope="col">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {row.cells.map((cell, i) => (
                <td key={i} className="font-mono tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 *   latestPanic?: Record<string, unknown> | null
 * }} props
 */
export default function YdsPrecursorEnginePhase3Section({
  events = YDS_VALIDATION_EVENT_DATASET,
  latestCycleRow = null,
  latestPanic = null,
}) {
  const latestSnapshot = useMemo(() => {
    if (latestPanic && typeof latestPanic === "object") {
      return {
        vix: latestPanic.vix,
        fearGreed: latestPanic.fearGreed,
        cnn: latestPanic.fearGreed,
        bofa: latestPanic.bofa,
        putCall: latestPanic.putCall,
        highYield: latestPanic.highYield,
        date: latestPanic.tradeDate ?? latestPanic.updatedAt ?? null,
      }
    }
    if (latestCycleRow) {
      const panic = panicDataFromCycleRow(latestCycleRow)
      if (panic) return { ...latestCycleRow, ...panic }
    }
    return null
  }, [latestCycleRow, latestPanic])

  const report = useMemo(
    () => buildPrecursorEnginePhase3Report(events, { latestSnapshot }),
    [events, latestSnapshot],
  )

  const { live, validation } = report
  const { priACard, priBCard, cashGuide, asOf } = live
  const { priA: metricsA, priB: metricsB } = validation.classification
  const counts = validation.datasetCounts

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p3"
      aria-labelledby="yds-precursor-engine-p3-title"
    >
      <h2 id="yds-precursor-engine-p3-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE3_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        패닉 이전 위험 감지 · 실시간 PRI · 현금 가이드(표시용) · 확장 백테스트 · 프로덕션 미수정
      </p>

      <div className="yds-precursor-engine-p3__live-grid">
        <article className="yds-precursor-engine-p3__card" aria-label="조기경보 실시간">
          <p className="m-0 yds-precursor-engine-p3__card-title">조기경보</p>
          {priACard ? (
            <>
              <p className="m-0 yds-precursor-engine-p3__score font-mono tabular-nums">
                {formatPhase3Cell(priACard.score)}
                <span className="yds-precursor-engine-p3__tier">
                  {priACard.tier.emoji} {priACard.tier.label}
                </span>
              </p>
              <p className="m-0 yds-event-detail__hint">{priACard.change30dLabel}</p>
              <p
                className={`m-0 yds-precursor-engine-p3__warn${priACard.warning ? " yds-precursor-engine-p3__warn--on" : ""}`}
              >
                {priACard.warningLabel}
              </p>
              <p className="m-0 yds-event-detail__hint">기준일 {asOf ?? "—"} · T-30 {priACard.baselineDate ?? "—"}</p>
            </>
          ) : (
            <p className="m-0">데이터 없음</p>
          )}
        </article>

        <article className="yds-precursor-engine-p3__card yds-precursor-engine-p3__card--cash" aria-label="현금 비중 가이드">
          <p className="m-0 yds-precursor-engine-p3__card-title">현금 비중 가이드 (표시용)</p>
          <p className="m-0 yds-precursor-engine-p3__cash font-mono tabular-nums">
            {cashGuide.cashPct != null ? `${cashGuide.cashPct}%` : "—"} 현금
          </p>
          <p className="m-0 yds-event-detail__hint">{cashGuide.label}</p>
          <p className="m-0 yds-precursor-engine-p3__disclaimer">{cashGuide.disclaimer}</p>
        </article>

        <article className="yds-precursor-engine-p3__card" aria-label="충격감지 실시간">
          <p className="m-0 yds-precursor-engine-p3__card-title">충격감지</p>
          {priBCard ? (
            <>
              <p className="m-0 yds-precursor-engine-p3__score font-mono tabular-nums">
                {formatPhase3Cell(priBCard.score)}
                <span className="yds-precursor-engine-p3__tier">
                  {priBCard.tier.emoji} {priBCard.shockState}
                </span>
              </p>
              <p className="m-0 yds-event-detail__hint">{priBCard.change30dLabel}</p>
              <p
                className={`m-0 yds-precursor-engine-p3__warn${priBCard.warning ? " yds-precursor-engine-p3__warn--on" : ""}`}
              >
                {priBCard.warningLabel}
              </p>
            </>
          ) : (
            <p className="m-0">데이터 없음</p>
          )}
        </article>
      </div>

      <article className="yds-precursor-engine-p3__block" aria-label="검증 리포트">
        <p className="m-0 panic-validation-panel__h3">검증 리포트 (확장 표본)</p>
        <p className="m-0 yds-event-detail__hint">
          패닉 {counts.panic}건 · 비패닉 {counts.nonPanic}건 · 경고 임계 PRI≥
          {PRECURSOR_ENGINE_PHASE2_WARN_PRI_A} · 윈도우 {metricsA.leadWindow}
        </p>
        <table className="panic-validation-year-table yds-precursor-engine-p3__metrics-table">
          <thead>
            <tr>
              <th scope="col">지표</th>
              <th scope="col">Precision</th>
              <th scope="col">Recall</th>
              <th scope="col">FPR</th>
              <th scope="col">적중률</th>
              <th scope="col">오경보율</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>조기경보</td>
              <td className="font-mono tabular-nums">
                {metricsA.precision != null ? `${metricsA.precision}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {metricsA.recall != null ? `${metricsA.recall}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {metricsA.falsePositiveRate != null ? `${metricsA.falsePositiveRate}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {metricsA.hitRate != null ? `${metricsA.hitRate}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {metricsA.falseAlarmRate != null ? `${metricsA.falseAlarmRate}%` : "—"}
              </td>
            </tr>
            <tr>
              <td>충격감지</td>
              <td className="font-mono tabular-nums">
                {metricsB.precision != null ? `${metricsB.precision}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {metricsB.recall != null ? `${metricsB.recall}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {metricsB.falsePositiveRate != null ? `${metricsB.falsePositiveRate}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {metricsB.hitRate != null ? `${metricsB.hitRate}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {metricsB.falseAlarmRate != null ? `${metricsB.falseAlarmRate}%` : "—"}
              </td>
            </tr>
          </tbody>
        </table>

        <ConfusionMatrixTable matrix={metricsA.confusionMatrix} title="조기경보 Confusion Matrix" />
        <ConfusionMatrixTable matrix={metricsB.confusionMatrix} title="충격감지 Confusion Matrix" />

        <ul className="yds-engine-candidate__notes">
          {report.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </article>
    </section>
  )
}
