import { useState } from "react"
import { formatKrw } from "../../content/ydsPortfolioV2Engine.js"
import { todayDateKey } from "../../content/ydsPortfolioTradesStorage.js"
import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"

const CASH_TYPES = [
  { id: "deposit", label: "입금" },
  { id: "withdraw", label: "출금" },
  { id: "dividend", label: "배당" },
]

const TYPE_LABEL = {
  deposit: "입금",
  withdraw: "출금",
  dividend: "배당",
}

export default function YdsPortfolioCashSection() {
  const { cashLedger, cashAmount, portfolio, addCashEntry, removeCashEntry } = usePortfolioHoldings()
  const [type, setType] = useState(/** @type {'deposit'|'withdraw'|'dividend'} */ ("deposit"))
  const [amount, setAmount] = useState("")
  const [memo, setMemo] = useState("")
  const [date, setDate] = useState(todayDateKey())

  function handleSubmit(e) {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt || amt <= 0) return

    addCashEntry({ type, amount: amt, memo, date })
    setAmount("")
    setMemo("")
    setDate(todayDateKey())
  }

  return (
    <section
      className="yds-portfolio__section yds-portfolio-v2__section yds-portfolio-v6__cash"
      aria-labelledby="pf-cash"
    >
      <h2 id="pf-cash" className="yds-portfolio__section-title">
        현금 관리
      </h2>

      <p className="yds-portfolio-v2__hint-inline">
        입금·출금·배당 + 매매 대금 반영 · 총자산 = 주식 평가 + 현금
      </p>

      <div className="yds-portfolio-v6__cash-summary">
        <span>
          현금 잔액 <strong className="font-mono tabular-nums">{formatKrw(cashAmount)}</strong>
        </span>
        <span>
          총자산 <strong className="font-mono tabular-nums">{formatKrw(portfolio.totalAssets)}</strong>
        </span>
        <span>
          현금 비중 <strong className="font-mono tabular-nums">{portfolio.cashPct}%</strong>
        </span>
      </div>

      <form className="yds-portfolio-v2__form" onSubmit={handleSubmit}>
        <fieldset className="yds-portfolio-v2__actions">
          <legend className="yds-portfolio-v2__form-label">현금 거래</legend>
          <div className="yds-portfolio-v2__action-options">
            {CASH_TYPES.map((item) => (
              <label key={item.id} className="yds-portfolio-v2__action-option">
                <input
                  type="radio"
                  name="cashType"
                  checked={type === item.id}
                  onChange={() => setType(/** @type {'deposit'|'withdraw'|'dividend'} */ (item.id))}
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
            <span>금액</span>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000000"
              className="font-mono tabular-nums"
              required
            />
          </label>
          <label className="yds-portfolio-v2__field-wide">
            <span>메모</span>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="계좌 입금" />
          </label>
        </div>

        <button type="submit" className="yds-portfolio-v2__btn yds-portfolio-v2__btn--primary">
          저장
        </button>
      </form>

      {!cashLedger.length ? (
        <p className="yds-portfolio-v2__empty">
          초기 입금을 기록하면 매수 후 남은 현금과 비중이 자동 계산됩니다.
        </p>
      ) : (
        <div className="yds-portfolio-v2__table-wrap">
          <table className="yds-portfolio-v2__table">
            <thead>
              <tr>
                <th scope="col">날짜</th>
                <th scope="col">구분</th>
                <th scope="col">금액</th>
                <th scope="col">메모</th>
                <th scope="col" aria-label="관리" />
              </tr>
            </thead>
            <tbody>
              {cashLedger.map((entry) => (
                <tr key={entry.id}>
                  <td className="font-mono tabular-nums">{entry.date}</td>
                  <td>{TYPE_LABEL[entry.type] ?? entry.type}</td>
                  <td className="font-mono tabular-nums">{formatKrw(entry.amount)}</td>
                  <td className="yds-portfolio-v2__memo">{entry.memo || "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="yds-portfolio-v2__btn yds-portfolio-v2__btn--danger"
                      onClick={() => removeCashEntry(entry.id)}
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
