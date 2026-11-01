import { useEffect, useState } from "react"
import { CHART_QUALITY_V6_BASIS, CHART_QUALITY_V6_PATH } from "../content/dbbChartQualityV6.js"

const SMALL = 30

function fmtPct(value, signed = true) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  const number = Number(value)
  const sign = signed && number > 0 ? "+" : ""
  return `${sign}${number.toFixed(2)}%`
}

function caution(n) {
  return n != null && n < SMALL ? " · 주의" : ""
}

function HorizonBlock({ label, block }) {
  if (!block) return null
  return (
    <p className="yds-signal-track__summary">
      {label}: 사용 {block.usableGroups}
      {caution(block.usableGroups)} · 매칭 대비 {fmtPct(block.gapVsMatchedMedian)} (양수 날짜{" "}
      {fmtPct(block.gapVsMatchedPositiveRate, false)}) · 전체일 대비 {fmtPct(block.gapVsFullMedian)} · 불리차{" "}
      {block.gapDrawdownMedian == null
        ? "표본 없음"
        : `${block.gapDrawdownMedian > 0 ? "+" : ""}${Number(block.gapDrawdownMedian).toFixed(2)}%p`}
      {block.bootstrapVsMatched?.status === "ok"
        ? ` · 매칭 재표본 ${fmtPct(block.bootstrapVsMatched.lo)}~${fmtPct(block.bootstrapVsMatched.hi)}${
            block.bootstrapVsMatched.excludesZero ? "" : " (0 포함)"
          }`
        : " · 매칭 재표본 유보"}
      {` · 선택/매칭/전체 평균 n ${block.avgSelectedCount ?? "—"}/${block.avgMatchedCount ?? "—"}/${block.avgFullCount ?? "—"}`}
    </p>
  )
}

export default function DbbChartQualityV6Page() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(CHART_QUALITY_V6_PATH, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error("선별 효과 비교 자료를 불러오지 못했습니다.")
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
        <p className="yds-dbb__kicker">DBB CHART QUALITY V6</p>
        <h1 className="yds-dbb__title">{CHART_QUALITY_V6_BASIS.title}</h1>
        <p className="yds-dbb__lead">기준군과 C·D 비교군을 같은 DBB 신호 안에서 비교해 선별 효과를 확인합니다.</p>
      </header>

      <aside className="yds-dbb__notice" aria-label="실험 설계">
        <p>{CHART_QUALITY_V6_BASIS.researchOnly}</p>
        {report ? (
          <>
            <p>
              데이터 기준일 {report.asOf || "없음"}. 신호 {report.counts.signals}건 · 학습 {report.counts.trainSignals}건(~
              {report.split?.trainEndDate}) · 검증 {report.counts.validationSignals}건({report.split?.validationStartDate}~) ·
              동일 신호일 {report.counts.uniqueDates}개.
            </p>
            <p>
              C 가능 {report.counts.cAvailable}/결측 {report.counts.cMissing} · 선택 {report.counts.cSelected} · D 가능{" "}
              {report.counts.dAvailable}/결측 {report.counts.dMissing} · 선택 {report.counts.dSelected}. 미완성 20/60/120:{" "}
              {report.counts.incompleteByHorizon?.["20"]}/{report.counts.incompleteByHorizon?.["60"]}/
              {report.counts.incompleteByHorizon?.["120"]}.
            </p>
            <p>{report.rule?.purpose}</p>
            <p>{report.rule?.baseline}</p>
            <p>{report.rule?.cArm}</p>
            <p>{report.rule?.dArm}</p>
            <p>{report.rule?.sameDay}</p>
            <p>{report.rule?.matched}</p>
            <p>
              판정 조건: {(report.verdictRule?.promisingNeeds || []).join(" ")} {report.verdictRule?.note}
            </p>
            <p>{CHART_QUALITY_V6_BASIS.caution}</p>
          </>
        ) : null}
      </aside>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}

      {report ? (
        <>
          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 A · 기준군·C·D 성과 (전체)</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">전략</th>
                    <th scope="col">표본</th>
                    <th scope="col">60일 중앙값</th>
                    <th scope="col">양수</th>
                    <th scope="col">불리 중앙값</th>
                    <th scope="col">QQQ초과</th>
                    <th scope="col">기준 대비 수익차</th>
                    <th scope="col">기준 대비 불리차</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["기준군", report.baseline.horizons["60"], null, report.baseline.n],
                    ["C 상위 1/3", report.c.pooled.selected["60"], report.c.pooled.vsBaseline["60"], report.c.pooled.selectedN],
                    ["D 상위 1/3", report.d.pooled.selected["60"], report.d.pooled.vsBaseline["60"], report.d.pooled.selectedN],
                  ].map(([label, summary, diff, n]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td className="tabular-nums">
                        {n}
                        {summary ? ` · 완성 ${summary.complete}` : ""}
                      </td>
                      <td className="tabular-nums">{fmtPct(summary?.priceMedian)}</td>
                      <td className="tabular-nums">{fmtPct(summary?.positiveRate, false)}</td>
                      <td className="tabular-nums">
                        {summary?.drawdownMedian == null ? "표본 없음" : `-${Number(summary.drawdownMedian).toFixed(2)}%`}
                      </td>
                      <td className="tabular-nums">{fmtPct(summary?.excessQqqMedian)}</td>
                      <td className="tabular-nums">{diff ? fmtPct(diff.deltaPriceMedian) : "—"}</td>
                      <td className="tabular-nums">
                        {diff?.deltaDrawdownMedian == null
                          ? "—"
                          : `${diff.deltaDrawdownMedian > 0 ? "+" : ""}${Number(diff.deltaDrawdownMedian).toFixed(2)}%p`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="yds-signal-track__summary">
              20일 — 기준 {fmtPct(report.baseline.horizons["20"].priceMedian)} · C {fmtPct(report.c.pooled.selected["20"].priceMedian)} (
              {fmtPct(report.c.pooled.vsBaseline["20"].deltaPriceMedian)}) · D{" "}
              {fmtPct(report.d.pooled.selected["20"].priceMedian)} ({fmtPct(report.d.pooled.vsBaseline["20"].deltaPriceMedian)})
            </p>
            <p className="yds-signal-track__summary">
              120일 — 기준 {fmtPct(report.baseline.horizons["120"].priceMedian)} · C{" "}
              {fmtPct(report.c.pooled.selected["120"].priceMedian)} ({fmtPct(report.c.pooled.vsBaseline["120"].deltaPriceMedian)}) · D{" "}
              {fmtPct(report.d.pooled.selected["120"].priceMedian)} ({fmtPct(report.d.pooled.vsBaseline["120"].deltaPriceMedian)})
            </p>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 B · 동일 신호일 비교</h2>
            <HorizonBlock label="C 60일" block={report.tableB.cSameDay["60"]} />
            <HorizonBlock label="C 20일" block={report.tableB.cSameDay["20"]} />
            <HorizonBlock label="C 120일" block={report.tableB.cSameDay["120"]} />
            <HorizonBlock label="D 60일" block={report.tableB.dSameDay["60"]} />
            <HorizonBlock label="D 20일" block={report.tableB.dSameDay["20"]} />
            <HorizonBlock label="D 120일" block={report.tableB.dSameDay["120"]} />
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 C · 학습·검증</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    <th scope="col">학습 수익차</th>
                    <th scope="col">검증 수익차</th>
                    <th scope="col">학습 불리차</th>
                    <th scope="col">검증 불리차</th>
                    <th scope="col">풀드 방향</th>
                    <th scope="col">동일일 방향</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["C", report.tableC.cTrain, report.tableC.cValidation, report.tableC.cDirection],
                    ["D", report.tableC.dTrain, report.tableC.dValidation, report.tableC.dDirection],
                  ].map(([label, train, validation, direction]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td className="tabular-nums">{fmtPct(train.diff60.deltaPriceMedian)}</td>
                      <td className="tabular-nums">{fmtPct(validation.diff60.deltaPriceMedian)}</td>
                      <td className="tabular-nums">
                        {train.diff60.deltaDrawdownMedian == null
                          ? "표본 없음"
                          : `${train.diff60.deltaDrawdownMedian > 0 ? "+" : ""}${Number(train.diff60.deltaDrawdownMedian).toFixed(2)}%p`}
                      </td>
                      <td className="tabular-nums">
                        {validation.diff60.deltaDrawdownMedian == null
                          ? "표본 없음"
                          : `${validation.diff60.deltaDrawdownMedian > 0 ? "+" : ""}${Number(
                              validation.diff60.deltaDrawdownMedian,
                            ).toFixed(2)}%p`}
                      </td>
                      <td>{direction.pooledReturn.status}</td>
                      <td>{direction.sameDayGap.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 D · 업종 비중·민감도</h2>
            <p className="yds-signal-track__summary">
              C 선택 업종: {(report.tableD.cSectors || []).slice(0, 5).map((row) => `${row.sector} ${row.sharePct}%`).join(" · ") || "없음"}
            </p>
            <p className="yds-signal-track__summary">
              D 선택 업종: {(report.tableD.dSectors || []).slice(0, 5).map((row) => `${row.sector} ${row.sharePct}%`).join(" · ") || "없음"}
            </p>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <caption>검증 구간 종목 제외 시 60일 기준 대비 수익차</caption>
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    <th scope="col">제외 종목</th>
                    <th scope="col">수익차</th>
                    <th scope="col">부호 반전</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...report.tableD.cSensitivity.map((row) => ["C", row]),
                    ...report.tableD.dSensitivity.map((row) => ["D", row]),
                  ].map(([label, row]) => (
                    <tr key={`${label}-${row.symbol}`}>
                      <th scope="row">{label}</th>
                      <td>{row.symbol}</td>
                      <td className="tabular-nums">{fmtPct(row.deltaPriceMedian)}</td>
                      <td>{row.flipped ? "예" : "아니오"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">표 E · 최종 판정</h2>
            {[report.tableE.c, report.tableE.d].map((row) => (
              <div key={row.component} className="yds-signal-track__block">
                <h3 className="yds-dbb-section__subtitle">
                  {row.component} — {row.verdict}
                </h3>
                <p className="yds-signal-track__summary">{row.reason}</p>
                <ul className="yds-signal-track__list">
                  {(row.checks || []).map((check) => (
                    <li key={check.id}>
                      {check.ok ? "충족" : "미충족"} · {check.detail}
                      {check.worsened ? " · 불리 악화" : ""}
                      {check.ciSupports ? " · CI 0 제외" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="yds-signal-track__summary">
              <strong>전체:</strong> {report.tableE.overall.verdict} — {report.tableE.overall.reason}
            </p>
          </section>
        </>
      ) : null}
    </div>
  )
}
