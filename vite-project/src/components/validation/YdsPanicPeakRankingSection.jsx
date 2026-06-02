import { useMemo } from "react"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPanicPeakRankingReport,
  formatStageBadge,
  HISTORIC_PANIC_MIN_SCORE,
} from "../../trading-zone/ydsPanicPeakRankingReport.js"

/**
 * @param {{ events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[] }} props
 */
export default function YdsPanicPeakRankingSection({ events = YDS_VALIDATION_EVENT_DATASET }) {
  const report = useMemo(() => buildPanicPeakRankingReport(events), [events])
  const { rows, lehmanVsCovid, historicPanic, currentStageSummary, summary } = report

  return (
    <section
      className="panic-validation-panel yds-peak-ranking"
      aria-labelledby="yds-peak-ranking-title"
    >
      <h2 id="yds-peak-ranking-title" className="panic-validation-panel__h2">
        패닉 최고 YDS 순위 (리먼 데이터 보강)
      </h2>
      <p className="panic-validation-panel__note">
        `getFinalScore`·현재 단계 체계 유지 · 구간 시뮬레이션 미반영 · 검증 전용
      </p>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">1. 최고 YDS 순위</p>
        <table className="panic-validation-year-table panic-validation-year-table--vs yds-panic-validation__table">
          <thead>
            <tr>
              <th scope="col">순위</th>
              <th scope="col">이벤트</th>
              <th scope="col">최고 YDS</th>
              <th scope="col">최고 시점</th>
              <th scope="col">현재 구간</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.id === "panic-2008-lehman" ? "yds-peak-ranking__row-lehman" : ""}>
                <td className="font-mono tabular-nums">{row.rank}</td>
                <td>{row.name}</td>
                <td className="font-mono tabular-nums">{row.maxYds}</td>
                <td className="font-mono tabular-nums">
                  {row.peakMilestone} · {row.peakDate}
                </td>
                <td>{formatStageBadge(row.currentStage?.emoji, row.currentStage?.label)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {summary.topEvent && (
          <p className="m-0 yds-event-detail__hint">
            1위 {summary.topEvent} YDS {summary.topYds} (현재 구간 체계 · 엔진 미변경)
          </p>
        )}
      </div>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">2. 리먼 vs 코로나</p>
        <table className="panic-validation-year-table yds-peak-ranking__compare-table">
          <thead>
            <tr>
              <th scope="col">항목</th>
              <th scope="col">리먼</th>
              <th scope="col">코로나</th>
            </tr>
          </thead>
          <tbody>
            {lehmanVsCovid.table.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td className="font-mono tabular-nums">{row.lehman}</td>
                <td className="font-mono tabular-nums">{row.covid}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="yds-peak-ranking__insights">
          {lehmanVsCovid.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">3. 현재 구간 적용 결과 (60~79 분할 · 80+ 패닉매수)</p>
        <ul className="yds-peak-ranking__stage-list">
          {currentStageSummary.events.map((e) => (
            <li key={e.name}>
              <span>{e.name}</span>
              <span className="font-mono tabular-nums">YDS {e.maxYds}</span>
              <span>
                {e.stageEmoji} {e.stageLabel}
              </span>
            </li>
          ))}
        </ul>
        <p className="m-0 yds-event-detail__hint">
          현재 체계 패닉매수(80+) 해당: {currentStageSummary.panicBuyCount}건 / {rows.length}건
        </p>
      </div>

      <article className="yds-peak-ranking__historic" aria-label="역사적패닉 존재 여부">
        <p className="m-0 panic-validation-panel__h3">4. 역사적패닉(85+) 존재 여부</p>
        <p className="m-0 yds-peak-ranking__historic-verdict">
          {historicPanic.exists ? (
            <>
              <strong>존재함</strong> — 엔진 최고 YDS {HISTORIC_PANIC_MIN_SCORE} 이상 이벤트{" "}
              {historicPanic.events.length}건 (실험 구간 비교용 · 프로덕션 미반영)
            </>
          ) : (
            <>
              <strong>없음</strong> — 표본 내 최고 YDS가 {HISTORIC_PANIC_MIN_SCORE} 미만 (현재 엔진·데이터 기준)
            </>
          )}
        </p>
        {historicPanic.exists && (
          <ul className="yds-peak-ranking__insights">
            {historicPanic.events.map((e) => (
              <li key={e.id}>
                {e.name}: 최고 YDS {e.maxYds} ({e.peakMilestone})
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 yds-event-detail__hint">{historicPanic.note}</p>
      </article>
    </section>
  )
}
