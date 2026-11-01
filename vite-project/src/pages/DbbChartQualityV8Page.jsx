import { useEffect, useState } from "react"
import { CHART_QUALITY_V8_BASIS, CHART_QUALITY_V8_PATH } from "../content/dbbChartQualityV8.js"

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

function fmtCi(ci) {
  if (!ci || ci.lo == null || ci.hi == null) return "—"
  return `${ci.lo.toFixed(1)}~${ci.hi.toFixed(1)}%`
}

export default function DbbChartQualityV8Page() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(CHART_QUALITY_V8_PATH, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error("신호 강도 검증 자료를 불러오지 못했습니다.")
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
        <p className="yds-dbb__kicker">DBB STRENGTH V8</p>
        <h1 className="yds-dbb__title">{CHART_QUALITY_V8_BASIS.title}</h1>
        <p className="yds-dbb__lead">네 조건 중 3개 충족과 4개 충족 신호의 성과·위험을 비교합니다.</p>
      </header>

      <aside className="yds-dbb__notice" aria-label="실험 설계">
        <p>{CHART_QUALITY_V8_BASIS.researchOnly}</p>
        {report ? (
          <>
            <p>
              데이터 기준일 {report.asOf || "없음"}. 신호 {report.counts.signals}건 · 3개 {report.counts.three}건 · 4개{" "}
              {report.counts.four}건 · 분류불가 {report.counts.unclassified}건. 학습 ~{report.split?.trainEndDate} · 검증{" "}
              {report.split?.validationStartDate}~.
            </p>
            <p>
              조건 재검증: 표본 {report.verification?.sampled} · 일치 {report.verification?.matched} · 불일치{" "}
              {report.verification?.mismatched}
              {report.verification?.ok ? " (일치)" : ""}.
            </p>
            <p>{CHART_QUALITY_V8_BASIS.compare}</p>
            <p>{CHART_QUALITY_V8_BASIS.success}</p>
            <p>{CHART_QUALITY_V8_BASIS.caution}</p>
          </>
        ) : null}
      </aside>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}

      {report ? (
        <>
          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 A · 신호 분포</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">구분</th>
                    <th scope="col">신호 수</th>
                    <th scope="col">비중</th>
                    <th scope="col">분류 불가</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">3개 충족</th>
                    <td className="tabular-nums">{report.tableA.three.signals}</td>
                    <td className="tabular-nums">{fmtPct(report.tableA.three.sharePct, false)}</td>
                    <td className="tabular-nums" rowSpan={2}>
                      {report.tableA.unclassified}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">4개 충족</th>
                    <td className="tabular-nums">{report.tableA.four.signals}</td>
                    <td className="tabular-nums">{fmtPct(report.tableA.four.sharePct, false)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 B · 기간별 성과 (전체)</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">기간</th>
                    <th scope="col">그룹</th>
                    <th scope="col">완성</th>
                    <th scope="col">성공률</th>
                    <th scope="col">CI</th>
                    <th scope="col">중앙값</th>
                    <th scope="col">평균</th>
                    <th scope="col">MAE 중앙값</th>
                  </tr>
                </thead>
                <tbody>
                  {report.tableB.map((row) => (
                    <tr key={`${row.horizon}-${row.group}`}>
                      <th scope="row">{row.horizon}일</th>
                      <td>{row.group}개</td>
                      <td className="tabular-nums">{row.complete}</td>
                      <td className="tabular-nums">{fmtPct(row.successRate, false)}</td>
                      <td className="tabular-nums">{fmtCi(row.successRateCi)}</td>
                      <td className="tabular-nums">{fmtPct(row.priceMedian)}</td>
                      <td className="tabular-nums">{fmtPct(row.priceMean)}</td>
                      <td className="tabular-nums">{fmtPct(row.maeMedian, false)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 C · 4개 − 3개 차이</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">기간</th>
                    <th scope="col">성공률 Δ</th>
                    <th scope="col">중앙값 Δ</th>
                    <th scope="col">평균 Δ</th>
                    <th scope="col">MAE Δ</th>
                    <th scope="col">동일일 중앙값Δ</th>
                    <th scope="col">부트스트랩 CI</th>
                    <th scope="col">n3 / n4</th>
                  </tr>
                </thead>
                <tbody>
                  {["20", "60", "120"].map((key) => {
                    const block = report.tableC[key]
                    const boot = block.bootstrapReturn
                    return (
                      <tr key={key}>
                        <th scope="row">{key}일</th>
                        <td className="tabular-nums">{fmtPp(block.successRatePp)}</td>
                        <td className="tabular-nums">{fmtPp(block.priceMedianPp)}</td>
                        <td className="tabular-nums">{fmtPp(block.priceMeanPp)}</td>
                        <td className="tabular-nums">{fmtPp(block.maeMedianPp)}</td>
                        <td className="tabular-nums">{fmtPct(block.sameDay?.returnGapMedian)}</td>
                        <td className="tabular-nums">
                          {boot?.status === "ok" ? `${fmtPct(boot.lo)}~${fmtPct(boot.hi)}` : boot?.status || "유보"}
                        </td>
                        <td className="tabular-nums">
                          {block.n3} / {block.n4}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="yds-signal-track__summary">MAE Δ가 양수이면 4개 충족 그룹의 불리한 움직임이 더 큽니다.</p>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">학습 · 검증 (60일)</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">구간</th>
                    <th scope="col">성공률 Δ</th>
                    <th scope="col">중앙값 Δ</th>
                    <th scope="col">MAE Δ</th>
                    <th scope="col">동일일 쌍</th>
                    <th scope="col">동일일 중앙값Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["학습", report.train.byHorizon["60"]],
                    ["검증", report.validation.byHorizon["60"]],
                  ].map(([label, block]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td className="tabular-nums">{fmtPp(block.diff.successRatePp)}</td>
                      <td className="tabular-nums">{fmtPp(block.diff.priceMedianPp)}</td>
                      <td className="tabular-nums">{fmtPp(block.diff.maeMedianPp)}</td>
                      <td className="tabular-nums">{block.sameDay.pairedDates}</td>
                      <td className="tabular-nums">{fmtPct(block.sameDay.returnGapMedian)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="yds-signal-track__summary">
              방향 재현: 중앙값 {report.direction?.priceMedian?.status} · 성공률 {report.direction?.successRate?.status}
            </p>
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
            {report.sensitivity?.length ? (
              <p className="yds-signal-track__summary">
                검증 종목 제외 민감도(상위):{" "}
                {report.sensitivity
                  .slice(0, 5)
                  .map((item) => `${item.symbol}${item.flipped ? "(부호반전)" : ""} ${fmtPp(item.priceMedianPp)}`)
                  .join(" · ")}
              </p>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  )
}
