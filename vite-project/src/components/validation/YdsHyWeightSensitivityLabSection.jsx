import { useMemo } from "react"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildHyWeightSensitivityLabReport,
  HY_WEIGHT_CURRENT_RULES_NOTE,
  HY_WEIGHT_STEPPED_BANDS,
} from "../../trading-zone/ydsHyWeightSensitivityLab.js"

function formatDelta(delta) {
  if (delta == null || !Number.isFinite(delta)) return "—"
  return delta > 0 ? `+${delta}` : `${delta}`
}

function verdictYesNo(value) {
  return value ? "✓ 예" : "✗ 아니오"
}

/**
 * @param {{ events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[] }} props
 */
export default function YdsHyWeightSensitivityLabSection({ events = YDS_VALIDATION_EVENT_DATASET }) {
  const report = useMemo(() => buildHyWeightSensitivityLabReport(events), [events])
  const { rows, validationGoals, notes } = report
  const { tariffBeatsCovid, naturalOrder } = validationGoals

  return (
    <section
      className="panic-validation-panel yds-hy-weight-lab"
      aria-labelledby="yds-hy-weight-lab-title"
    >
      <h2 id="yds-hy-weight-lab-title" className="panic-validation-panel__h2">
        HY 가중 민감도 실험실
      </h2>
      <p className="panic-validation-panel__note">
        HY 가중 규칙이 관세 &gt; 코로나 현상을 만드는지 검증 · `getFinalScore` 미변경 · 검증 전용
      </p>

      <div className="yds-hy-weight-lab__rules">
        <article className="yds-hy-weight-lab__rule-block" aria-label="실험 A 현재 규칙">
          <p className="m-0 panic-validation-panel__h3">실험 A — 현재 규칙</p>
          <ul className="yds-hy-weight-lab__rule-list">
            <li>HY &gt; 6 → 단기 40% · 중기 60% (우선)</li>
            <li>HY ≤ 6 且 VIX &gt; 25 → 단기 70% · 중기 30%</li>
            <li>그 외 → 단기 50% · 중기 50%</li>
          </ul>
          <p className="m-0 yds-event-detail__hint">{HY_WEIGHT_CURRENT_RULES_NOTE}</p>
        </article>

        <article className="yds-hy-weight-lab__rule-block" aria-label="실험 B 계단형 규칙">
          <p className="m-0 panic-validation-panel__h3">실험 B — HY 계단형 규칙</p>
          <table className="panic-validation-year-table yds-hy-weight-lab__band-table">
            <thead>
              <tr>
                <th scope="col">HY 구간</th>
                <th scope="col">단기</th>
                <th scope="col">중기</th>
              </tr>
            </thead>
            <tbody>
              {HY_WEIGHT_STEPPED_BANDS.map((band) => (
                <tr key={band.label}>
                  <td>{band.label}</td>
                  <td className="font-mono tabular-nums">{Math.round(band.wShort * 100)}%</td>
                  <td className="font-mono tabular-nums">{Math.round(band.wMid * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">패닉 6건 — 최고 YDS 비교</p>
        <table className="panic-validation-year-table panic-validation-year-table--vs yds-panic-validation__table">
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col">현재 YDS</th>
              <th scope="col">실험 YDS</th>
              <th scope="col">변화량</th>
              <th scope="col">최고 시점 HY</th>
              <th scope="col">실험 HY 밴드</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td className="font-mono tabular-nums">{row.currentMaxYds}</td>
                <td className="font-mono tabular-nums yds-hy-weight-lab__exp">{row.experimentalMaxYds}</td>
                <td className="font-mono tabular-nums yds-hy-weight-lab__delta">{formatDelta(row.delta)}</td>
                <td className="font-mono tabular-nums">{row.peakHy ?? "—"}</td>
                <td className="font-mono tabular-nums">{row.experimentalBand ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <article className="yds-hy-weight-lab__goals" aria-label="검증 목표">
        <p className="m-0 panic-validation-panel__h3">검증 목표</p>

        <div className="yds-hy-weight-lab__goal-item">
          <p className="m-0 yds-hy-weight-lab__goal-title">1. 관세 &gt; 코로나 현상</p>
          <ul className="yds-hy-weight-lab__insights">
            <li>
              현재: 관세 {tariffBeatsCovid.currentGap >= 0 ? "+" : ""}
              {tariffBeatsCovid.currentGap}p ({verdictYesNo(tariffBeatsCovid.current)})
            </li>
            <li>
              실험 B: 관세 {tariffBeatsCovid.experimentalGap >= 0 ? "+" : ""}
              {tariffBeatsCovid.experimentalGap}p ({verdictYesNo(tariffBeatsCovid.experimental)})
            </li>
            <li>
              현상 유지: {verdictYesNo(tariffBeatsCovid.maintained)}
              {!tariffBeatsCovid.maintained && tariffBeatsCovid.current && !tariffBeatsCovid.experimental
                ? " — 계단형 규칙으로 관세 우위 소멸"
                : ""}
            </li>
          </ul>
        </div>

        <div className="yds-hy-weight-lab__goal-item">
          <p className="m-0 yds-hy-weight-lab__goal-title">
            2. {naturalOrder.target} 순서
          </p>
          <ul className="yds-hy-weight-lab__insights">
            <li>
              현재: {naturalOrder.currentScores.lehman} &gt; {naturalOrder.currentScores.covid} &gt;{" "}
              {naturalOrder.currentScores.tariff} &gt; {naturalOrder.currentScores.yen} →{" "}
              {verdictYesNo(naturalOrder.current)}
            </li>
            <li>
              실험 B: {naturalOrder.experimentalScores.lehman} &gt; {naturalOrder.experimentalScores.covid} &gt;{" "}
              {naturalOrder.experimentalScores.tariff} &gt; {naturalOrder.experimentalScores.yen} →{" "}
              {verdictYesNo(naturalOrder.experimental)}
            </li>
            <li>
              자연스러운 순서 달성: {verdictYesNo(naturalOrder.experimental)}
              {naturalOrder.improved ? " (현재 대비 개선)" : naturalOrder.current ? " (현재도 충족)" : ""}
            </li>
          </ul>
        </div>
      </article>

      <ul className="yds-hy-weight-lab__notes">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  )
}
