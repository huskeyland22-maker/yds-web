import { useEffect, useMemo, useState } from "react"
import { SIGNAL_TRACK_PATH } from "../content/etfSignalTrack.js"
import { COMPARE_HORIZONS, compareSignalReport } from "../content/etfSignalCompare.js"

function fmtPct(value, signed = true) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  const number = Number(value)
  const sign = signed && number > 0 ? "+" : ""
  return `${sign}${number.toFixed(2)}%`
}

function fmtDays(value) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  const number = Number(value)
  const text = Number.isInteger(number) ? String(number) : number.toFixed(2)
  return `${text}거래일`
}

function HorizonStats({ row, days }) {
  const horizon = row.horizons[String(days)]
  return (
    <>
      <td className="tabular-nums">{horizon.complete}</td>
      <td className="tabular-nums">{horizon.incomplete}</td>
      <td className="tabular-nums">{fmtPct(horizon.priceMean)}</td>
      <td className="tabular-nums">{fmtPct(horizon.priceMedian)}</td>
      <td className="tabular-nums">{fmtPct(horizon.positiveRate, false)}</td>
      <td className="tabular-nums">{horizon.drawdownCount ? fmtPct(-horizon.drawdownMean) : "표본 없음"}</td>
      <td className="tabular-nums">{horizon.drawdownCount ? fmtPct(-horizon.drawdownMedian) : "표본 없음"}</td>
      <td className="tabular-nums">{horizon.totalCount}</td>
      <td className="tabular-nums">{fmtPct(horizon.totalMean)}</td>
      <td className="tabular-nums">{fmtPct(horizon.totalMedian)}</td>
    </>
  )
}

export default function EtfSignalComparePage() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [horizon, setHorizon] = useState(60)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(SIGNAL_TRACK_PATH, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error("v1 신호 기록을 불러오지 못했습니다.")
        return res.json()
      })
      .then((json) => setReport(json))
      .catch((err) => {
        if (err?.name === "AbortError") return
        setError(err?.message || "v1 신호 기록을 불러오지 못했습니다.")
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [])

  const compared = useMemo(() => (report ? compareSignalReport(report) : null), [report])
  const basis = compared?.basis

  return (
    <div className="yds-dbb yds-signal-track min-w-0 w-full">
      <header className="yds-dbb__hero">
        <p className="yds-dbb__kicker">ETF SIGNAL COMPARE</p>
        <h1 className="yds-dbb__title">ETF 신호 성과 비교</h1>
        <p className="yds-dbb__lead">v1에 기록된 ETF 매수 신호를 종목별로 모아 비교하는 연구 화면입니다.</p>
      </header>

      <aside className="yds-dbb__notice" aria-label="비교 기준">
        <p>연구 전용입니다. v1 신호 기록과 매수 카드, 매수 기록은 바꾸지 않습니다.</p>
        {basis ? (
          <>
            <p>{basis.sample}</p>
            <p>{basis.size}</p>
            <p>{basis.overlap}</p>
            <p>{basis.sort}</p>
          </>
        ) : null}
      </aside>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}

      {compared ? (
        <>
          <p className="yds-signal-track__summary">
            비교 종목 {compared.rows.length}개 · 신호 합계 {compared.episodes}건 · 정렬 기준 60거래일 가격 수익률 중앙값
          </p>
          <div className="yds-signal-track__filters" role="group" aria-label="상세 기간">
            {COMPARE_HORIZONS.map((days) => (
              <button
                key={days}
                type="button"
                className={`yds-signal-track__filter${horizon === days ? " is-on" : ""}`}
                onClick={() => setHorizon(days)}
              >
                {days}거래일 상세
              </button>
            ))}
          </div>
          <div className="yds-dbb-research__scroll">
            <table className="yds-dbb-research__table yds-signal-track__table">
              <thead>
                <tr>
                  <th scope="col">종목</th>
                  <th scope="col">신호</th>
                  <th scope="col">60일 완료</th>
                  <th scope="col">{horizon}일 완료</th>
                  <th scope="col">{horizon}일 미완료</th>
                  <th scope="col">{horizon}일 가격 평균</th>
                  <th scope="col">{horizon}일 가격 중앙값</th>
                  <th scope="col">{horizon}일 양수 비율</th>
                  <th scope="col">{horizon}일 하락 평균</th>
                  <th scope="col">{horizon}일 하락 중앙값</th>
                  <th scope="col">{horizon}일 총수익 건수</th>
                  <th scope="col">{horizon}일 총수익 평균</th>
                  <th scope="col">{horizon}일 총수익 중앙값</th>
                  <th scope="col">회복 중앙값</th>
                </tr>
              </thead>
              <tbody>
                {compared.rows.map((row) => (
                  <tr key={row.symbol}>
                    <th scope="row">
                      {row.symbol}
                      <span className="yds-signal-track__name"> {row.themeShort}</span>
                    </th>
                    <td className="tabular-nums">{row.signals}</td>
                    <td className="tabular-nums">{row.horizons["60"].complete}</td>
                    <HorizonStats row={row} days={horizon} />
                    <td className="tabular-nums">
                      {fmtDays(row.recoveryMedian)}
                      <span className="yds-signal-track__name"> {row.recoveryCount}건</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="yds-dbb-card__hint">
            가격 수익률과 분배금을 반영한 총수익률은 별도 열입니다. 총수익률을 계산할 수 없는 신호는 총수익 평균에 넣지 않습니다.
          </p>
        </>
      ) : null}
    </div>
  )
}
