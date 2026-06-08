import { Link, useParams } from "react-router-dom"
import { getStockPickByTicker } from "../content/ydsStockPickModel.js"
import { useStockPickFavorites } from "../hooks/useStockPickFavorites.js"
import YdsStockPickFavoriteButton from "../components/stock-picks/YdsStockPickFavoriteButton.jsx"
import YdsStockScoreBreakdown from "../components/stock-picks/YdsStockScoreBreakdown.jsx"
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

        <YdsStockScoreBreakdown
          scores={stock.scores}
          rows={stock.scoreRows}
          variant="detail"
        />

        <p className="yds-spick-detail__status-label">상태</p>
        <p className="yds-spick-detail__status">{stock.statusPhrase}</p>

        <p className="yds-spick-detail__eval-label">한줄 평가</p>
        <p className="yds-spick-detail__comment">{stock.comment}</p>

        <p className="yds-spick-detail__schema-note">
          추세·거래량·위치는 스냅샷 기반 자동 계산 · 시장 적합도는 수동값 (향후 시장분석 연동)
        </p>
      </header>

      <section className="yds-spick-detail__future" aria-label="향후 확장 영역">
        <h2 className="yds-spick-detail__future-title">Phase 2-4 연동 예정</h2>
        <ul className="yds-spick-detail__future-list">
          <li>실시간 가격·거래량 스냅샷</li>
          <li>시장 적합도 (YDS 시장분석)</li>
          <li>차트 · 실적 · 뉴스</li>
        </ul>
      </section>
    </div>
  )
}
