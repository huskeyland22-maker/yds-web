import { useEffect } from "react"
import { Link } from "react-router-dom"
import { traceStockPickMount } from "../content/ydsStockPickMountTrace.js"
import YdsStockPickV1Hub from "../components/stock-picks/YdsStockPickV1Hub.jsx"
import { UI_PAGE } from "../utils/ydsUiLabels.js"
import "../styles/stock-picks-platform.css"

export default function StockRecommendationPage() {
  useEffect(() => {
    traceStockPickMount("StockRecommendationPage", "mount")
    return () => traceStockPickMount("StockRecommendationPage", "unmount")
  }, [])

  return (
    <div className="yds-spick-page yds-spick-page--countries min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-spick-page__header">
        <p className="yds-spick-page__kicker">{UI_PAGE.stockPicks.kicker}</p>
        <h1 className="yds-spick-page__title">{UI_PAGE.stockPicks.title}</h1>
        <p className="yds-spick-page__sub">
          무엇을 살 것인가 · 시장 타이밍은{" "}
          <Link to="/market-analysis">시장분석</Link>
        </p>
      </header>

      <YdsStockPickV1Hub />
    </div>
  )
}
