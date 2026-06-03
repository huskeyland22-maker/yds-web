import { useMemo } from "react"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase4Report,
  FAILURE_REASON_CODES,
  PRECURSOR_ENGINE_PHASE4_LABEL,
  SEVERITY_LABELS,
} from "../../trading-zone/ydsPrecursorEnginePhase4.js"

/**
 * @param {{ events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[] }} props
 */
export default function YdsPrecursorEnginePhase4Section({
  events = YDS_VALIDATION_EVENT_DATASET,
}) {
  const report = useMemo(() => buildPrecursorEnginePhase4Report(events), [events])
  const {
    panicList,
    fn,
    failureReasonBreakdown,
    severityBreakdown,
    finalReport,
    leadWindow,
    warnThresholdA,
    warnThresholdB,
    panicCount,
    notes,
  } = report

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p4"
      aria-labelledby="yds-precursor-engine-p4-title"
    >
      <h2 id="yds-precursor-engine-p4-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE4_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        PRI-A/B 미감지 패닉(FN) 분석 · {leadWindow} · 패닉 {panicCount}건 · 검증 전용
      </p>

      <article className="yds-precursor-engine-p4__block" aria-label="1. 패닉 이벤트 목록">
        <p className="m-0 panic-validation-panel__h3">1. 패닉 이벤트 전체 목록</p>
        <p className="m-0 yds-event-detail__hint">
          감지 성공 {panicList.success.length}건 · 감지 실패 {panicList.failure.length}건 (PRI-A≥
          {warnThresholdA} 또는 PRI-B≥{warnThresholdB})
        </p>
        <table className="panic-validation-year-table yds-precursor-engine-p4__list-table">
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col">심각도</th>
              <th scope="col">PRI-A</th>
              <th scope="col">PRI-B</th>
              <th scope="col">종합</th>
              <th scope="col">최초 경고</th>
              <th scope="col">max A</th>
              <th scope="col">max B</th>
            </tr>
          </thead>
          <tbody>
            {panicList.all.map((row) => (
              <tr
                key={row.id}
                className={
                  row.detected
                    ? "yds-precursor-engine-p4__row-success"
                    : "yds-precursor-engine-p4__row-failure"
                }
              >
                <td>{row.name}</td>
                <td>{row.severityLabel}</td>
                <td>{row.detectedPriA ? "✓" : "✗"}</td>
                <td>{row.detectedPriB ? "✓" : "✗"}</td>
                <td>{row.statusLabel}</td>
                <td className="font-mono tabular-nums">{row.firstWarningAny}</td>
                <td className="font-mono tabular-nums">{row.maxPriAInLead ?? "—"}</td>
                <td className="font-mono tabular-nums">{row.maxPriBInLead ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="yds-precursor-engine-p4__block" aria-label="2. FN 테이블">
        <p className="m-0 panic-validation-panel__h3">2. FN (감지 실패) 테이블</p>
        <p className="m-0 yds-event-detail__hint">
          PRI-A·PRI-B 모두 미감지 {fn.combinedCount}건 · PRI-A 단독 FN {fn.priACount}건 · PRI-B
          단독 FN {fn.priBCount}건
        </p>
        {fn.combined.length === 0 ? (
          <p className="m-0 yds-event-detail__hint">복합 FN 없음 — 일부 지표는 단독 FN 참고</p>
        ) : null}
        <div className="yds-precursor-engine-p4__scroll">
          <table className="panic-validation-year-table yds-precursor-engine-p4__fn-table">
            <thead>
              <tr>
                <th scope="col">이벤트명</th>
                <th scope="col">심각도</th>
                <th scope="col">최초 경고</th>
                <th scope="col">PRI-A 최고</th>
                <th scope="col">PRI-B 최고</th>
                <th scope="col">실패 원인</th>
              </tr>
            </thead>
            <tbody>
              {(fn.combined.length ? fn.combined : fn.priAOnly).map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.severityLabel}</td>
                  <td className="font-mono tabular-nums">{row.firstWarning}</td>
                  <td className="font-mono tabular-nums">{row.maxPriA}</td>
                  <td className="font-mono tabular-nums">{row.maxPriB}</td>
                  <td>{row.failureReasons}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="yds-precursor-engine-p4__block" aria-label="3. 실패 원인 분류">
        <p className="m-0 panic-validation-panel__h3">3. 실패 원인 분류</p>
        <ul className="yds-precursor-engine-p4__reason-legend">
          {Object.values(FAILURE_REASON_CODES).map((r) => (
            <li key={r.id}>
              <strong>{r.id}.</strong> {r.label}
            </li>
          ))}
        </ul>
        <table className="panic-validation-year-table yds-precursor-engine-p4__breakdown-table">
          <thead>
            <tr>
              <th scope="col">코드</th>
              <th scope="col">원인</th>
              <th scope="col">FN 건수</th>
            </tr>
          </thead>
          <tbody>
            {failureReasonBreakdown.map((row) => (
              <tr key={row.code}>
                <td className="font-mono">{row.id}</td>
                <td>{row.label}</td>
                <td className="font-mono tabular-nums">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="yds-precursor-engine-p4__block" aria-label="4. 심각도 분류">
        <p className="m-0 panic-validation-panel__h3">4. 심각도 분류 (FN 구성)</p>
        <ul className="yds-precursor-engine-p4__severity-list">
          <li>
            {SEVERITY_LABELS.critical}: {severityBreakdown.critical}건
          </li>
          <li>
            {SEVERITY_LABELS.major}: {severityBreakdown.major}건
          </li>
          <li>
            {SEVERITY_LABELS.minor}: {severityBreakdown.minor}건
          </li>
        </ul>
      </article>

      <article className="yds-precursor-engine-p4__block yds-precursor-engine-p4__final" aria-label="5. 최종 리포트">
        <p className="m-0 panic-validation-panel__h3">5. 최종 리포트</p>
        <table className="panic-validation-year-table yds-precursor-engine-p4__metrics-table">
          <thead>
            <tr>
              <th scope="col">지표</th>
              <th scope="col">Recall</th>
              <th scope="col">FPR</th>
              <th scope="col">Precision</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>PRI-A</td>
              <td className="font-mono tabular-nums">
                {finalReport.recallPriA != null ? `${finalReport.recallPriA}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {finalReport.fprPriA != null ? `${finalReport.fprPriA}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {finalReport.precisionPriA != null ? `${finalReport.precisionPriA}%` : "—"}
              </td>
            </tr>
            <tr>
              <td>PRI-B</td>
              <td className="font-mono tabular-nums">
                {finalReport.recallPriB != null ? `${finalReport.recallPriB}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {finalReport.fprPriB != null ? `${finalReport.fprPriB}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {finalReport.precisionPriB != null ? `${finalReport.precisionPriB}%` : "—"}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="m-0 yds-event-detail__hint">
          FN 구성 — PRI-A: {finalReport.fnComposition.priA} · PRI-B: {finalReport.fnComposition.priB}{" "}
          · 복합: {finalReport.fnComposition.bothMissed}
        </p>
        <p className="m-0 panic-validation-panel__h3">개선 우선순위</p>
        <ol className="yds-precursor-engine-p4__priorities">
          {finalReport.improvementPriorities.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <ul className="yds-engine-candidate__notes">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </article>
    </section>
  )
}
