import { useMemo } from "react"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase21Report,
  EARLY_WARNING_GRADES,
  formatScorecardDays,
  formatScorecardRate,
  PRECURSOR_ENGINE_PHASE21_LABEL,
} from "../../trading-zone/ydsPrecursorEnginePhase21.js"

const GRADE_CLASS = {
  S: "yds-precursor-engine-p21__grade--s",
  A: "yds-precursor-engine-p21__grade--a",
  B: "yds-precursor-engine-p21__grade--b",
  C: "yds-precursor-engine-p21__grade--c",
}

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 * }} props
 */
export default function YdsPrecursorEnginePhase21Section({
  events = YDS_VALIDATION_EVENT_DATASET,
}) {
  const report = useMemo(() => buildPrecursorEnginePhase21Report(events), [events])

  const {
    meta,
    eventScorecard,
    patternAverages,
    gradeDistribution,
    bestCases,
    worstCases,
    finalScorecard,
    notes,
  } = report

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p21"
      aria-labelledby="yds-precursor-engine-p21-title"
    >
      <h2 id="yds-precursor-engine-p21-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE21_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        YDS 조기경보 선행성 정량 평가 · Phase 2·4·10·20 읽기 전용 · 선행 윈도우 {meta.leadWindow}
      </p>

      <div className="yds-precursor-engine-p21__final">
        <h3 className="yds-precursor-engine-p21__h3">F. 최종 Score Card</h3>
        <div className="yds-precursor-engine-p21__final-grid">
          <div className="yds-precursor-engine-p21__final-stat">
            <span className="yds-precursor-engine-p21__stat-key">평균 선행일수</span>
            <strong>{formatScorecardDays(finalScorecard.avgLeadDays)}</strong>
          </div>
          <div className="yds-precursor-engine-p21__final-stat">
            <span className="yds-precursor-engine-p21__stat-key">최대 선행일수</span>
            <strong>{formatScorecardDays(finalScorecard.maxLeadDays)}</strong>
          </div>
          <div className="yds-precursor-engine-p21__final-stat">
            <span className="yds-precursor-engine-p21__stat-key">탐지 성공률</span>
            <strong>
              {formatScorecardRate(finalScorecard.successRate)} ({finalScorecard.successCount}/
              {finalScorecard.totalCount})
            </strong>
          </div>
          <div
            className={[
              "yds-precursor-engine-p21__final-grade",
              GRADE_CLASS[finalScorecard.grade] ?? "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="yds-precursor-engine-p21__stat-key">최종 등급</span>
            <strong className="yds-precursor-engine-p21__grade-badge">{finalScorecard.grade}</strong>
            <span className="yds-precursor-engine-p21__grade-desc">{finalScorecard.gradeDescription}</span>
          </div>
        </div>
      </div>

      <div className="yds-precursor-engine-p21__block">
        <h3 className="yds-precursor-engine-p21__h3">A. 이벤트 성적표</h3>
        <div className="yds-precursor-engine-p21__table-wrap">
          <table className="yds-precursor-engine-p21__table">
            <thead>
              <tr>
                <th>이벤트</th>
                <th>패턴</th>
                <th>최초 경고</th>
                <th>PRI-A≥30</th>
                <th>PRI-B≥30</th>
                <th>선행일수</th>
                <th>탐지</th>
                <th>등급</th>
              </tr>
            </thead>
            <tbody>
              {eventScorecard.map((row) => (
                <tr
                  key={row.eventId}
                  className={row.isTimeMachine ? "yds-precursor-engine-p21__row--tm" : ""}
                >
                  <td>
                    {row.name}
                    {row.isTimeMachine ? (
                      <span className="yds-precursor-engine-p21__tm-badge">TM</span>
                    ) : null}
                  </td>
                  <td>{row.patternLabel}</td>
                  <td>
                    {row.firstWarning.type} {row.firstWarning.offsetLabel}
                  </td>
                  <td className={row.firstPriA.hit ? "yds-precursor-engine-p21__hit" : ""}>
                    {row.firstPriA.offsetLabel}
                  </td>
                  <td className={row.firstPriB.hit ? "yds-precursor-engine-p21__hit" : ""}>
                    {row.firstPriB.offsetLabel}
                  </td>
                  <td>{formatScorecardDays(row.leadDays)}</td>
                  <td
                    className={
                      row.detected
                        ? "yds-precursor-engine-p21__detect--ok"
                        : "yds-precursor-engine-p21__detect--fail"
                    }
                  >
                    {row.detectedLabel}
                  </td>
                  <td>
                    <span
                      className={[
                        "yds-precursor-engine-p21__grade-pill",
                        GRADE_CLASS[row.grade] ?? "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {row.grade}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="yds-precursor-engine-p21__table-note">
          TM = Phase 20 타임머신 대상 · 패닉 {meta.panicCount}건
        </p>
      </div>

      <div className="yds-precursor-engine-p21__two-col">
        <div className="yds-precursor-engine-p21__block">
          <h3 className="yds-precursor-engine-p21__h3">B. 평균 선행일수</h3>
          <ul className="yds-precursor-engine-p21__avg-list">
            <li>
              <span>전체</span>
              <strong>{formatScorecardDays(finalScorecard.avgLeadDays)}</strong>
            </li>
            <li>
              <span>타임머신 10건</span>
              <strong>{formatScorecardDays(finalScorecard.avgLeadDaysTimeMachine)}</strong>
            </li>
            {patternAverages.map((p) => (
              <li key={p.patternId}>
                <span>{p.label}</span>
                <strong>
                  {formatScorecardDays(p.avgLeadDays)}
                  <small>
                    {" "}
                    ({p.detectedCount}/{p.eventCount})
                  </small>
                </strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="yds-precursor-engine-p21__block">
          <h3 className="yds-precursor-engine-p21__h3">C. 조기탐지 등급</h3>
          <ul className="yds-precursor-engine-p21__grade-list">
            {EARLY_WARNING_GRADES.map((g) => {
              const dist = gradeDistribution.find((d) => d.id === g.id)
              return (
                <li key={g.id} className={GRADE_CLASS[g.id] ?? ""}>
                  <span className="yds-precursor-engine-p21__grade-pill">{g.label}</span>
                  <span className="yds-precursor-engine-p21__grade-desc">{g.description}</span>
                  <strong>{dist?.count ?? 0}건</strong>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <div className="yds-precursor-engine-p21__two-col">
        <div className="yds-precursor-engine-p21__block">
          <h3 className="yds-precursor-engine-p21__h3">D. 최고 탐지 사례</h3>
          {bestCases.length === 0 ? (
            <p className="yds-precursor-engine-p21__empty">탐지 성공 사례 없음</p>
          ) : (
            <ol className="yds-precursor-engine-p21__case-list">
              {bestCases.map((c) => (
                <li key={c.eventId}>
                  <strong>{c.name}</strong>
                  <span>
                    {formatScorecardDays(c.leadDays)} · {c.firstWarning.type}{" "}
                    {c.firstWarning.offsetLabel} · {c.grade}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="yds-precursor-engine-p21__block">
          <h3 className="yds-precursor-engine-p21__h3">E. 최저 탐지 사례</h3>
          <ol className="yds-precursor-engine-p21__case-list">
            {worstCases.map((c) => (
              <li key={c.eventId}>
                <strong>{c.name}</strong>
                <span>
                  {c.detected ? formatScorecardDays(c.leadDays) : "미탐지"} · {c.patternLabel} ·{" "}
                  {c.grade}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <ul className="panic-validation-panel__notes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
