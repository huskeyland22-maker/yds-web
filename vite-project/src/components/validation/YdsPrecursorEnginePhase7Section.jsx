import { useMemo } from "react"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase7Report,
  PATTERN_LABELS,
  PRECURSOR_ENGINE_PHASE7_LABEL,
} from "../../trading-zone/ydsPrecursorEnginePhase7.js"

/**
 * @param {{ events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[] }} props
 */
export default function YdsPrecursorEnginePhase7Section({
  events = YDS_VALIDATION_EVENT_DATASET,
}) {
  const report = useMemo(() => buildPrecursorEnginePhase7Report(events), [events])
  const {
    eventCount,
    top1Accuracy,
    top3Accuracy,
    avgMargin,
    separationScore,
    verdict,
    classifiedRows,
    referenceSelfMatch,
    confusion,
    topConfusedPair,
    confusedPairs,
    notes,
  } = report

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p7"
      aria-labelledby="yds-precursor-engine-p7-title"
    >
      <h2 id="yds-precursor-engine-p7-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE7_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        Pattern Radar 패턴 구분 검증 · {eventCount}건 · 검증 전용
      </p>

      <div className="yds-precursor-engine-p7__metrics-grid">
        <div className="yds-precursor-engine-p7__metric">
          <span className="yds-precursor-engine-p7__metric-label">Top-1 Accuracy</span>
          <span className="font-mono tabular-nums yds-precursor-engine-p7__metric-val">
            {top1Accuracy != null ? `${top1Accuracy}%` : "—"}
          </span>
        </div>
        <div className="yds-precursor-engine-p7__metric">
          <span className="yds-precursor-engine-p7__metric-label">Top-3 Accuracy</span>
          <span className="font-mono tabular-nums yds-precursor-engine-p7__metric-val">
            {top3Accuracy != null ? `${top3Accuracy}%` : "—"}
          </span>
        </div>
        <div className="yds-precursor-engine-p7__metric">
          <span className="yds-precursor-engine-p7__metric-label">Avg Margin</span>
          <span className="font-mono tabular-nums yds-precursor-engine-p7__metric-val">
            {avgMargin != null ? `${avgMargin}pp` : "—"}
          </span>
        </div>
        <div className="yds-precursor-engine-p7__metric">
          <span className="yds-precursor-engine-p7__metric-label">분리도 점수</span>
          <span className="font-mono tabular-nums yds-precursor-engine-p7__metric-val">
            {separationScore}/100
          </span>
        </div>
      </div>

      <article className="yds-precursor-engine-p7__block" aria-label="Reference self-match">
        <p className="m-0 panic-validation-panel__h3">Archetype 참조 · 자기 패턴 유사도</p>
        <table className="panic-validation-year-table yds-precursor-engine-p7__ref-table">
          <thead>
            <tr>
              <th scope="col">패턴</th>
              <th scope="col">참조 이벤트</th>
              <th scope="col">Self Sim</th>
              <th scope="col">Top-1</th>
              <th scope="col">Margin</th>
            </tr>
          </thead>
          <tbody>
            {referenceSelfMatch.map((row) => (
              <tr key={row.patternId}>
                <td>{row.patternLabel}</td>
                <td>{row.referenceEventName}</td>
                <td className="font-mono tabular-nums">{row.selfSimilarity ?? "—"}%</td>
                <td>{row.top1Match ? "✓" : "✗"}</td>
                <td className="font-mono tabular-nums">{row.margin ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="yds-precursor-engine-p7__block" aria-label="4. Confusion Matrix">
        <p className="m-0 panic-validation-panel__h3">4. Confusion Matrix (실제 → 예측)</p>
        <div className="yds-precursor-engine-p7__scroll">
          <table className="panic-validation-year-table yds-precursor-engine-p7__matrix">
            <thead>
              <tr>
                <th scope="col">실제 \ 예측</th>
                {confusion.ids.map((id) => (
                  <th key={id} scope="col">
                    {PATTERN_LABELS[id]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {confusion.rows.map((row) => (
                <tr key={row.actualId}>
                  <th scope="row">{row.actualLabel}</th>
                  {row.cells.map((cell) => (
                    <td
                      key={cell.predId}
                      className={`font-mono tabular-nums${
                        cell.actualId === cell.predId && cell.count > 0
                          ? " yds-precursor-engine-p7__cell-hit"
                          : cell.count > 0
                            ? " yds-precursor-engine-p7__cell-miss"
                            : ""
                      }`}
                    >
                      {cell.count}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="yds-precursor-engine-p7__block" aria-label="5. 혼동 쌍">
        <p className="m-0 panic-validation-panel__h3">5. 가장 혼동되는 패턴 쌍</p>
        {topConfusedPair ? (
          <p className="m-0 yds-precursor-engine-p7__confused-pair">
            {topConfusedPair.pair} ({topConfusedPair.count}건)
          </p>
        ) : (
          <p className="m-0 yds-event-detail__hint">오분류 혼동 없음</p>
        )}
        {confusedPairs.length > 1 ? (
          <ul className="yds-precursor-engine-p7__pair-list">
            {confusedPairs.slice(1).map((p) => (
              <li key={p.pair}>
                {p.pair} ({p.count}건)
              </li>
            ))}
          </ul>
        ) : null}
      </article>

      <article className="yds-precursor-engine-p7__block" aria-label="분류 상세">
        <p className="m-0 panic-validation-panel__h3">이벤트별 분류 (일부)</p>
        <div className="yds-precursor-engine-p7__scroll">
          <table className="panic-validation-year-table yds-precursor-engine-p7__detail-table">
            <thead>
              <tr>
                <th scope="col">이벤트</th>
                <th scope="col">실제</th>
                <th scope="col">예측</th>
                <th scope="col">Top-1</th>
                <th scope="col">Margin</th>
              </tr>
            </thead>
            <tbody>
              {classifiedRows.slice(0, 20).map((row) => (
                <tr
                  key={row.eventId}
                  className={row.top1Hit ? "yds-precursor-engine-p7__row-hit" : "yds-precursor-engine-p7__row-miss"}
                >
                  <td>{row.eventName}</td>
                  <td>{row.actualLabel}</td>
                  <td>{row.predictedLabel}</td>
                  <td>{row.top1Hit ? "✓" : "✗"}</td>
                  <td className="font-mono tabular-nums">{row.margin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article
        className={`yds-precursor-engine-p7__verdict yds-precursor-engine-p7__verdict--${verdict.id}`}
        aria-label="최종 판정"
      >
        <p className="m-0 yds-precursor-engine-p7__verdict-title">
          {verdict.emoji} {verdict.label}
        </p>
        <p className="m-0 yds-event-detail__hint">{verdict.detail}</p>
      </article>

      <ul className="yds-engine-candidate__notes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
