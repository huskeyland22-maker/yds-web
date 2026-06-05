import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  buildPerformanceDashboardFromPaperTrading,
  PERFORMANCE_PERIOD_FILTERS,
  PERFORMANCE_DASHBOARD_LABEL,
} from "../trading-zone/ydsPerformanceDashboardEngine.js"
import { formatJournalReturnPct } from "../trading-zone/ydsPrecursorEnginePhase28.js"

function StatCard({ label, value, tone = "neutral" }) {
  const toneClass =
    tone === "up" ? "yds-perf-dash__stat--up" : tone === "down" ? "yds-perf-dash__stat--down" : ""
  return (
    <article className={`yds-perf-dash__stat ${toneClass}`}>
      <span className="yds-perf-dash__stat-key">{label}</span>
      <strong className="yds-perf-dash__stat-val font-mono tabular-nums">{value}</strong>
    </article>
  )
}

export default function PerformanceDashboardPage() {
  const [period, setPeriod] = useState("all")

  const report = useMemo(
    () => buildPerformanceDashboardFromPaperTrading(period),
    [period],
  )

  const { summary, charts, gradeStats, sectorStats, top10, worst10, counts } = report

  return (
    <div className="yds-perf-dash min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-perf-dash__header">
        <div>
          <p className="yds-perf-dash__kicker">{PERFORMANCE_DASHBOARD_LABEL}</p>
          <h1 className="yds-perf-dash__title">{report.title}</h1>
          <p className="yds-perf-dash__sub">
            Paper Trading 기준 · OPEN {counts.open} · CLOSED {counts.closed} · 실제 매매 아님
          </p>
        </div>
        <Link to="/market-analysis" className="yds-perf-dash__link">
          현재 시장 분석
        </Link>
        <Link to="/performance-center" className="yds-perf-dash__link">
          성과센터
        </Link>
      </header>

      <div className="yds-perf-dash__filters" role="tablist" aria-label="기간 필터">
        {PERFORMANCE_PERIOD_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={period === f.id}
            className={period === f.id ? "is-active" : ""}
            onClick={() => setPeriod(/** @type {typeof period} */ (f.id))}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!report.available ? (
        <p className="yds-perf-dash__empty">
          Paper Trading 기록이 없습니다. 현재 시장 분석에서 진입 신호 A/B 동기화 후 다시 확인하세요.
        </p>
      ) : (
        <>
          <section className="yds-perf-dash__summary" aria-label="집계">
            <StatCard label="총 거래수" value={String(summary.totalTrades)} />
            <StatCard label="승률" value={summary.winRateDisplay} />
            <StatCard label="평균수익" value={summary.avgProfitDisplay} tone="up" />
            <StatCard label="평균보유일" value={summary.avgHoldingDays != null ? `${summary.avgHoldingDays}일` : "—"} />
            <StatCard label="최대수익" value={summary.maxProfitDisplay} tone="up" />
            <StatCard label="최대손실" value={summary.maxLossDisplay} tone="down" />
            <StatCard label="Profit Factor" value={summary.profitFactorDisplay} />
            <StatCard label="MDD" value={summary.mddDisplay} tone="down" />
          </section>

          <section className="yds-perf-dash__charts">
            <article className="yds-perf-dash__chart-card">
              <h2 className="yds-perf-dash__h2">누적 수익곡선</h2>
              <div className="yds-perf-dash__chart-box">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={charts.cumulativeCurve} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(42,54,72,0.5)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#787b86" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#787b86" }} unit="%" />
                    <Tooltip
                      contentStyle={{
                        background: "#131722",
                        border: "1px solid rgba(42,54,72,0.8)",
                        fontSize: 11,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#2962ff"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>

            <div className="yds-perf-dash__chart-row">
              <article className="yds-perf-dash__chart-card">
                <h2 className="yds-perf-dash__h2">월별 성과</h2>
                <div className="yds-perf-dash__chart-box">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={charts.monthlyPerformance} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(42,54,72,0.5)" strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#787b86" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#787b86" }} unit="%" />
                      <Tooltip
                        contentStyle={{
                          background: "#131722",
                          border: "1px solid rgba(42,54,72,0.8)",
                          fontSize: 11,
                        }}
                      />
                      <Bar dataKey="avgReturn" fill="#26a69a" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="yds-perf-dash__chart-card">
                <h2 className="yds-perf-dash__h2">승률 추이</h2>
                <div className="yds-perf-dash__chart-box">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={charts.winRateTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(42,54,72,0.5)" strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#787b86" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#787b86" }} unit="%" domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          background: "#131722",
                          border: "1px solid rgba(42,54,72,0.8)",
                          fontSize: 11,
                        }}
                      />
                      <Line type="monotone" dataKey="winRate" stroke="#fbbf24" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </article>
            </div>
          </section>

          <div className="yds-perf-dash__grid-2">
            <section className="yds-perf-dash__table-section">
              <h2 className="yds-perf-dash__h2">등급별 성과</h2>
              <table className="yds-perf-dash__table">
                <thead>
                  <tr>
                    <th>등급</th>
                    <th>건수</th>
                    <th>승률</th>
                    <th>평균수익</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeStats.map((g) => (
                    <tr key={g.grade}>
                      <td>{g.grade}</td>
                      <td className="font-mono tabular-nums">{g.count}</td>
                      <td className="font-mono tabular-nums">
                        {g.winRate != null ? `${g.winRate}%` : "—"}
                      </td>
                      <td className="font-mono tabular-nums">{formatJournalReturnPct(g.avgReturn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="yds-perf-dash__table-section">
              <h2 className="yds-perf-dash__h2">섹터별 성과</h2>
              <table className="yds-perf-dash__table">
                <thead>
                  <tr>
                    <th>섹터</th>
                    <th>건수</th>
                    <th>승률</th>
                    <th>평균수익</th>
                  </tr>
                </thead>
                <tbody>
                  {sectorStats.map((s) => (
                    <tr key={s.sectorId}>
                      <td>{s.label}</td>
                      <td className="font-mono tabular-nums">{s.count}</td>
                      <td className="font-mono tabular-nums">
                        {s.winRate != null ? `${s.winRate}%` : "—"}
                      </td>
                      <td className="font-mono tabular-nums">{formatJournalReturnPct(s.avgReturn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <div className="yds-perf-dash__grid-2">
            <section className="yds-perf-dash__table-section">
              <h2 className="yds-perf-dash__h2">TOP Performer · Top 10</h2>
              <ol className="yds-perf-dash__rank">
                {top10.map((p, i) => (
                  <li key={p.id}>
                    <span className="yds-perf-dash__rank-n">{i + 1}</span>
                    <span>{p.name}</span>
                    <span className="yds-perf-dash__rank-grade">{p.grade}</span>
                    <strong className="yds-perf-dash__pct--up font-mono tabular-nums">
                      {formatJournalReturnPct(p.returnPct)}
                    </strong>
                  </li>
                ))}
              </ol>
            </section>

            <section className="yds-perf-dash__table-section">
              <h2 className="yds-perf-dash__h2">Worst 10</h2>
              <ol className="yds-perf-dash__rank">
                {worst10.map((p, i) => (
                  <li key={p.id}>
                    <span className="yds-perf-dash__rank-n">{i + 1}</span>
                    <span>{p.name}</span>
                    <span className="yds-perf-dash__rank-grade">{p.grade}</span>
                    <strong className="yds-perf-dash__pct--down font-mono tabular-nums">
                      {formatJournalReturnPct(p.returnPct)}
                    </strong>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
