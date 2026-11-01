import { useEffect, useState } from "react"
import { CHART_QUALITY_V7_BASIS, CHART_QUALITY_V7_PATH } from "../content/dbbChartQualityV7.js"

function fmtPct(value, signed = true) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  const number = Number(value)
  const sign = signed && number > 0 ? "+" : ""
  return `${sign}${number.toFixed(2)}%`
}

export default function DbbChartQualityV7Page() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(CHART_QUALITY_V7_PATH, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error("실전 효용 검증 자료를 불러오지 못했습니다.")
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
        <p className="yds-dbb__kicker">DBB UTILITY V7</p>
        <h1 className="yds-dbb__title">{CHART_QUALITY_V7_BASIS.title}</h1>
        <p className="yds-dbb__lead">종목 선택과 매수 후 위험관리가 단순 보유보다 나은지 검증합니다.</p>
      </header>

      <aside className="yds-dbb__notice" aria-label="실험 설계">
        <p>{CHART_QUALITY_V7_BASIS.researchOnly}</p>
        {report ? (
          <>
            <p>
              데이터 기준일 {report.asOf || "없음"}. 신호 {report.counts.signals}건 · 진입확정 {report.counts.entered}건 · 학습{" "}
              {report.counts.trainSignals}건(~{report.split?.trainEndDate}) · 검증 {report.counts.validationSignals}건(
              {report.split?.validationStartDate}~).
            </p>
            <p>
              OHLCV 커버 {report.counts.barsCoverage?.symbolsWithBars}/{report.counts.barsCoverage?.symbolsNeeded}. E=0{" "}
              {report.counts.e?.zero} · E≠0 {report.counts.e?.nonzero} ({report.counts.e?.note}).
            </p>
            <p>{report.rule?.purpose}</p>
            <p>{report.rule?.selection}</p>
            <p>{report.rule?.stopCandidates}</p>
            <p>{report.rule?.trendExit}</p>
            <p>{report.rule?.costs}</p>
            <p>{CHART_QUALITY_V7_BASIS.caution}</p>
          </>
        ) : null}
      </aside>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}

      {report ? (
        <>
          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">연구 A · 종목 선택 (60일)</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">전략</th>
                    <th scope="col">선택 n</th>
                    <th scope="col">전체 중앙값</th>
                    <th scope="col">검증 대비Δ</th>
                    <th scope="col">동일일 매칭Δ</th>
                    <th scope="col">불리Δ(검증)</th>
                    <th scope="col">판정</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">기준(전체)</th>
                    <td className="tabular-nums">{report.studyA.baseline.n}</td>
                    <td className="tabular-nums">{fmtPct(report.studyA.baseline.horizons["60"].priceMedian)}</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                  {["A", "B", "C", "D"].map((key) => {
                    const arm = report.studyA.arms[key]
                    return (
                      <tr key={key}>
                        <th scope="row">{key} 상위 1/3</th>
                        <td className="tabular-nums">{arm.selectedN}</td>
                        <td className="tabular-nums">{fmtPct(arm.pooled.selected["60"].priceMedian)}</td>
                        <td className="tabular-nums">{fmtPct(arm.validation.diff60.deltaPriceMedian)}</td>
                        <td className="tabular-nums">{fmtPct(arm.sameDay.horizons["60"].gapVsMatchedMedian)}</td>
                        <td className="tabular-nums">
                          {arm.validation.diff60.deltaDrawdownMedian == null
                            ? "표본 없음"
                            : `${arm.validation.diff60.deltaDrawdownMedian > 0 ? "+" : ""}${Number(
                                arm.validation.diff60.deltaDrawdownMedian,
                              ).toFixed(2)}%p`}
                        </td>
                        <td>{arm.verdict.level}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="yds-signal-track__summary">
              E 참고: {report.studyA.eReference.note} (비0 {report.studyA.eReference.nonzero}건)
            </p>
            <p className="yds-signal-track__summary">
              C 검증 종목 제외 민감도(상위):{" "}
              {(report.studyA.arms.C.sensitivity || [])
                .slice(0, 5)
                .map((row) => `${row.symbol} Δ${fmtPct(row.deltaPriceMedian)}${row.flipped ? "(반전)" : ""}`)
                .join(" · ") || "없음"}
            </p>
            <p className="yds-signal-track__summary">
              연구 A 종합: {report.overall.studyA.level} — {report.overall.studyA.detail}
            </p>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">연구 B · 위험관리 (검증 60일)</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">전략</th>
                    <th scope="col">완성</th>
                    <th scope="col">수익 중앙값</th>
                    <th scope="col">양수</th>
                    <th scope="col">P10</th>
                    <th scope="col">불리 중앙값</th>
                    <th scope="col">판정</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">보유(무위험관리)</th>
                    <td className="tabular-nums">{report.studyB.hold.byHorizon["60"].validation.complete}</td>
                    <td className="tabular-nums">{fmtPct(report.studyB.hold.byHorizon["60"].validation.priceMedian)}</td>
                    <td className="tabular-nums">{fmtPct(report.studyB.hold.byHorizon["60"].validation.positiveRate, false)}</td>
                    <td className="tabular-nums">{fmtPct(report.studyB.hold.byHorizon["60"].validation.p10Return)}</td>
                    <td className="tabular-nums">
                      {report.studyB.hold.byHorizon["60"].validation.drawdownMedian == null
                        ? "표본 없음"
                        : `-${Number(report.studyB.hold.byHorizon["60"].validation.drawdownMedian).toFixed(2)}%`}
                    </td>
                    <td>기준</td>
                  </tr>
                  {report.studyB.stopArms.map((arm, index) => {
                    const judgment = report.studyB.judgments.stops[index]
                    const val = arm.byHorizon["60"].validation
                    return (
                      <tr key={arm.label}>
                        <th scope="row">{arm.label}</th>
                        <td className="tabular-nums">{val.complete}</td>
                        <td className="tabular-nums">{fmtPct(val.priceMedian)}</td>
                        <td className="tabular-nums">{fmtPct(val.positiveRate, false)}</td>
                        <td className="tabular-nums">{fmtPct(val.p10Return)}</td>
                        <td className="tabular-nums">
                          {val.drawdownMedian == null ? "표본 없음" : `-${Number(val.drawdownMedian).toFixed(2)}%`}
                        </td>
                        <td>{judgment.level}</td>
                      </tr>
                    )
                  })}
                  {[
                    [report.studyB.trendNextOpen, report.studyB.judgments.trendNextOpen],
                    [report.studyB.combined, report.studyB.judgments.combined],
                  ].map(([arm, judgment]) => {
                    const val = arm.byHorizon["60"].validation
                    return (
                      <tr key={arm.label}>
                        <th scope="row">{arm.label}</th>
                        <td className="tabular-nums">{val.complete}</td>
                        <td className="tabular-nums">{fmtPct(val.priceMedian)}</td>
                        <td className="tabular-nums">{fmtPct(val.positiveRate, false)}</td>
                        <td className="tabular-nums">{fmtPct(val.p10Return)}</td>
                        <td className="tabular-nums">
                          {val.drawdownMedian == null ? "표본 없음" : `-${Number(val.drawdownMedian).toFixed(2)}%`}
                        </td>
                        <td>{judgment.level}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="yds-signal-track__summary">
              추세 당일종가(참고): 검증 중앙값 {fmtPct(report.studyB.trendSameCloseRef.byHorizon["60"].validation.priceMedian)} ·{" "}
              {report.studyB.judgments.trendSameCloseRef.note}
            </p>
            <p className="yds-signal-track__summary">
              손절−12% 대안터치(저가·참고): 검증 중앙값{" "}
              {fmtPct(report.studyB.stopAltTouchRef.byHorizon["60"].validation.priceMedian)} ·{" "}
              {report.studyB.judgments.stopAltTouchRef.note}
            </p>
            <p className="yds-signal-track__summary">
              조기청산 후 회복 참고(손절−12% 검증):{" "}
              {report.studyB.stopArms[1].byHorizon["60"].validation.recoveryRef
                ? `n=${report.studyB.stopArms[1].byHorizon["60"].validation.recoveryRef.n} · 중앙값 ${fmtPct(
                    report.studyB.stopArms[1].byHorizon["60"].validation.recoveryRef.median,
                  )} · ${report.studyB.stopArms[1].byHorizon["60"].validation.recoveryRef.note}`
                : "없음"}
            </p>
            <p className="yds-signal-track__summary">
              비용 민감도(보유 검증 60일):{" "}
              {(report.studyB.hold.byHorizon["60"].costSensitivity || [])
                .map((row) => `${row.costPct}%→${fmtPct(row.validation.priceMedian)}`)
                .join(" · ")}
            </p>
            <p className="yds-signal-track__summary">
              연구 B 종합: {report.overall.studyB.level} — {report.overall.studyB.detail}
            </p>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">한계 · 종합</h2>
            <p className="yds-signal-track__summary">{report.overall.note}</p>
            <p className="yds-signal-track__summary">{report.rule?.stopFill}</p>
            <p className="yds-signal-track__summary">{report.rule?.noOptimize}</p>
          </section>
        </>
      ) : null}
    </div>
  )
}
