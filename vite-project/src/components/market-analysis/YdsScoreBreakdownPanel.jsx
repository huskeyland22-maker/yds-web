import { useMemo } from "react"
import { buildYdsScoreVerification } from "../../trading-zone/ydsScoreBreakdown.js"

const ROWS = [
  { key: "vix", label: "VIX" },
  { key: "cnn", label: "CNN" },
  { key: "bofa", label: "BofA" },
  { key: "putCall", label: "P/C" },
  { key: "highYield", label: "HY" },
]

function fmt(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return "—"
  return `${Math.round(v * 10) / 10}`
}

function fmtSigned(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return "—"
  return `${v > 0 ? "+" : ""}${Math.round(v * 10) / 10}`
}

/**
 * YDS 총점 산출·변동 근거 (getFinalScore 경로)
 * @param {{ panicData?: object | null; historyRows?: object[] }} props
 */
export default function YdsScoreBreakdownPanel({ panicData = null, historyRows = [] }) {
  const model = useMemo(
    () => buildYdsScoreVerification(panicData, historyRows),
    [panicData, historyRows],
  )

  if (!model?.today?.computable) {
    return <p className="yds-score-breakdown__empty">핵심 5지표 입력 후 점수 산출 근거를 표시합니다.</p>
  }

  const { today, delta, nearInterest, moveNote } = model

  return (
    <div className="yds-score-breakdown">
      <p className="yds-score-breakdown__formula">
        단기 {today.shortScore} × {Math.round(today.weights.wShort * 100)}% + 중기 {today.midScore} ×{" "}
        {Math.round(today.weights.wMid * 100)}% = <strong>{today.finalYds}</strong>
      </p>
      <p className="yds-score-breakdown__note">{today.weightNote}</p>

      <table className="yds-score-breakdown__table">
        <thead>
          <tr>
            <th scope="col">지표</th>
            <th scope="col">입력값</th>
            <th scope="col">성분점수</th>
            <th scope="col">기여(p)</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ key, label }) => {
            const inputKey =
              key === "cnn" ? "fearGreed" : key === "highYield" ? "highYield" : key
            return (
              <tr key={key}>
                <td>{label}</td>
                <td className="font-mono tabular-nums">{fmt(today.inputs?.[inputKey])}</td>
                <td className="font-mono tabular-nums">{fmt(today.componentScores?.[key])}</td>
                <td className="font-mono tabular-nums">{fmt(today.contributions?.[key])}</td>
              </tr>
            )
          })}
          <tr className="yds-score-breakdown__sum">
            <td colSpan={3}>합계</td>
            <td className="font-mono tabular-nums">{fmt(today.sumContributions)}</td>
          </tr>
        </tbody>
      </table>

      {delta.computable ? (
        <div className="yds-score-breakdown__delta">
          <p className="yds-score-breakdown__delta-head">
            전일 {delta.prev.finalYds} → 당일 {delta.today.finalYds}{" "}
            <span className={delta.finalDelta >= 0 ? "is-up" : "is-down"}>
              ({fmtSigned(delta.finalDelta)})
            </span>
          </p>
          <ul className="yds-score-breakdown__delta-list">
            {delta.drivers.map((d) => (
              <li key={d.key}>
                {d.label}: {fmt(d.prevContribution)} → {fmt(d.todayContribution)} ({fmtSigned(d.delta)}p)
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {today.insights?.length ? (
        <ul className="yds-score-breakdown__insights">
          {today.insights.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      {nearInterest ? (
        <p className="yds-score-breakdown__flag">
          관심구간(40+) 임박 — VIX·CNN 변화가 누적되면 구간 전환 가능
        </p>
      ) : null}

      <p className="yds-score-breakdown__footnote">{moveNote}</p>
    </div>
  )
}
