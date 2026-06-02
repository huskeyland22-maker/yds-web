import { useMemo } from "react"
import {
  buildPanicEventValidationReport,
  formatIndicatorCell,
  formatStageBadge,
  PANIC_VALIDATION_COMPARE_IDS,
} from "../../trading-zone/ydsPanicEventValidation.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import { buildMilestoneBreakdown } from "../../trading-zone/ydsScoreBreakdown.js"
import { YdsClimaxAnalysisCard } from "./YdsScoreBreakdownTable.jsx"

/**
 * @param {{ events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[] }} props
 */
export default function YdsPanicEventValidationSection({ events = YDS_VALIDATION_EVENT_DATASET }) {
  const targets = useMemo(
    () => events.filter((e) => PANIC_VALIDATION_COMPARE_IDS.includes(e.id)),
    [events],
  )

  const report = useMemo(() => buildPanicEventValidationReport(targets), [targets])

  const climaxAnalyses = useMemo(() => {
    const covid = targets.find((e) => e.id === "panic-2020-covid")
    const svb = targets.find((e) => e.id === "panic-2023-svb")
    return {
      covidClimax: covid ? buildMilestoneBreakdown(covid, "climax") : null,
      covidFear: covid ? buildMilestoneBreakdown(covid, "fearExpansion") : null,
      svbClimax: svb ? buildMilestoneBreakdown(svb, "climax") : null,
    }
  }, [targets])

  const { summary, rows, ranked, stageChecks } = report

  return (
    <section className="panic-validation-panel yds-panic-validation" aria-labelledby="yds-panic-validation-title">
      <h2 id="yds-panic-validation-title" className="panic-validation-panel__h2">
        YDS 패닉 이벤트 검증
      </h2>
      <p className="panic-validation-panel__note">
        패닉 표본 6건(리먼·코로나·2022·SVB·엔캐리·관세) 극점(climax) 기준 · 기존 YDS 계산 엔진(`getFinalScore`) 재사용
      </p>

      <article className="yds-panic-validation__summary" aria-label="YDS 역사 검증 결과">
        <p className="m-0 yds-panic-validation__summary-title">YDS 역사 검증 결과</p>
        <p className="m-0 yds-panic-validation__summary-sub">패닉 이벤트 {summary.totalCompared}건 검증</p>
        <ul className="yds-panic-validation__summary-list">
          {rows.map((row) => (
            <li key={row.id} className="yds-panic-validation__summary-item">
              <span>{row.name}</span>
              <span className="font-mono tabular-nums">
                {row.yds != null ? `YDS ${row.yds}` : "YDS —"}
              </span>
              <span>{formatStageBadge(row.stageEmoji, row.stageLabel)}</span>
              {row.stageOk ? (
                <span className="yds-panic-validation__pass">적중</span>
              ) : (
                <span className="yds-panic-validation__fail">{row.ydsComputable ? "미적중" : "미계산"}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="m-0 yds-panic-validation__hit-rate">
          YDS 분류 적중률{" "}
          <strong className="font-mono tabular-nums">
            {summary.hitRatePct != null ? `${summary.hitRatePct}%` : "—"}
          </strong>
          {summary.evaluatedCount > 0 && (
            <span className="yds-panic-validation__hit-detail">
              {" "}
              ({summary.hitCount}/{summary.evaluatedCount}건 · 분할매수/패닉매수)
            </span>
          )}
        </p>
        {summary.allPass && (
          <p className="m-0 yds-panic-validation__pass-note">극점 단계가 모두 분할매수 또는 패닉매수로 분류되었습니다.</p>
        )}
      </article>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">1. 극점 지표 비교표</p>
        <table className="panic-validation-year-table panic-validation-year-table--vs yds-panic-validation__table">
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col">극점 날짜</th>
              <th scope="col">YDS</th>
              <th scope="col">VIX</th>
              <th scope="col">CNN</th>
              <th scope="col">BofA</th>
              <th scope="col">HY</th>
              <th scope="col">Put/Call</th>
              <th scope="col">단계</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`cmp-${row.id}`}>
                <td>{row.name}</td>
                <td className="font-mono tabular-nums">{row.climaxDate ?? "—"}</td>
                <td className="font-mono tabular-nums">{formatIndicatorCell(row.yds, 0)}</td>
                <td className="font-mono tabular-nums">{formatIndicatorCell(row.vix)}</td>
                <td className="font-mono tabular-nums">{formatIndicatorCell(row.cnn, 0)}</td>
                <td className="font-mono tabular-nums">{formatIndicatorCell(row.bofa)}</td>
                <td className="font-mono tabular-nums">{formatIndicatorCell(row.highYield)}</td>
                <td className="font-mono tabular-nums">{formatIndicatorCell(row.putCall)}</td>
                <td>{formatStageBadge(row.stageEmoji, row.stageLabel)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">2. 극점 YDS 순위 (높은 순 · 엔진 튜닝 전 베이스라인)</p>
        <table className="panic-validation-year-table panic-validation-year-table--vs yds-panic-validation__table">
          <thead>
            <tr>
              <th scope="col">순위</th>
              <th scope="col">이벤트</th>
              <th scope="col">극점 YDS</th>
              <th scope="col">단계</th>
            </tr>
          </thead>
          <tbody>
            {ranked.length ? (
              ranked.map((row, idx) => (
                <tr key={`rank-${row.id}`}>
                  <td className="font-mono tabular-nums">{idx + 1}</td>
                  <td>{row.name}</td>
                  <td className="font-mono tabular-nums">{row.yds}</td>
                  <td>{formatStageBadge(row.stageEmoji, row.stageLabel)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>YDS 계산 가능한 극점 데이터가 없습니다.</td>
              </tr>
            )}
            {rows
              .filter((r) => !r.ydsComputable)
              .map((row) => (
                <tr key={`rank-skip-${row.id}`} className="yds-panic-validation__row-muted">
                  <td className="font-mono tabular-nums">—</td>
                  <td>{row.name}</td>
                  <td colSpan={2}>YDS 계산 불가 (핵심 지표 미입력)</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">3. YDS 계산 과정 검증 (신뢰성)</p>
        <p className="m-0 panic-validation-panel__note">
          극단 공포(VIX 80+, CNN 10대)인데 YDS가 80 미만일 때, 동적 가중·중기 지표·VIX 캡이 원인인지 확인합니다.
        </p>
        {climaxAnalyses.covidFear && (
          <YdsClimaxAnalysisCard
            title="코로나 · 공포확대 (VIX 82.7 / CNN 12 참고 시점)"
            breakdown={climaxAnalyses.covidFear}
          />
        )}
        {climaxAnalyses.covidClimax && (
          <YdsClimaxAnalysisCard title="코로나 · 극점 — 왜 YDS 66인가?" breakdown={climaxAnalyses.covidClimax} />
        )}
        {climaxAnalyses.svbClimax && (
          <YdsClimaxAnalysisCard title="SVB · 극점 — 왜 YDS 60인가?" breakdown={climaxAnalyses.svbClimax} />
        )}
      </div>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">4. 단계 판정 검증</p>
        <p className="m-0 panic-validation-panel__note">
          검증 목표: 극점이 🟠 분할매수(60~79) 또는 🔴 패닉매수(80+) 구간인지 확인
        </p>
        <ul className="yds-panic-validation__stage-checks">
          {stageChecks.map((row) => (
            <li
              key={`stage-${row.id}`}
              className={row.pass ? "yds-panic-validation__stage-check--pass" : "yds-panic-validation__stage-check--fail"}
            >
              <span className="yds-panic-validation__stage-check-name">{row.name}</span>
              <span>{formatStageBadge(row.stageEmoji, row.stageLabel)}</span>
              <span className="yds-panic-validation__stage-check-note">{row.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
