import { Link, useParams } from "react-router-dom"
import { getStockPickByTicker, STOCK_PICK_COUNTRIES } from "../content/ydsStockPickModel.js"
import { useStockPickFavorites } from "../hooks/useStockPickFavorites.js"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import YdsStockPickFavoriteButton from "../components/stock-picks/YdsStockPickFavoriteButton.jsx"
import YdsStockPickActionBlock from "../components/stock-picks/YdsStockPickActionBlock.jsx"
import YdsStockPickReasons from "../components/stock-picks/YdsStockPickReasons.jsx"
import YdsStockScoreBreakdown from "../components/stock-picks/YdsStockScoreBreakdown.jsx"
import "../styles/stock-picks-platform.css"

export default function StockPickDetailPage() {
  const { ticker = "" } = useParams()
  const marketContext = useYdsMarketContext()
  const stock = getStockPickByTicker(ticker, marketContext)
  const { isFavorite, toggleFavorite } = useStockPickFavorites()

  if (!stock) {
    return (
      <div className="yds-spick-detail min-w-0 px-3 py-4 sm:px-4">
        <p className="yds-spick-empty">종목을 찾을 수 없습니다.</p>
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
          <YdsStockPickFavoriteButton
            active={isFavorite(stock.ticker)}
            onToggle={() => toggleFavorite(stock.ticker)}
          />
        </div>
        <p className="yds-spick-detail__ticker font-mono tabular-nums">
          {stock.ticker}
          {countryMeta ? (
            <span className="yds-spick-detail__country">
              {" "}
              · {countryMeta.emoji} {countryMeta.label} {stock.rank}위
            </span>
          ) : null}
        </p>

        <YdsStockPickActionBlock stock={stock} variant="detail" />
        <YdsStockPickReasons reasons={stock.recommendReasons} variant="detail" />

        <details className="yds-spick-detail__scores">
          <summary className="yds-spick-detail__scores-summary">점수 근거</summary>
          <YdsStockScoreBreakdown
            scores={stock.scores}
            rows={stock.scoreRows}
            variant="detail"
          />
        </details>

        <p className="yds-spick-detail__eval-label">한줄 평가</p>
        <p className="yds-spick-detail__comment">{stock.comment}</p>

        <p className="yds-spick-detail__schema-note">
          추세·거래량·위치는 스냅샷 Provider · 시장 적합도는
          {stock.marketFitSource === "adapter" ? " 시장분석 Adapter 자동" : " 수동값"}
          {marketContext.ready ? ` (${marketContext.strategyLabel})` : ""}
        </p>
      </header>

      <section className="yds-spick-detail__future" aria-label="향후 확장 영역">
        <h2 className="yds-spick-detail__future-title">향후 확장</h2>
        <ul className="yds-spick-detail__future-list">
          <li>실시간 Yahoo · Naver Snapshot Provider</li>
          <li>포트폴리오 비중 연동</li>
          <li>차트 · 실적 · 뉴스</li>
        </ul>
      </section>
    </div>
  )
}
