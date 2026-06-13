import { Link, useParams } from "react-router-dom"
import { STOCK_PICK_COUNTRIES } from "../content/ydsStockPickModel.js"
import { useStockPickFavorites } from "../hooks/useStockPickFavorites.js"
import { useStockPickDetailLive } from "../hooks/useStockPickLiveData.js"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import YdsStockPickFavoriteButton from "../components/stock-picks/YdsStockPickFavoriteButton.jsx"
import YdsStockPickPriceLine from "../components/stock-picks/YdsStockPickPriceLine.jsx"
import YdsStockPickTransparencyPanel from "../components/stock-picks/YdsStockPickTransparencyPanel.jsx"
import YdsStockPickActionBlock from "../components/stock-picks/YdsStockPickActionBlock.jsx"
import YdsStockPickReasons from "../components/stock-picks/YdsStockPickReasons.jsx"
import YdsStockPickScoreDebugPanel from "../components/stock-picks/YdsStockPickScoreDebugPanel.jsx"
import YdsStockScoreBreakdown from "../components/stock-picks/YdsStockScoreBreakdown.jsx"
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

        <p className="yds-spick-detail__ticker font-mono tabular-nums">
          {stock.ticker}
          {countryMeta ? (
            <span className="yds-spick-detail__country">
              {" "}
              · {countryMeta.emoji} {countryMeta.label} {stock.rank}위
            </span>
          ) : null}
        </p>

        <YdsStockPickTransparencyPanel stock={stock} variant="detail" />
        <YdsStockPickActionBlock stock={stock} variant="detail" />
        <YdsStockPickReasons
          reasons={stock.recommendReasonsDetail ?? stock.recommendReasons}
          variant="detail"
        />

        <details className="yds-spick-detail__scores">
          <summary className="yds-spick-detail__scores-summary">점수 근거</summary>
          <YdsStockScoreBreakdown
            scores={stock.scores}
            rows={stock.scoreRows}
            decomposed={stock.decomposedScores}
            variant="detail"
          />
        </details>

        <YdsStockPickScoreDebugPanel sample={stock} />

        <p className="yds-spick-detail__eval-label">한줄 평가</p>
        <p className="yds-spick-detail__comment">{stock.comment}</p>

        <p className="yds-spick-detail__schema-note">
          추세·거래량·위치는
          실시간 시세 · 시장 적합도는
          {stock.marketFitSource === "adapter" ? " 시장분석 Adapter 자동" : " 수동값"}
          {marketContext.ready ? ` (${marketContext.strategyLabel})` : ""}
        </p>
      </header>
    </div>
  )
}
