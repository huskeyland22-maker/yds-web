import YdsStockPickTop10WhySection from "./YdsStockPickTop10WhySection.jsx"
import YdsStockPickSectorPanel from "./YdsStockPickSectorPanel.jsx"
import YdsStockPickSectorConcentrationCard from "./YdsStockPickSectorConcentrationCard.jsx"
import YdsAiPortfolioRecommend from "./YdsAiPortfolioRecommend.jsx"

/**
 * @param {{
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   regimeStocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   universeStocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   sectorId: string
 *   onSectorChange: (id: string) => void
 *   regimeLimit: number
 *   portfolioStocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   heldTickers?: Set<string>
 *   loading?: boolean
 * }} props
 */
export default function YdsStockPickHubExtras({
  stocks,
  regimeStocks,
  universeStocks,
  sectorId,
  onSectorChange,
  regimeLimit,
  portfolioStocks,
  heldTickers = new Set(),
  loading = false,
}) {
  return (
    <details className="yds-spick-hub-extras">
      <summary className="yds-spick-hub-extras__summary">분석 · 섹터 · 포트폴리오</summary>
      <div className="yds-spick-hub-extras__body">
        <YdsStockPickSectorConcentrationCard
          stocks={regimeStocks}
          limit={Math.min(10, regimeLimit)}
        />
        <YdsStockPickTop10WhySection
          stocks={regimeStocks}
          loading={loading}
          limit={Math.min(10, regimeLimit)}
        />
        <YdsStockPickSectorPanel
          stocks={stocks}
          allStocks={stocks}
          universeStocks={universeStocks}
          sectorId={sectorId}
          onSectorChange={onSectorChange}
          heldTickers={heldTickers}
        />
        <YdsAiPortfolioRecommend stocks={portfolioStocks} />
      </div>
    </details>
  )
}
