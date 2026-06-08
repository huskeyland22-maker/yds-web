import { useState } from "react"
import { deriveUnitPrice, formatKrw, tradeActionLabel } from "../../content/ydsPortfolioV2Engine.js"
import { todayDateKey } from "../../content/ydsPortfolioTradesStorage.js"
import { usePortfolioCash } from "../../hooks/usePortfolioCash.js"
import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"

const ACTIONS = [
  { id: "buy", label: "매수" },
  { id: "sell", label: "매도" },
  { id: "watch", label: "관망" },
]

export default function YdsPortfolioTradesSection() {
  const { cashAmount, setCashAmount } = usePortfolioCash()
  const { trades, addTrade, removeTrade } = usePortfolioHoldings()

  const [action, setAction] = useState(/** @type {'buy'|'sell'|'watch'} */ ("buy"))
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [quantity, setQuantity] = useState("")
  const [memo, setMemo] = useState("")
  const [date, setDate] = useState(todayDateKey())

  const needsQty = action === "buy" || action === "sell"

  function handleSubmit(e) {
    e.preventDefault()
    const qty = quantity ? Number(quantity) : null
    const amt = amount ? Number(amount) : null

    if (needsQty && (!qty || qty <= 0)) return

    addTrade({
      action,
      name,
      amount: amt,
      quantity: qty,
      memo,
      date,
    })

    if (action === "buy" && amt && amt > 0) {
      setCashAmount(Math.max(0, cashAmount - amt))
    } else if (action === "sell" && amt && amt > 0) {
      setCashAmount(cashAmount + amt)
    }

    setName("")
    setAmount("")
    setQuantity("")
    setMemo("")
    setAction("buy")
    setDate(todayDateKey())
  }

  return (
    <section
      className="yds-portfolio__section yds-portfolio-v2__section"
      id="portfolio-trades"
      aria-labelledby="pf-trades"
    >
      <h2 id="pf-trades" className="yds-portfolio__section-title">
        2 · 매매 기록
      </h2>

      <p className="yds-portfolio-v2__hint-inline">
        매수 → 보유 자동 추가 · 매도 → 수량 자동 차감
      </p>

      <form className="yds-portfolio-v2__form yds-portfolio-v2__form--trade" onSubmit={handleSubmit}>
        <fieldset className="yds-portfolio-v2__actions">
          <legend className="yds-portfolio-v2__form-label">기록</legend>
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
          <label>
            <span>종목</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="엔비디아" required />
          </label>
          {needsQty ? (
            <label>
              <span>수량</span>
              <input
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
                className="font-mono tabular-nums"
                required
              />
            </label>
          ) : null}
          <label>
            <span>금액{needsQty ? " (평균단가 자동)" : ""}</span>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000000"
              className="font-mono tabular-nums"
            />
          </label>
          {needsQty && amount && quantity ? (
            <p className="yds-portfolio-v2__derived font-mono tabular-nums">
              체결단가 {deriveUnitPrice(Number(amount), Number(quantity)).toLocaleString("ko-KR")}원
            </p>
          ) : null}
          <label className="yds-portfolio-v2__field-wide">
            <span>메모</span>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="일부 익절" />
          </label>
        </div>

        <button type="submit" className="yds-portfolio-v2__btn yds-portfolio-v2__btn--primary">
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
                <th scope="col">수량</th>
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
                  <td>{trade.name}</td>
                  <td className="font-mono tabular-nums">
                    {trade.quantity != null ? trade.quantity.toLocaleString("ko-KR") : "—"}
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
