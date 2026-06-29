import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts"
import { useStockPickLiveData } from "../hooks/useStockPickLiveData.js"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import {
  buildStockPickCompareReport,
  COMPARE_MAX,
  parseCompareTickers,
} from "../content/ydsStockPickCompareEngine.js"
import "../styles/stock-picks-platform.css"

export default function StockPickComparePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const marketContext = useYdsMarketContext()
  const { liveStocks } = useStockPickLiveData(marketContext)
  const tickers = useMemo(() => parseCompareTickers(searchParams.get("tickers") ?? ""), [searchParams])
  const [input, setInput] = useState(tickers.join(", "))

  const report = useMemo(() => buildStockPickCompareReport(liveStocks, tickers), [liveStocks, tickers])

  function applyTickers() {
    const parsed = parseCompareTickers(input)
    setSearchParams(parsed.length ? { tickers: parsed.join(",") } : {})
  }

  function toggleTicker(ticker) {
    const set = new Set(tickers)
    if (set.has(ticker)) set.delete(ticker)
    else if (set.size < COMPARE_MAX) set.add(ticker)
    const next = [...set]
    setInput(next.join(", "))
    setSearchParams(next.length ? { tickers: next.join(",") } : {})
  }

  return (
    <div className="yds-spick-compare-page min-w-0 px-3 py-4 sm:px-4">
      <Link to="/stock-picks/ranking" className="yds-spick-detail__back">
        ← AI 랭킹
      </Link>
      <header className="yds-spick-compare-page__head">
        <h1 className="yds-spick-compare-page__title">{report.title}</h1>
        <p className="yds-spick-compare-page__sub">최대 {COMPARE_MAX}개 종목 · 표 + 레이더 차트</p>
      </header>

      <div className="yds-spick-compare-page__picker">
        <input
          type="text"
          className="yds-spick-compare-page__input"
          placeholder="NVDA, AMD, TSM, AVGO"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyTickers()}
        />
        <button type="button" className="yds-spick-compare-page__btn" onClick={applyTickers}>
          비교
        </button>
      </div>

      <div className="yds-spick-compare-page__quick">
        {liveStocks.slice(0, 12).map((s) => (
          <button
            key={s.ticker}
            type="button"
            className={[
              "yds-spick-compare-page__chip",
              tickers.includes(s.ticker.toUpperCase()) ? "yds-spick-compare-page__chip--on" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => toggleTicker(s.ticker.toUpperCase())}
          >
            {s.ticker}
          </button>
        ))}
      </div>

      {!report.visible ? (
        <p className="yds-spick-empty">비교할 종목을 선택하세요 (최대 4개).</p>
      ) : (
        <>
          <div className="yds-spick-compare-page__radar">
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={report.radarData}>
                <PolarGrid stroke="rgba(100,116,139,0.35)" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: "#64748b" }} />
                {report.stocks.map((s, i) => (
                  <Radar
                    key={s.ticker}
                    name={s.ticker}
                    dataKey={s.ticker}
                    stroke={report.colors[i]}
                    fill={report.colors[i]}
                    fillOpacity={0.15}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="yds-spick-compare-page__table-wrap">
            <table className="yds-spick-compare-page__table">
              <thead>
                <tr>
                  <th>항목</th>
                  {report.stocks.map((s) => (
                    <th key={s.ticker}>{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.metrics.map((m) => (
                  <tr key={m.id}>
                    <td>{m.label}</td>
                    {report.stocks.map((s) => (
                      <td key={`${m.id}-${s.ticker}`} className="font-mono tabular-nums">
                        {String(s[m.id] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
