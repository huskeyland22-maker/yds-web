import { Link, useParams } from "react-router-dom"
import { STOCK_PICK_COUNTRIES } from "../content/ydsStockPickModel.js"
import { useStockPickFavorites } from "../hooks/useStockPickFavorites.js"
import { useStockPickDetailLive } from "../hooks/useStockPickLiveData.js"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import YdsStockPickFavoriteButton from "../components/stock-picks/YdsStockPickFavoriteButton.jsx"
import YdsStockPickPriceLine from "../components/stock-picks/YdsStockPickPriceLine.jsx"
import YdsStockPickScoreDetailPanel from "../components/stock-picks/YdsStockPickScoreDetailPanel.jsx"
import YdsStockPositionBadge from "../components/stock-picks/YdsStockPositionBadge.jsx"
import YdsStockPickTrustExtras from "../components/stock-picks/YdsStockPickTrustExtras.jsx"
import YdsStockPickScoreBreakdown from "../components/stock-picks/YdsStockPickScoreBreakdown.jsx"
import YdsStockPickAiAnalysisPanel from "../components/stock-picks/YdsStockPickAiAnalysisPanel.jsx"
import "../styles/stock-picks-platform.css"

export default function StockPickDetailPage() {
  const { ticker = "" } = useParams()
  const marketContext = useYdsMarketContext()
  const { stock, loading, liveReady } = useStockPickDetailLive(ticker, marketContext)
  const { isFavorite, toggleFavorite } = useStockPickFavorites()

  if (loading && !stock) {
    return (
      <div className="yds-spick-detail min-w-0 px-3 py-4 sm:px-4">
        <p className="yds-spick-empty">시세 조회 중…</p>
        <Link to="/stock-picks" className="yds-spick-detail__back">
          ← 종목추천
        </Link>
      </div>
    )
  }

  if (!stock || stock.dataSource !== "live") {
    return (
      <div className="yds-spick-detail min-w-0 px-3 py-4 sm:px-4">
        <p className="yds-spick-empty">
          {!loading && liveReady ? "데이터 수집중" : loading ? "시세 조회 중…" : "종목을 찾을 수 없습니다."}
        </p>
        <Link to="/stock-picks" className="yds-spick-detail__back">
          ← 종목추천
        </Link>
      </div>
    )
  }

  const countryMeta = STOCK_PICK_COUNTRIES.find((c) => c.id === stock.country)

  return (
    <div className="yds-spick-detail min-w-0 px-3 py-4 sm:px-4">
      <Link to="/stock-picks" className="yds-spick-detail__back">
        ← 종목추천
      </Link>

      <header className="yds-spick-detail__hero">
        <div className="yds-spick-detail__head-row">
          <h1 className="yds-spick-detail__title">{stock.name}</h1>
          {stock.quoteSource ? (
            <span className="yds-spick-detail__source">Source: {stock.quoteSource}</span>
          ) : null}
          <YdsStockPickFavoriteButton
            active={isFavorite(stock.ticker)}
            onToggle={() => toggleFavorite(stock.ticker)}
          />
        </div>
        <YdsStockPickPriceLine stock={stock} />

        <YdsStockPositionBadge stock={stock} variant="detail" />

        <YdsStockPickScoreBreakdown stock={stock} className="yds-spick-detail__score-breakdown" />

        <YdsStockPickAiAnalysisPanel
          report={stock.aiAnalysisReport}
          className="yds-spick-detail__ai-analysis"
        />

        <YdsStockPickTrustExtras trustReport={stock.trustReport} className="yds-spick-detail__trust" />

        <p className="yds-spick-detail__ticker font-mono tabular-nums">
          {stock.ticker}
          {countryMeta ? (
            <span className="yds-spick-detail__country">
              {" "}
              · {countryMeta.emoji} {countryMeta.label} {stock.rank}위
            </span>
          ) : null}
        </p>

        <YdsStockPickScoreDetailPanel stock={stock} />
      </header>
    </div>
  )
}
