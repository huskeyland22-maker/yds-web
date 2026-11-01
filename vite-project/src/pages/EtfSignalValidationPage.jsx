import { useEffect, useMemo, useState } from "react"
import { SIGNAL_TRACK_PATH } from "../content/etfSignalTrack.js"
import { REGIME_LABEL, REGIME_ORDER } from "../content/etfSignalRegimeV3.js"
import { VALIDATION_RULE, analyzeValidation, compareSplitMedian } from "../content/etfSignalValidationV5.js"

const QQQ_PATH = "/data/qqq-daily-closes-v3.json"
const AUX_HORIZONS = [20, 120]

function fmtPct(value, signed = true) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  const number = Number(value)
  const sign = signed && number > 0 ? "+" : ""
  return `${sign}${number.toFixed(2)}%`
}

function caution(complete) {
  return complete < VALIDATION_RULE.smallSampleComplete ? " · 주의" : ""
}

function HorizonCells({ row }) {
  return (
    <>
      <td className="tabular-nums">{row.complete}{caution(row.complete)}</td>
      <td className="tabular-nums">{row.incomplete}</td>
      <td className="tabular-nums">{fmtPct(row.priceMean)}</td>
      <td className="tabular-nums">{fmtPct(row.priceMedian)}</td>
      <td className="tabular-nums">{fmtPct(row.positiveRate, false)}</td>
      <td className="tabular-nums">{row.drawdownCount ? fmtPct(-row.drawdownMean) : "표본 없음"}</td>
      <td className="tabular-nums">{row.drawdownCount ? fmtPct(-row.drawdownMedian) : "표본 없음"}</td>
      <td className="tabular-nums">{row.totalCount}</td>
      <td className="tabular-nums">{fmtPct(row.totalMean)}</td>
      <td className="tabular-nums">{fmtPct(row.totalMedian)}</td>
    </>
  )
}

export default function EtfSignalValidationPage() {
  const [report, setReport] = useState(null)
  const [qqqBars, setQqqBars] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [aux, setAux] = useState(20)

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
    () => (report && qqqBars ? analyzeValidation(report, qqqBars) : null),
    [report, qqqBars],
  )
  const rule = analysis?.rule

  return (
    <div className="yds-dbb yds-signal-track min-w-0 w-full">
      <header className="yds-dbb__hero">
        <p className="yds-dbb__kicker">ETF SIGNAL VALIDATION</p>
        <h1 className="yds-dbb__title">ETF 신호 시간순 검증</h1>
        <p className="yds-dbb__lead">과거 구간에서 본 성과가 이후 구간에서도 비슷한지 확인하는 연구 화면입니다.</p>
      </header>

      <aside className="yds-dbb__notice" aria-label="분석 기준">
        <p>연구 전용입니다. v1부터 v4 기록과 매수 카드, 매수 기록은 바꾸지 않습니다.</p>
        {analysis ? (
          <>
            <p>
              데이터 기준일 {analysis.qqqAsOf || "없음"}. 학습 마지막 신호일 {analysis.trainEndDate || "없음"}. 검증 첫 신호일 {analysis.validationStartDate || "없음"}.
            </p>
            <p>
              신호 {analysis.counts.total}건 · 학습 {analysis.counts.train}건 · 검증 {analysis.counts.validation}건 · 학습 목표 {analysis.target}건.
            </p>
            <p>{rule.split}</p>
            <p>{rule.boundary}</p>
            <p>{rule.regime}</p>
            <p>{rule.independence}</p>
            <p>{rule.compare}</p>
            <p>{rule.environment}</p>
            <p>{rule.limit}</p>
          </>
        ) : null}
      </aside>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}

      {analysis ? (
        <>
          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">60거래일 비교</h2>
            <p className="yds-signal-track__summary">
              판정 {analysis.verdict.status}{analysis.verdict.gapPct == null ? "" : ` ${fmtPct(analysis.verdict.gapPct)}`}
            </p>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">구간</th>
                    <th scope="col">신호</th>
                    <th scope="col">신호일</th>
                    <th scope="col">시작</th>
                    <th scope="col">끝</th>
                    <th scope="col">완료</th>
                    <th scope="col">미완료</th>
                    <th scope="col">가격 평균</th>
                    <th scope="col">가격 중앙값</th>
                    <th scope="col">양수 비율</th>
                    <th scope="col">하락 평균</th>
                    <th scope="col">하락 중앙값</th>
                    <th scope="col">총수익 건수</th>
                    <th scope="col">총수익 평균</th>
                    <th scope="col">총수익 중앙값</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["학습", analysis.train],
                    ["검증", analysis.validation],
                  ].map(([label, side]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td className="tabular-nums">{side.signals}</td>
                      <td className="tabular-nums">{side.dates}</td>
                      <td>{side.startDate || "없음"}</td>
                      <td>{side.endDate || "없음"}</td>
                      <HorizonCells row={side.summary.horizons["60"]} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">{aux}거래일 보조 비교</h2>
            <div className="yds-signal-track__filters" role="group" aria-label="보조 기간">
              {AUX_HORIZONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  className={`yds-signal-track__filter${aux === days ? " is-on" : ""}`}
                  onClick={() => setAux(days)}
                >
                  {days}거래일
                </button>
              ))}
            </div>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">구간</th>
                    <th scope="col">완료</th>
                    <th scope="col">미완료</th>
                    <th scope="col">가격 평균</th>
                    <th scope="col">가격 중앙값</th>
                    <th scope="col">양수 비율</th>
                    <th scope="col">하락 평균</th>
                    <th scope="col">하락 중앙값</th>
                    <th scope="col">총수익 건수</th>
                    <th scope="col">총수익 평균</th>
                    <th scope="col">총수익 중앙값</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["학습", analysis.train],
                    ["검증", analysis.validation],
                  ].map(([label, side]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <HorizonCells row={side.summary.horizons[String(aux)]} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">시장 국면별 60거래일</h2>
            <p className="yds-dbb-card__hint">
              {analysis.environment.different
                ? "학습 구간과 검증 구간의 국면 비중이 10%p 이상 다릅니다. 같은 시장 환경의 반복으로 보지 않습니다."
                : "표시한 국면 비중 차이는 10%p 미만입니다."}
            </p>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">국면</th>
                    <th scope="col">학습 비중</th>
                    <th scope="col">검증 비중</th>
                    <th scope="col">비중 차이</th>
                    <th scope="col">학습 신호</th>
                    <th scope="col">학습 완료</th>
                    <th scope="col">학습 중앙값</th>
                    <th scope="col">검증 신호</th>
                    <th scope="col">검증 완료</th>
                    <th scope="col">검증 중앙값</th>
                    <th scope="col">성과 판정</th>
                  </tr>
                </thead>
                <tbody>
                  {REGIME_ORDER.map((regime) => {
                    const gap = analysis.environment.gaps.find((row) => row.regime === regime)
                    const trainRow = analysis.train.regimes[regime]
                    const validationRow = analysis.validation.regimes[regime]
                    const verdict = compareSplitMedian(trainRow, validationRow)
                    return (
                      <tr key={regime}>
                        <th scope="row">{REGIME_LABEL[regime]}</th>
                        <td className="tabular-nums">{gap.trainShare == null ? "표본 없음" : `${gap.trainShare.toFixed(2)}%`}</td>
                        <td className="tabular-nums">{gap.validationShare == null ? "표본 없음" : `${gap.validationShare.toFixed(2)}%`}</td>
                        <td className="tabular-nums">{gap.gapPct == null ? "표본 없음" : fmtPct(gap.gapPct)}{gap.different ? " · 환경 차이" : ""}</td>
                        <td className="tabular-nums">{trainRow.signals}</td>
                        <td className="tabular-nums">{trainRow.horizons["60"].complete}{caution(trainRow.horizons["60"].complete)}</td>
                        <td className="tabular-nums">{fmtPct(trainRow.horizons["60"].priceMedian)}</td>
                        <td className="tabular-nums">{validationRow.signals}</td>
                        <td className="tabular-nums">{validationRow.horizons["60"].complete}{caution(validationRow.horizons["60"].complete)}</td>
                        <td className="tabular-nums">{fmtPct(validationRow.horizons["60"].priceMedian)}</td>
                        <td>{verdict.status}{verdict.gapPct == null ? "" : ` ${fmtPct(verdict.gapPct)}`}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">연도·종목 쏠림</h2>
            <p className="yds-signal-track__summary">
              학습에서 가장 많은 연도 {analysis.train.yearLeader.key || "없음"} {analysis.train.yearLeader.sharePct == null ? "" : `${analysis.train.yearLeader.sharePct.toFixed(2)}%`}{analysis.train.yearLeader.concentrated ? " · 집중" : ""}. 검증에서 가장 많은 연도 {analysis.validation.yearLeader.key || "없음"} {analysis.validation.yearLeader.sharePct == null ? "" : `${analysis.validation.yearLeader.sharePct.toFixed(2)}%`}{analysis.validation.yearLeader.concentrated ? " · 집중" : ""}.
            </p>
            <p className="yds-signal-track__summary">
              학습에서 가장 많은 ETF {analysis.train.etfLeader.key || "없음"} {analysis.train.etfLeader.sharePct == null ? "" : `${analysis.train.etfLeader.sharePct.toFixed(2)}%`}. 검증에서 가장 많은 ETF {analysis.validation.etfLeader.key || "없음"} {analysis.validation.etfLeader.sharePct == null ? "" : `${analysis.validation.etfLeader.sharePct.toFixed(2)}%`}.
            </p>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">구간</th>
                    <th scope="col">연도</th>
                    <th scope="col">신호</th>
                    <th scope="col">비중</th>
                    <th scope="col">60일 완료</th>
                    <th scope="col">60일 중앙값</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["학습", analysis.train],
                    ["검증", analysis.validation],
                  ].flatMap(([label, side]) => side.years.map((row) => (
                    <tr key={`${label}-${row.year}`}>
                      <th scope="row">{label}</th>
                      <td>{row.year}{row.smallSample ? " · 주의" : ""}</td>
                      <td className="tabular-nums">{row.signals}</td>
                      <td className="tabular-nums">{row.sharePct == null ? "표본 없음" : `${row.sharePct.toFixed(2)}%`}</td>
                      <td className="tabular-nums">{row.summary.horizons["60"].complete}</td>
                      <td className="tabular-nums">{fmtPct(row.summary.horizons["60"].priceMedian)}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">종목별 60거래일</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">종목</th>
                    <th scope="col">학습 신호</th>
                    <th scope="col">학습 완료</th>
                    <th scope="col">학습 중앙값</th>
                    <th scope="col">검증 신호</th>
                    <th scope="col">검증 완료</th>
                    <th scope="col">검증 중앙값</th>
                    <th scope="col">판정</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.train.symbols.map((trainRow, index) => {
                    const validationRow = analysis.validation.symbols[index]
                    const verdict = compareSplitMedian(trainRow, validationRow)
                    return (
                      <tr key={trainRow.symbol}>
                        <th scope="row">{trainRow.symbol}<span className="yds-signal-track__name"> {trainRow.themeShort}</span></th>
                        <td className="tabular-nums">{trainRow.signals}</td>
                        <td className="tabular-nums">{trainRow.horizons["60"].complete}{caution(trainRow.horizons["60"].complete)}</td>
                        <td className="tabular-nums">{fmtPct(trainRow.horizons["60"].priceMedian)}</td>
                        <td className="tabular-nums">{validationRow.signals}</td>
                        <td className="tabular-nums">{validationRow.horizons["60"].complete}{caution(validationRow.horizons["60"].complete)}</td>
                        <td className="tabular-nums">{fmtPct(validationRow.horizons["60"].priceMedian)}</td>
                        <td>{verdict.status}{verdict.gapPct == null ? "" : ` ${fmtPct(verdict.gapPct)}`}</td>
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
