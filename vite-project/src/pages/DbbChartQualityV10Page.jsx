import { useEffect, useState } from "react"
import { CHART_QUALITY_V10_BASIS, CHART_QUALITY_V10_PATH } from "../content/dbbChartQualityV10.js"

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

export default function DbbChartQualityV10Page() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(CHART_QUALITY_V10_PATH, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error("대조 연구 자료를 불러오지 못했습니다.")
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
        <p className="yds-dbb__kicker">DBB CONTROL V10</p>
        <h1 className="yds-dbb__title">{CHART_QUALITY_V10_BASIS.title}</h1>
        <p className="yds-dbb__lead">{CHART_QUALITY_V10_BASIS.question}</p>
      </header>

      <aside className="yds-dbb__notice" aria-label="실험 설계">
        <p>{CHART_QUALITY_V10_BASIS.researchOnly}</p>
        {report ? (
          <>
            <p>
              데이터 기준일 {report.asOf || "없음"}. 매칭 시도 {report.counts?.signalsAttempted} · 매칭{" "}
              {report.counts?.matched} ({fmtPct(report.counts?.matchRatePct, false)}) · 미매칭 {report.counts?.unmatched}.
              학습 ~{report.split?.trainEndDate} · 검증 {report.split?.validationStartDate}~.
            </p>
            <p>
              신호 재검증 {report.verification?.ok ? "일치" : "불일치"} (표본 종목 {report.verification?.sampledSymbols}).
              대조 재사용 {report.counts?.reusedControls}.
            </p>
            <p>{CHART_QUALITY_V10_BASIS.matching}</p>
            <p>{CHART_QUALITY_V10_BASIS.caution}</p>
          </>
        ) : null}
      </aside>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}

      {report ? (
        <>
          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">매칭 품질</h2>
            <p className="yds-signal-track__summary">
              매칭 후 |Δ| 평균 — dd20 {fmtPp(report.balance?.after?.meanAbsGap?.dd20)} · vol20{" "}
              {fmtPp(report.balance?.after?.meanAbsGap?.vol20)} · qqq20{" "}
              {fmtPp(report.balance?.after?.meanAbsGap?.qqqRet20)}. 거리 중앙값 {report.distance?.median}.
            </p>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">기간별 성과 (매칭 쌍)</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">기간</th>
                    <th scope="col">군</th>
                    <th scope="col">완성</th>
                    <th scope="col">성공률</th>
                    <th scope="col">중앙값</th>
                    <th scope="col">평균</th>
                    <th scope="col">MAE</th>
                    <th scope="col">초과QQQ</th>
                  </tr>
                </thead>
                <tbody>
                  {["20", "60", "120"].flatMap((key) => {
                    const block = report.tables[key]
                    return [
                      <tr key={`${key}-s`}>
                        <th scope="row">{key}일</th>
                        <td>신호</td>
                        <td className="tabular-nums">{block.signal.complete}</td>
                        <td className="tabular-nums">{fmtPct(block.signal.successRate, false)}</td>
                        <td className="tabular-nums">{fmtPct(block.signal.priceMedian)}</td>
                        <td className="tabular-nums">{fmtPct(block.signal.priceMean)}</td>
                        <td className="tabular-nums">{fmtPct(block.signal.maeMedian, false)}</td>
                        <td className="tabular-nums">{fmtPct(block.signal.excessQqqMedian)}</td>
                      </tr>,
                      <tr key={`${key}-c`}>
                        <th scope="row">{key}일</th>
                        <td>대조</td>
                        <td className="tabular-nums">{block.control.complete}</td>
                        <td className="tabular-nums">{fmtPct(block.control.successRate, false)}</td>
                        <td className="tabular-nums">{fmtPct(block.control.priceMedian)}</td>
                        <td className="tabular-nums">{fmtPct(block.control.priceMean)}</td>
                        <td className="tabular-nums">{fmtPct(block.control.maeMedian, false)}</td>
                        <td className="tabular-nums">{fmtPct(block.control.excessQqqMedian)}</td>
                      </tr>,
                      <tr key={`${key}-d`}>
                        <th scope="row">{key}일</th>
                        <td>차이</td>
                        <td className="tabular-nums">{block.diff.completePairs}</td>
                        <td className="tabular-nums">{fmtPp(block.diff.successRatePp)}</td>
                        <td className="tabular-nums">{fmtPct(block.diff.returnMedian)}</td>
                        <td className="tabular-nums">{fmtPct(block.diff.returnMean)}</td>
                        <td className="tabular-nums">{fmtPp(block.diff.maeMedian)}</td>
                        <td className="tabular-nums">{fmtPct(block.diff.excessMedian)}</td>
                      </tr>,
                    ]
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">날짜 단위 · 학습/검증 (60일)</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">구간</th>
                    <th scope="col">쌍</th>
                    <th scope="col">중앙값 Δ</th>
                    <th scope="col">성공률 Δ</th>
                    <th scope="col">MAE Δ</th>
                    <th scope="col">날짜 중앙값Δ</th>
                    <th scope="col">부트스트랩 CI</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["전체", report.tables["60"].diff, report.tables["60"].sameDay, report.counts.matched],
                    ["학습", report.train.byHorizon["60"], report.train.sameDay60, report.train.n],
                    ["검증", report.validation.byHorizon["60"], report.validation.sameDay60, report.validation.n],
                  ].map(([label, diff, sameDay, n]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td className="tabular-nums">{n}</td>
                      <td className="tabular-nums">{fmtPct(diff.returnMedian)}</td>
                      <td className="tabular-nums">{fmtPp(diff.successRatePp)}</td>
                      <td className="tabular-nums">{fmtPp(diff.maeMedian)}</td>
                      <td className="tabular-nums">{fmtPct(sameDay.gapMedian)}</td>
                      <td className="tabular-nums">{bootLabel(sameDay.bootstrap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">보조 · 3개/4개 · 국면 (60일)</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">구분</th>
                    <th scope="col">쌍</th>
                    <th scope="col">중앙값 Δ</th>
                    <th scope="col">성공률 Δ</th>
                    <th scope="col">날짜 CI</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">3개 충족</th>
                    <td className="tabular-nums">{report.auxiliary.strength.three.n}</td>
                    <td className="tabular-nums">{fmtPct(report.auxiliary.strength.three.diff60.returnMedian)}</td>
                    <td className="tabular-nums">{fmtPp(report.auxiliary.strength.three.diff60.successRatePp)}</td>
                    <td className="tabular-nums">{bootLabel(report.auxiliary.strength.three.sameDay60.bootstrap)}</td>
                  </tr>
                  <tr>
                    <th scope="row">4개 충족</th>
                    <td className="tabular-nums">{report.auxiliary.strength.four.n}</td>
                    <td className="tabular-nums">{fmtPct(report.auxiliary.strength.four.diff60.returnMedian)}</td>
                    <td className="tabular-nums">{fmtPp(report.auxiliary.strength.four.diff60.successRatePp)}</td>
                    <td className="tabular-nums">{bootLabel(report.auxiliary.strength.four.sameDay60.bootstrap)}</td>
                  </tr>
                  {["bull", "bear", "sideways"].map((key) => {
                    const block = report.auxiliary.regimes[key]
                    return (
                      <tr key={key}>
                        <th scope="row">
                          {block.label}
                          {block.exploratory ? " (탐색)" : ""}
                        </th>
                        <td className="tabular-nums">{block.n}</td>
                        <td className="tabular-nums">{fmtPct(block.diff60.returnMedian)}</td>
                        <td className="tabular-nums">{fmtPp(block.diff60.successRatePp)}</td>
                        <td className="tabular-nums">{bootLabel(block.sameDay60.bootstrap)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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
    </div>
  )
}
