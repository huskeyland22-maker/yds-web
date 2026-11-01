import { useEffect, useMemo, useState } from "react"
import { CHART_QUALITY_BASIS, CHART_QUALITY_PATH } from "../content/dbbChartQualityV1.js"

const SMALL = 30

function fmtPct(value, signed = true) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  const number = Number(value)
  const sign = signed && number > 0 ? "+" : ""
  return `${sign}${number.toFixed(2)}%`
}

function fmtScore(value) {
  if (value == null || !Number.isFinite(Number(value))) return "계산 불가"
  return Number(value).toFixed(1)
}

function caution(complete) {
  return complete < SMALL ? " · 주의" : ""
}

function SummaryBlock({ title, summary }) {
  return (
    <p className="yds-signal-track__summary">
      {title}: 신호 {summary.signals} · 60일 완료 {summary.complete}{caution(summary.complete)} · 미완료 {summary.incomplete} · 중앙값 {fmtPct(summary.priceMedian)} · 양수 {fmtPct(summary.positiveRate, false)} · 불리 중앙값 {summary.drawdownMedian == null ? "표본 없음" : `-${Number(summary.drawdownMedian).toFixed(2)}%`} · QQQ초과 중앙값 {fmtPct(summary.excessQqqMedian)}
    </p>
  )
}

export default function DbbChartQualityPage() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [horizon, setHorizon] = useState(60)
  const [filter, setFilter] = useState("all")
  const [sortKey, setSortKey] = useState("score")

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(CHART_QUALITY_PATH, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error("차트 품질 연구 자료를 불러오지 못했습니다.")
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

  const rows = useMemo(() => {
    if (!report?.rows) return []
    let list = report.rows
    if (filter === "scored") list = list.filter((row) => row.totalScore != null)
    if (filter === "unavailable") list = list.filter((row) => row.totalStatus === "unavailable")
    if (filter === "focus") list = list.filter((row) => ["LRCX", "AMAT", "MU", "TSM", "VRT"].includes(row.symbol))
    return [...list].sort((a, b) => {
      if (sortKey === "date") return String(b.signalDate).localeCompare(String(a.signalDate)) || a.symbol.localeCompare(b.symbol)
      if (sortKey === "return") {
        const left = a.horizons?.["60"]?.priceReturnPct
        const right = b.horizons?.["60"]?.priceReturnPct
        const leftOk = Number.isFinite(left)
        const rightOk = Number.isFinite(right)
        if (leftOk !== rightOk) return leftOk ? -1 : 1
        if (leftOk && left !== right) return right - left
      }
      const left = a.totalScore
      const right = b.totalScore
      const leftOk = Number.isFinite(left)
      const rightOk = Number.isFinite(right)
      if (leftOk !== rightOk) return leftOk ? -1 : 1
      if (leftOk && left !== right) return right - left
      return String(b.signalDate).localeCompare(String(a.signalDate)) || a.symbol.localeCompare(b.symbol)
    })
  }, [report, filter, sortKey])

  const rule = report?.rule

  return (
    <div className="yds-dbb yds-signal-track min-w-0 w-full">
      <header className="yds-dbb__hero">
        <p className="yds-dbb__kicker">DBB CHART QUALITY</p>
        <h1 className="yds-dbb__title">{CHART_QUALITY_BASIS.title}</h1>
        <p className="yds-dbb__lead">매수 신호 시점의 차트 구조를 점수로 비교하는 연구 화면입니다. 미래 가격은 점수에 넣지 않습니다.</p>
      </header>

      <aside className="yds-dbb__notice" aria-label="분석 기준">
        <p>{CHART_QUALITY_BASIS.researchOnly}</p>
        {report ? (
          <>
            <p>
              데이터 기준일 {report.asOf || "없음"}. 출처 {report.source}. 시장 벤치마크 {report.marketBenchmark}. 종목 {report.universeCount}개 · 신호 {report.counts.signals}건 · 점수 산출 {report.counts.scored} · 계산 불가 {report.counts.unavailableScore}.
            </p>
            <p>
              학습 {report.split.trainCount}건(~{report.split.trainEndDate}) · 검증 {report.split.validationCount}건({report.split.validationStartDate}~). 같은 날짜 신호는 한 구간에만 둡니다.
            </p>
            <p>{CHART_QUALITY_BASIS.signal}</p>
            <p>{CHART_QUALITY_BASIS.entry}</p>
            <p>{rule?.total}</p>
            <p>A {rule?.A?.weight}점: {rule?.A?.detail}</p>
            <p>B {rule?.B?.weight}점: {rule?.B?.detail}</p>
            <p>C {rule?.C?.weight}점: {rule?.C?.detail}</p>
            <p>D {rule?.D?.weight}점: {rule?.D?.detail}</p>
            <p>E {rule?.E?.weight}점: {rule?.E?.detail}</p>
            <p>{CHART_QUALITY_BASIS.missing}</p>
            <p>{CHART_QUALITY_BASIS.independence}</p>
            {report.missingData?.length ? <p>데이터 부족 종목: {report.missingData.map((row) => row.symbol).join(", ")}</p> : null}
          </>
        ) : null}
      </aside>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}

      {report ? (
        <>
          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">전체·구간 요약</h2>
            <SummaryBlock title="전체" summary={report.overall} />
            <SummaryBlock title="학습" summary={report.train.summary} />
            <SummaryBlock title="검증" summary={report.validation.summary} />
            <p className="yds-dbb-card__hint">
              겹친 날짜 {report.counts.multiSignalDates}일 · 그 신호 {report.counts.multiSignals}건 · 고유 신호일 {report.counts.uniqueDates}일.
            </p>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">점수 구간별 60거래일</h2>
            <p className="yds-dbb-card__hint">점수가 산출된 신호만 상위 25%·중간 50%·하위 25%로 나눕니다. 표본이 30건 미만이면 주의입니다.</p>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">구분</th>
                    <th scope="col">구간</th>
                    <th scope="col">건수</th>
                    <th scope="col">점수 범위</th>
                    <th scope="col">60일 완료</th>
                    <th scope="col">중앙값</th>
                    <th scope="col">양수 비율</th>
                    <th scope="col">불리 중앙값</th>
                    <th scope="col">QQQ초과 중앙값</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["전체", report.quartiles],
                    ["학습", report.train.quartiles],
                    ["검증", report.validation.quartiles],
                  ].flatMap(([label, block]) => ["top", "mid", "bottom"].map((key) => {
                    const band = block[key]
                    return (
                      <tr key={`${label}-${key}`}>
                        <th scope="row">{label}</th>
                        <td>{band.label}{block.insufficient ? " · 주의" : ""}</td>
                        <td className="tabular-nums">{band.count}</td>
                        <td className="tabular-nums">{band.scoreMin == null ? "표본 없음" : `${band.scoreMin}~${band.scoreMax}`}</td>
                        <td className="tabular-nums">{band.summary.complete}{caution(band.summary.complete)}</td>
                        <td className="tabular-nums">{fmtPct(band.summary.priceMedian)}</td>
                        <td className="tabular-nums">{fmtPct(band.summary.positiveRate, false)}</td>
                        <td className="tabular-nums">{band.summary.drawdownMedian == null ? "표본 없음" : `-${Number(band.summary.drawdownMedian).toFixed(2)}%`}</td>
                        <td className="tabular-nums">{fmtPct(band.summary.excessQqqMedian)}</td>
                      </tr>
                    )
                  }))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">종목별 요약</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">종목</th>
                    <th scope="col">업종 ETF</th>
                    <th scope="col">신호</th>
                    <th scope="col">점수 중앙값</th>
                    <th scope="col">60일 완료</th>
                    <th scope="col">60일 중앙값</th>
                    <th scope="col">양수 비율</th>
                    <th scope="col">불리 중앙값</th>
                  </tr>
                </thead>
                <tbody>
                  {[...report.bySymbol].sort((a, b) => (b.summary.priceMedian ?? -Infinity) - (a.summary.priceMedian ?? -Infinity)).map((row) => (
                    <tr key={row.symbol}>
                      <th scope="row">{row.symbol}<span className="yds-signal-track__name"> {row.name}</span></th>
                      <td>{row.sectorBenchmark || "비교 불가"}</td>
                      <td className="tabular-nums">{row.signals}</td>
                      <td className="tabular-nums">{fmtScore(row.scoreMedian)}</td>
                      <td className="tabular-nums">{row.summary.complete}{caution(row.summary.complete)}</td>
                      <td className="tabular-nums">{fmtPct(row.summary.priceMedian)}</td>
                      <td className="tabular-nums">{fmtPct(row.summary.positiveRate, false)}</td>
                      <td className="tabular-nums">{row.summary.drawdownMedian == null ? "표본 없음" : `-${Number(row.summary.drawdownMedian).toFixed(2)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">신호별 상세</h2>
            <div className="yds-signal-track__filters" role="group" aria-label="필터">
              {[
                ["all", "전체"],
                ["scored", "점수 있음"],
                ["unavailable", "계산 불가"],
                ["focus", "관찰 5종"],
              ].map(([id, label]) => (
                <button key={id} type="button" className={`yds-signal-track__filter${filter === id ? " is-on" : ""}`} onClick={() => setFilter(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="yds-signal-track__filters" role="group" aria-label="정렬">
              {[
                ["score", "총점순"],
                ["date", "신호일순"],
                ["return", "60일 수익순"],
              ].map(([id, label]) => (
                <button key={id} type="button" className={`yds-signal-track__filter${sortKey === id ? " is-on" : ""}`} onClick={() => setSortKey(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="yds-signal-track__filters" role="group" aria-label="기간">
              {[20, 60, 120].map((days) => (
                <button key={days} type="button" className={`yds-signal-track__filter${horizon === days ? " is-on" : ""}`} onClick={() => setHorizon(days)}>
                  {days}거래일
                </button>
              ))}
            </div>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">신호일</th>
                    <th scope="col">종목</th>
                    <th scope="col">충족</th>
                    <th scope="col">진입가</th>
                    <th scope="col">총점</th>
                    <th scope="col">A</th>
                    <th scope="col">B</th>
                    <th scope="col">C</th>
                    <th scope="col">D</th>
                    <th scope="col">E</th>
                    <th scope="col">{horizon}일 수익</th>
                    <th scope="col">불리</th>
                    <th scope="col">QQQ초과</th>
                    <th scope="col">업종초과</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 400).map((row) => {
                    const h = row.horizons?.[String(horizon)]
                    return (
                      <tr key={row.id}>
                        <th scope="row">{row.signalDate}</th>
                        <td>{row.symbol}<span className="yds-signal-track__name"> {row.name}</span></td>
                        <td className="tabular-nums">{row.signalCount}/4</td>
                        <td className="tabular-nums">{row.entryPrice ?? "미확정"}</td>
                        <td className="tabular-nums">{fmtScore(row.totalScore)}{row.totalStatus === "partial" ? " · 부분" : ""}</td>
                        <td className="tabular-nums">{fmtScore(row.parts?.A)}</td>
                        <td className="tabular-nums">{fmtScore(row.parts?.B)}</td>
                        <td className="tabular-nums">{fmtScore(row.parts?.C)}</td>
                        <td className="tabular-nums">{fmtScore(row.parts?.D)}</td>
                        <td className="tabular-nums">{fmtScore(row.parts?.E)}</td>
                        <td className="tabular-nums">{h?.priceReturnStatus === "complete" ? fmtPct(h.priceReturnPct) : "미완료"}</td>
                        <td className="tabular-nums">{h?.maxDrawdownStatus === "complete" ? `-${Number(h.maxDrawdownPct).toFixed(2)}%` : "미완료"}</td>
                        <td className="tabular-nums">{fmtPct(h?.excessQqqPct)}</td>
                        <td className="tabular-nums">{h?.excessSectorPct == null ? (row.sectorBenchmark ? "표본 없음" : "비교 불가") : fmtPct(h.excessSectorPct)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {rows.length > 400 ? <p className="yds-dbb-card__hint">표시는 정렬된 상위 400건입니다. 전체 {rows.length}건.</p> : null}
          </section>
        </>
      ) : null}
    </div>
  )
}
