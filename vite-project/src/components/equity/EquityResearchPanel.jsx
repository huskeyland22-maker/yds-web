import { useState } from "react"
import { EQUITY_RESEARCH_SUMMARY as study } from "../../content/equityResearchSummary.js"

function signedPct(value) {
  const number = Number(value)
  const sign = number > 0 ? "+" : ""
  return `${sign}${number.toFixed(2)}%`
}

function signedPp(value) {
  const number = Number(value)
  const sign = number > 0 ? "+" : ""
  return `${sign}${number.toFixed(2)}pp`
}

const HORIZONS = [
  ["T+20", "T20"],
  ["T+60", "T60"],
  ["T+120", "T120"],
]

export default function EquityResearchPanel() {
  const [open, setOpen] = useState(true)
  const low = study.buyLimitation
  const stats = study["T60 statistical"]
  return (
    <details
      className="yds-dbb-card yds-dbb-research mb-3"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="yds-dbb-section__title">과거 연구 기준</summary>
      <p className="yds-dbb-research__lead">개별주식 BUY 조건의 과거 연구 결과입니다.</p>
      <p className="yds-dbb__meta">
        {study.period} · 동일 조건 {study.episodes.toLocaleString("en-US")}건
      </p>
      <div className="yds-dbb-research__scroll">
        <table className="yds-dbb-research__table">
          <thead>
            <tr>
              <th scope="col">기간</th>
              <th scope="col">평균</th>
              <th scope="col">중앙값</th>
              <th scope="col">승률</th>
            </tr>
          </thead>
          <tbody>
            {HORIZONS.map(([label, key]) => {
              const row = study.buy[key]
              return (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  <td className="tabular-nums">{signedPct(row.mean)}</td>
                  <td className="tabular-nums">{signedPct(row.median)}</td>
                  <td className="tabular-nums">{row.winRate.toFixed(2)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="yds-dbb-card__hint">
        같은 종목·같은 수의 Random 평균 대비: T+20 {signedPp(study.difference.T20)} · T+60{" "}
        {signedPp(study.difference.T60)} · T+120 {signedPp(study.difference.T120)}
      </p>
      <p className="yds-dbb-card__hint">
        T+60 평균 차이 95% CI: +{stats.ciLow.toFixed(2)}~+{stats.ciHigh.toFixed(2)}pp · p={stats.pValue.toFixed(3)}
      </p>
      <p className="yds-dbb__meta">이 수치는 과거 동일 조건의 연구 통계이며, 현재 종목의 미래 수익률 예측이 아닙니다.</p>
      <div className="yds-dbb__notice" aria-label="연구 주의">
        <p>주의: 과거 BUY 사례에서도 이후 추가 하락이 흔했습니다.</p>
        <p>
          BUY 이후 60일 내 추가 저점은 평균 {low.postBuyLowMean.toFixed(2)}%, 중앙값 {low.postBuyLowMedian.toFixed(2)}%였습니다.
        </p>
        <p>따라서 BUY 신호가 즉시 저점 확정을 의미하지는 않습니다.</p>
        <p>과거 연구에서 깊은 하락 구간은 회복 신뢰도가 크게 낮았습니다.</p>
      </div>
      <p className="yds-dbb-card__hint">
        현재 연구에서는 {study.baseline.name}를 안정적으로 능가하는 범용 SELL 규칙이 확인되지 않았습니다.
      </p>
      <p className="yds-dbb-card__hint">자동 추가매수 규칙도 채택하지 않았습니다.</p>
      <p className="yds-dbb__meta">연구 비교 기준: {study.baseline.name}</p>
    </details>
  )
}
