import { useMemo, useState } from "react"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorValidationReport,
  formatPrecursorCell,
  METRIC_KEYS,
  METRIC_LABELS,
  PRECURSOR_VALIDATION_LABEL,
  PRECURSOR_VALIDATION_NOTE,
} from "../../trading-zone/ydsPrecursorValidation.js"

function formatYds(value) {
  if (value == null || !Number.isFinite(value)) return "—"
  return String(Math.round(value))
}

/**
 * @param {{ events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[] }} props
 */
export default function YdsPrecursorValidationSection({
  events = YDS_VALIDATION_EVENT_DATASET,
}) {
  const report = useMemo(() => buildPrecursorValidationReport(events), [events])
  const { timelines, summaryRows, insights, thresholds, notes } = report
  const [selectedId, setSelectedId] = useState(() => timelines[0]?.id ?? null)

  const selected = timelines.find((t) => t.id === selectedId) ?? timelines[0] ?? null

  return (
    <section
      className="panic-validation-panel yds-precursor-validation"
      aria-labelledby="yds-precursor-validation-title"
    >
      <h2 id="yds-precursor-validation-title" className="panic-validation-panel__h2">
        {PRECURSOR_VALIDATION_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        패닉 발생 전 YDS·핵심 지표 전조 검증 · 미래 전조 탐지 시스템 설계 · 검증 페이지 전용
      </p>

      <article className="yds-precursor-validation__insights" aria-label="전조 검증 인사이트">
        <p className="m-0 panic-validation-panel__h3">종합 인사이트</p>
        <ul className="yds-precursor-validation__insight-list">
          {insights.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="m-0 yds-event-detail__hint">{PRECURSOR_VALIDATION_NOTE}</p>
      </article>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">이벤트별 전조 요약</p>
        <table className="panic-validation-year-table panic-validation-year-table--vs yds-panic-validation__table">
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col">발생일</th>
              <th scope="col">선행 1위 지표</th>
              <th scope="col">1위 시점</th>
              <th scope="col">YDS 상승 시작</th>
              <th scope="col">경고 가능</th>
              <th scope="col">리드(일)</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.map((row) => (
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
                <td className="font-mono tabular-nums">{row.anchorDate ?? "—"}</td>
                <td>{row.firstMover}</td>
                <td className="font-mono tabular-nums">{row.firstMoverAt}</td>
                <td className="font-mono tabular-nums">{row.ydsRiseAt}</td>
                <td className="font-mono tabular-nums">{row.warningAt}</td>
                <td className="font-mono tabular-nums">{row.leadDays ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <>
          <div className="yds-panic-validation__block">
            <p className="m-0 panic-validation-panel__h3">
              {selected.name} — 전조 타임라인
            </p>
            <table className="panic-validation-year-table yds-precursor-validation__timeline-table">
              <thead>
                <tr>
                  <th scope="col">시점</th>
                  <th scope="col">날짜</th>
                  <th scope="col">YDS</th>
                  {METRIC_KEYS.map((k) => (
                    <th key={k} scope="col">
                      {METRIC_LABELS[k]}
                    </th>
                  ))}
                  <th scope="col">단계</th>
                </tr>
              </thead>
              <tbody>
                {selected.snapshots.map((snap) => (
                  <tr
                    key={snap.offsetLabel}
                    className={snap.offsetDays === 0 ? "yds-precursor-validation__row-event" : ""}
                  >
                    <td className="font-mono tabular-nums">{snap.offsetLabel}</td>
                    <td className="font-mono tabular-nums">{snap.date ?? "—"}</td>
                    <td className="font-mono tabular-nums yds-precursor-validation__yds">
                      {formatYds(snap.yds)}
                    </td>
                    {METRIC_KEYS.map((k) => (
                      <td key={k} className="font-mono tabular-nums">
                        {formatPrecursorCell(snap[k], k === "putCall" ? 2 : k === "highYield" ? 2 : 1)}
                      </td>
                    ))}
                    <td>
                      {snap.stage ? `${snap.stage.emoji} ${snap.stage.label}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <article className="yds-precursor-validation__analysis" aria-label="전조 분석">
            <p className="m-0 panic-validation-panel__h3">전조 분석 — {selected.name}</p>
            <ul className="yds-precursor-validation__analysis-list">
              <li>
                <strong>가장 먼저 움직인 지표</strong> — {selected.firstMover.detail}
              </li>
              <li>
                <strong>YDS 상승 시작</strong> — {selected.ydsRiseStart.detail}
              </li>
              <li>
                <strong>경고 가능 시점</strong> — {selected.warningPoint.detail}
              </li>
            </ul>
          </article>
        </>
      ) : null}

      <article className="yds-precursor-validation__thresholds" aria-label="탐지 임계값">
        <p className="m-0 panic-validation-panel__h3">탐지 임계값 (설계안)</p>
        <ul className="yds-precursor-validation__threshold-list">
          <li>
            선행 지표 (T-30 대비): VIX +{thresholds.firstMover.vix} · CNN −
            {thresholds.firstMover.cnn} · BofA −{thresholds.firstMover.bofa} · HY +
            {thresholds.firstMover.highYield} · P/C +{thresholds.firstMover.putCall}
          </li>
          <li>YDS 상승 시작: T-30 대비 +{thresholds.ydsRiseDeltaMin}p</li>
          <li>경고 가능: YDS ≥ {thresholds.ydsWarningMin}</li>
        </ul>
      </article>

      <ul className="yds-engine-candidate__notes">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  )
}
