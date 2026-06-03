import { useMemo, useState } from "react"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase2Report,
  formatPhase2Cell,
  PRECURSOR_ENGINE_PHASE2_LABEL,
  PRECURSOR_ENGINE_PHASE2_LEAD_MAX,
  PRECURSOR_ENGINE_PHASE2_LEAD_MIN,
  PRECURSOR_ENGINE_PHASE2_T_OFFSETS,
  PRECURSOR_ENGINE_PHASE2_WARN_PRI_A,
} from "../../trading-zone/ydsPrecursorEnginePhase2.js"

/**
 * @param {{ events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[] }} props
 */
export default function YdsPrecursorEnginePhase2Section({
  events = YDS_VALIDATION_EVENT_DATASET,
}) {
  const report = useMemo(() => buildPrecursorEnginePhase2Report(events), [events])
  const { eventReports, timeSeriesTable, firstWarnings, classification, notes } = report
  const [selectedId, setSelectedId] = useState(() => eventReports[0]?.id ?? null)

  const selected = eventReports.find((e) => e.id === selectedId) ?? eventReports[0] ?? null
  const { priA: metricsA, priB: metricsB } = classification

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p2"
      aria-labelledby="yds-precursor-engine-p2-title"
    >
      <h2 id="yds-precursor-engine-p2-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE2_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        패닉 2~4주 전 위험 탐지 · PRI-A(조기경보) / PRI-B(충격확인) · 검증 전용 · 프로덕션 미수정
      </p>

      <article className="yds-precursor-engine-p2__block" aria-label="A. PRI 시계열">
        <p className="m-0 panic-validation-panel__h3">A. PRI-A / PRI-B 시계열</p>
        <div className="yds-precursor-engine-p2__scroll">
          <table className="panic-validation-year-table yds-precursor-engine-p2__series-table">
            <thead>
              <tr>
                <th scope="col">이벤트</th>
                <th scope="col">구분</th>
                <th scope="col">시점</th>
                <th scope="col">날짜</th>
                <th scope="col">PRI-A</th>
                <th scope="col">A등급</th>
                <th scope="col">PRI-B</th>
                <th scope="col">B등급</th>
                <th scope="col">선행윈도우</th>
              </tr>
            </thead>
            <tbody>
              {timeSeriesTable.map((row) => (
                <tr
                  key={`${row.eventId}-${row.offsetDays}`}
                  className={[
                    row.offsetDays === 0 ? "yds-precursor-engine-p2__row-climax" : "",
                    row.inLeadWindow ? "yds-precursor-engine-p2__row-lead" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <td>{row.eventName}</td>
                  <td>{row.isPanic ? "패닉" : "비패닉"}</td>
                  <td className="font-mono tabular-nums">{row.offsetLabel}</td>
                  <td className="font-mono tabular-nums">{row.date}</td>
                  <td className="font-mono tabular-nums">{formatPhase2Cell(row.priA)}</td>
                  <td>{row.priATier}</td>
                  <td className="font-mono tabular-nums">{formatPhase2Cell(row.priB)}</td>
                  <td>{row.priBTier}</td>
                  <td>{row.inLeadWindow ? "✓" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 yds-event-detail__hint">
          선행 윈도우 = T-{PRECURSOR_ENGINE_PHASE2_LEAD_MAX}~T-{PRECURSOR_ENGINE_PHASE2_LEAD_MIN}{" "}
          (climax 기준 2~4주 전)
        </p>
      </article>

      <article className="yds-precursor-engine-p2__block" aria-label="B. 최초 경고">
        <p className="m-0 panic-validation-panel__h3">B. 최초 경고 발생 시점</p>
        <table className="panic-validation-year-table panic-validation-year-table--vs">
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col">구분</th>
              <th scope="col">climax</th>
              <th scope="col">PRI-A 최초</th>
              <th scope="col">PRI-B 최초</th>
              <th scope="col">선행 적중(A)</th>
              <th scope="col">오경보(A)</th>
              <th scope="col">윈도우 max A</th>
            </tr>
          </thead>
          <tbody>
            {firstWarnings.map((row) => (
              <tr
                key={row.id}
                className={row.id === selected?.id ? "yds-precursor-validation__row-active" : ""}
              >
                <td>
                  <button
                    type="button"
                    className="yds-precursor-validation__event-btn"
                    onClick={() => setSelectedId(row.id)}
                  >
                    {row.name}
                  </button>
                </td>
                <td>{row.isPanic ? "패닉" : "비패닉"}</td>
                <td className="font-mono tabular-nums">{row.climaxDate ?? "—"}</td>
                <td className="font-mono tabular-nums">{row.priA}</td>
                <td className="font-mono tabular-nums">{row.priB}</td>
                <td>{row.hitPriA ? "✓" : "—"}</td>
                <td>{row.falseAlarmPriA ? "⚠" : "—"}</td>
                <td className="font-mono tabular-nums">{row.maxPriAInLead ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {selected ? (
          <div className="yds-precursor-engine-p2__detail">
            <p className="m-0 panic-validation-panel__h3">{selected.name} — 시계열</p>
            <table className="panic-validation-year-table yds-precursor-engine-p2__detail-table">
              <thead>
                <tr>
                  <th scope="col">시점</th>
                  {PRECURSOR_ENGINE_PHASE2_T_OFFSETS.map((d) => (
                    <th key={d} scope="col">
                      {d === 0 ? "T-0" : `T-${d}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>PRI-A</td>
                  {PRECURSOR_ENGINE_PHASE2_T_OFFSETS.map((d) => {
                    const cell = selected.timeSeries.find((s) => s.offsetDays === d)
                    const hot = cell?.priA != null && cell.priA >= PRECURSOR_ENGINE_PHASE2_WARN_PRI_A
                    return (
                      <td
                        key={d}
                        className={`font-mono tabular-nums${hot ? " yds-precursor-engine-p2__hot" : ""}`}
                      >
                        {formatPhase2Cell(cell?.priA)}
                      </td>
                    )
                  })}
                </tr>
                <tr>
                  <td>PRI-B</td>
                  {PRECURSOR_ENGINE_PHASE2_T_OFFSETS.map((d) => {
                    const cell = selected.timeSeries.find((s) => s.offsetDays === d)
                    return (
                      <td key={d} className="font-mono tabular-nums">
                        {formatPhase2Cell(cell?.priB)}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </article>

      <article className="yds-precursor-engine-p2__block" aria-label="C-E. 분류 지표">
        <p className="m-0 panic-validation-panel__h3">C~E. 적중률 · 오경보 · Precision / Recall / FPR</p>
        <p className="m-0 yds-event-detail__hint">
          경고 기준: PRI≥{PRECURSOR_ENGINE_PHASE2_WARN_PRI_A} · 윈도우 {metricsA.leadWindow} · 패닉{" "}
          {metricsA.panicCount}건 / 비패닉 {metricsA.nonPanicCount}건
        </p>
        <table className="panic-validation-year-table yds-precursor-engine-p2__metrics-table">
          <thead>
            <tr>
              <th scope="col">지표</th>
              <th scope="col">적중률 (Recall)</th>
              <th scope="col">오경보율 (FPR)</th>
              <th scope="col">Precision</th>
              <th scope="col">Recall</th>
              <th scope="col">FPR</th>
              <th scope="col">TP/FP/TN/FN</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>PRI-A (조기경보)</td>
              <td className="font-mono tabular-nums">
                {metricsA.hitRate != null ? `${metricsA.hitRate}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {metricsA.falseAlarmRate != null ? `${metricsA.falseAlarmRate}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {metricsA.precision != null ? `${metricsA.precision}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {metricsA.recall != null ? `${metricsA.recall}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {metricsA.falsePositiveRate != null ? `${metricsA.falsePositiveRate}%` : "—"}
              </td>
              <td className="font-mono tabular-nums text-xs">
                {metricsA.confusion.tp}/{metricsA.confusion.fp}/{metricsA.confusion.tn}/
                {metricsA.confusion.fn}
              </td>
            </tr>
            <tr>
              <td>PRI-B (충격확인)</td>
              <td className="font-mono tabular-nums">
                {metricsB.hitRate != null ? `${metricsB.hitRate}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {metricsB.falseAlarmRate != null ? `${metricsB.falseAlarmRate}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {metricsB.precision != null ? `${metricsB.precision}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {metricsB.recall != null ? `${metricsB.recall}%` : "—"}
              </td>
              <td className="font-mono tabular-nums">
                {metricsB.falsePositiveRate != null ? `${metricsB.falsePositiveRate}%` : "—"}
              </td>
              <td className="font-mono tabular-nums text-xs">
                {metricsB.confusion.tp}/{metricsB.confusion.fp}/{metricsB.confusion.tn}/
                {metricsB.confusion.fn}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="m-0 yds-event-detail__hint">
          패닉 PRI-A 적중: {classification.combined.panicHitPriA} · PRI-B 적중:{" "}
          {classification.combined.panicHitPriB}
        </p>
        <ul className="yds-engine-candidate__notes">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </article>
    </section>
  )
}
