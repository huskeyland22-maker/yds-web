import { useEffect, useMemo, useState } from "react"
import { CHART_QUALITY_V2_BASIS, CHART_QUALITY_V2_PATH } from "../content/dbbChartQualityV2.js"

const SMALL = 30

function fmtPct(value, signed = true) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  const number = Number(value)
  const sign = signed && number > 0 ? "+" : ""
  return `${sign}${number.toFixed(2)}%`
}

function caution(n) {
  return n < SMALL ? " · 주의" : ""
}

function GapSummary({ title, summary }) {
  if (!summary) return null
  return (
    <p className="yds-signal-track__summary">
      {title}: 사용 그룹 {summary.usableGroups}{caution(summary.usableGroups)} · 미사용 {summary.missingOutcome} · 상위 중앙값 {fmtPct(summary.topReturnMedian)} · 비교 중앙값 {fmtPct(summary.restReturnMedian)} · 차이 중앙값 {fmtPct(summary.gapMedian)} · 차이 양수 {fmtPct(summary.gapPositiveRate, false)} · 불리 차이 중앙값 {summary.gapDrawdownMedian == null ? "표본 없음" : `${summary.gapDrawdownMedian > 0 ? "+" : ""}${Number(summary.gapDrawdownMedian).toFixed(2)}%p`}
    </p>
  )
}

export default function DbbChartQualityV2Page() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [horizon, setHorizon] = useState(60)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(CHART_QUALITY_V2_PATH, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error("동일 신호일 비교 자료를 불러오지 못했습니다.")
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

  const tableA = useMemo(() => {
    const rows = report?.tableA || []
    return [...rows].sort((a, b) => String(b.signalDate).localeCompare(String(a.signalDate)))
  }, [report])

  const rule = report?.rule
  const side = report?.overall

  return (
    <div className="yds-dbb yds-signal-track min-w-0 w-full">
      <header className="yds-dbb__hero">
        <p className="yds-dbb__kicker">DBB CHART QUALITY V2</p>
        <h1 className="yds-dbb__title">{CHART_QUALITY_V2_BASIS.title}</h1>
        <p className="yds-dbb__lead">같은 신호일에 조건을 충족한 종목끼리 차트 품질 점수와 이후 성과를 비교합니다.</p>
      </header>

      <aside className="yds-dbb__notice" aria-label="분석 기준">
        <p>{CHART_QUALITY_V2_BASIS.researchOnly}</p>
        {report ? (
          <>
            <p>
              데이터 기준일 {report.asOf || "없음"}. 전체 신호 {report.counts.signals}건 · 동일 신호일 그룹 {report.counts.groups}개 · 비교 가능(점수 2개 이상) {report.counts.comparableGroups}개 · 직접 비교 불가 {report.counts.nonComparableGroups}개 · 점수 결측 {report.counts.missingScore}건 · 60일 성과 결측 그룹 {report.counts.missingOutcome60}개.
            </p>
            <p>
              학습 경계 {report.split?.trainEndDate || "없음"} · 검증 시작 {report.split?.validationStartDate || "없음"}. {rule?.split}
            </p>
            <p>{rule?.scored}</p>
            <p>{rule?.topTie}</p>
            <p>{rule?.quartile}</p>
            <p>{rule?.incomplete}</p>
            <p>{rule?.bootstrap}</p>
            <p>{CHART_QUALITY_V2_BASIS.bias}</p>
          </>
        ) : null}
      </aside>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}

      {report ? (
        <>
          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 B · 전체 비교 요약</h2>
            <div className="yds-signal-track__filters" role="group" aria-label="기간">
              {[20, 60, 120].map((days) => (
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
            <GapSummary title={`전체 상위 대 나머지 ${horizon}일`} summary={side.topVsRest[String(horizon)]} />
            <GapSummary title={`학습 상위 대 나머지 ${horizon}일`} summary={report.train.topVsRest[String(horizon)]} />
            <GapSummary title={`검증 상위 대 나머지 ${horizon}일`} summary={report.validation.topVsRest[String(horizon)]} />
            <GapSummary title={`전체 상위·하위 25% ${horizon}일`} summary={side.quartile[String(horizon)]} />
            <p className="yds-signal-track__summary">
              60일 그룹 재표본: {side.bootstrap60.status}
              {side.bootstrap60.status === "ok"
                ? ` · 중앙값 평균 ${fmtPct(side.bootstrap60.mean)} · 95% 구간 ${fmtPct(side.bootstrap60.lo)} ~ ${fmtPct(side.bootstrap60.hi)}${side.bootstrap60.excludesZero ? "" : " · 0 포함"}`
                : ""}
            </p>
            <p className="yds-signal-track__summary">
              점수 순위(1=최고점)와 60일 수익 스피어만 ρ {side.rankReturn60.rho ?? "표본 없음"} (n={side.rankReturn60.n}) · 불리 움직임 ρ {side.rankDrawdown60.rho ?? "표본 없음"} (n={side.rankDrawdown60.n}). 순위 숫자가 작을수록 점수가 높습니다.
            </p>
            <p className="yds-dbb-card__hint">
              사분위 비교는 점수 산출 종목 4개 이상 그룹 {report.counts.quartileEligibleGroups}개만 사용합니다. 불리 차이 중앙값이 음수면 상위 점수 쪽 최대 불리 움직임이 더 얕습니다.
            </p>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">업종 편향 보조</h2>
            <p className="yds-signal-track__summary">
              같은 날·같은 업종 ETF 비교 그룹 {report.sectorSameDay.groups}개{caution(report.sectorSameDay.groups)} · 60일 차이 중앙값 {fmtPct(report.sectorSameDay.gapMedian)} · 양수 {fmtPct(report.sectorSameDay.gapPositiveRate, false)}
            </p>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">업종 ETF</th>
                    <th scope="col">상위 선정 횟수</th>
                    <th scope="col">비중</th>
                  </tr>
                </thead>
                <tbody>
                  {side.topSectorDistribution.map((row) => (
                    <tr key={row.sector}>
                      <th scope="row">{row.sector}</th>
                      <td className="tabular-nums">{row.count}</td>
                      <td className="tabular-nums">{row.sharePct == null ? "표본 없음" : `${row.sharePct.toFixed(2)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 C · 종목 제외 민감도</h2>
            <p className="yds-dbb-card__hint">한 종목을 빼고 같은 규칙을 다시 적용했을 때 60일 차이 중앙값·양수 비율이 얼마나 달라지는지입니다.</p>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">종목</th>
                    <th scope="col">점수 있는 신호</th>
                    <th scope="col">제외 후 사용 그룹</th>
                    <th scope="col">차이 중앙값</th>
                    <th scope="col">중앙값 변화</th>
                    <th scope="col">양수 비율 변화</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sensitivity.map((row) => (
                    <tr key={row.symbol}>
                      <th scope="row">{row.symbol}</th>
                      <td className="tabular-nums">{row.groupsWithSymbol}</td>
                      <td className="tabular-nums">{row.usableGroups}</td>
                      <td className="tabular-nums">{fmtPct(row.gapMedian)}</td>
                      <td className="tabular-nums">{fmtPct(row.deltaGapMedian)}</td>
                      <td className="tabular-nums">{fmtPct(row.deltaGapPositiveRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 A · 동일 신호일 그룹 요약</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">신호일</th>
                    <th scope="col">비교 종목</th>
                    <th scope="col">상위 종목</th>
                    <th scope="col">상위 점수</th>
                    <th scope="col">상위 60일</th>
                    <th scope="col">나머지 60일 중앙값</th>
                    <th scope="col">수익 차이</th>
                    <th scope="col">불리 차이</th>
                  </tr>
                </thead>
                <tbody>
                  {tableA.slice(0, 300).map((row) => (
                    <tr key={row.signalDate}>
                      <th scope="row">{row.signalDate}</th>
                      <td className="tabular-nums">{row.scoredCount}</td>
                      <td>{row.topSymbols.join(", ")}{row.topTiedCount > 1 ? " · 동점" : ""}</td>
                      <td className="tabular-nums">{row.topScore}</td>
                      <td className="tabular-nums">{row.usable60 ? fmtPct(row.topReturn60) : "미완료"}</td>
                      <td className="tabular-nums">{row.usable60 ? fmtPct(row.restReturn60) : "미완료"}</td>
                      <td className="tabular-nums">{row.usable60 ? fmtPct(row.gapReturn60) : "미완료"}</td>
                      <td className="tabular-nums">{row.gapDrawdown60 == null ? "표본 없음" : `${row.gapDrawdown60 > 0 ? "+" : ""}${Number(row.gapDrawdown60).toFixed(2)}%p`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tableA.length > 300 ? <p className="yds-dbb-card__hint">최근 300개 그룹만 표시합니다. 전체 {tableA.length}개.</p> : null}
          </section>
        </>
      ) : null}
    </div>
  )
}
