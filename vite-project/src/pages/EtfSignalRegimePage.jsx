import { useEffect, useMemo, useState } from "react"
import { SIGNAL_TRACK_PATH } from "../content/etfSignalTrack.js"
import { REGIME_LABEL, REGIME_ORDER, REGIME_RULE, analyzeSignalRegimes } from "../content/etfSignalRegimeV3.js"

const QQQ_PATH = "/data/qqq-daily-closes-v3.json"

function fmtPct(value, signed = true) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  const number = Number(value)
  const sign = signed && number > 0 ? "+" : ""
  return `${sign}${number.toFixed(2)}%`
}

function HorizonStats({ row, days }) {
  const horizon = row.horizons[String(days)]
  const small = horizon.complete < REGIME_RULE.smallSampleComplete
  return (
    <>
      <td className="tabular-nums">{horizon.complete}{small ? " · 주의" : ""}</td>
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

export default function EtfSignalRegimePage() {
  const [report, setReport] = useState(null)
  const [qqqBars, setQqqBars] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [regime, setRegime] = useState("bull")
  const [horizon, setHorizon] = useState(60)

  useEffect(() => {
    const ctrl = new AbortController()
    Promise.all([
      fetch(SIGNAL_TRACK_PATH, { signal: ctrl.signal }).then((res) => {
        if (!res.ok) throw new Error("v1 신호 기록을 불러오지 못했습니다.")
        return res.json()
      }),
      fetch(QQQ_PATH, { signal: ctrl.signal }).then((res) => {
        if (!res.ok) throw new Error("QQQ 일봉을 불러오지 못했습니다.")
        return res.json()
      }),
    ])
      .then(([signals, qqq]) => {
        setReport(signals)
        setQqqBars(Array.isArray(qqq?.bars) ? qqq.bars : qqq)
      })
      .catch((err) => {
        if (err?.name === "AbortError") return
        setError(err?.message || "연구 자료를 불러오지 못했습니다.")
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [])

  const analysis = useMemo(
    () => (report && qqqBars ? analyzeSignalRegimes(report, qqqBars) : null),
    [report, qqqBars],
  )
  const selected = analysis?.regimes?.[regime]
  const rule = analysis?.rule

  return (
    <div className="yds-dbb yds-signal-track min-w-0 w-full">
      <header className="yds-dbb__hero">
        <p className="yds-dbb__kicker">ETF SIGNAL REGIME</p>
        <h1 className="yds-dbb__title">ETF 시장 국면별 성과</h1>
        <p className="yds-dbb__lead">v1 신호를 신호일 당시의 QQQ 국면으로 나누어 보는 연구 화면입니다.</p>
      </header>

      <aside className="yds-dbb__notice" aria-label="국면 분류 기준">
        <p>연구 전용입니다. v1·v2 기록과 매수 카드, 매수 기록은 바꾸지 않습니다.</p>
        {rule ? (
          <>
            <p>기준 시장: {rule.market} {rule.price}. 데이터 기준일 {analysis.qqqAsOf || "없음"} · QQQ {analysis.qqqBars}거래일.</p>
            <p>{rule.bull}</p>
            <p>{rule.bear}</p>
            <p>{rule.sideways}</p>
            <p>{rule.unclassified}</p>
            <p>{rule.asOf}</p>
            <p>{rule.fixed}</p>
            <p>ETF별 신호일이 겹칠 수 있어 전체 합계를 서로 독립인 표본으로 보지 않습니다. 60거래일 완료가 {rule.smallSampleComplete}건 미만이면 주의로 표시합니다.</p>
          </>
        ) : null}
      </aside>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}

      {analysis && selected ? (
        <>
          <p className="yds-signal-track__summary">
            전체 {analysis.counts.total}건 · 상승장 {analysis.counts.bull} · 하락장 {analysis.counts.bear} · 횡보장 {analysis.counts.sideways} · 분류 불가 {analysis.counts.unclassified}
          </p>
          <div className="yds-signal-track__filters" role="group" aria-label="시장 국면">
            {REGIME_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className={`yds-signal-track__filter${regime === id ? " is-on" : ""}`}
                onClick={() => setRegime(id)}
              >
                {REGIME_LABEL[id]} {analysis.counts[id]}
              </button>
            ))}
          </div>
          <div className="yds-signal-track__filters" role="group" aria-label="상세 기간">
            {[20, 60, 120].map((days) => (
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
          {selected.smallSample ? (
            <p className="yds-dbb__status">이 국면의 60거래일 완료 건수가 {REGIME_RULE.smallSampleComplete}건 미만입니다. 평균과 중앙값을 크게 해석하지 않습니다.</p>
          ) : null}
          <p className="yds-signal-track__summary">
            {REGIME_LABEL[regime]} 전체 신호 {selected.total.signals}건 · 60일 완료 {selected.total.horizons["60"].complete} · 60일 미완료 {selected.total.horizons["60"].incomplete} · 60일 가격 중앙값 {fmtPct(selected.total.horizons["60"].priceMedian)}
          </p>
          <div className="yds-dbb-research__scroll">
            <table className="yds-dbb-research__table yds-signal-track__table">
              <thead>
                <tr>
                  <th scope="col">종목</th>
                  <th scope="col">신호</th>
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
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">전체</th>
                  <td className="tabular-nums">{selected.total.signals}</td>
                  <HorizonStats row={selected.total} days={horizon} />
                </tr>
                {selected.rows.map((row) => (
                  <tr key={row.symbol}>
                    <th scope="row">
                      {row.symbol}
                      <span className="yds-signal-track__name"> {row.themeShort}</span>
                    </th>
                    <td className="tabular-nums">{row.signals}</td>
                    <HorizonStats row={row} days={horizon} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
