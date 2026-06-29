import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { loadValidationPicks } from "../content/ydsValidationStorage.js"
import {
  BACKTEST_PERIODS,
  buildStockPickBacktestReport,
} from "../content/ydsStockPickBacktestEngine.js"
import { formatPerfPct } from "../content/ydsPickPerformanceEngine.js"
import "../styles/stock-picks-platform.css"

export default function StockPickBacktestPage() {
  const [windowDays, setWindowDays] = useState(30)
  const picks = useMemo(() => loadValidationPicks(), [])
  const report = useMemo(() => buildStockPickBacktestReport(picks, windowDays), [picks, windowDays])

  return (
    <div className="yds-spick-backtest-page min-w-0 px-3 py-4 sm:px-4">
      <Link to="/performance-validation/picks" className="yds-spick-detail__back">
        ← 상세 검증
      </Link>
      <header className="yds-spick-backtest-page__head">
        <h1 className="yds-spick-backtest-page__title">{report.title}</h1>
        <p className="yds-spick-backtest-page__sub">저장된 AI 추천 실적 검증</p>
      </header>

      <div className="yds-spick-backtest-page__periods" role="tablist">
        {BACKTEST_PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={windowDays === p.days}
            className={[
              "yds-spick-backtest-page__period",
              windowDays === p.days ? "yds-spick-backtest-page__period--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setWindowDays(p.days)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!report.visible ? (
        <p className="yds-spick-empty">백테스트 데이터가 부족합니다.</p>
      ) : (
        <>
          <dl className="yds-spick-backtest-kpi">
            <div><dt>추천 수</dt><dd className="font-mono tabular-nums">{report.kpi.pickCount}</dd></div>
            <div><dt>누적 수익률</dt><dd className="font-mono tabular-nums">{formatPerfPct(report.kpi.cumulativeReturn)}</dd></div>
            <div><dt>승률</dt><dd className="font-mono tabular-nums">{report.kpi.winRate != null ? `${report.kpi.winRate}%` : "—"}</dd></div>
            <div><dt>평균 수익률</dt><dd className="font-mono tabular-nums">{formatPerfPct(report.kpi.avgReturn)}</dd></div>
            <div><dt>최대 손실(MDD)</dt><dd className="font-mono tabular-nums">{formatPerfPct(report.kpi.mdd)}</dd></div>
            <div><dt>Sharpe</dt><dd className="font-mono tabular-nums">{report.kpi.sharpe ?? "—"}</dd></div>
            <div><dt>SPY Alpha</dt><dd className="font-mono tabular-nums">{formatPerfPct(report.kpi.alpha)}</dd></div>
          </dl>

          {report.equityCurve.length ? (
            <section className="yds-spick-backtest-section">
              <h2 className="yds-spick-backtest-section__title">누적 자산 곡선</h2>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={report.equityCurve}>
                  <CartesianGrid stroke="rgba(100,116,139,0.25)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                  <Line type="monotone" dataKey="cumulative" stroke="#38bdf8" strokeWidth={2} dot={false} name="누적%" />
                  <Bar dataKey="monthly" fill="rgba(74,222,128,0.35)" name="월%" />
                </ComposedChart>
              </ResponsiveContainer>
            </section>
          ) : null}

          {report.monthly.length ? (
            <section className="yds-spick-backtest-section">
              <h2 className="yds-spick-backtest-section__title">월별 수익률</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={report.monthly}>
                  <CartesianGrid stroke="rgba(100,116,139,0.25)" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                  <Bar dataKey="avgReturn" fill="#4ade80" name="평균%" />
                </BarChart>
              </ResponsiveContainer>
            </section>
          ) : null}

          {report.perPick.length ? (
            <section className="yds-spick-backtest-section">
              <h2 className="yds-spick-backtest-section__title">추천 종목별 성과</h2>
              <div className="yds-spick-backtest-page__table-wrap">
                <table className="yds-spick-backtest-page__table">
                  <thead>
                    <tr>
                      <th>종목</th>
                      <th>추천일</th>
                      <th>수익률</th>
                      <th>결과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.perPick.slice(0, 30).map((row) => (
                      <tr key={`${row.ticker}-${row.recommendedAt}`}>
                        <td>{row.name}</td>
                        <td className="font-mono tabular-nums">{row.recommendedAt}</td>
                        <td className={["font-mono tabular-nums", row.success ? "yds-rec-perf-report__up" : "yds-rec-perf-report__down"].join(" ")}>
                          {row.returnLabel}
                        </td>
                        <td>{row.success ? "성공" : "실패"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
