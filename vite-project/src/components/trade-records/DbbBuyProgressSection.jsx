import { formatUsdPrice } from "../../content/ydsTradeRecords.js"
import TradeRecordStatusBlock from "./TradeRecordStatusBlock.jsx"

/**
 * Shared holdings strip for ETF and equity daily-bottom-buy pages.
 * @param {{
 *   items: Array<{
 *     symbol: string
 *     name: string
 *     statusView: object | null
 *     recordedWeightPct: number
 *     avgBuyPrice: number | null
 *   }>
 *   onSelectSymbol?: (symbol: string) => void
 * }} props
 */
export default function DbbBuyProgressSection({ items, onSelectSymbol }) {
  if (!items?.length) return null
  return (
    <section className="yds-dbb-holdings" aria-label="매수 현황">
      <header className="yds-dbb-section__head">
        <p className="yds-dbb-section__eyebrow">내 매수 기록</p>
        <h2 className="yds-dbb-section__title">매수 현황</h2>
      </header>
      <div className="yds-dbb-holdings__grid">
        {items.map((item) => {
          const body = (
            <>
              <p className="yds-dbb-holdings__name">
                {item.name}
                <span className="yds-dbb-holdings__ticker"> {item.symbol}</span>
              </p>
              {item.statusView ? (
                <TradeRecordStatusBlock view={item.statusView} />
              ) : (
                <div className="yds-trade-status" aria-label="매수 기록 현황">
                  <div className="yds-trade-status__row">
                    <span>현재 신호</span>
                    <strong>준비 중</strong>
                  </div>
                  <div className="yds-trade-status__row">
                    <span>기록 비중</span>
                    <strong className="font-mono tabular-nums">
                      {Number(item.recordedWeightPct).toFixed(0)}%
                    </strong>
                  </div>
                  <div className="yds-trade-status__row">
                    <span>평균 매수가 (USD)</span>
                    <strong className="font-mono tabular-nums">
                      {formatUsdPrice(item.avgBuyPrice)}
                    </strong>
                  </div>
                </div>
              )}
            </>
          )
          if (onSelectSymbol) {
            return (
              <button
                key={item.symbol}
                type="button"
                className="yds-dbb-holdings__card"
                onClick={() => onSelectSymbol(item.symbol)}
              >
                {body}
              </button>
            )
          }
          return (
            <article key={item.symbol} className="yds-dbb-holdings__card">
              {body}
            </article>
          )
        })}
      </div>
    </section>
  )
}
