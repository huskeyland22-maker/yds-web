import { useMemo } from "react"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildVixSensitivityLabReport,
  CURRENT_PANIC_BUY_MIN,
  HISTORIC_PANIC_MIN,
  VIX_EXPERIMENT_VARIANTS,
} from "../../trading-zone/ydsVixSensitivityLab.js"

function formatDelta(delta) {
  if (delta == null || !Number.isFinite(delta)) return "—"
  return delta > 0 ? `+${delta}` : `${delta}`
}

function verdictYesNo(value) {
  return value ? "✓ 예" : "✗ 아니오"
}

function formatRankShift(shift) {
  if (shift == null || !Number.isFinite(shift)) return "—"
  if (shift > 0) return `↑${shift} (상승)`
  if (shift < 0) return `↓${Math.abs(shift)} (하락)`
  return "—"
}

/**
 * @param {{ events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[] }} props
 */
export default function YdsVixSensitivityLabSection({ events = YDS_VALIDATION_EVENT_DATASET }) {
  const report = useMemo(() => buildVixSensitivityLabReport(events), [events])
  const { rows, rankingChanges, validationGoals, finalReport, v3Interpretation, notes } = report
  const { naturalOrder, covidTariffGap, historicPanic, tariffPanicBuy, lowVixControl } =
    validationGoals

  return (
    <section
      className="panic-validation-panel yds-vix-lab"
      aria-labelledby="yds-vix-lab-title"
    >
      <h2 id="yds-vix-lab-title" className="panic-validation-panel__h2">
        VIX 민감도 실험실 (V1 · V2 · V3)
      </h2>
      <p className="panic-validation-panel__note">
        검증 페이지 전용 · `getFinalScore`·프로덕션 미반영 · 4-way 비교
      </p>

      <div className="yds-vix-lab__anchors-grid yds-vix-lab__anchors-grid--triple">
        {VIX_EXPERIMENT_VARIANTS.map((variant) => (
          <article
            key={variant.id}
            className="yds-vix-lab__experiment-a"
            aria-label={`실험 ${variant.label} VIX 앵커`}
          >
            <p className="m-0 panic-validation-panel__h3">실험 {variant.label}</p>
            <table className="panic-validation-year-table yds-vix-lab__anchor-table">
              <thead>
                <tr>
                  <th scope="col">VIX</th>
                  <th scope="col">scoreVIX</th>
                </tr>
              </thead>
              <tbody>
                {variant.anchors.filter((a) => a.vix >= 40).map((anchor) => (
                  <tr key={`${variant.id}-${anchor.vix}`}>
                    <td className="font-mono tabular-nums">{anchor.vix}</td>
                    <td className="font-mono tabular-nums">{anchor.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="m-0 yds-event-detail__hint">{variant.note}</p>
          </article>
        ))}
      </div>

      <div className="yds-panic-validation__block yds-vix-lab__scroll-wrap">
        <p className="m-0 panic-validation-panel__h3">패닉 6건 — 현재 · V1 · V2 · V3 최고 YDS</p>
        <table className="panic-validation-year-table panic-validation-year-table--vs yds-panic-validation__table yds-vix-lab__quad-table">
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col">현재</th>
              <th scope="col">V1</th>
              <th scope="col">V2</th>
              <th scope="col">V3</th>
              <th scope="col">Δ V3</th>
              <th scope="col">최고 시점</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td className="font-mono tabular-nums">{row.currentMaxYds}</td>
                <td className="font-mono tabular-nums">{row.v1MaxYds}</td>
                <td className="font-mono tabular-nums">{row.v2MaxYds}</td>
                <td className="font-mono tabular-nums yds-vix-lab__exp-v3">{row.v3MaxYds}</td>
                <td className="font-mono tabular-nums yds-vix-lab__delta">{formatDelta(row.deltaV3)}</td>
                <td className="font-mono tabular-nums">
                  {row.peakMilestone} · {row.peakDate}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <article className="yds-vix-lab__ranking" aria-label="순위 변화">
        <p className="m-0 panic-validation-panel__h3">순위 변화</p>
        <table className="panic-validation-year-table yds-vix-lab__rank-table">
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col">현재</th>
              <th scope="col">V1</th>
              <th scope="col">V2</th>
              <th scope="col">V3</th>
              <th scope="col">V3 vs 현재</th>
            </tr>
          </thead>
          <tbody>
            {rankingChanges.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                {row.ranks.map((r) => (
                  <td key={r.label} className="font-mono tabular-nums">
                    {r.rank}위
                  </td>
                ))}
                <td className="font-mono tabular-nums">{formatRankShift(row.rankShiftV3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="yds-vix-lab__final-report" aria-label="점수 변화">
        <p className="m-0 panic-validation-panel__h3">점수 변화 — 4-way</p>
        <table className="panic-validation-year-table yds-vix-lab__final-table">
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col">현재</th>
              <th scope="col">V1</th>
              <th scope="col">V2</th>
              <th scope="col">V3</th>
              <th scope="col">Δ V3</th>
            </tr>
          </thead>
          <tbody>
            {finalReport.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td className="font-mono tabular-nums">{row.current}</td>
                <td className="font-mono tabular-nums">{row.v1}</td>
                <td className="font-mono tabular-nums">{row.v2}</td>
                <td className="font-mono tabular-nums">{row.v3}</td>
                <td className="font-mono tabular-nums">{formatDelta(row.deltaV3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="yds-vix-lab__goals" aria-label="V3 검증 목표">
        <p className="m-0 panic-validation-panel__h3">V3 검증 목표</p>

        <div className="yds-vix-lab__goal-item">
          <p className="m-0 yds-vix-lab__goal-title">1. {naturalOrder.target}</p>
          <ul className="yds-vix-lab__insights">
            <li>현재: {verdictYesNo(naturalOrder.current)} · V1: {verdictYesNo(naturalOrder.v1)} · V2: {verdictYesNo(naturalOrder.v2)} · V3: {verdictYesNo(naturalOrder.v3)}</li>
          </ul>
        </div>

        <div className="yds-vix-lab__goal-item">
          <p className="m-0 yds-vix-lab__goal-title">2. 코로나−관세 격차 확대</p>
          <ul className="yds-vix-lab__insights">
            <li>
              현재 {covidTariffGap.current}p · V1 {covidTariffGap.v1}p · V2 {covidTariffGap.v2}p · V3{" "}
              {covidTariffGap.v3}p — V3 확대: {verdictYesNo(covidTariffGap.v3Widened)}
            </li>
          </ul>
        </div>

        <div className="yds-vix-lab__goal-item">
          <p className="m-0 yds-vix-lab__goal-title">3. 리먼/코로나 → 역사적패닉({HISTORIC_PANIC_MIN}+)</p>
          <ul className="yds-vix-lab__insights">
            <li>V3: {verdictYesNo(historicPanic.v3LehmanCovid)} {historicPanic.v3.map((e) => `· ${e.name} ${e.score}`).join("")}</li>
          </ul>
        </div>

        <div className="yds-vix-lab__goal-item">
          <p className="m-0 yds-vix-lab__goal-title">4. 관세 → 패닉매수({CURRENT_PANIC_BUY_MIN}+) 유지</p>
          <ul className="yds-vix-lab__insights">
            <li>
              V3 관세 {tariffPanicBuy.v3Score}: {verdictYesNo(tariffPanicBuy.v3)}
            </li>
          </ul>
        </div>

        <div className="yds-vix-lab__goal-item">
          <p className="m-0 yds-vix-lab__goal-title">5. 엔캐리 · 긴축 · SVB 왜곡 없음</p>
          <ul className="yds-vix-lab__insights">
            {lowVixControl.items.map((item) => (
              <li key={item.id}>
                {item.name}: {item.current} → V3 {item.v3} (Δ {formatDelta(item.deltaV3)}){" "}
                {item.undistorted ? "✓" : "△"}
              </li>
            ))}
            <li>전체: {verdictYesNo(lowVixControl.allUndistorted)}</li>
          </ul>
        </div>
      </article>

      <article className="yds-vix-lab__interpret-v3" aria-label="V3 최종 해석">
        <p className="m-0 panic-validation-panel__h3">V3 최종 해석</p>
        <ol className="yds-vix-lab__interpret-list">
          {v3Interpretation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </article>

      <ul className="yds-vix-lab__notes">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  )
}
