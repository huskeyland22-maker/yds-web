import { useMemo } from "react"
import { Link } from "react-router-dom"
import { resolveStockPickV1View } from "../content/ydsStockPickV1View.js"
import YdsStockPickV1Hub from "../components/stock-picks/YdsStockPickV1Hub.jsx"
import { UI_PAGE } from "../utils/ydsUiLabels.js"

export default function StockRecommendationPage() {
  const view = useMemo(() => resolveStockPickV1View(), [])

  return (
    <div className="yds-stock-reco yds-stock-reco--v1 min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-stock-reco__header">
        <div>
          <p className="yds-stock-reco__kicker">{UI_PAGE.stockPicks.kicker}</p>
          <h1 className="yds-stock-reco__title">{UI_PAGE.stockPicks.title}</h1>
          <p className="yds-stock-reco__sub">
            무엇을 살 것인가 · 시장 타이밍은{" "}
            <Link to="/market-analysis">시장분석</Link>
          </p>
        </div>
      </header>

      <YdsStockPickV1Hub view={view} />
    </div>
  )
}
