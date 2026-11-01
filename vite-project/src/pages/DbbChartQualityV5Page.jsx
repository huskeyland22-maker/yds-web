import { useEffect, useState } from "react"
import { CHART_QUALITY_V5_BASIS, CHART_QUALITY_V5_PATH } from "../content/dbbChartQualityV5.js"

export default function DbbChartQualityV5Page() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(CHART_QUALITY_V5_PATH, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error("항목별 최종 판정 자료를 불러오지 못했습니다.")
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
        <p className="yds-dbb__kicker">DBB CHART QUALITY V5</p>
        <h1 className="yds-dbb__title">{CHART_QUALITY_V5_BASIS.title}</h1>
        <p className="yds-dbb__lead">v1~v4 결과를 종합해 항목별 증거 수준과 실전 적용 가능성을 정리합니다.</p>
      </header>

      <aside className="yds-dbb__notice" aria-label="분석 기준">
        <p>{CHART_QUALITY_V5_BASIS.researchOnly}</p>
        {report ? (
          <>
            <p>
              데이터 기준일 {report.asOf || "없음"}. 신호 {report.counts.signals}건 · 학습 {report.counts.trainSignals}건(~{report.split?.trainEndDate}) · 검증 {report.counts.validationSignals}건({report.split?.validationStartDate}~) · 동일 신호일 {report.counts.uniqueDates}개.
            </p>
            <p>
              항목별 가능/결측 —
              {["A", "B", "C", "D", "E"].map((key) => {
                const row = report.counts.components[key]
                return ` ${key} ${row.available}/${row.missing}`
              }).join(" ·")}
              {report.counts.eZero != null ? ` · E=0 ${report.counts.eZero} · E≠0 ${report.counts.eNonzero}` : ""}
            </p>
            <p>{report.rule?.purpose}</p>
            <p>{report.rule?.levelNote}</p>
            <p>{report.rule?.sources}</p>
            <p>{CHART_QUALITY_V5_BASIS.caution}</p>
          </>
        ) : null}
      </aside>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}

      {report ? (
        <>
          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 A · A~E 종합 판정</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    <th scope="col">표본</th>
                    <th scope="col">전체 관계</th>
                    <th scope="col">동일일 비교</th>
                    <th scope="col">검증 재현성</th>
                    <th scope="col">위험</th>
                    <th scope="col">증거 수준</th>
                    <th scope="col">판정 이유</th>
                  </tr>
                </thead>
                <tbody>
                  {report.tableA.map((row) => (
                    <tr key={row.component}>
                      <th scope="row">{row.component}. {row.label}</th>
                      <td className="tabular-nums">{row.available}/{row.missing}</td>
                      <td>{row.overallRelation}</td>
                      <td>{row.sameDay}</td>
                      <td>{row.reproducibility}</td>
                      <td>{row.risk}</td>
                      <td>{row.evidenceLevel}</td>
                      <td>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 B · 핵심 근거와 반대 증거</h2>
            {report.tableB.map((row) => (
              <div key={row.component} className="yds-signal-track__block">
                <h3 className="yds-dbb-section__subtitle">
                  {row.component}. {row.label}
                </h3>
                <p className="yds-signal-track__summary">
                  <strong>지지:</strong> {row.supporting.join(" ")}
                </p>
                <p className="yds-signal-track__summary">
                  <strong>제한:</strong> {row.opposing.join(" ")}
                </p>
                {row.extraNotes?.length ? (
                  <p className="yds-signal-track__summary">
                    <strong>참고:</strong> {row.extraNotes.join(" ")}
                  </p>
                ) : null}
              </div>
            ))}
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 C · 데이터 신뢰성 및 편향</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">주제</th>
                    <th scope="col">내용</th>
                    <th scope="col">출처</th>
                  </tr>
                </thead>
                <tbody>
                  {report.tableC.map((row) => (
                    <tr key={row.topic}>
                      <th scope="row">{row.topic}</th>
                      <td>{row.detail}</td>
                      <td>{row.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 D · 실전 적용 가능성</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    <th scope="col">증거 수준</th>
                    <th scope="col">실전 적용</th>
                    <th scope="col">이유</th>
                  </tr>
                </thead>
                <tbody>
                  {report.tableD.byComponent.map((row) => (
                    <tr key={row.component}>
                      <th scope="row">
                        {row.component}. {row.label}
                      </th>
                      <td>{row.evidenceLevel}</td>
                      <td>{row.practical}</td>
                      <td>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="yds-signal-track__summary">
              <strong>전체 점수 체계:</strong> {report.tableD.overallScoreSystem.verdict} — {report.tableD.overallScoreSystem.reason} {report.tableD.overallScoreSystem.note}
            </p>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">항목별 산식 (v1·v3 저장)</h2>
            <ul className="yds-signal-track__list">
              {report.tableA.map((row) => (
                <li key={`f-${row.component}`}>
                  <strong>
                    {row.component}. {row.label}
                  </strong>
                  — {row.formula || "미확인"}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  )
}
