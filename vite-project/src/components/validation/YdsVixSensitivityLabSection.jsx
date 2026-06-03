import { useMemo } from "react"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildVixSensitivityLabReport,
  CURRENT_PANIC_BUY_MIN,
  HISTORIC_PANIC_MIN,
  VIX_EXPERIMENT_V1_ANCHORS,
  VIX_EXPERIMENT_V1_NOTE,
  VIX_EXPERIMENT_V2_ANCHORS,
  VIX_EXPERIMENT_V2_NOTE,
} from "../../trading-zone/ydsVixSensitivityLab.js"

function formatDelta(delta) {
  if (delta == null || !Number.isFinite(delta)) return "—"
  return delta > 0 ? `+${delta}` : `${delta}`
}

function verdictYesNo(value) {
  return value ? "✓ 예" : "✗ 아니오"
}

function formatGapPair(label, current, v1, v2) {
  return `${label}: 현재 ${current ?? "—"} · V1 ${v1 ?? "—"} · V2 ${v2 ?? "—"}`
}

/**
 * @param {{ events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[] }} props
 */
export default function YdsVixSensitivityLabSection({ events = YDS_VALIDATION_EVENT_DATASET }) {
  const report = useMemo(() => buildVixSensitivityLabReport(events), [events])
  const { rows, validationGoals, finalReport, notes } = report
  const { naturalOrder, lehmanCovidVsTariffGap, historicPanic, panicBuy } = validationGoals

  return (
    <section
      className="panic-validation-panel yds-vix-lab"
      aria-labelledby="yds-vix-lab-title"
    >
      <h2 id="yds-vix-lab-title" className="panic-validation-panel__h2">
        VIX 민감도 실험실 (V1 · V2)
      </h2>
      <p className="panic-validation-panel__note">
        검증 페이지 전용 · `getFinalScore`·프로덕션 미반영 · VIX 40+ 캡 해제 실험
      </p>

      <div className="yds-vix-lab__anchors-grid">
        <article className="yds-vix-lab__experiment-a" aria-label="실험 V1 VIX 앵커">
          <p className="m-0 panic-validation-panel__h3">실험 V1</p>
          <table className="panic-validation-year-table yds-vix-lab__anchor-table">
            <thead>
              <tr>
                <th scope="col">VIX</th>
                <th scope="col">scoreVIX</th>
              </tr>
            </thead>
            <tbody>
              {VIX_EXPERIMENT_V1_ANCHORS.filter((a) => a.vix >= 40).map((anchor) => (
                <tr key={`v1-${anchor.vix}`}>
                  <td className="font-mono tabular-nums">{anchor.vix}</td>
                  <td className="font-mono tabular-nums">{anchor.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 yds-event-detail__hint">{VIX_EXPERIMENT_V1_NOTE}</p>
        </article>

        <article className="yds-vix-lab__experiment-a" aria-label="실험 V2 VIX 앵커">
          <p className="m-0 panic-validation-panel__h3">실험 V2</p>
          <table className="panic-validation-year-table yds-vix-lab__anchor-table">
            <thead>
              <tr>
                <th scope="col">VIX</th>
                <th scope="col">scoreVIX</th>
              </tr>
            </thead>
            <tbody>
              {VIX_EXPERIMENT_V2_ANCHORS.filter((a) => a.vix >= 40).map((anchor) => (
                <tr key={`v2-${anchor.vix}`}>
                  <td className="font-mono tabular-nums">{anchor.vix}</td>
                  <td className="font-mono tabular-nums">{anchor.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 yds-event-detail__hint">{VIX_EXPERIMENT_V2_NOTE}</p>
        </article>
      </div>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">패닉 6건 — 현재 · V1 · V2 최고 YDS</p>
        <table className="panic-validation-year-table panic-validation-year-table--vs yds-panic-validation__table yds-vix-lab__triple-table">
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col">현재</th>
              <th scope="col">V1</th>
              <th scope="col">V2</th>
              <th scope="col">Δ V1</th>
              <th scope="col">Δ V2</th>
              <th scope="col">최고 시점</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td className="font-mono tabular-nums">{row.currentMaxYds}</td>
                <td className="font-mono tabular-nums yds-vix-lab__exp-score">{row.v1MaxYds}</td>
                <td className="font-mono tabular-nums yds-vix-lab__exp-v2">{row.v2MaxYds}</td>
                <td className="font-mono tabular-nums yds-vix-lab__delta">{formatDelta(row.deltaV1)}</td>
                <td className="font-mono tabular-nums yds-vix-lab__delta">{formatDelta(row.deltaV2)}</td>
                <td className="font-mono tabular-nums">
                  {row.peakMilestone} · {row.peakDate}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <article className="yds-vix-lab__final-report" aria-label="최종 리포트">
        <p className="m-0 panic-validation-panel__h3">최종 리포트 — 현재 엔진 대비 변화</p>
        <table className="panic-validation-year-table yds-vix-lab__final-table">
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col">현재</th>
              <th scope="col">V1</th>
              <th scope="col">Δ V1</th>
              <th scope="col">V2</th>
              <th scope="col">Δ V2</th>
            </tr>
          </thead>
          <tbody>
            {finalReport.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td className="font-mono tabular-nums">{row.current}</td>
                <td className="font-mono tabular-nums">{row.v1}</td>
                <td className="font-mono tabular-nums">{formatDelta(row.deltaV1)}</td>
                <td className="font-mono tabular-nums">{row.v2}</td>
                <td className="font-mono tabular-nums">{formatDelta(row.deltaV2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="yds-vix-lab__goals" aria-label="검증 목표">
        <p className="m-0 panic-validation-panel__h3">검증 목표</p>

        <div className="yds-vix-lab__goal-item">
          <p className="m-0 yds-vix-lab__goal-title">1. {naturalOrder.target}</p>
          <ul className="yds-vix-lab__insights">
            <li>현재: {verdictYesNo(naturalOrder.current)}</li>
            <li>V1: {verdictYesNo(naturalOrder.v1)}</li>
            <li>V2: {verdictYesNo(naturalOrder.v2)}</li>
          </ul>
        </div>

        <div className="yds-vix-lab__goal-item">
          <p className="m-0 yds-vix-lab__goal-title">2. 리먼/코로나 vs 관세 격차 확대</p>
          <ul className="yds-vix-lab__insights">
            <li>
              {formatGapPair(
                "리먼−관세",
                lehmanCovidVsTariffGap.current.lehmanMinusTariff,
                lehmanCovidVsTariffGap.v1.lehmanMinusTariff,
                lehmanCovidVsTariffGap.v2.lehmanMinusTariff,
              )}
            </li>
            <li>
              {formatGapPair(
                "코로나−관세",
                lehmanCovidVsTariffGap.current.covidMinusTariff,
                lehmanCovidVsTariffGap.v1.covidMinusTariff,
                lehmanCovidVsTariffGap.v2.covidMinusTariff,
              )}
            </li>
            <li>
              V1 격차 확대: {verdictYesNo(lehmanCovidVsTariffGap.v1.widened)} · V2:{" "}
              {verdictYesNo(lehmanCovidVsTariffGap.v2.widened)}
            </li>
          </ul>
        </div>

        <div className="yds-vix-lab__goal-item">
          <p className="m-0 yds-vix-lab__goal-title">3. 역사적패닉({HISTORIC_PANIC_MIN}+)</p>
          <ul className="yds-vix-lab__insights">
            <li>
              V1: {historicPanic.v1.exists ? `✓ ${historicPanic.v1.count}건` : "✗ 미분리"}
              {historicPanic.v1.events.map((e) => ` · ${e.name} ${e.score}`).join("")}
            </li>
            <li>
              V2: {historicPanic.v2.exists ? `✓ ${historicPanic.v2.count}건` : "✗ 미분리"}
              {historicPanic.v2.events.map((e) => ` · ${e.name} ${e.score}`).join("")}
            </li>
          </ul>
        </div>

        <div className="yds-vix-lab__goal-item">
          <p className="m-0 yds-vix-lab__goal-title">4. 패닉매수({CURRENT_PANIC_BUY_MIN}+)</p>
          <ul className="yds-vix-lab__insights">
            <li>
              V1: {panicBuy.v1.exists ? `✓ ${panicBuy.v1.count}건` : "✗ 미발생"}
              {panicBuy.v1.events.map((e) => ` · ${e.name} ${e.score}`).join("")}
            </li>
            <li>
              V2: {panicBuy.v2.exists ? `✓ ${panicBuy.v2.count}건` : "✗ 미발생"}
              {panicBuy.v2.events.map((e) => ` · ${e.name} ${e.score}`).join("")}
            </li>
          </ul>
        </div>
      </article>

      <ul className="yds-vix-lab__notes">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  )
}
