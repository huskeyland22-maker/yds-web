import { Link, useParams } from "react-router-dom"
import { getStockPickByTicker } from "../content/ydsStockPickModel.js"
import { useStockPickFavorites } from "../hooks/useStockPickFavorites.js"
import YdsStockPickFavoriteButton from "../components/stock-picks/YdsStockPickFavoriteButton.jsx"
import "../styles/stock-picks-platform.css"

export default function StockPickDetailPage() {
  const { ticker = "" } = useParams()
  const stock = getStockPickByTicker(ticker)
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
        <p className="yds-spick-detail__ticker font-mono tabular-nums">{stock.ticker}</p>
        <p className="yds-spick-detail__stars">{stock.stars}</p>
        <p className="yds-spick-detail__status">
          {stock.statusView.emoji} {stock.statusView.label}
        </p>
        <p className="yds-spick-detail__score font-mono tabular-nums">YDS 점수 {stock.score}</p>
        <p className="yds-spick-detail__comment">{stock.comment}</p>
      </header>

      <section className="yds-spick-detail__future" aria-label="향후 확장 영역">
        <h2 className="yds-spick-detail__future-title">향후 확장</h2>
        <ul className="yds-spick-detail__future-list">
          <li>차트</li>
          <li>실적</li>
          <li>데이터</li>
          <li>뉴스</li>
        </ul>
        <p className="yds-spick-detail__future-note">Phase 2-2 이후 연동 예정 · 현재 더미 페이지</p>
      </section>
    </div>
  )
}
