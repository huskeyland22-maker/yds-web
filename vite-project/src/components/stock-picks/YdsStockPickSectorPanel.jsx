import { useLayoutEffect, useMemo, useRef } from "react"
import { Link } from "react-router-dom"
import { STOCK_PICK_SECTORS } from "../../content/ydsStockPickModel.js"
import { formatTransparencyPrice } from "../../content/ydsStockPickTransparency.js"
import {
  buildSectorStrengthMap,
  getSectorTopStocks,
} from "../../content/ydsStockPickSectorStrength.js"
import { getStockPickTotalScore } from "../../content/ydsStockPickUxStatus.js"
import { recordComponentMount } from "../../content/ydsStockPickRenderPerf.js"
import YdsStockPickUxStatusBadge from "./YdsStockPickUxStatusBadge.jsx"

/**
 * @param {{
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   allStocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   universeStocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   sectorId: string
 *   onSectorChange: (id: string) => void
 *   heldTickers?: Set<string>
 * }} props
 */
export default function YdsStockPickSectorPanel({
  stocks,
  allStocks,
  universeStocks,
  sectorId,
  onSectorChange,
  heldTickers = new Set(),
}) {
  const mountT0 = useRef(performance.now())

  useLayoutEffect(() => {
    recordComponentMount("sector", performance.now() - mountT0.current, {
      count: stocks.length,
    })
  }, [stocks.length])

  const strengthMap = useMemo(
    () => buildSectorStrengthMap(universeStocks),
    [universeStocks],
  )

  const sectorTop5 = useMemo(
    () => getSectorTopStocks(universeStocks, sectorId, 5),
    [universeStocks, sectorId],
  )

  const activeSector = STOCK_PICK_SECTORS.find((s) => s.id === sectorId)

  return (
    <section className="yds-spick-section yds-spick-section--sector" aria-labelledby="spick-sector">
      <h2 id="spick-sector" className="yds-spick-section__title">
        섹터 보기
      </h2>

      <div className="yds-spick-tabs" role="tablist" aria-label="섹터 필터">
        {STOCK_PICK_SECTORS.map((sector) => {
          const strength = strengthMap[sector.id]?.strength
          const count = sector.id === "all" ? allStocks.length : strengthMap[sector.id]?.count ?? 0
          const tabLabel =
            sector.id === "all"
              ? `${sector.label} (${count})`
              : strength != null
                ? `${sector.label} (${strength}점)`
                : `${sector.label} (${count})`

          return (
            <button
              key={sector.id}
              type="button"
              role="tab"
              aria-selected={sectorId === sector.id}
              className={[
                "yds-spick-tabs__btn",
                sectorId === sector.id ? "yds-spick-tabs__btn--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSectorChange(sector.id)}
            >
              {tabLabel}
            </button>
          )
        })}
      </div>

      {sectorId !== "all" && sectorTop5.length ? (
        <div className="yds-spick-sector-top5" role="tabpanel">
          <h3 className="yds-spick-sector-top5__title">
            {activeSector?.label ?? sectorId} TOP5
          </h3>
          <ol className="yds-spick-sector-top5__list">
            {sectorTop5.map((stock, index) => (
              <li key={stock.ticker} className="yds-spick-sector-top5__item">
                <span className="yds-spick-sector-top5__rank font-mono tabular-nums">
                  {index + 1}
                </span>
                <Link
                  to={`/stock-picks/${encodeURIComponent(stock.ticker)}`}
                  className="yds-spick-sector-top5__link"
                >
                  {stock.name}
                </Link>
                <span className="yds-spick-sector-top5__score font-mono tabular-nums">
                  {getStockPickTotalScore(stock) ?? "—"}
                </span>
                {stock.dataSource !== "live" ? (
                  <span className="yds-spick-sector-top5__badge">수집중</span>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="yds-spick-sector-top5__note">
            섹터 강도 {strengthMap[sectorId]?.strength ?? "—"}점 · TOP3 평균 종합점수
          </p>
        </div>
      ) : null}

      <ul className="yds-spick-sector-list" role="tabpanel">
        {stocks.length ? (
          stocks.map((stock) => (
            <li key={stock.ticker} className="yds-spick-sector-list__item">
              <Link
                to={`/stock-picks/${encodeURIComponent(stock.ticker)}`}
                className="yds-spick-sector-list__link"
              >
                <span className="yds-spick-sector-list__name">
                  {stock.name}
                  {heldTickers.has(stock.ticker.toUpperCase()) ? (
                    <span className="yds-spick-sector-list__held">보유</span>
                  ) : null}
                </span>
                <span className="yds-spick-sector-list__score font-mono tabular-nums">
                  {getStockPickTotalScore(stock) ?? "—"}
                </span>
                <span className="yds-spick-sector-list__status">
                  <YdsStockPickUxStatusBadge stock={stock} />
                </span>
                <span className="yds-spick-sector-list__price font-mono tabular-nums">
                  {formatTransparencyPrice(
                    stock.snapshot?.price ?? stock.snapshot?.close,
                    stock.country === "KR" ? "KR" : "US",
                  )}
                </span>
              </Link>
            </li>
          ))
        ) : (
          <li className="yds-spick-empty">해당 섹터 추천 종목이 없습니다.</li>
        )}
      </ul>
    </section>
  )
}
