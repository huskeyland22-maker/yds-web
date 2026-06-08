import { useMemo } from "react"
import { Link } from "react-router-dom"
import { buildCompareView, MIN_COMPARE_SAMPLES } from "../content/ydsCompareEngine.js"
import { useYdsActionLog } from "../hooks/useYdsActionLog.js"
import { UI_PAGE } from "../utils/ydsUiLabels.js"
import "../styles/yds-compare.css"

function formatReturn(v) {
  if (v == null || !Number.isFinite(v)) return "—"
  return `${v > 0 ? "+" : ""}${v}%`
}

export default function YdsComparePage() {
  const { entries } = useYdsActionLog()
  const view = useMemo(() => buildCompareView(entries), [entries])

  return (
    <div className="yds-compare min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-compare__header">
        <p className="yds-compare__kicker">{UI_PAGE.compare.kicker}</p>
        <h1 className="yds-compare__title">{UI_PAGE.compare.title}</h1>
        <p className="yds-compare__sub">
          YDS 권장 vs 실제 ·{" "}
          <Link to="/action-log">행동 로그</Link>
          {" · "}
          <Link to="/ops-dashboard">운영 대시보드</Link>
        </p>
      </header>

      <div
        className={[
          "yds-compare__status",
          view.statsReady ? "yds-compare__status--ready" : "yds-compare__status--pending",
        ].join(" ")}
        role="status"
      >
        <p className="yds-compare__status-text">{view.statusMessage}</p>
        <p className="yds-compare__status-meta font-mono tabular-nums">
          전체 {view.totalEntries}건 · 수익률 기록 {view.returnEntryCount}건 / {MIN_COMPARE_SAMPLES}
        </p>
      </div>

      <section className="yds-compare__legend" aria-label="비교 항목">
        <h2 className="yds-compare__section-title">비교 항목</h2>
        <ul className="yds-compare__legend-list">
          <li>YDS 준수율 — 행동 로그 기록</li>
          <li>실제 수익률 — 시작·종료 자산 기록</li>
          <li className="yds-compare__legend-future">YDS 예상 결과 — 향후 연동 (현재 구조만)</li>
          <li>실제 결과 — 수익률과 동일</li>
        </ul>
      </section>

      <section className="yds-compare__table-section" aria-labelledby="compare-rows">
        <h2 id="compare-rows" className="yds-compare__section-title">
          기록별 비교
        </h2>
        {!view.rows.length ? (
          <p className="yds-compare__empty">
            <Link to="/action-log">행동 로그</Link>에 기록을 추가하면 비교가 시작됩니다.
          </p>
        ) : (
          <div className="yds-compare__table-wrap">
            <table className="yds-compare__table">
              <thead>
                <tr>
                  <th scope="col">날짜</th>
                  <th scope="col">준수율</th>
                  <th scope="col">실제 수익률</th>
                  <th scope="col">YDS 예상</th>
                  <th scope="col">실제 결과</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-mono tabular-nums">{row.date}</td>
                    <td className="font-mono tabular-nums">{row.compliancePct}%</td>
                    <td className="font-mono tabular-nums">{formatReturn(row.actualReturnPct)}</td>
                    <td className="yds-compare__future-cell">향후 연동</td>
                    <td className="font-mono tabular-nums">
                      {row.actualStatus === "recorded" ? formatReturn(row.actualReturnPct) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="yds-compare__future" aria-labelledby="compare-future-stats">
        <h2 id="compare-future-stats" className="yds-compare__section-title">
          향후 통계 (준수율 × 수익률)
        </h2>
        {!view.statsReady ? (
          <p className="yds-compare__future-locked">
            {MIN_COMPARE_SAMPLES}건 미만 — 확정적 결론을 표시하지 않습니다. YDS는 예측을 주장하지
            않으며, 실행 결과를 시간을 통해 검증합니다.
          </p>
        ) : view.futureStats ? (
          <div className="yds-compare__buckets">
            <article className="yds-compare__bucket">
              <p className="yds-compare__bucket-label">{view.futureStats.highCompliance.label}</p>
              <p className="yds-compare__bucket-value font-mono tabular-nums">
                {view.futureStats.highCompliance.enabled
                  ? `평균 ${formatReturn(view.futureStats.highCompliance.avgReturnPct)}`
                  : "—"}
              </p>
              <p className="yds-compare__bucket-meta">{view.futureStats.highCompliance.count}건</p>
            </article>
            <article className="yds-compare__bucket">
              <p className="yds-compare__bucket-label">{view.futureStats.lowCompliance.label}</p>
              <p className="yds-compare__bucket-value font-mono tabular-nums">
                {view.futureStats.lowCompliance.enabled
                  ? `평균 ${formatReturn(view.futureStats.lowCompliance.avgReturnPct)}`
                  : "—"}
              </p>
              <p className="yds-compare__bucket-meta">{view.futureStats.lowCompliance.count}건</p>
            </article>
          </div>
        ) : null}
        {view.statsReady ? (
          <p className="yds-compare__disclaimer">
            참고용 통계입니다 · 인과관계를 단정하지 않습니다
          </p>
        ) : null}
      </section>

      {view.scatterPoints.length > 0 ? (
        <section className="yds-compare__samples" aria-label="예시 패턴">
          <h2 className="yds-compare__section-title">기록 예시</h2>
          <ul className="yds-compare__sample-list">
            {view.scatterPoints.slice(0, 4).map((p) => (
              <li key={p.date} className="yds-compare__sample-item font-mono tabular-nums">
                준수율 {p.compliancePct}% · 실제 {formatReturn(p.returnPct)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
