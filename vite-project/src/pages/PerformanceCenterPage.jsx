import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useAppDataStore } from "../store/appDataStore.js"
import { panicDataFromCycleRow, mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../trading-zone/ydsHistoricalValidationEvents.js"
import { buildCurrentMarketAnalysisReport } from "../trading-zone/ydsCurrentMarketAnalysis.js"
import {
  buildPerformanceCenterFromPaperTrading,
  buildMonthlyTableForYearFromPaper,
  PERFORMANCE_CENTER_LABEL,
} from "../trading-zone/ydsPerformanceCenterEngine.js"
import PerformanceTradingTools from "../components/performance/PerformanceTradingTools.jsx"
import YdsV1ReleaseBadge from "../components/trust/YdsV1ReleaseBadge.jsx"

function StatCard({ label, value, tone = "neutral" }) {
  const toneClass =
    tone === "up" ? "yds-perf-center__stat--up" : tone === "down" ? "yds-perf-center__stat--down" : ""
  return (
    <article className={`yds-perf-center__stat ${toneClass}`}>
      <span className="yds-perf-center__stat-key">{label}</span>
      <strong className="yds-perf-center__stat-val font-mono tabular-nums">{value}</strong>
    </article>
  )
}

export default function PerformanceCenterPage() {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )
  const latestCycleRow = history[history.length - 1] ?? null
  const latestSnapshot = useMemo(() => {
    if (!latestCycleRow) return null
    const panic = panicDataFromCycleRow(latestCycleRow)
    if (panic) return { ...latestCycleRow, ...panic, date: latestCycleRow.date ?? panic.updatedAt }
    return latestCycleRow
  }, [latestCycleRow])

  const marketReport = useMemo(
    () =>
      buildCurrentMarketAnalysisReport(YDS_VALIDATION_EVENT_DATASET, {
        latestSnapshot,
        extraRows: history,
      }),
    [latestSnapshot, history],
  )

  const report = useMemo(() => buildPerformanceCenterFromPaperTrading(), [])
  const [year, setYear] = useState(report.sectionC.defaultYear)

  const monthly = useMemo(() => {
    if (!report.available) return []
    return buildMonthlyTableForYearFromPaper(year)
  }, [report.available, year])

  const { sectionA, sectionB, sectionD, sectionE, counts } = report

  const recoHistoryHref =
    sectionE.bestStock?.name != null
      ? `/recommendation-history?q=${encodeURIComponent(sectionE.bestStock.name)}`
      : "/recommendation-history"

  return (
    <div className="yds-perf-center min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-perf-center__header">
        <div>
          <YdsV1ReleaseBadge compact />
          <p className="yds-perf-center__kicker">{PERFORMANCE_CENTER_LABEL}</p>
          <h1 className="yds-perf-center__title">{report.title}</h1>
          <p className="yds-perf-center__sub">
            시장 위치 추천 성과 · Paper Trading · OPEN {counts.open} · CLOSED {counts.closed}
          </p>
        </div>
        <Link to="/market-analysis" className="yds-perf-center__link">
          현재 시장 분석
        </Link>
        <Link to={recoHistoryHref} className="yds-perf-center__link">
          추천 당시 기록
        </Link>
      </header>

      {!report.available ? (
        <p className="yds-perf-center__empty">
          Paper Trading 기록이 없습니다. 현재 시장 분석에서 Entry Radar A/B 동기화 후 다시 확인하세요.
        </p>
      ) : (
        <>
          <section className="yds-perf-center__section" aria-labelledby="perf-center-a">
            <h2 id="perf-center-a" className="yds-perf-center__h2">
              A. 누적 성과 요약
            </h2>
            <div className="yds-perf-center__stat-grid">
              <StatCard label="누적 수익률" value={sectionA.cumulativeReturnDisplay} tone="up" />
              <StatCard label="승률" value={sectionA.winRateDisplay} />
              <StatCard label="평균 수익" value={sectionA.avgWinDisplay} tone="up" />
              <StatCard label="평균 손실" value={sectionA.avgLossDisplay} tone="down" />
              <StatCard label="Profit Factor" value={sectionA.profitFactorDisplay} />
              <StatCard label="최대 MDD" value={sectionA.mddDisplay} tone="down" />
            </div>
          </section>

          <section className="yds-perf-center__section" aria-labelledby="perf-center-b">
            <h2 id="perf-center-b" className="yds-perf-center__h2">
              B. 벤치마크 비교
            </h2>
            <p className="yds-perf-center__note">{report.benchmarkNote}</p>
            <div className="yds-perf-center__bench-wrap">
              <table className="yds-perf-center__table">
                <thead>
                  <tr>
                    <th>지수</th>
                    <th>수익률</th>
                    <th>vs YDS</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionB.benchmarks.map((b) => (
                    <tr
                      key={b.id}
                      className={b.isPrimary ? "yds-perf-center__row--primary" : ""}
                    >
                      <td>{b.label}</td>
                      <td className="font-mono tabular-nums">{b.returnDisplay}</td>
                      <td
                        className={[
                          "font-mono tabular-nums",
                          b.vsYds != null && b.vsYds > 0
                            ? "yds-perf-center__pct--up"
                            : b.vsYds != null && b.vsYds < 0
                              ? "yds-perf-center__pct--down"
                              : "",
                        ].join(" ")}
                      >
                        {b.vsYdsDisplay}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-perf-center__section" aria-labelledby="perf-center-c">
            <h2 id="perf-center-c" className="yds-perf-center__h2">
              C. 월별 성과
            </h2>
            <div className="yds-perf-center__year-filter">
              <label htmlFor="perf-center-year">연도</label>
              <select
                id="perf-center-year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              >
                {report.sectionC.yearsAvailable.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="yds-perf-center__table-wrap">
              <table className="yds-perf-center__table">
                <thead>
                  <tr>
                    <th>월</th>
                    <th>수익률</th>
                    <th>건수</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((row) => (
                    <tr key={row.label} className={`yds-perf-center__row--${row.tone}`}>
                      <td>{row.monthLabel}</td>
                      <td className="font-mono tabular-nums">{row.returnDisplay}</td>
                      <td className="font-mono tabular-nums">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-perf-center__section" aria-labelledby="perf-center-d">
            <h2 id="perf-center-d" className="yds-perf-center__h2">
              D. 추천 이력 성과
            </h2>
            <div className="yds-perf-center__table-wrap">
              <table className="yds-perf-center__table yds-perf-center__table--history">
                <thead>
                  <tr>
                    <th>추천일</th>
                    <th>종목</th>
                    <th>점수</th>
                    <th>현재 수익</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionD.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono tabular-nums">{String(row.recommendedAt).slice(0, 10)}</td>
                      <td className="yds-perf-center__name">
                        <Link
                          to={`/recommendation-history?q=${encodeURIComponent(row.name)}`}
                          className="yds-perf-center__name-link"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="font-mono tabular-nums">{row.scoreDisplay}</td>
                      <td
                        className={[
                          "font-mono tabular-nums",
                          row.returnPct != null && row.returnPct > 0
                            ? "yds-perf-center__pct--up"
                            : row.returnPct != null && row.returnPct < 0
                              ? "yds-perf-center__pct--down"
                              : "",
                        ].join(" ")}
                      >
                        {row.returnDisplay}
                      </td>
                      <td>
                        <span
                          className={
                            row.status === "OPEN"
                              ? "yds-perf-center__status--open"
                              : "yds-perf-center__status--closed"
                          }
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-perf-center__section" aria-labelledby="perf-center-e">
            <h2 id="perf-center-e" className="yds-perf-center__h2">
              E. Top Performer
            </h2>
            <div className="yds-perf-center__top-grid">
              <article className="yds-perf-center__top-card">
                <span className="yds-perf-center__top-key">최고 수익 종목</span>
                {sectionE.bestStock ? (
                  <>
                    <Link
                      to={`/recommendation-history?q=${encodeURIComponent(sectionE.bestStock.name)}`}
                      className="yds-perf-center__name-link"
                    >
                      <strong>{sectionE.bestStock.name}</strong>
                    </Link>
                    <span className="yds-perf-center__pct--up font-mono tabular-nums">
                      {sectionE.bestStock.returnDisplay}
                    </span>
                    <span className="yds-perf-center__top-meta">등급 {sectionE.bestStock.grade}</span>
                  </>
                ) : (
                  <span>—</span>
                )}
              </article>
              <article className="yds-perf-center__top-card">
                <span className="yds-perf-center__top-key">최고 승률 섹터</span>
                {sectionE.bestSector ? (
                  <>
                    <strong>{sectionE.bestSector.label}</strong>
                    <span className="font-mono tabular-nums">승률 {sectionE.bestSector.winRateDisplay}</span>
                    <span className="yds-perf-center__top-meta">
                      평균 {sectionE.bestSector.avgReturnDisplay}
                    </span>
                  </>
                ) : (
                  <span>—</span>
                )}
              </article>
              <article className="yds-perf-center__top-card">
                <span className="yds-perf-center__top-key">최고 성과 전략</span>
                {sectionE.bestStrategy ? (
                  <>
                    <strong>{sectionE.bestStrategy.label}</strong>
                    <span className="font-mono tabular-nums">
                      승률 {sectionE.bestStrategy.winRateDisplay}
                    </span>
                    <span className="yds-perf-center__top-meta">
                      평균 {sectionE.bestStrategy.avgReturnDisplay}
                    </span>
                  </>
                ) : (
                  <span>—</span>
                )}
              </article>
            </div>
          </section>

          <PerformanceTradingTools
            entryRadar={marketReport.entryRadar}
            tradingJournal={marketReport.tradingJournal}
          />

          <ul className="yds-perf-center__footnotes">
            {report.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
