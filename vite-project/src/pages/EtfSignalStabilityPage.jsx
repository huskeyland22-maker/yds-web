import { useEffect, useMemo, useState } from "react"
import { SIGNAL_TRACK_PATH } from "../content/etfSignalTrack.js"
import { REGIME_LABEL, REGIME_ORDER } from "../content/etfSignalRegimeV3.js"
import { STABILITY_RULE, analyzeStability } from "../content/etfSignalStabilityV4.js"

const QQQ_PATH = "/data/qqq-daily-closes-v3.json"
const HORIZONS = [20, 60, 120]

function fmtPct(value, signed = true) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  const number = Number(value)
  const sign = signed && number > 0 ? "+" : ""
  return `${sign}${number.toFixed(2)}%`
}

function caution(complete) {
  return complete < STABILITY_RULE.smallSampleComplete ? " · 주의" : ""
}

export default function EtfSignalStabilityPage() {
  const [report, setReport] = useState(null)
  const [qqqBars, setQqqBars] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
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
    () => (report && qqqBars ? analyzeStability(report, qqqBars) : null),
    [report, qqqBars],
  )
  const rule = analysis?.rule

  return (
    <div className="yds-dbb yds-signal-track min-w-0 w-full">
      <header className="yds-dbb__hero">
        <p className="yds-dbb__kicker">ETF SIGNAL STABILITY</p>
        <h1 className="yds-dbb__title">ETF 신호 안정성 검증</h1>
        <p className="yds-dbb__lead">v3 국면 성과가 특정 연도나 같은 날 겹친 ETF 신호에 기대는지 보는 연구 화면입니다.</p>
      </header>

      <aside className="yds-dbb__notice" aria-label="분석 기준">
        <p>연구 전용입니다. v1·v2·v3 기록과 매수 카드, 매수 기록은 바꾸지 않습니다.</p>
        {analysis ? (
          <>
            <p>데이터 기준일 {analysis.qqqAsOf || "없음"}. 신호 {analysis.counts.total}건.</p>
            <p>{rule.period}</p>
            <p>{rule.cluster}</p>
            <p>{rule.independence}</p>
            <p>{rule.outlier}</p>
            <p>{rule.limit}</p>
            <p>국면 규칙은 v3와 같습니다. {analysis.regimeRule.bull}</p>
          </>
        ) : null}
      </aside>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}

      {analysis ? (
        <>
          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">전체 요약</h2>
            <p className="yds-signal-track__summary">
              신호 {analysis.signalSummary.signals}건 · 60일 완료 {analysis.signalSummary.horizons["60"].complete} · 미완료 {analysis.signalSummary.horizons["60"].incomplete} · 60일 가격 중앙값 {fmtPct(analysis.signalSummary.horizons["60"].priceMedian)}
            </p>
            <p className="yds-signal-track__summary">
              날짜 군집 {analysis.overlap.dates}개 · 완료 군집 {analysis.overlap.usableClusters} · 군집 60일 중앙값 {fmtPct(analysis.overlap.priceMedian)} · 단독 날짜 신호 {analysis.singleSummary.signals}건 · 단독 60일 중앙값 {fmtPct(analysis.singleSummary.horizons["60"].priceMedian)}
            </p>
          </section>

          <div className="yds-signal-track__filters" role="group" aria-label="상세 기간">
            {HORIZONS.map((days) => (
              <button
                key={days}
                type="button"
                className={`yds-signal-track__filter${horizon === days ? " is-on" : ""}`}
                onClick={() => setHorizon(days)}
              >
                {days}거래일
              </button>
            ))}
          </div>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">시간 구간별 결과</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">연도</th>
                    <th scope="col">신호</th>
                    <th scope="col">{horizon}일 완료</th>
                    <th scope="col">{horizon}일 미완료</th>
                    <th scope="col">가격 평균</th>
                    <th scope="col">가격 중앙값</th>
                    <th scope="col">양수 비율</th>
                    <th scope="col">하락 평균</th>
                    <th scope="col">하락 중앙값</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.periods.map((period) => {
                    const row = period.summary.horizons[String(horizon)]
                    return (
                      <tr key={period.year}>
                        <th scope="row">{period.year}{period.smallSample ? " · 주의" : ""}</th>
                        <td className="tabular-nums">{period.summary.signals}</td>
                        <td className="tabular-nums">{row.complete}{caution(row.complete)}</td>
                        <td className="tabular-nums">{row.incomplete}</td>
                        <td className="tabular-nums">{fmtPct(row.priceMean)}</td>
                        <td className="tabular-nums">{fmtPct(row.priceMedian)}</td>
                        <td className="tabular-nums">{fmtPct(row.positiveRate, false)}</td>
                        <td className="tabular-nums">{row.drawdownCount ? fmtPct(-row.drawdownMean) : "표본 없음"}</td>
                        <td className="tabular-nums">{row.drawdownCount ? fmtPct(-row.drawdownMedian) : "표본 없음"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">시장 국면별 안정성</h2>
            <p className="yds-dbb-card__hint">차이 표시는 60거래일 중앙값 기준입니다. 완료 30건이 안 되면 비교 불가로 둡니다.</p>
            {REGIME_ORDER.map((regime) => (
              <div key={regime} className="yds-dbb-research__scroll">
                <table className="yds-dbb-research__table yds-signal-track__table">
                  <caption>{REGIME_LABEL[regime]} {analysis.regimes[regime].total.signals}건</caption>
                  <thead>
                    <tr>
                      <th scope="col">연도</th>
                      <th scope="col">신호</th>
                      <th scope="col">비중</th>
                      <th scope="col">60일 완료</th>
                      <th scope="col">60일 중앙값</th>
                      <th scope="col">판정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.regimes[regime].years.map((row) => (
                      <tr key={`${regime}-${row.year}`}>
                        <th scope="row">{row.year}{row.smallSample ? " · 주의" : ""}</th>
                        <td className="tabular-nums">{row.summary.signals}{row.concentrated ? " · 집중" : ""}</td>
                        <td className="tabular-nums">{row.sharePct == null ? "표본 없음" : `${row.sharePct.toFixed(2)}%`}</td>
                        <td className="tabular-nums">{row.summary.horizons["60"].complete}</td>
                        <td className="tabular-nums">{fmtPct(row.summary.horizons["60"].priceMedian)}</td>
                        <td>{row.verdict.status}{row.verdict.gapPct == null ? "" : ` ${fmtPct(row.verdict.gapPct)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">날짜 중복 분석</h2>
            <p className="yds-signal-track__summary">
              둘 이상 ETF가 같은 날 신호를 낸 날 {analysis.overlap.multiDates}일 · 그 신호 {analysis.overlap.multiSignals}건 · 전체의 {analysis.overlap.multiSharePct == null ? "표본 없음" : `${analysis.overlap.multiSharePct.toFixed(2)}%`}
            </p>
            {analysis.overlap.largest ? (
              <p className="yds-signal-track__summary">
                가장 많이 겹친 날 {analysis.overlap.largest.date} · {analysis.overlap.largest.members}개 · {analysis.overlap.largest.symbols.join(", ")}
              </p>
            ) : null}
            <p className="yds-dbb-card__hint">
              신호별 60일 중앙값 {fmtPct(analysis.signalSummary.horizons["60"].priceMedian)} · 날짜 군집 60일 중앙값 {fmtPct(analysis.overlap.priceMedian)} · 군집 완료 {analysis.overlap.usableClusters} · 군집 미완료 {analysis.overlap.incompleteClusters}
            </p>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">종목별 성과</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">종목</th>
                    <th scope="col">신호</th>
                    <th scope="col">{horizon}일 완료</th>
                    <th scope="col">{horizon}일 미완료</th>
                    <th scope="col">가격 중앙값</th>
                    <th scope="col">양수 비율</th>
                    <th scope="col">하락 중앙값</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.symbols.map((row) => {
                    const horizonRow = row.horizons[String(horizon)]
                    return (
                      <tr key={row.symbol}>
                        <th scope="row">{row.symbol}<span className="yds-signal-track__name"> {row.themeShort}</span></th>
                        <td className="tabular-nums">{row.signals}</td>
                        <td className="tabular-nums">{horizonRow.complete}{caution(horizonRow.complete)}</td>
                        <td className="tabular-nums">{horizonRow.incomplete}</td>
                        <td className="tabular-nums">{fmtPct(horizonRow.priceMedian)}</td>
                        <td className="tabular-nums">{fmtPct(horizonRow.positiveRate, false)}</td>
                        <td className="tabular-nums">{horizonRow.drawdownCount ? fmtPct(-horizonRow.drawdownMedian) : "표본 없음"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
