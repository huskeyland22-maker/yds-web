import { useMemo } from "react"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildEngineCandidateV3Report,
  ENGINE_CANDIDATE_V3_LABEL,
  ENGINE_CANDIDATE_V3_NOTE,
} from "../../trading-zone/ydsEngineCandidateV3.js"

function verdictYesNo(pass) {
  return pass ? "✓ 통과" : "✗ 미달"
}

/**
 * @param {{ events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[] }} props
 */
export default function YdsEngineCandidateV3Section({ events = YDS_VALIDATION_EVENT_DATASET }) {
  const report = useMemo(() => buildEngineCandidateV3Report(events), [events])
  const { rows, stageBands, finalValidation, verdict, summary, notes } = report

  return (
    <section
      className="panic-validation-panel yds-engine-candidate"
      aria-labelledby="yds-engine-candidate-v3-title"
    >
      <h2 id="yds-engine-candidate-v3-title" className="panic-validation-panel__h2">
        {ENGINE_CANDIDATE_V3_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        VIX V3 후보 엔진 · 7단계 후보 구간 · 프로덕션 미반영 · 최종 승인 전 기존 엔진 유지
      </p>

      <article className="yds-engine-candidate__bands" aria-label="후보 단계 체계">
        <p className="m-0 panic-validation-panel__h3">후보 단계 체계 (Candidate #1)</p>
        <ul className="yds-engine-candidate__band-list">
          {stageBands.map((band) => (
            <li key={band.id} className="font-mono tabular-nums">
              {band.emoji} {band.label}{" "}
              {band.max != null ? `${band.min}~${band.max}` : `${band.min}+`}
            </li>
          ))}
        </ul>
        <p className="m-0 yds-event-detail__hint">{ENGINE_CANDIDATE_V3_NOTE}</p>
      </article>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">패닉 6건 — 현재 vs V3 후보 단계</p>
        <table className="panic-validation-year-table panic-validation-year-table--vs yds-panic-validation__table">
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col">현재 YDS</th>
              <th scope="col">현재 단계</th>
              <th scope="col">V3 YDS</th>
              <th scope="col">V3 후보 단계</th>
              <th scope="col">Δ</th>
              <th scope="col">최고 시점</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={row.stageChanged ? "yds-engine-candidate__row-changed" : ""}
              >
                <td>{row.name}</td>
                <td className="font-mono tabular-nums">{row.currentYds}</td>
                <td>{row.currentStageLabel}</td>
                <td className="font-mono tabular-nums yds-engine-candidate__v3-score">
                  {row.candidateYds}
                </td>
                <td>{row.candidateStageLabel}</td>
                <td className="font-mono tabular-nums">
                  {row.delta != null ? (row.delta > 0 ? `+${row.delta}` : row.delta) : "—"}
                </td>
                <td className="font-mono tabular-nums">
                  {row.peakMilestone} · {row.peakDate}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="m-0 yds-event-detail__hint">
          단계 변경 {summary.stageChangedCount}/{summary.compared}건
        </p>
      </div>

      <article className="yds-engine-candidate__validation" aria-label="최종 검증">
        <p className="m-0 panic-validation-panel__h3">최종 검증</p>
        <ol className="yds-engine-candidate__check-list">
          <li>
            <strong>역사적 패닉 분리</strong> — {verdictYesNo(finalValidation.historicPanicSeparated.pass)}
            <span className="yds-engine-candidate__check-detail">
              {finalValidation.historicPanicSeparated.detail}
            </span>
          </li>
          <li>
            <strong>관세−코로나 격차</strong> — {verdictYesNo(finalValidation.covidTariffGap.pass)}
            <span className="yds-engine-candidate__check-detail">{finalValidation.covidTariffGap.detail}</span>
          </li>
          <li>
            <strong>엔캐리 위치</strong> — {verdictYesNo(finalValidation.yenPosition.pass)}
            <span className="yds-engine-candidate__check-detail">{finalValidation.yenPosition.detail}</span>
          </li>
          <li>
            <strong>긴축/SVB 위치</strong> — {verdictYesNo(finalValidation.moderateEvents.pass)}
            <span className="yds-engine-candidate__check-detail">{finalValidation.moderateEvents.detail}</span>
          </li>
        </ol>
      </article>

      <article
        className={`yds-engine-candidate__verdict yds-engine-candidate__verdict--${verdict.id}`}
        aria-label="최종 결론"
      >
        <p className="m-0 panic-validation-panel__h3">최종 결론</p>
        <p className="m-0 yds-engine-candidate__verdict-label">
          {verdict.emoji} {verdict.label}
        </p>
        <p className="m-0 yds-engine-candidate__verdict-summary">{verdict.summary}</p>
      </article>

      <ul className="yds-engine-candidate__notes">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  )
}
