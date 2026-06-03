import { useMemo, useState } from "react"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase1Report,
  formatPhase1Cell,
  PRECURSOR_ENGINE_METRIC_KEYS,
  PRECURSOR_ENGINE_METRIC_LABELS,
  PRECURSOR_ENGINE_PHASE1_LABEL,
  PRECURSOR_ENGINE_T_OFFSETS,
} from "../../trading-zone/ydsPrecursorEnginePhase1.js"

function signalMark(active) {
  return active ? "●" : "·"
}

/**
 * @param {{ events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[] }} props
 */
export default function YdsPrecursorEnginePhase1Section({
  events = YDS_VALIDATION_EVENT_DATASET,
}) {
  const report = useMemo(() => buildPrecursorEnginePhase1Report(events), [events])
  const { eventReports, dataTable, commonPatterns, engineDraft, notes } = report
  const [selectedId, setSelectedId] = useState(() => eventReports[0]?.id ?? null)

  const selected = eventReports.find((e) => e.id === selectedId) ?? eventReports[0] ?? null

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p1"
      aria-labelledby="yds-precursor-engine-p1-title"
    >
      <h2 id="yds-precursor-engine-p1-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE1_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        패닉 발생 전 전조 탐지 · climax 기준 T-14~T-0 · 검증 페이지 전용 · 프로덕션 엔진 미수정
      </p>

      <article className="yds-precursor-engine-p1__block" aria-label="A. 전조 데이터 테이블">
        <p className="m-0 panic-validation-panel__h3">A. 전조 데이터 테이블</p>
        <div className="yds-precursor-engine-p1__scroll">
          <table className="panic-validation-year-table yds-precursor-engine-p1__data-table">
            <thead>
              <tr>
                <th scope="col">이벤트</th>
                <th scope="col">시점</th>
                <th scope="col">날짜</th>
                <th scope="col">VIX</th>
                <th scope="col">CNN</th>
                <th scope="col">HY</th>
                <th scope="col">P/C</th>
                <th scope="col">MOVE</th>
                <th scope="col">PRI</th>
                <th scope="col">등급</th>
              </tr>
            </thead>
            <tbody>
              {dataTable.map((row) => (
                <tr
                  key={`${row.eventId}-${row.offsetDays}`}
                  className={row.offsetDays === 0 ? "yds-precursor-engine-p1__row-climax" : ""}
                >
                  <td>{row.eventName}</td>
                  <td className="font-mono tabular-nums">{row.offsetLabel}</td>
                  <td className="font-mono tabular-nums">{row.date}</td>
                  <td className="font-mono tabular-nums">{formatPhase1Cell(row.vix, 1)}</td>
                  <td className="font-mono tabular-nums">{formatPhase1Cell(row.cnn, 0)}</td>
                  <td className="font-mono tabular-nums">{formatPhase1Cell(row.highYield, 2)}</td>
                  <td className="font-mono tabular-nums">{formatPhase1Cell(row.putCall, 2)}</td>
                  <td className="font-mono tabular-nums" title={row.moveEstimated ? "VIX 근사" : ""}>
                    {formatPhase1Cell(row.move, 0)}
                    {row.moveEstimated ? "*" : ""}
                  </td>
                  <td className="font-mono tabular-nums">{row.precursorRiskIndex ?? "—"}</td>
                  <td>{row.riskTier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 yds-event-detail__hint">MOVE* = milestone 미수집 · VIX 기반 검증용 근사</p>
      </article>

      <article className="yds-precursor-engine-p1__block" aria-label="B. 이벤트별 전조 신호">
        <p className="m-0 panic-validation-panel__h3">B. 이벤트별 전조 신호 발생</p>
        <table className="panic-validation-year-table panic-validation-year-table--vs yds-panic-validation__table">
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col">climax</th>
              {PRECURSOR_ENGINE_METRIC_KEYS.map((k) => (
                <th key={k} scope="col">
                  {PRECURSOR_ENGINE_METRIC_LABELS[k]}
                </th>
              ))}
              <th scope="col">경고(T-7~)</th>
              <th scope="col">PRI@T-7</th>
            </tr>
          </thead>
          <tbody>
            {eventReports.map((ev) => (
              <tr
                key={ev.id}
                className={ev.id === selected?.id ? "yds-precursor-validation__row-active" : ""}
              >
                <td>
                  <button
                    type="button"
                    className="yds-precursor-validation__event-btn"
                    onClick={() => setSelectedId(ev.id)}
                  >
                    {ev.name}
                  </button>
                </td>
                <td className="font-mono tabular-nums">{ev.climaxDate ?? "—"}</td>
                {ev.signalMatrix.map((m) => (
                  <td key={m.metric} className="font-mono tabular-nums">
                    {m.anySignal ? m.firstSignalAt : "—"}
                  </td>
                ))}
                <td className="font-mono tabular-nums">{ev.signalSummary.warningAt}</td>
                <td className="font-mono tabular-nums">{ev.signalSummary.priAtT7 ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {selected ? (
          <div className="yds-precursor-engine-p1__signal-grid">
            <p className="m-0 panic-validation-panel__h3">{selected.name} — 지표×시점 신호</p>
            <table className="panic-validation-year-table yds-precursor-engine-p1__signal-table">
              <thead>
                <tr>
                  <th scope="col">지표</th>
                  {PRECURSOR_ENGINE_T_OFFSETS.map((d) => (
                    <th key={d} scope="col">
                      {d === 0 ? "T-0" : `T-${d}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.signalMatrix.map((row) => (
                  <tr key={row.metric}>
                    <td>{row.label}</td>
                    {row.cells
                      .slice()
                      .sort((a, b) => b.offsetDays - a.offsetDays)
                      .map((cell) => (
                        <td
                          key={cell.offsetDays}
                          className={
                            cell.active ? "yds-precursor-engine-p1__signal-on" : ""
                          }
                          title={cell.reason ?? ""}
                        >
                          {signalMark(cell.active)}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>

      <article className="yds-precursor-engine-p1__block" aria-label="C. 공통 패턴">
        <p className="m-0 panic-validation-panel__h3">C. 공통 패턴 분석</p>
        <ul className="yds-precursor-validation__insight-list">
          {commonPatterns.insights.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <table className="panic-validation-year-table yds-precursor-engine-p1__pattern-table">
          <thead>
            <tr>
              <th scope="col">지표</th>
              <th scope="col">전조 발생률</th>
              <th scope="col">이벤트 수</th>
              <th scope="col">평균 선행(일)</th>
            </tr>
          </thead>
          <tbody>
            {commonPatterns.metricStats.map((row) => (
              <tr key={row.metric}>
                <td>{row.label}</td>
                <td className="font-mono tabular-nums">{row.signalRate}%</td>
                <td className="font-mono tabular-nums">
                  {row.eventCount}/{eventReports.length}
                </td>
                <td className="font-mono tabular-nums">{row.avgLeadDays ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="m-0 yds-event-detail__hint">
          T-7 이전 복수 지표 동시 전조: {commonPatterns.multiSignalByT7Rate}% · T-7 평균 PRI{" "}
          {commonPatterns.avgPrecursorRiskAtT7 ?? "—"}
        </p>
      </article>

      <article className="yds-precursor-engine-p1__block yds-precursor-engine-p1__draft" aria-label="D. 엔진 설계 초안">
        <p className="m-0 panic-validation-panel__h3">D. 전조 위험도 엔진 설계 초안</p>
        <p className="m-0 yds-precursor-engine-p1__draft-objective">{engineDraft.objective}</p>
        <p className="m-0 yds-event-detail__hint">
          {engineDraft.scoring.id} ({engineDraft.scoring.range}) — {engineDraft.scoring.note}
        </p>
        <p className="m-0 yds-event-detail__hint">가중: {engineDraft.scoring.weights}</p>
        <ul className="yds-precursor-engine-p1__ladder">
          {engineDraft.alertLadder.map((step) => (
            <li key={step.tier}>
              <strong>{step.tier}</strong> {step.range} — {step.action}
            </li>
          ))}
        </ul>
        <ul className="yds-precursor-engine-p1__rules">
          {engineDraft.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <ul className="yds-engine-candidate__notes">
          {engineDraft.constraints.map((c) => (
            <li key={c}>{c}</li>
          ))}
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </article>
    </section>
  )
}
