import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useStockPickLiveData } from "../hooks/useStockPickLiveData.js"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import {
  buildRankingPageReport,
  RANKING_SORT_OPTIONS,
} from "../content/ydsStockPickRankingEngine.js"
import "../styles/stock-picks-platform.css"

export default function StockPickRankingPage() {
  const marketContext = useYdsMarketContext()
  const { liveStocks, loading } = useStockPickLiveData(marketContext)
  const [sortKey, setSortKey] = useState("aiScore")
  const [sortDir, setSortDir] = useState("desc")

  const report = useMemo(
    () => buildRankingPageReport(liveStocks, sortKey, sortDir),
    [liveStocks, sortKey, sortDir],
  )

  return (
    <div className="yds-spick-ranking-page min-w-0 px-3 py-4 sm:px-4">
      <Link to="/stock-picks" className="yds-spick-detail__back">
        ← 종목추천
      </Link>
      <header className="yds-spick-ranking-page__head">
        <h1 className="yds-spick-ranking-page__title">{report.title}</h1>
        <p className="yds-spick-ranking-page__sub">Top 100 · 실시간 AI 데이터</p>
        <Link to="/stock-picks/compare" className="yds-spick-ranking-page__link">
          종목 비교 →
        </Link>
      </header>

      <div className="yds-spick-ranking-page__sort" role="tablist">
        {RANKING_SORT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={sortKey === opt.id}
            className={[
              "yds-spick-ranking-page__sort-btn",
              sortKey === opt.id ? "yds-spick-ranking-page__sort-btn--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => {
              if (sortKey === opt.id) setSortDir((d) => (d === "desc" ? "asc" : "desc"))
              else {
                setSortKey(opt.id)
                setSortDir(opt.id === "rank" || opt.id === "priority" ? "asc" : "desc")
              }
            }}
          >
            {opt.label}
            {sortKey === opt.id ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
          </button>
        ))}
      </div>

      {loading && !report.visible ? (
        <p className="yds-spick-empty">시세 조회 중…</p>
      ) : !report.visible ? (
        <p className="yds-spick-empty">라이브 추천 데이터가 없습니다.</p>
      ) : (
        <div className="yds-spick-ranking-page__table-wrap">
          <table className="yds-spick-ranking-page__table">
            <thead>
              <tr>
                <th>#</th>
                <th>종목</th>
                <th>AI점수</th>
                <th>순위변화</th>
                <th>점수변화</th>
                <th>상태</th>
                <th>신뢰도</th>
                <th>예상수익</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.ticker}>
                  <td className="font-mono tabular-nums">{row.rank}</td>
                  <td>
                    <Link to={`/stock-picks/${row.ticker}`} className="yds-spick-ranking-page__name">
                      {row.name}
                      <span className="font-mono tabular-nums">{row.ticker}</span>
                    </Link>
                  </td>
                  <td className="font-mono tabular-nums">{row.aiScore}</td>
                  <td>{row.rankChange ? `${row.rankChange.emoji} ${row.rankChange.label}` : "—"}</td>
                  <td
                    className={[
                      "font-mono tabular-nums",
                      row.scoreDelta?.direction === "up"
                        ? "yds-rec-perf-report__up"
                        : row.scoreDelta?.direction === "down"
                          ? "yds-rec-perf-report__down"
                          : "",
                    ].join(" ")}
                  >
                    {row.scoreDelta?.display ?? "—"}
                  </td>
                  <td>{row.statusLabel}</td>
                  <td className="font-mono tabular-nums">{row.confidence ?? "—"}</td>
                  <td className="font-mono tabular-nums">+{row.expectedReturn}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
