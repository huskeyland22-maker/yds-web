import { useMemo } from "react"
import { Link } from "react-router-dom"
import { assignRanks, filterByCountry } from "../../content/ydsStockPickModel.js"
import { getRegimeTopStocks } from "../../content/ydsStockPickMarketRegime.js"
import { useStockPickLiveData } from "../../hooks/useStockPickLiveData.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"
import YdsStockPickCard from "../stock-picks/YdsStockPickCard.jsx"

const PREVIEW_COUNT = 3

/**
 * 홈 추천 종목 미리보기 — 시장 상태별 TOP N
 */
export default function YdsMarketRecommendStrip({ className = "" }) {
  const marketContext = useYdsMarketContext()
  const { stocks: liveStocks, loading } = useStockPickLiveData(marketContext)

  const preview = useMemo(() => {
    const us = assignRanks(filterByCountry(liveStocks, "US"))
    const limit = marketContext.pickDisplayLimit ?? 20
    const capped = getRegimeTopStocks(us, limit)
    return capped.slice(0, PREVIEW_COUNT)
  }, [liveStocks, marketContext.pickDisplayLimit])

  const limitLabel = Number.isFinite(marketContext.pickDisplayLimit)
    ? `TOP${marketContext.pickDisplayLimit}`
    : "전체"

  if (!marketContext.ready) return null

  return (
    <section
      className={["yds-market-recommend-strip", className].filter(Boolean).join(" ")}
      aria-label="추천 종목"
    >
      <div className="yds-market-recommend-strip__head">
        <div>
          <h2 className="yds-market-recommend-strip__title">추천 종목</h2>
          <p className="yds-market-recommend-strip__sub">
            {marketContext.marketPositionEmoji} {marketContext.marketPositionLabel}구간 ·{" "}
            {limitLabel} 기준
          </p>
        </div>
        <Link to="/stock-picks" className="yds-market-recommend-strip__link">
          전체 보기 →
        </Link>
      </div>

      {loading && !preview.length ? (
        <p className="yds-market-recommend-strip__loading" role="status">
          종목 데이터 동기화 중…
        </p>
      ) : preview.length ? (
        <div className="yds-market-recommend-strip__grid">
          {preview.map((stock) => (
            <YdsStockPickCard
              key={stock.ticker}
              stock={stock}
              variant="compact"
              isFavorite={false}
              onToggleFavorite={() => {}}
            />
          ))}
        </div>
      ) : (
        <p className="yds-market-recommend-strip__empty">
          현재 구간에 맞는 추천 종목을 준비 중입니다.
        </p>
      )}
    </section>
  )
}
