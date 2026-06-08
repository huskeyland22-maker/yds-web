import { useState } from "react"
import { formatKrw, tradeActionLabel } from "../../content/ydsPortfolioV2Engine.js"
import { todayDateKey } from "../../content/ydsPortfolioTradesStorage.js"
import { usePortfolioTrades } from "../../hooks/usePortfolioTrades.js"

const ACTIONS = [
  { id: "buy", label: "매수" },
  { id: "sell", label: "매도" },
  { id: "watch", label: "관망" },
]

export default function YdsPortfolioTradesSection() {
  const { trades, addTrade, removeTrade } = usePortfolioTrades()

  const [action, setAction] = useState(/** @type {'buy'|'sell'|'watch'} */ ("watch"))
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [memo, setMemo] = useState("")
  const [date, setDate] = useState(todayDateKey())

  function handleSubmit(e) {
    e.preventDefault()
    addTrade({
      action,
      name,
      amount: amount ? Number(amount) : null,
      memo,
      date,
    })
    setName("")
    setAmount("")
    setMemo("")
    setAction("watch")
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
          <label>
            <span>금액</span>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000000"
              className="font-mono tabular-nums"
            />
          </label>
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
