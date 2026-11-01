import { useEffect, useState } from "react"
import { CHART_QUALITY_V4_BASIS, CHART_QUALITY_V4_PATH } from "../content/dbbChartQualityV4.js"

const SMALL = 30

function fmtPct(value, signed = true) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  const number = Number(value)
  const sign = signed && number > 0 ? "+" : ""
  return `${sign}${number.toFixed(2)}%`
}

function fmtRho(value) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  return Number(value).toFixed(2)
}

function caution(n) {
  return n != null && n < SMALL ? " · 주의" : ""
}

function HorizonGap({ label, block }) {
  if (!block) return null
  return (
    <p className="yds-signal-track__summary">
      {label}: 사용 {block.usableGroups}{caution(block.usableGroups)} · 수익 차이 {fmtPct(block.gapMedian)} · 양수 {fmtPct(block.gapPositiveRate, false)} · 불리 차이 {block.gapDrawdownMedian == null ? "표본 없음" : `${block.gapDrawdownMedian > 0 ? "+" : ""}${Number(block.gapDrawdownMedian).toFixed(2)}%p`}
      {block.bootstrapReturn?.status === "ok"
        ? ` · 수익 재표본 ${fmtPct(block.bootstrapReturn.lo)}~${fmtPct(block.bootstrapReturn.hi)}${block.bootstrapReturn.excludesZero ? "" : " (0 포함)"}`
        : " · 수익 재표본 유보"}
      {block.bootstrapDrawdown?.status === "ok"
        ? ` · 불리 재표본 ${fmtPct(block.bootstrapDrawdown.lo)}~${fmtPct(block.bootstrapDrawdown.hi)}${block.bootstrapDrawdown.excludesZero ? "" : " (0 포함)"}`
        : " · 불리 재표본 유보"}
    </p>
  )
}

export default function DbbChartQualityV4Page() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(CHART_QUALITY_V4_PATH, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error("상대강도·반등 위험 검증 자료를 불러오지 못했습니다.")
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
        <p className="yds-dbb__kicker">DBB CHART QUALITY V4</p>
        <h1 className="yds-dbb__title">{CHART_QUALITY_V4_BASIS.title}</h1>
        <p className="yds-dbb__lead">상대강도와 반등 확인이 이후 수익뿐 아니라 하락 위험과도 어떻게 연결되는지 확인합니다.</p>
      </header>

      <aside className="yds-dbb__notice" aria-label="분석 기준">
        <p>{CHART_QUALITY_V4_BASIS.researchOnly}</p>
        {report ? (
          <>
            <p>
              데이터 기준일 {report.asOf || "없음"}. 신호 {report.counts.signals}건 · C 가능 {report.counts.cAvailable}/결측 {report.counts.cMissing} · E 가능 {report.counts.eAvailable}/결측 {report.counts.eMissing}.
            </p>
            <p>
              학습 {report.counts.trainSignals}건(~{report.split?.trainEndDate}) · 검증 {report.counts.validationSignals}건({report.split?.validationStartDate}~) · 동일 신호일 {report.counts.uniqueDates}개 · C 비교 그룹 {report.counts.cSameDayComparable} · E 비교 그룹 {report.counts.eSameDayComparable}.
            </p>
            <p>
              미완성 성과 20/60/120일: {report.counts.incompleteByHorizon?.["20"]}/{report.counts.incompleteByHorizon?.["60"]}/{report.counts.incompleteByHorizon?.["120"]}건. v1 재계산 일치 {report.verification.matched}/불일치 {report.verification.mismatched}.
            </p>
            <p>{report.rule?.focus}</p>
            <p>{report.rule?.cBands}</p>
            <p>{report.rule?.eScores}</p>
            <p>{report.rule?.correlation}</p>
            <p>{report.rule?.risk}</p>
            <p>{report.rule?.sameDay}</p>
            <p>{report.rule?.joint}</p>
            <p>{CHART_QUALITY_V4_BASIS.caution}</p>
          </>
        ) : null}
      </aside>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}

      {report ? (
        <>
          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 A · C 상대강도</h2>
            <p className="yds-signal-track__summary">
              C 점수–60일 수익 ρ {fmtRho(report.c.correlations.return60.rho)} (n={report.c.correlations.return60.n}) · 불리 ρ {fmtRho(report.c.correlations.drawdown60.rho)} · QQQ초과 ρ {fmtRho(report.c.correlations.excessQqq60.rho)}
            </p>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">구분</th>
                    <th scope="col">구간</th>
                    <th scope="col">표본</th>
                    <th scope="col">60일 중앙값</th>
                    <th scope="col">양수</th>
                    <th scope="col">불리 중앙값</th>
                    <th scope="col">QQQ초과</th>
                  </tr>
                </thead>
                <tbody>
                  {report.c.tertile.eligible
                    ? [
                        ["C 점수", "상위 1/3", report.c.tertile.top["60"]],
                        ["C 점수", "중간 1/3", report.c.tertile.mid["60"]],
                        ["C 점수", "하위 1/3", report.c.tertile.bottom["60"]],
                      ].map(([kind, band, summary]) => (
                        <tr key={`${kind}-${band}`}>
                          <th scope="row">{kind}</th>
                          <td>{band}</td>
                          <td className="tabular-nums">{summary.complete}{caution(summary.complete)}</td>
                          <td className="tabular-nums">{fmtPct(summary.priceMedian)}</td>
                          <td className="tabular-nums">{fmtPct(summary.positiveRate, false)}</td>
                          <td className="tabular-nums">{summary.drawdownMedian == null ? "표본 없음" : `-${Number(summary.drawdownMedian).toFixed(2)}%`}</td>
                          <td className="tabular-nums">{fmtPct(summary.excessQqqMedian)}</td>
                        </tr>
                      ))
                    : null}
                  {report.tableA.rawExcessQqq60.eligible
                    ? [
                        ["excessQqq60", "상위 1/3", report.tableA.rawExcessQqq60.top60],
                        ["excessQqq60", "중간 1/3", report.tableA.rawExcessQqq60.mid60],
                        ["excessQqq60", "하위 1/3", report.tableA.rawExcessQqq60.bottom60],
                      ].map(([kind, band, summary]) => (
                        <tr key={`${kind}-${band}`}>
                          <th scope="row">{kind}</th>
                          <td>{band}</td>
                          <td className="tabular-nums">{summary.complete}{caution(summary.complete)}</td>
                          <td className="tabular-nums">{fmtPct(summary.priceMedian)}</td>
                          <td className="tabular-nums">{fmtPct(summary.positiveRate, false)}</td>
                          <td className="tabular-nums">{summary.drawdownMedian == null ? "표본 없음" : `-${Number(summary.drawdownMedian).toFixed(2)}%`}</td>
                          <td className="tabular-nums">{fmtPct(summary.excessQqqMedian)}</td>
                        </tr>
                      ))
                    : (
                      <tr>
                        <td colSpan={7}>원시 excessQqq60 삼분위 비교 불가</td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 B · E 반등 확인</h2>
            <p className="yds-signal-track__summary">
              E=0 {report.eConcentration?.zeroCount ?? "—"}건 · E≠0 {report.eConcentration?.nonzeroCount ?? "—"}건. {report.eConcentration?.note}
            </p>
            <p className="yds-signal-track__summary">
              E 점수–60일 수익 ρ {fmtRho(report.e.correlations.return60.rho)} (n={report.e.correlations.return60.n}) · 불리 ρ {fmtRho(report.e.correlations.drawdown60.rho)} · QQQ초과 ρ {fmtRho(report.e.correlations.excessQqq60.rho)}
            </p>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">E 점수</th>
                    <th scope="col">표본</th>
                    <th scope="col">20일</th>
                    <th scope="col">60일</th>
                    <th scope="col">120일</th>
                    <th scope="col">60일 양수</th>
                    <th scope="col">60일 불리</th>
                  </tr>
                </thead>
                <tbody>
                  {report.tableB.buckets.map((row) => (
                    <tr key={row.score}>
                      <th scope="row">{row.score}{row.smallSample ? " · 주의" : ""}</th>
                      <td className="tabular-nums">{row.n}</td>
                      <td className="tabular-nums">{fmtPct(row.horizons["20"].priceMedian)}</td>
                      <td className="tabular-nums">{fmtPct(row.horizons["60"].priceMedian)}</td>
                      <td className="tabular-nums">{fmtPct(row.horizons["120"].priceMedian)}</td>
                      <td className="tabular-nums">{fmtPct(row.horizons["60"].positiveRate, false)}</td>
                      <td className="tabular-nums">{row.horizons["60"].drawdownMedian == null ? "표본 없음" : `-${Number(row.horizons["60"].drawdownMedian).toFixed(2)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 C · 동일 신호일 비교</h2>
            <HorizonGap label="C 60일" block={report.tableC.c["60"]} />
            <HorizonGap label="C 20일" block={report.tableC.c["20"]} />
            <HorizonGap label="C 120일" block={report.tableC.c["120"]} />
            <HorizonGap label="E 60일" block={report.tableC.e["60"]} />
            <HorizonGap label="E 20일" block={report.tableC.e["20"]} />
            <HorizonGap label="E 120일" block={report.tableC.e["120"]} />
            <p className="yds-signal-track__summary">
              같은 날·같은 업종 — C 그룹 {report.tableC.cSameSector.usableGroups}{caution(report.tableC.cSameSector.usableGroups)} · 수익 차이 {fmtPct(report.tableC.cSameSector.gapMedian)} · 불리 차이 {report.tableC.cSameSector.gapDrawdownMedian == null ? "표본 없음" : `${report.tableC.cSameSector.gapDrawdownMedian > 0 ? "+" : ""}${Number(report.tableC.cSameSector.gapDrawdownMedian).toFixed(2)}%p`}
            </p>
            <p className="yds-signal-track__summary">
              같은 날·같은 업종 — E 그룹 {report.tableC.eSameSector.usableGroups}{caution(report.tableC.eSameSector.usableGroups)} · 수익 차이 {fmtPct(report.tableC.eSameSector.gapMedian)} · 불리 차이 {report.tableC.eSameSector.gapDrawdownMedian == null ? "표본 없음" : `${report.tableC.eSameSector.gapDrawdownMedian > 0 ? "+" : ""}${Number(report.tableC.eSameSector.gapDrawdownMedian).toFixed(2)}%p`}
            </p>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 D · 학습·검증</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    <th scope="col">학습 ρ 수익/불리</th>
                    <th scope="col">검증 ρ 수익/불리</th>
                    <th scope="col">상관 방향</th>
                    <th scope="col">학습 그룹 수익차</th>
                    <th scope="col">검증 그룹 수익차</th>
                    <th scope="col">그룹 방향</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["C", report.tableD.c, report.tableD.cTrain, report.tableD.cValidation],
                    ["E", report.tableD.e, report.tableD.eTrain, report.tableD.eValidation],
                  ].map(([label, direction, train, validation]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td className="tabular-nums">{fmtRho(train.correlations.return60.rho)} / {fmtRho(train.correlations.drawdown60.rho)}</td>
                      <td className="tabular-nums">{fmtRho(validation.correlations.return60.rho)} / {fmtRho(validation.correlations.drawdown60.rho)}</td>
                      <td>수익 {direction.returnRho.status} · 불리 {direction.drawdownRho.status}</td>
                      <td className="tabular-nums">{fmtPct(train.sameDay60.gapMedian)}</td>
                      <td className="tabular-nums">{fmtPct(validation.sameDay60.gapMedian)}</td>
                      <td>수익 {direction.sameDayReturnGap.status} · 불리 {direction.sameDayDrawdownGap.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 E · C·E 상관 및 민감도</h2>
            <p className="yds-signal-track__summary">
              C–E 점수 스피어만 ρ {fmtRho(report.tableE.ceCorrelation.rho)} (n={report.tableE.ceCorrelation.n}). 2×2 결합표 {report.tableE.joint.enough ? "작성" : "표본 부족으로 미작성"}
              {report.tableE.joint.enough ? "" : ` (칸 수 ${JSON.stringify(report.tableE.joint.counts)})`}.
            </p>
            {report.tableE.joint.enough ? (
              <div className="yds-dbb-research__scroll">
                <table className="yds-dbb-research__table yds-signal-track__table">
                  <thead>
                    <tr>
                      <th scope="col">칸</th>
                      <th scope="col">표본</th>
                      <th scope="col">60일 중앙값</th>
                      <th scope="col">불리 중앙값</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(report.tableE.joint.cells).map(([key, summary]) => (
                      <tr key={key}>
                        <th scope="row">{key}</th>
                        <td className="tabular-nums">{summary.complete}</td>
                        <td className="tabular-nums">{fmtPct(summary.priceMedian)}</td>
                        <td className="tabular-nums">{summary.drawdownMedian == null ? "표본 없음" : `-${Number(summary.drawdownMedian).toFixed(2)}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <caption>종목 제외 시 60일 그룹 차이 변화</caption>
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    <th scope="col">제외 종목</th>
                    <th scope="col">수익차 변화</th>
                    <th scope="col">불리차 변화</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...report.tableE.cSensitivity.map((row) => ["C", row]),
                    ...report.tableE.eSensitivity.map((row) => ["E", row]),
                  ].map(([label, row]) => (
                    <tr key={`${label}-${row.symbol}`}>
                      <th scope="row">{label}</th>
                      <td>{row.symbol}</td>
                      <td className="tabular-nums">{fmtPct(row.deltaGapMedian)}</td>
                      <td className="tabular-nums">{fmtPct(row.deltaGapDrawdownMedian)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
