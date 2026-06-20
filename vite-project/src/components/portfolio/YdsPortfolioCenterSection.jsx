import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { buildPortfolioCenterV1Report } from "../../content/ydsPortfolioCenterEngine.js"
import { todayDateKey } from "../../content/ydsPortfolioTradesStorage.js"
import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"
import YdsPortfolioStockSearchInput from "./YdsPortfolioStockSearchInput.jsx"

function Metric({ label, value, sub, tone = "" }) {
  return (
    <article className={`yds-pf-v1__metric ${tone ? `yds-pf-v1__metric--${tone}` : ""}`}>
      <span className="yds-pf-v1__metric-key">{label}</span>
      <strong className="yds-pf-v1__metric-val font-mono tabular-nums">{value}</strong>
      {sub ? <span className="yds-pf-v1__metric-sub">{sub}</span> : null}
    </article>
  )
}

export default function YdsPortfolioCenterSection() {
  const marketContext = useYdsMarketContext()
  const {
    trades,
    addTrade,
    removeTrade,
    portfolio,
    cashAmount,
    setCashBalance,
    quoteMap,
    usdkrw,
    quotesLoading,
  } = usePortfolioHoldings()

  const [selectedStock, setSelectedStock] = useState(
    /** @type {import("../../content/ydsPortfolioStockSearch.js").PortfolioStockOption | null} */ (null),
  )
  const [quantity, setQuantity] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [cashDraft, setCashDraft] = useState(String(cashAmount || ""))

  useEffect(() => {
    setCashDraft(cashAmount > 0 ? String(cashAmount) : "")
  }, [cashAmount])

  const report = useMemo(
    () => buildPortfolioCenterV1Report(trades, cashAmount, marketContext, quoteMap, usdkrw, portfolio),
    [trades, cashAmount, marketContext, quoteMap, usdkrw, portfolio],
  )

  function handleRegister(e) {
    e.preventDefault()
    if (!selectedStock?.ticker) return
    const qty = Number(quantity)
    const unit = Number(unitPrice)
    if (!qty || qty <= 0 || !unit || unit <= 0) return

    addTrade({
      action: "buy",
      name: selectedStock.name,
      ticker: selectedStock.ticker,
      country: selectedStock.country,
      quantity: qty,
      unitPrice: unit,
      date: todayDateKey(),
    })

    setSelectedStock(null)
    setQuantity("")
    setUnitPrice("")
  }

  function handleCashSave(e) {
    e.preventDefault()
    const amt = Number(cashDraft)
    if (!Number.isFinite(amt) || amt < 0) return
    setCashBalance(amt)
  }

  /** @param {string} ticker */
  function removeHolding(ticker) {
    const ids = trades.filter((t) => t.ticker === ticker).map((t) => t.id)
    for (const id of ids) removeTrade(id)
  }

  const returnTone =
    report.status.totalReturnPct != null && report.status.totalReturnPct > 0
      ? "up"
      : report.status.totalReturnPct != null && report.status.totalReturnPct < 0
        ? "down"
        : ""

  return (
    <div className="yds-pf-v1">
      <p className="yds-pf-v1__market-line">
        {marketContext?.ready ? (
          <>
            {marketContext.strategyEmoji} {marketContext.strategyLabel} · {marketContext.panicLabel}
          </>
        ) : (
          "시장상태 로딩…"
        )}
        {quotesLoading ? " · 시세 갱신" : null}
      </p>

      <section className="yds-pf-v1__block" aria-labelledby="pfv1-holdings">
        <h2 id="pfv1-holdings" className="yds-pf-v1__h2">
          1 · 보유종목
        </h2>
        <form className="yds-pf-v1__form" onSubmit={handleRegister}>
          <div className="yds-pf-v1__form-grid">
            <div className="yds-pf-v1__field-wide">
              <span className="yds-pf-v1__label">종목명</span>
              <YdsPortfolioStockSearchInput value={selectedStock} onChange={setSelectedStock} required />
            </div>
            <label>
              <span className="yds-pf-v1__label">수량</span>
              <input
                type="number"
                min={0.0001}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="font-mono tabular-nums"
                required
              />
            </label>
            <label>
              <span className="yds-pf-v1__label">평단가</span>
              <input
                type="number"
                min={0.01}
                step="any"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="font-mono tabular-nums"
                required
              />
            </label>
          </div>
          <button type="submit" className="yds-pf-v1__btn" disabled={!selectedStock?.ticker}>
            등록
          </button>
        </form>

        {report.holdings.length ? (
          <ul className="yds-pf-v1__holdings">
            {report.holdings.map((row) => (
              <li key={row.id ?? row.ticker} className="yds-pf-v1__holding-row">
                <div>
                  <strong>{row.name}</strong>
                  <span className="yds-pf-v1__ticker font-mono">{row.ticker}</span>
                </div>
                <span className="font-mono tabular-nums">
                  {row.quantity}주 · 평단 {row.avgUnitPrice?.toLocaleString("ko-KR")}
                </span>
                <span className="font-mono tabular-nums">{row.weightPct}%</span>
                <button type="button" className="yds-pf-v1__remove" onClick={() => removeHolding(row.ticker)}>
                  제거
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="yds-pf-v1__empty">등록된 보유 종목이 없습니다.</p>
        )}

        <form className="yds-pf-v1__cash-inline" onSubmit={handleCashSave}>
          <label>
            <span className="yds-pf-v1__label">현금 보유 (원)</span>
            <input
              type="number"
              min={0}
              value={cashDraft}
              onChange={(e) => setCashDraft(e.target.value)}
              className="font-mono tabular-nums"
              placeholder="0"
            />
          </label>
          <button type="submit" className="yds-pf-v1__btn yds-pf-v1__btn--ghost">
            저장
          </button>
        </form>
      </section>

      <section className="yds-pf-v1__block" aria-labelledby="pfv1-status">
        <h2 id="pfv1-status" className="yds-pf-v1__h2">
          2 · 포트폴리오 현황
        </h2>
        <div className="yds-pf-v1__metrics">
          <Metric
            label="총 평가금액"
            value={
              report.status.totalAssets > 0
                ? `${Math.round(report.status.totalAssets).toLocaleString("ko-KR")}원`
                : "—"
            }
          />
          <Metric
            label="총 수익률"
            value={
              report.status.totalReturnPct != null
                ? `${report.status.totalReturnPct > 0 ? "+" : ""}${report.status.totalReturnPct}%`
                : "—"
            }
            tone={returnTone}
          />
          <Metric label="주식 비중" value={`${report.status.stockPct}%`} />
          <Metric label="현금 비중" value={`${report.status.cashPct}%`} />
        </div>
      </section>

      <section className="yds-pf-v1__block" aria-labelledby="pfv1-market">
        <h2 id="pfv1-market" className="yds-pf-v1__h2">
          3 · 시장상태 연동
        </h2>
        <p className="yds-pf-v1__stage">
          {report.market.stageEmoji} {report.market.stageLabel}
          <span className="yds-pf-v1__muted"> · {report.market.panicLabel}</span>
        </p>
        <div className="yds-pf-v1__alloc">
          <div>
            <span className="yds-pf-v1__alloc-key">권장 주식</span>
            <strong className="font-mono tabular-nums">{report.market.recommendedStockPct}%</strong>
            <span className="yds-pf-v1__alloc-actual">실제 {report.status.stockPct}%</span>
          </div>
          <div>
            <span className="yds-pf-v1__alloc-key">권장 현금</span>
            <strong className="font-mono tabular-nums">{report.market.recommendedCashPct}%</strong>
            <span className="yds-pf-v1__alloc-actual">실제 {report.status.cashPct}%</span>
          </div>
        </div>
        {report.market.note ? <p className="yds-pf-v1__note">{report.market.note}</p> : null}
        <p className="yds-pf-v1__note">
          <Link to="/market-analysis">시장분석</Link> 기준 권장 비중
        </p>
      </section>

      <section className="yds-pf-v1__block" aria-labelledby="pfv1-fit">
        <h2 id="pfv1-fit" className="yds-pf-v1__h2">
          4 · 포트폴리오 적합도
        </h2>
        <div className="yds-pf-v1__fit">
          <span className={`yds-pf-v1__fit-grade yds-pf-v1__fit-grade--${report.fit.grade}`}>
            {report.fit.grade}
          </span>
          <div>
            <strong className="yds-pf-v1__fit-score font-mono tabular-nums">{report.fit.score}점</strong>
            <span className="yds-pf-v1__fit-label">{report.fit.label}</span>
          </div>
        </div>
      </section>

      <section className="yds-pf-v1__block" aria-labelledby="pfv1-risk">
        <h2 id="pfv1-risk" className="yds-pf-v1__h2">
          5 · 리스크 점검
        </h2>
        <ul className="yds-pf-v1__checks">
          {report.riskChecks.map((check) => (
            <li key={check.id} className={`yds-pf-v1__check yds-pf-v1__check--${check.status}`}>
              <span className="yds-pf-v1__check-label">{check.label}</span>
              <span>{check.message}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
