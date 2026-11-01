import { useEffect, useState } from "react"
import { CHART_QUALITY_V3_BASIS, CHART_QUALITY_V3_PATH } from "../content/dbbChartQualityV3.js"

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

export default function DbbChartQualityV3Page() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState("A")

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(CHART_QUALITY_V3_PATH, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error("항목별 유효성 자료를 불러오지 못했습니다.")
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

  const component = report?.components?.[active]

  return (
    <div className="yds-dbb yds-signal-track min-w-0 w-full">
      <header className="yds-dbb__hero">
        <p className="yds-dbb__kicker">DBB CHART QUALITY V3</p>
        <h1 className="yds-dbb__title">{CHART_QUALITY_V3_BASIS.title}</h1>
        <p className="yds-dbb__lead">A~E 항목이 이후 성과와 관계가 있는지 개별적으로 확인하는 연구 화면입니다.</p>
      </header>

      <aside className="yds-dbb__notice" aria-label="분석 기준">
        <p>{CHART_QUALITY_V3_BASIS.researchOnly}</p>
        {report ? (
          <>
            <p>
              데이터 기준일 {report.asOf || "없음"}. 신호 {report.counts.signals}건 · 동일 신호일 {report.counts.uniqueDates}개 · 학습 {report.counts.trainSignals}건(~{report.split?.trainEndDate}) · 검증 {report.counts.validationSignals}건({report.split?.validationStartDate}~).
            </p>
            <p>
              v1 점수 재계산 검증: 일치 {report.verification.matched} · 불일치 {report.verification.mismatched} · 바 부족 {report.verification.missingBars}.
            </p>
            <p>
              항목별 계산 가능 / 결측 —
              {["A", "B", "C", "D", "E"].map((key) => {
                const row = report.counts.components[key]
                return ` ${key} ${row.available}/${row.missing}`
              }).join(" ·")}
            </p>
            <p>{report.rule?.source}</p>
            <p>{report.rule?.raw}</p>
            <p>{report.rule?.sameDay}</p>
            <p>{report.rule?.tertile}</p>
            <p>{report.rule?.correlation}</p>
            <p>{CHART_QUALITY_V3_BASIS.caution}</p>
          </>
        ) : null}
      </aside>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}

      {report ? (
        <>
          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 A · 항목별 전체 성과</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    <th scope="col">표본</th>
                    <th scope="col">결측</th>
                    <th scope="col">점수-수익 ρ</th>
                    <th scope="col">상위 1/3 60일</th>
                    <th scope="col">양수</th>
                    <th scope="col">불리 중앙값</th>
                    <th scope="col">QQQ초과</th>
                    <th scope="col">하위 1/3 60일</th>
                  </tr>
                </thead>
                <tbody>
                  {report.tableA.map((row) => (
                    <tr key={row.component}>
                      <th scope="row">{row.component}. {row.label}</th>
                      <td className="tabular-nums">{row.available}</td>
                      <td className="tabular-nums">{row.missing}</td>
                      <td className="tabular-nums">{fmtRho(row.scoreReturnRho)}</td>
                      <td className="tabular-nums">{fmtPct(row.topMedian60)}</td>
                      <td className="tabular-nums">{fmtPct(row.topPositive60, false)}</td>
                      <td className="tabular-nums">{row.topDrawdown60 == null ? "표본 없음" : `-${Number(row.topDrawdown60).toFixed(2)}%`}</td>
                      <td className="tabular-nums">{fmtPct(row.topExcessQqq60)}</td>
                      <td className="tabular-nums">{fmtPct(row.bottomMedian60)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 B · 동일 신호일 비교</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    <th scope="col">사용 그룹</th>
                    <th scope="col">수익 차이 중앙값</th>
                    <th scope="col">양수 그룹</th>
                    <th scope="col">불리 차이</th>
                    <th scope="col">재표본 95%</th>
                  </tr>
                </thead>
                <tbody>
                  {report.tableB.map((row) => (
                    <tr key={row.component}>
                      <th scope="row">{row.component}. {row.label}</th>
                      <td className="tabular-nums">{row.usableGroups}{caution(row.usableGroups)}</td>
                      <td className="tabular-nums">{fmtPct(row.gapMedian60)}</td>
                      <td className="tabular-nums">{fmtPct(row.gapPositiveRate, false)}</td>
                      <td className="tabular-nums">{row.gapDrawdownMedian60 == null ? "표본 없음" : `${row.gapDrawdownMedian60 > 0 ? "+" : ""}${Number(row.gapDrawdownMedian60).toFixed(2)}%p`}</td>
                      <td className="tabular-nums">
                        {row.bootstrapLo == null
                          ? "표본 부족"
                          : `${fmtPct(row.bootstrapLo)} ~ ${fmtPct(row.bootstrapHi)}${row.bootstrapExcludesZero ? "" : " · 0 포함"}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 C · 학습과 검증</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    <th scope="col">학습 n</th>
                    <th scope="col">검증 n</th>
                    <th scope="col">학습 ρ</th>
                    <th scope="col">검증 ρ</th>
                    <th scope="col">상관 방향</th>
                    <th scope="col">학습 그룹 차이</th>
                    <th scope="col">검증 그룹 차이</th>
                    <th scope="col">그룹 방향</th>
                  </tr>
                </thead>
                <tbody>
                  {report.tableC.map((row) => (
                    <tr key={row.component}>
                      <th scope="row">{row.component}. {row.label}</th>
                      <td className="tabular-nums">{row.trainAvailable}</td>
                      <td className="tabular-nums">{row.validationAvailable}</td>
                      <td className="tabular-nums">{fmtRho(row.trainReturnRho)}</td>
                      <td className="tabular-nums">{fmtRho(row.validationReturnRho)}</td>
                      <td>{row.correlationMatch}</td>
                      <td className="tabular-nums">{fmtPct(row.trainGapMedian)}</td>
                      <td className="tabular-nums">{fmtPct(row.validationGapMedian)}</td>
                      <td>{row.sameDayMatch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">항목 상세</h2>
            <div className="yds-signal-track__filters" role="group" aria-label="항목">
              {["A", "B", "C", "D", "E"].map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`yds-signal-track__filter${active === key ? " is-on" : ""}`}
                  onClick={() => setActive(key)}
                >
                  {key}
                </button>
              ))}
            </div>
            {component ? (
              <>
                <p className="yds-dbb-card__hint">{component.detail}</p>
                <p className="yds-signal-track__summary">
                  계산 가능 {component.available} · 결측 {component.missing} · 삼분위 {component.overall.tertileEligible ? "가능" : "점수 분포로 비교 불가"} · 동일일 사용 그룹 {component.sameDay.usableGroups}{caution(component.sameDay.usableGroups)}
                </p>
                <div className="yds-dbb-research__scroll">
                  <table className="yds-dbb-research__table yds-signal-track__table">
                    <caption>원시 지표와 60일 성과 스피어만 상관</caption>
                    <thead>
                      <tr>
                        <th scope="col">지표</th>
                        <th scope="col">수익 ρ (n)</th>
                        <th scope="col">불리 ρ (n)</th>
                        <th scope="col">QQQ초과 ρ (n)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {component.correlations.map((row) => (
                        <tr key={row.id}>
                          <th scope="row">{row.label}</th>
                          <td className="tabular-nums">{fmtRho(row.return60.rho)} ({row.return60.n})</td>
                          <td className="tabular-nums">{fmtRho(row.drawdown60.rho)} ({row.drawdown60.n})</td>
                          <td className="tabular-nums">{fmtRho(row.excessQqq60.rho)} ({row.excessQqq60.n})</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="yds-dbb-research__scroll">
                  <table className="yds-dbb-research__table yds-signal-track__table">
                    <caption>표 D · {active} 종목 제외 민감도(상위 변화)</caption>
                    <thead>
                      <tr>
                        <th scope="col">제외 종목</th>
                        <th scope="col">사용 그룹</th>
                        <th scope="col">차이 중앙값</th>
                        <th scope="col">중앙값 변화</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report.tableD[active] || []).map((row) => (
                        <tr key={row.symbol}>
                          <th scope="row">{row.symbol}</th>
                          <td className="tabular-nums">{row.usableGroups}</td>
                          <td className="tabular-nums">{fmtPct(row.gapMedian)}</td>
                          <td className="tabular-nums">{fmtPct(row.deltaGapMedian)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="yds-dbb-research__scroll">
                  <table className="yds-dbb-research__table yds-signal-track__table">
                    <caption>상위 1/3 업종 분포</caption>
                    <thead>
                      <tr>
                        <th scope="col">업종 ETF</th>
                        <th scope="col">건수</th>
                        <th scope="col">비중</th>
                      </tr>
                    </thead>
                    <tbody>
                      {component.topSectors.length ? component.topSectors.map((row) => (
                        <tr key={row.sector}>
                          <th scope="row">{row.sector}</th>
                          <td className="tabular-nums">{row.count}</td>
                          <td className="tabular-nums">{row.sharePct == null ? "표본 없음" : `${row.sharePct.toFixed(2)}%`}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={3}>삼분위 비교 불가로 업종 분포를 만들지 않습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  )
}
