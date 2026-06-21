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

/** @param {{ row: import("../../content/ydsPortfolioAllocationCompare.js").AllocationCompareRow }} props */
function AllocationCompareRow({ row }) {
  return (
    <tr className={`yds-pf-v1__alloc-row yds-pf-v1__alloc-row--${row.status}`}>
      <th scope="row">{row.label}</th>
      <td className="font-mono tabular-nums">{row.currentPct}%</td>
      <td className="font-mono tabular-nums">{row.recommendedPct}%</td>
      <td className={`font-mono tabular-nums yds-pf-v1__alloc-delta yds-pf-v1__alloc-delta--${row.status}`}>
        {row.deltaLabel}
      </td>
      <td>
        <span className={`yds-pf-v1__alloc-badge yds-pf-v1__alloc-badge--${row.status}`}>
          {row.badge} {row.statusLabel}
        </span>
      </td>
    </tr>
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
    syncMode,
    syncReady,
    isLoggedIn,
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
              <span className="yds-pf-v1__label">종목 검색</span>
              <YdsPortfolioStockSearchInput
                value={selectedStock}
                onChange={setSelectedStock}
                required
                hideLabel
                inputClassName="yds-pf-v1__input font-mono tabular-nums"
              />
            </div>
            <label>
              <span className="yds-pf-v1__label">수량</span>
              <input
                type="number"
                min={0.0001}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="yds-pf-v1__input font-mono tabular-nums"
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
                className="yds-pf-v1__input font-mono tabular-nums"
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
          <>
            <p className="yds-pf-v1__empty">등록된 보유 종목이 없습니다.</p>
            <p className="yds-pf-v1__note">
              {isLoggedIn
                ? syncReady
                  ? "로그인 계정 기준 Supabase 동기화. 모바일에서 등록한 종목은 동일 계정 로그인 후 이 기기에서 불러옵니다."
                  : "계정 포트폴리오 동기화 중…"
                : "키는 모바일·PC 동일(yds-portfolio-trades-v1)하지만 저장소는 기기별입니다. PC 콘솔 [portfolio] 로그로 이 기기 데이터를 확인하세요. 로그인 시 계정 동기화."}
            </p>
          </>
        )}

        {isLoggedIn ? (
          <p className="yds-pf-v1__sync-line">
            동기화: {syncReady ? syncMode : "loading…"}
          </p>
        ) : null}

        <form className="yds-pf-v1__cash-inline" onSubmit={handleCashSave}>
          <label>
            <span className="yds-pf-v1__label">현금 보유 (원)</span>
            <input
              type="number"
              min={0}
              value={cashDraft}
              onChange={(e) => setCashDraft(e.target.value)}
              className="yds-pf-v1__input font-mono tabular-nums"
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

        {report.market.allocationCompare ? (
          <div className="yds-pf-v1__alloc-compare">
            <p
              className={`yds-pf-v1__alloc-posture yds-pf-v1__alloc-posture--${report.market.allocationCompare.postureTone}`}
            >
              {report.market.allocationCompare.postureLabel}
            </p>

            <div className="yds-pf-v1__alloc-bars" aria-hidden>
              {[
                { label: "주식", row: report.market.allocationCompare.stock },
                { label: "현금", row: report.market.allocationCompare.cash },
              ].map(({ label, row }) => (
                <div key={label} className="yds-pf-v1__alloc-bar-group">
                  <span className="yds-pf-v1__alloc-bar-label">{label}</span>
                  <div className="yds-pf-v1__alloc-bar-track">
                    <span
                      className="yds-pf-v1__alloc-bar yds-pf-v1__alloc-bar--current"
                      style={{ width: `${Math.min(100, row.currentPct)}%` }}
                    />
                    <span
                      className="yds-pf-v1__alloc-bar yds-pf-v1__alloc-bar--rec"
                      style={{ width: `${Math.min(100, row.recommendedPct)}%` }}
                    />
                  </div>
                  <span className="yds-pf-v1__alloc-bar-legend font-mono tabular-nums">
                    현재 {row.currentPct}% · 권장 {row.recommendedPct}%
                  </span>
                </div>
              ))}
            </div>

            <div className="yds-pf-v1__alloc-table-wrap">
              <table className="yds-pf-v1__alloc-table">
                <caption className="yds-pf-v1__alloc-caption">실제 보유비중 vs YDS 권장비중</caption>
                <thead>
                  <tr>
                    <th scope="col">구분</th>
                    <th scope="col">현재</th>
                    <th scope="col">권장</th>
                    <th scope="col">차이</th>
                    <th scope="col">상태</th>
                  </tr>
                </thead>
                <tbody>
                  <AllocationCompareRow row={report.market.allocationCompare.stock} />
                  <AllocationCompareRow row={report.market.allocationCompare.cash} />
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

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

        {report.fit.detail ? (
          <details className="yds-pf-v1__fit-details">
            <summary className="yds-pf-v1__fit-details-toggle">점수 근거 보기</summary>
            <div className="yds-pf-v1__fit-details-body">
              <ul className="yds-pf-v1__fit-breakdown">
                {report.fit.detail.components.map((row) => (
                  <li key={row.id} className="yds-pf-v1__fit-breakdown-row">
                    <span className="yds-pf-v1__fit-breakdown-label">{row.label}</span>
                    <span className="yds-pf-v1__fit-breakdown-score font-mono tabular-nums">
                      {row.score}/{row.max}
                    </span>
                    <span className="yds-pf-v1__fit-breakdown-detail">{row.detail}</span>
                  </li>
                ))}
                <li className="yds-pf-v1__fit-breakdown-row yds-pf-v1__fit-breakdown-row--total">
                  <span className="yds-pf-v1__fit-breakdown-label">총점</span>
                  <strong className="yds-pf-v1__fit-breakdown-score font-mono tabular-nums">
                    {report.fit.detail.total}
                  </strong>
                </li>
              </ul>

              {report.fit.detail.deductions.length ? (
                <div className="yds-pf-v1__fit-subblock">
                  <h3 className="yds-pf-v1__fit-subtitle">감점 사유</h3>
                  <ul className="yds-pf-v1__fit-list yds-pf-v1__fit-list--warn">
                    {report.fit.detail.deductions.map((d) => (
                      <li key={d.id}>{d.reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {report.fit.detail.improvements.length ? (
                <div className="yds-pf-v1__fit-subblock">
                  <h3 className="yds-pf-v1__fit-subtitle">개선 방법</h3>
                  <ul className="yds-pf-v1__fit-list yds-pf-v1__fit-list--ok">
                    {report.fit.detail.improvements.map((item) => (
                      <li key={item.id}>{item.text}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
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
