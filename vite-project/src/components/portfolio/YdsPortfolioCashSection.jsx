import { useEffect, useState } from "react"
import { formatKrw } from "../../content/ydsPortfolioV2Engine.js"
import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"

export default function YdsPortfolioCashSection() {
  const { cashAmount, portfolio, setCashBalance } = usePortfolioHoldings()
  const [draft, setDraft] = useState(String(cashAmount || ""))

  useEffect(() => {
    setDraft(cashAmount > 0 ? String(cashAmount) : "")
  }, [cashAmount])

  function handleSubmit(e) {
    e.preventDefault()
    const amt = Number(draft)
    if (!Number.isFinite(amt) || amt < 0) return
    setCashBalance(amt)
  }

  return (
    <section
      className="yds-portfolio__section yds-portfolio-v2__section yds-portfolio-v6__cash yds-portfolio-v7__cash"
      aria-labelledby="pf-cash"
    >
      <h2 id="pf-cash" className="yds-portfolio__section-title">
        현재 현금
      </h2>

      <p className="yds-portfolio-v2__hint-inline">
        지금 계좌에 있는 현금만 입력 · 총자산 = 주식 평가 + 현금
      </p>

      <form className="yds-portfolio-v7__cash-form" onSubmit={handleSubmit}>
        <label className="yds-portfolio-v7__cash-label">
          <span>현재 현금 보유</span>
          <input
            type="number"
            min={0}
            step={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="8000000"
            className="font-mono tabular-nums"
          />
        </label>
        <button type="submit" className="yds-portfolio-v2__btn yds-portfolio-v2__btn--primary">
          적용
        </button>
      </form>

      <p className="yds-portfolio-v7__cash-readout font-mono tabular-nums">
        {cashAmount > 0 ? formatKrw(cashAmount) : "—"}
        {portfolio.totalAssets > 0 ? (
          <span className="yds-portfolio-v7__cash-meta">
            {" "}
            · 총자산 {formatKrw(portfolio.totalAssets)} · 현금 비중 {portfolio.cashPct}%
          </span>
        ) : null}
      </p>
    </section>
  )
}
