import { useMemo, useState } from "react"
import { formatKrw, tradeActionLabel } from "../../content/ydsPortfolioV2Engine.js"
import { todayDateKey } from "../../content/ydsPortfolioTradesStorage.js"
import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"
import YdsPortfolioStockSearchInput from "./YdsPortfolioStockSearchInput.jsx"

const ACTIONS = [
  { id: "buy", label: "매수" },
  { id: "sell", label: "매도" },
  { id: "watch", label: "관망" },
]

export default function YdsPortfolioTradesSection() {
  const { trades, addTrade, removeTrade } = usePortfolioHoldings()

  const [action, setAction] = useState(/** @type {'buy'|'sell'|'watch'} */ ("buy"))
  const [selectedStock, setSelectedStock] = useState(
    /** @type {import("../../content/ydsPortfolioStockSearch.js").PortfolioStockOption | null} */ (null),
  )
  const [quantity, setQuantity] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [memo, setMemo] = useState("")
  const [date, setDate] = useState(todayDateKey())

  const needsTradeSize = action === "buy" || action === "sell"
  const country = selectedStock?.country ?? "us"

  const derivedAmount = useMemo(() => {
    const qty = Number(quantity)
    const unit = Number(unitPrice)
    if (!qty || qty <= 0 || !unit || unit <= 0) return null
    return Math.round(qty * unit)
  }, [quantity, unitPrice])

  function resetForm() {
    setSelectedStock(null)
    setQuantity("")
    setUnitPrice("")
    setMemo("")
    setAction("buy")
    setDate(todayDateKey())
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!selectedStock?.name) return

    const qty = quantity ? Number(quantity) : null
    const unit = unitPrice ? Number(unitPrice) : null
    if (needsTradeSize) {
      if (!selectedStock.ticker) return
      if (!qty || qty <= 0 || !unit || unit <= 0) return
    }

    addTrade({
      action,
      name: selectedStock.name,
      ticker: selectedStock.ticker,
      country: selectedStock.country,
      quantity: needsTradeSize ? qty : null,
      unitPrice: needsTradeSize ? unit : null,
      memo,
      date,
    })

    resetForm()
  }

  return (
    <section
      className="yds-portfolio__section yds-portfolio-v2__section yds-portfolio-v4__trades yds-portfolio-v5__trades"
      id="portfolio-trades"
      aria-labelledby="pf-trades"
    >
      <h2 id="pf-trades" className="yds-portfolio__section-title">
        3 · 거래 기록
      </h2>

      <p className="yds-portfolio-v2__hint-inline">
        종목 검색 · 수량·단가만 입력 · 코드·국가는 자동
      </p>

      <form className="yds-portfolio-v2__form yds-portfolio-v2__form--trade" onSubmit={handleSubmit}>
        <fieldset className="yds-portfolio-v2__actions">
          <legend className="yds-portfolio-v2__form-label">거래</legend>
          <div className="yds-portfolio-v2__action-options">
            {ACTIONS.map((item) => (
              <label key={item.id} className="yds-portfolio-v2__action-option">
                <input
                  type="radio"
                  name="tradeAction"
                  checked={action === item.id}
                  onChange={() => setAction(/** @type {'buy'|'sell'|'watch'} */ (item.id))}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="yds-portfolio-v2__form-grid yds-portfolio-v2__form-grid--trade">
          <label>
            <span>날짜</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>

          <div className="yds-portfolio-v2__field-wide">
            <YdsPortfolioStockSearchInput
              value={selectedStock}
              onChange={setSelectedStock}
              required
            />
          </div>

          {selectedStock ? (
            <div className="yds-portfolio-v5__stock-meta yds-portfolio-v2__field-wide" aria-live="polite">
              <span className="yds-portfolio-v5__stock-meta-item">
                <span className="yds-portfolio-v5__stock-meta-label">종목코드</span>
                <strong className="font-mono tabular-nums">{selectedStock.ticker}</strong>
              </span>
              <span className="yds-portfolio-v5__stock-meta-item">
                <span className="yds-portfolio-v5__stock-meta-label">국가</span>
                <strong>{selectedStock.country === "kr" ? "🇰🇷 한국" : "🇺🇸 미국"}</strong>
              </span>
            </div>
          ) : null}

          {needsTradeSize ? (
            <>
              <label>
                <span>수량</span>
                <input
                  type="number"
                  min={0.0001}
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="10"
                  className="font-mono tabular-nums"
                  required
                />
              </label>
              <label>
                <span>단가</span>
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder={country === "kr" ? "230000" : "120"}
                  className="font-mono tabular-nums"
                  required
                />
              </label>
            </>
          ) : null}
          <label className="yds-portfolio-v2__field-wide">
            <span>메모</span>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="일부 익절" />
          </label>
        </div>

        {needsTradeSize && derivedAmount != null ? (
          <p className="yds-portfolio-v2__derived font-mono tabular-nums">
            거래 금액(현지) {derivedAmount.toLocaleString("ko-KR")}
            {country === "us" ? " USD" : " 원"}
          </p>
        ) : null}

        <button
          type="submit"
          className="yds-portfolio-v2__btn yds-portfolio-v2__btn--primary"
          disabled={needsTradeSize && !selectedStock?.ticker}
        >
          저장
        </button>
      </form>

      {!trades.length ? (
        <p className="yds-portfolio-v2__empty">매수·매도·관망 기록이 여기에 쌓입니다.</p>
      ) : (
        <div className="yds-portfolio-v2__table-wrap">
          <table className="yds-portfolio-v2__table yds-portfolio-v2__table--trades">
            <thead>
              <tr>
                <th scope="col">날짜</th>
                <th scope="col">구분</th>
                <th scope="col">종목</th>
                <th scope="col">코드</th>
                <th scope="col">수량</th>
                <th scope="col">단가</th>
                <th scope="col">금액</th>
                <th scope="col">메모</th>
                <th scope="col" aria-label="관리" />
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.id}>
                  <td className="font-mono tabular-nums">{trade.date}</td>
                  <td>
                    <span className={`yds-portfolio-v2__badge yds-portfolio-v2__badge--${trade.action}`}>
                      {tradeActionLabel(trade.action)}
                    </span>
                  </td>
                  <td>
                    {trade.name}
                    {trade.country ? (
                      <span className="yds-portfolio-v4__country">
                        {trade.country === "kr" ? " 🇰🇷" : " 🇺🇸"}
                      </span>
                    ) : null}
                  </td>
                  <td className="font-mono tabular-nums">{trade.ticker || "—"}</td>
                  <td className="font-mono tabular-nums">
                    {trade.quantity != null ? trade.quantity : "—"}
                  </td>
                  <td className="font-mono tabular-nums">
                    {trade.unitPrice != null ? trade.unitPrice.toLocaleString("ko-KR") : "—"}
                  </td>
                  <td className="font-mono tabular-nums">{formatKrw(trade.amount)}</td>
                  <td className="yds-portfolio-v2__memo">{trade.memo || "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="yds-portfolio-v2__btn yds-portfolio-v2__btn--danger"
                      onClick={() => removeTrade(trade.id)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
