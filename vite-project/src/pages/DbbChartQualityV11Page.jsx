import { useEffect, useState } from "react"
import { CHART_QUALITY_V11_BASIS, CHART_QUALITY_V11_PATH } from "../content/dbbChartQualityV11.js"

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

export default function DbbChartQualityV11Page() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(CHART_QUALITY_V11_PATH, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error("감사 자료를 불러오지 못했습니다.")
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
        <p className="yds-dbb__kicker">DBB AUDIT V11</p>
        <h1 className="yds-dbb__title">{CHART_QUALITY_V11_BASIS.title}</h1>
        <p className="yds-dbb__lead">{CHART_QUALITY_V11_BASIS.scope}</p>
      </header>

      <aside className="yds-dbb__notice" aria-label="감사 범위">
        <p>{CHART_QUALITY_V11_BASIS.researchOnly}</p>
        {report ? (
          <>
            <p>
              기준일 {report.asOf || "없음"}. v10 재현 {report.reproduce?.ok ? "일치" : "불일치"}. 매칭{" "}
              {report.counts?.matched} / 미매칭 {report.counts?.unmatched}.
            </p>
            <p>{CHART_QUALITY_V11_BASIS.caution}</p>
          </>
        ) : null}
      </aside>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}

      {report ? (
        <>
          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">v10 재현</h2>
            <ul className="yds-signal-track__list">
              {(report.reproduce?.checks || []).map((check) => (
                <li key={check.id}>
                  {check.ok ? "일치" : "불일치"} · {check.detail}: 기대 {String(check.expected)} / 실제{" "}
                  {String(check.actual)}
                </li>
              ))}
            </ul>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">매칭군 vs 미매칭군</h2>
            <p className="yds-signal-track__summary">
              매칭 {report.matchingBias.matchedN} · 미매칭 {report.matchingBias.unmatchedN}. 사유:{" "}
              {Object.entries(report.matchingBias.reasons || {})
                .map(([k, v]) => `${k} ${v}`)
                .join(" · ")}
            </p>
            <p className="yds-signal-track__summary">
              SMD dd20 {report.matchingBias.covariates.dd20.smd} · vol20 {report.matchingBias.covariates.vol20.smd} ·
              qqq20 {report.matchingBias.covariates.qqqRet20.smd}. 사후 60일 수익 SMD{" "}
              {report.matchingBias.postHocOutcomes.ret60.smd} ({report.matchingBias.postHocOutcomes.warning})
            </p>
            <p className="yds-signal-track__summary">
              매칭 후 |Δ| 재현: dd20 {report.balance.recomputed?.dd20} · vol20 {report.balance.recomputed?.vol20} · qqq20{" "}
              {report.balance.recomputed?.qqqRet20} ({report.balance.matchesReported ? "v10과 일치" : "불일치"})
            </p>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">독립성 · 구간 중첩</h2>
            <p className="yds-signal-track__summary">
              대조 중복 {report.independence.duplicateControls}. 신호−대조 거래일 간격 중앙값{" "}
              {report.independence.gapsTrading?.median}. 동일 종목 60일 구간 중첩{" "}
              {fmtPct(report.independence.sameSymbolWindowOverlap60?.ratePct, false)} (
              {report.independence.sameSymbolWindowOverlap60?.overlapping}/
              {report.independence.sameSymbolWindowOverlap60?.complete}).
            </p>
            <p className="yds-signal-track__summary">
              대조가 다른 신호 ±20일 내 {fmtPct(report.independence.controlsNearOtherSignal20?.ratePct, false)}. 학습
              신호 60일 종료→검증 달력 {report.independence.splitBoundary?.trainSignalHorizonEndsInValidation}건.
            </p>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">부트스트랩 비교 (60일)</h2>
            <div className="yds-dbb-research__scroll">
              <table className="yds-dbb-research__table yds-signal-track__table">
                <thead>
                  <tr>
                    <th scope="col">구분</th>
                    <th scope="col">중앙값 Δ</th>
                    <th scope="col">CI</th>
                    <th scope="col">0 제외</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">전체 · 날짜 클러스터</th>
                    <td className="tabular-nums">{fmtPct(report.core.overall.sameDay.gapMedian)}</td>
                    <td className="tabular-nums">{bootLabel(report.core.overall.sameDay.bootstrap)}</td>
                    <td>{report.core.overall.sameDay.bootstrap.excludesZero ? "예" : "아니오"}</td>
                  </tr>
                  <tr>
                    <th scope="row">전체 · 시간 블록 60</th>
                    <td className="tabular-nums">{fmtPct(report.bootstrap.blockOverall.primary.mean)}</td>
                    <td className="tabular-nums">{bootLabel(report.bootstrap.blockOverall.primary)}</td>
                    <td>{report.bootstrap.blockOverall.primary.excludesZero ? "예" : "아니오"}</td>
                  </tr>
                  <tr>
                    <th scope="row">검증 · 날짜 클러스터</th>
                    <td className="tabular-nums">{fmtPct(report.core.validation.sameDay.gapMedian)}</td>
                    <td className="tabular-nums">{bootLabel(report.core.validation.sameDay.bootstrap)}</td>
                    <td>{report.core.validation.sameDay.bootstrap.excludesZero ? "예" : "아니오"}</td>
                  </tr>
                  <tr>
                    <th scope="row">검증 · 시간 블록 60</th>
                    <td className="tabular-nums">{fmtPct(report.bootstrap.blockValidation.primary.mean)}</td>
                    <td className="tabular-nums">{bootLabel(report.bootstrap.blockValidation.primary)}</td>
                    <td>{report.bootstrap.blockValidation.primary.excludesZero ? "예" : "아니오"}</td>
                  </tr>
                  {["40", "90"].map((len) => (
                    <tr key={len}>
                      <th scope="row">전체 · 블록 민감도 {len}</th>
                      <td className="tabular-nums">
                        {fmtPct(report.bootstrap.blockOverall.sensitivity[len]?.mean)}
                      </td>
                      <td className="tabular-nums">{bootLabel(report.bootstrap.blockOverall.sensitivity[len])}</td>
                      <td>{report.bootstrap.blockOverall.sensitivity[len]?.excludesZero ? "예" : "아니오"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="yds-signal-track__summary">
              학습 60일 중앙값 Δ {fmtPct(report.core.train.returnMedian)} · 검증 {fmtPct(report.core.validation.returnMedian)}.{" "}
              {report.core.validation.highlight}
            </p>
          </section>

          <section className="yds-dbb-section">
            <h2 className="yds-dbb-section__title">감사 판정</h2>
            <p className="yds-signal-track__summary">
              <strong>{report.verdict.level}</strong> — {report.verdict.reason}
            </p>
            <ul className="yds-signal-track__list">
              {(report.verdict.findings || []).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  )
}
