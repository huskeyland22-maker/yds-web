import { useEffect, useState } from "react"
import { CHART_QUALITY_V9_BASIS, CHART_QUALITY_V9_PATH } from "../content/dbbChartQualityV9.js"

function fmtPct(value, signed = true) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  const number = Number(value)
  const sign = signed && number > 0 ? "+" : ""
  return `${sign}${number.toFixed(2)}%`
}

function fmtPp(value) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  const number = Number(value)
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%p`
}

function bootLabel(boot) {
  if (!boot || boot.status !== "ok") return boot?.status || "유보"
  return `${fmtPct(boot.lo)}~${fmtPct(boot.hi)}`
}

export default function DbbChartQualityV9Page() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(CHART_QUALITY_V9_PATH, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error("강건성 검증 자료를 불러오지 못했습니다.")
        return res.json()
      })
      .then((json) => setReport(json))
      .catch((err) => {
        if (err?.name === "AbortError") return
        setError(err?.message || "연구 자료를 불러오지 못했습니다.")
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [])

  return (
    <div className="yds-dbb yds-signal-track min-w-0 w-full">
      <header className="yds-dbb__hero">
        <p className="yds-dbb__kicker">DBB STRENGTH V9</p>
        <h1 className="yds-dbb__title">{CHART_QUALITY_V9_BASIS.title}</h1>
        <p className="yds-dbb__lead">4개 충족 우위가 종목·국면·시장에 의존하는지 재검증합니다.</p>
      </header>

      <aside className="yds-dbb__notice" aria-label="실험 설계">
        <p>{CHART_QUALITY_V9_BASIS.researchOnly}</p>
        {report ? (
          <>
            <p>
              데이터 기준일 {report.asOf || "없음"}. 신호 {report.counts?.signals}건 · 3개 {report.counts?.three} · 4개{" "}
              {report.counts?.four}. 학습 ~{report.split?.trainEndDate} · 검증 {report.split?.validationStartDate}~. v8 재현{" "}
              {report.v8Match?.ok ? "일치" : "불일치"}.
            </p>
            <p>{CHART_QUALITY_V9_BASIS.studies}</p>
            <p>{CHART_QUALITY_V9_BASIS.regime}</p>
            <p>{CHART_QUALITY_V9_BASIS.caution}</p>
          </>
        ) : null}
      </aside>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}

      {report && !report.aborted ? (
        <>
          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">연구 A · 종목 편중 (검증 60일 leave-one-out)</h2>
            <p className="yds-signal-track__summary">
              기준 중앙값 Δ {fmtPp(report.studyA.leaveOutValidation.baseline.priceMedianPp)} · 범위{" "}
              {fmtPp(report.studyA.leaveOutValidation.summary.priceMedianPpMin)}~
              {fmtPp(report.studyA.leaveOutValidation.summary.priceMedianPpMax)} · 중앙값 부호반전{" "}
              {report.studyA.leaveOutValidation.summary.flipMedianCount} · 성공률 부호반전{" "}
              {report.studyA.leaveOutValidation.summary.flipSuccessCount}
            </p>
            <p className="yds-signal-track__summary">
              상위 기여 3종목 제외({report.studyA.dropTop3Contributors.dropped.join(", ")}): 중앙값 Δ{" "}
              {fmtPp(report.studyA.dropTop3Contributors.afterDrop.priceMedianPp)} · 성공률 Δ{" "}
              {fmtPp(report.studyA.dropTop3Contributors.afterDrop.successRatePp)}
            </p>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">종목</th>
                    <th scope="col">제외 후 중앙값Δ</th>
                    <th scope="col">성공률Δ</th>
                    <th scope="col">중앙값 반전</th>
                    <th scope="col">성공률 반전</th>
                  </tr>
                </thead>
                <tbody>
                  {report.studyA.leaveOutValidation.symbols.slice(0, 12).map((row) => (
                    <tr key={row.symbol}>
                      <th scope="row">{row.symbol}</th>
                      <td className="tabular-nums">{fmtPp(row.priceMedianPp)}</td>
                      <td className="tabular-nums">{fmtPp(row.successRatePp)}</td>
                      <td>{row.flipMedian ? "예" : "아니오"}</td>
                      <td>{row.flipSuccess ? "예" : "아니오"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">연구 B · 시장 국면 (60일)</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">국면</th>
                    <th scope="col">3개 / 4개</th>
                    <th scope="col">성공률 Δ</th>
                    <th scope="col">중앙값 Δ</th>
                    <th scope="col">초과 Δ</th>
                    <th scope="col">MAE Δ</th>
                    <th scope="col">표시</th>
                  </tr>
                </thead>
                <tbody>
                  {["bull", "bear", "sideways", "unclassified"].map((key) => {
                    const block = report.studyB.regimes[key]
                    const diff = block.byHorizon["60"].diff
                    return (
                      <tr key={key}>
                        <th scope="row">{block.label}</th>
                        <td className="tabular-nums">
                          {block.n3} / {block.n4}
                        </td>
                        <td className="tabular-nums">{fmtPp(diff.successRatePp)}</td>
                        <td className="tabular-nums">{fmtPp(diff.priceMedianPp)}</td>
                        <td className="tabular-nums">{fmtPp(diff.excessQqqPp)}</td>
                        <td className="tabular-nums">{fmtPp(diff.maeMedianPp)}</td>
                        <td>{block.exploratory ? "탐색적" : "본분석"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">연구 C · QQQ 초과수익 (60일)</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">구간</th>
                    <th scope="col">3개 초과 중앙값</th>
                    <th scope="col">4개 초과 중앙값</th>
                    <th scope="col">차이</th>
                    <th scope="col">동일일 초과Δ</th>
                    <th scope="col">부트스트랩 CI</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["전체", report.studyC.overall60, report.studyC.sameDayExcess.overall],
                    ["학습", report.studyC.train60, report.studyC.sameDayExcess.train],
                    ["검증", report.studyC.validation60, report.studyC.sameDayExcess.validation],
                  ].map(([label, block, sameDay]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td className="tabular-nums">{fmtPct(block.three.excessMedian)}</td>
                      <td className="tabular-nums">{fmtPct(block.four.excessMedian)}</td>
                      <td className="tabular-nums">{fmtPp(block.diffPp)}</td>
                      <td className="tabular-nums">{fmtPct(sameDay.excessGapMedian)}</td>
                      <td className="tabular-nums">{bootLabel(sameDay.bootstrapExcess)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="yds-signal-track__summary">
              v8 게시 전체 초과차 {fmtPp(report.studyC.v8PublishedExcessDiffPp)} → 재현{" "}
              {fmtPp(report.studyC.reproducedExcessDiffPp)}
            </p>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">연구 D · 날짜 단위 (60일 수익률)</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">구간</th>
                    <th scope="col">신호일</th>
                    <th scope="col">쌍</th>
                    <th scope="col">3만 / 4만</th>
                    <th scope="col">중앙값 Δ</th>
                    <th scope="col">부트스트랩 CI</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["전체", report.studyD.overall],
                    ["학습", report.studyD.train],
                    ["검증", report.studyD.validation],
                  ].map(([label, block]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td className="tabular-nums">{block.dates}</td>
                      <td className="tabular-nums">{block.pairedDates}</td>
                      <td className="tabular-nums">
                        {block.only3Dates} / {block.only4Dates}
                      </td>
                      <td className="tabular-nums">{fmtPct(block.returnGapMedian)}</td>
                      <td className="tabular-nums">{bootLabel(block.bootstrapReturn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="yds-signal-track__summary">{report.studyD.method}</p>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">판정</h2>
            <p className="yds-signal-track__summary">
              <strong>{report.verdict.level}</strong> — {report.verdict.reason}
            </p>
            <ul className="yds-signal-track__list">
              {(report.verdict.checks || []).map((check) => (
                <li key={check.id}>
                  {check.ok ? "충족" : "미충족"} · {check.detail}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {report?.aborted ? (
        <section className="yds-dbb-section">
          <h2 className="yds-dbb-section__title">분석 중단</h2>
          <p className="yds-signal-track__summary">
            {report.verdict.level} — {report.verdict.reason}
          </p>
        </section>
      ) : null}
    </div>
  )
}
