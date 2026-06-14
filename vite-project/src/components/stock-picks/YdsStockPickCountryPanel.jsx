import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  filterBySector,
  STOCK_PICK_COUNTRIES,
} from "../../content/ydsStockPickModel.js"
import { getRegimeTopStocks } from "../../content/ydsStockPickMarketRegime.js"
import { recordComponentMount } from "../../content/ydsStockPickRenderPerf.js"
import YdsStockPickTop3 from "./YdsStockPickTop3.jsx"
import YdsStockPickTop10WhySection from "./YdsStockPickTop10WhySection.jsx"
import YdsStockPickSectorPanel from "./YdsStockPickSectorPanel.jsx"
import YdsStockPickCard from "./YdsStockPickCard.jsx"

/**
 * @param {{
 *   countryId: import("../../content/ydsStockPickModel.js").StockPickCountryId
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   sectorId: string
 *   onSectorChange: (id: string) => void
 *   isFavorite: (ticker: string) => boolean
 *   onToggleFavorite: (ticker: string) => void
 *   heldTickers?: Set<string>
 *   statusChanges?: Map<string, { fromLabel: string; toLabel: string }>
 *   showCountryHead?: boolean
 *   allSectionId?: string
 *   loading?: boolean
 *   universeStocks?: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   regimeLimit?: number
 * }} props
 */
export default function YdsStockPickCountryPanel({
  countryId,
  stocks,
  sectorId,
  onSectorChange,
  isFavorite,
  onToggleFavorite,
  heldTickers = new Set(),
  statusChanges = new Map(),
  showCountryHead = false,
  allSectionId = "spick-all",
  loading = false,
  universeStocks = [],
  regimeLimit = 5,
}) {
  const countryMeta = STOCK_PICK_COUNTRIES.find((c) => c.id === countryId)
  const [showAll, setShowAll] = useState(false)
  const [showSecondary, setShowSecondary] = useState(false)
  const allCardsMountT0 = useRef(0)

  const topHero = useMemo(
    () => getRegimeTopStocks(stocks, Math.min(regimeLimit, 5)),
    [stocks, regimeLimit],
  )

  const regimeStocks = useMemo(
    () => getRegimeTopStocks(stocks, regimeLimit),
    [stocks, regimeLimit],
  )
  const sectorStocks = useMemo(
    () => filterBySector(stocks, sectorId),
    [stocks, sectorId],
  )

  useEffect(() => {
    if (!stocks.length) {
      setShowSecondary(false)
      return undefined
    }

    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => setShowSecondary(true), { timeout: 150 })
      return () => cancelIdleCallback(id)
    }

    const id = window.setTimeout(() => setShowSecondary(true), 0)
    return () => window.clearTimeout(id)
  }, [stocks])

  useEffect(() => {
    if (showAll) allCardsMountT0.current = performance.now()
  }, [showAll])

  useLayoutEffect(() => {
    if (!showAll || !stocks.length || !allCardsMountT0.current) return
    recordComponentMount("all cards", performance.now() - allCardsMountT0.current, {
      count: stocks.length,
    })
  }, [showAll, stocks.length])

  return (
    <div className="yds-spick-country-panel">
      {showCountryHead && countryMeta ? (
        <header className="yds-spick-country-panel__head">
          <span className="yds-spick-country-panel__emoji" aria-hidden>
            {countryMeta.emoji}
          </span>
          <h2 className="yds-spick-country-panel__title">{countryMeta.label}</h2>
        </header>
      ) : null}

      <YdsStockPickTop3
        stocks={topHero}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        heldTickers={heldTickers}
        statusChanges={statusChanges}
        loading={loading}
      />

      {showSecondary ? (
        <YdsStockPickTop10WhySection stocks={regimeStocks} loading={loading} limit={Math.min(10, regimeLimit)} />
      ) : null}

      {showSecondary ? (
        <>
          <YdsStockPickSectorPanel
            stocks={sectorStocks}
            allStocks={stocks}
            universeStocks={universeStocks.length ? universeStocks : stocks}
            sectorId={sectorId}
            onSectorChange={onSectorChange}
            heldTickers={heldTickers}
          />

          <section className="yds-spick-section yds-spick-section--all" aria-labelledby={allSectionId}>
            <div className="yds-spick-section__head-row">
              <h2 id={allSectionId} className="yds-spick-section__title yds-spick-section__title--inline">
                전체 종목
              </h2>
              <button
                type="button"
                className="yds-spick-section__toggle"
                aria-expanded={showAll}
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "접기" : "전체 보기"}
              </button>
            </div>
            {showAll ? (
              <div className="yds-spick-grid yds-spick-grid--all">
                {stocks.map((stock) => (
                  <YdsStockPickCard
                    key={stock.ticker}
                    stock={stock}
                    variant="compact"
                    isFavorite={isFavorite(stock.ticker)}
                    onToggleFavorite={onToggleFavorite}
                    isHeld={heldTickers.has(stock.ticker.toUpperCase())}
                    statusChange={statusChanges.get(stock.ticker) ?? null}
                  />
                ))}
              </div>
            ) : null}
            {showAll && !stocks.length ? (
              <p className="yds-spick-empty">표시할 종목이 없습니다.</p>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  )
}
