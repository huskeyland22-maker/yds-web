import {
  formatTradeRecordShares,
  formatUsdPrice,
  listTradeRecords,
  readEquityBuyIntent,
} from "../../content/ydsTradeRecords.js"
import TradeRecordStatusBlock from "./TradeRecordStatusBlock.jsx"

/**
 * Display label for one stored equity buy. Missing fields use the existing
 * read fallback (strategy stage 1). Does not invent a discretionary buy.
 * @param {object | null | undefined} record
 */
export function equityBuyProgressKind(record) {
  const intent = readEquityBuyIntent(record)
  if (intent.buyType === "discretionary") return "직관 매수"
  return `전략 ${intent.buyStage}차`
}

/**
 * @param {number} index zero-based
 */
export function equityBuyProgressMark(index) {
  const n = index + 1
  if (n >= 1 && n <= 20) return String.fromCodePoint(0x2460 + n - 1)
  if (n >= 21 && n <= 35) return String.fromCodePoint(0x3251 + n - 21)
  return `${n}.`
}

/**
 * @param {object | null | undefined} record
 */
export function formatEquityBuyProgressLine(record) {
  const date = typeof record?.buyDate === "string" && record.buyDate ? `${record.buyDate} · ` : ""
  return `${date}${equityBuyProgressKind(record)} · ${formatTradeRecordShares(record)} · ${formatUsdPrice(record?.buyPrice)}`
}

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
 *   showBuyLines?: boolean
 *   selectedSymbol?: string | null
 *   focusStatus?: boolean
 * }} props
 */
function EquityBuyLines({ symbol }) {
  const records = listTradeRecords("dbb", symbol)
  if (!records.length) return null
  return (
    <div className="yds-dbb-holdings__buys">
      <p className="yds-dbb-holdings__buys-title">매수 내역</p>
      <ol className="yds-dbb-holdings__buys-list">
        {records.map((record, index) => (
          <li key={record.id}>
            <span className="yds-dbb-holdings__buys-mark">{equityBuyProgressMark(index)}</span>
            <span className="yds-dbb-holdings__buys-text">{formatEquityBuyProgressLine(record)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function DbbBuyProgressSection({
  items,
  onSelectSymbol,
  showBuyLines = false,
  selectedSymbol = null,
  focusStatus = false,
}) {
  if (!items?.length) return null
  return (
    <section className={`yds-dbb-holdings${focusStatus ? " yds-dbb-holdings--focus" : ""}`} aria-label="매수 현황">
      <header className="yds-dbb-section__head">
        <p className="yds-dbb-section__eyebrow">내 매수 기록</p>
        <h2 className="yds-dbb-section__title">매수 현황</h2>
      </header>
      <div className="yds-dbb-holdings__grid">
        {items.map((item) => {
          const selected = selectedSymbol != null && item.symbol === selectedSymbol
          const body = (
            <>
              <p className="yds-dbb-holdings__name">
                {item.name}
                <span className="yds-dbb-holdings__ticker"> {item.symbol}</span>
              </p>
              {item.statusView ? (
                focusStatus ? (
                  <TradeRecordStatusBlock view={item.statusView} part="lead" />
                ) : (
                  <TradeRecordStatusBlock view={item.statusView} />
                )
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
              {showBuyLines ? <EquityBuyLines symbol={item.symbol} /> : null}
              {focusStatus && item.statusView ? (
                <TradeRecordStatusBlock view={item.statusView} part="tail" />
              ) : null}
            </>
          )
          if (onSelectSymbol) {
            return (
              <button
                key={item.symbol}
                type="button"
                className={`yds-dbb-holdings__card${selected ? " is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => onSelectSymbol(item.symbol)}
              >
                {body}
              </button>
            )
          }
          return (
            <article key={item.symbol} className={`yds-dbb-holdings__card${selected ? " is-selected" : ""}`}>
              {body}
            </article>
          )
        })}
      </div>
    </section>
  )
}
