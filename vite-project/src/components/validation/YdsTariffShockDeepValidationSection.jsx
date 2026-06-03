import { useMemo } from "react"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import { buildTariffShockDeepValidationReport } from "../../trading-zone/ydsTariffShockDeepValidation.js"

function formatNum(v) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return Number(v)
}

function formatDelta(v) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  const n = Number(v)
  return n > 0 ? `+${n}` : `${n}`
}

/**
 * @param {{ events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[] }} props
 */
export default function YdsTariffShockDeepValidationSection({ events = YDS_VALIDATION_EVENT_DATASET }) {
  const report = useMemo(() => buildTariffShockDeepValidationReport(events), [events])
  const {
    compareRows,
    tariffBreakdown,
    tariffPeak,
    contributionRows,
    indicatorDiff,
    interpretation,
    covidPeak,
    notes,
  } = report

  return (
    <section
      className="panic-validation-panel yds-tariff-deep"
      aria-labelledby="yds-tariff-deep-title"
    >
      <h2 id="yds-tariff-deep-title" className="panic-validation-panel__h2">
        관세 쇼크 심층 검증
      </h2>
      <p className="panic-validation-panel__note">
        관세 최고 YDS {tariffPeak?.maxYds ?? "—"}({tariffPeak?.milestone} · {tariffPeak?.date}) 타당성 · `getFinalScore`
        미변경 · 검증 전용
      </p>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">1. 최고 YDS 이벤트 비교</p>
        <table className="panic-validation-year-table panic-validation-year-table--vs yds-tariff-deep__compare-table">
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col">최고 YDS</th>
              <th scope="col">시점</th>
              <th scope="col">VIX</th>
              <th scope="col">CNN</th>
              <th scope="col">BofA</th>
              <th scope="col">HY</th>
              <th scope="col">Put/Call</th>
            </tr>
          </thead>
          <tbody>
            {compareRows.map((row) => (
              <tr
                key={row.id}
                className={row.id === "panic-2025-tariff-shock" ? "yds-tariff-deep__row-tariff" : ""}
              >
                <td>{row.name}</td>
                <td className="font-mono tabular-nums">{formatNum(row.maxYds)}</td>
                <td className="font-mono tabular-nums">
                  {row.peakMilestone} · {row.peakDate}
                </td>
                <td className="font-mono tabular-nums">{formatNum(row.vix)}</td>
                <td className="font-mono tabular-nums">{formatNum(row.cnn)}</td>
                <td className="font-mono tabular-nums">{formatNum(row.bofa)}</td>
                <td className="font-mono tabular-nums">{formatNum(row.highYield)}</td>
                <td className="font-mono tabular-nums">{formatNum(row.putCall)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">2. 관세 쇼크 YDS 분해 ({tariffPeak?.milestone})</p>
        {tariffBreakdown?.computable ? (
          <>
            <p className="m-0 yds-event-detail__hint">
              단기 {tariffBreakdown.shortScore} × {Math.round(tariffBreakdown.weights.wShort * 100)}% + 중기{" "}
              {tariffBreakdown.midScore} × {Math.round(tariffBreakdown.weights.wMid * 100)}% → 최종 YDS{" "}
              {tariffBreakdown.finalYds}
            </p>
            <table className="panic-validation-year-table yds-tariff-deep__contrib-table">
              <thead>
                <tr>
                  <th scope="col">구성</th>
                  <th scope="col">지표 점수</th>
                  <th scope="col">최종 기여(p)</th>
                </tr>
              </thead>
              <tbody>
                {contributionRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td className="font-mono tabular-nums">{formatNum(row.componentScore)}</td>
                    <td className="font-mono tabular-nums">{formatNum(row.contribution)}</td>
                  </tr>
                ))}
                <tr className="yds-tariff-deep__contrib-total">
                  <td>합계</td>
                  <td>—</td>
                  <td className="font-mono tabular-nums">{formatNum(tariffBreakdown.sumContributions)}</td>
                </tr>
              </tbody>
            </table>
            <p className="m-0 yds-event-detail__hint">{tariffBreakdown.weightNote}</p>
          </>
        ) : (
          <p className="m-0 yds-event-detail__hint">YDS 분해 불가 — 지표 미입력</p>
        )}
      </div>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">
          3. 코로나 vs 관세 쇼크 (각 최고 YDS 시점)
        </p>
        <p className="m-0 yds-event-detail__hint">
          코로나 {covidPeak?.maxYds}({covidPeak?.milestone}) · 관세 {tariffPeak?.maxYds}({tariffPeak?.milestone})
        </p>
        <table className="panic-validation-year-table yds-tariff-deep__diff-table">
          <thead>
            <tr>
              <th scope="col">지표</th>
              <th scope="col">관세</th>
              <th scope="col">코로나</th>
              <th scope="col">차이(관세−코로나)</th>
            </tr>
          </thead>
          <tbody>
            {indicatorDiff.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td className="font-mono tabular-nums">{formatNum(row.tariff)}</td>
                <td className="font-mono tabular-nums">{formatNum(row.covid)}</td>
                <td className="font-mono tabular-nums yds-tariff-deep__delta">{formatDelta(row.delta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <article className="yds-tariff-deep__interpret" aria-label="자동 해석">
        <p className="m-0 panic-validation-panel__h3">4. 자동 해석 — 관세 YDS가 높은 이유</p>
        <ol className="yds-tariff-deep__interpret-list">
          {interpretation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </article>

      <ul className="yds-tariff-deep__notes">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  )
}
