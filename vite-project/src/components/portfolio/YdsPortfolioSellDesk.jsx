import { useEffect, useMemo, useRef, useState } from "react"
import { buildSellPerformanceReport, previewSell } from "../../content/ydsPortfolioSellPerformance.js"
import { todayDateKey } from "../../content/ydsPortfolioTradesStorage.js"
import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"

function moneyKrw(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—"
  const value = Math.round(Number(n))
  return `${value > 0 ? "+" : ""}${value.toLocaleString("ko-KR")}원`
}

function plainKrw(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—"
  return `${Math.round(Number(n)).toLocaleString("ko-KR")}원`
}

function localMoney(n, currency) {
  if (n == null || !Number.isFinite(Number(n))) return "—"
  const value = Number(n)
  if (currency === "KRW") return `${Math.round(value).toLocaleString("ko-KR")}원`
  const sign = value < 0 ? "-" : ""
  return `${sign}$${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
}

function signedPct(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—"
  return `${Number(n) > 0 ? "+" : ""}${n}%`
}

function Metric({ label, value, sub }) {
  return (
    <article className="yds-pf-v1__metric">
      <span className="yds-pf-v1__metric-key">{label}</span>
      <strong className="yds-pf-v1__metric-val font-mono tabular-nums">{value}</strong>
      {sub ? <span className="yds-pf-v1__metric-sub">{sub}</span> : null}
    </article>
  )
}

export default function YdsPortfolioSellDesk() {
  const { trades, addTrade, removeTrade, portfolio, fxQuote } = usePortfolioHoldings()
  const holdings = (portfolio?.rows ?? []).filter((row) => row.quantity > 0)
  const [holdingId, setHoldingId] = useState("")
  const [date, setDate] = useState(todayDateKey())
  const [quantity, setQuantity] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [fee, setFee] = useState("")
  const [tax, setTax] = useState("")
  const [memo, setMemo] = useState("")
  const [notice, setNotice] = useState("")
  const saving = useRef(false)

  useEffect(() => {
    saving.current = false
  }, [trades])

  const holding = holdings.find((row) => row.id === holdingId) ?? null
  const liveRate = holding?.country === "us" && Number(fxQuote) > 0 ? Number(fxQuote) : null
  const report = useMemo(() => buildSellPerformanceReport(trades, fxQuote), [trades, fxQuote])
  const preview = useMemo(() => {
    if (!holding) return null
    return previewSell(
      trades,
      {
        name: holding.name,
        ticker: holding.ticker,
        country: holding.country,
        date,
        quantity: Number(quantity),
        unitPrice: Number(unitPrice),
        fee: Number(fee) || 0,
        tax: Number(tax) || 0,
        fxRate: liveRate,
        memo,
      },
      fxQuote,
    )
  }, [trades, holding, date, quantity, unitPrice, fee, tax, liveRate, memo, fxQuote])

  const settlementById = useMemo(() => {
    const map = new Map()
    for (const row of report.settlements) map.set(row.id, row)
    return map
  }, [report.settlements])

  const ledger = (trades ?? []).filter((trade) => trade.action === "buy" || trade.action === "sell")
  const monthMax = Math.max(...report.byMonth.map((row) => Math.abs(row.realizedKrw ?? 0)), 1)

  function handleSubmit(e) {
    e.preventDefault()
    if (saving.current) return
    if (!holding || !preview?.ok || !preview.preview) {
      setNotice(preview?.message || "매도 내용을 확인해 주세요.")
      return
    }
    saving.current = true
    addTrade({
      action: "sell",
      name: holding.name,
      ticker: holding.ticker,
      country: holding.country,
      date,
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      fee: Number(fee) || 0,
      tax: Number(tax) || 0,
      fxRate: liveRate,
      memo,
    })
    setQuantity("")
    setUnitPrice("")
    setFee("")
    setTax("")
    setMemo("")
    setNotice("매도 기록을 저장했습니다.")
  }

  function cancelSell(id) {
    if (!window.confirm("이 매도 기록만 취소합니다. 매수 기록은 남고, 보유 수량은 다시 계산됩니다.")) return
    removeTrade(id)
    setNotice("매도 기록을 취소했습니다.")
  }

  return (
    <section className="yds-pf-v1__block" aria-labelledby="pfv1-sell">
      <h2 id="pfv1-sell" className="yds-pf-v1__h2">
        매매 성과
      </h2>
      <p className="yds-pf-v1__metric-sub">
        승률은 매도 1건을 종료 거래 1건으로 계산합니다. 부분 매도도 1건이며, 보유 중인 종목은 넣지 않습니다.
      </p>

      <div className="yds-pf-v1__perf-grid">
        <Metric label="누적 실현손익" value={moneyKrw(report.realizedKrw)} sub="원화로 환산된 매도만 합산" />
        <Metric label="누적 실현 수익률" value={signedPct(report.cumulativeReturnPct)} />
        <Metric label="총 매도 횟수" value={String(report.closedCount)} />
        <Metric label="승률" value={report.winRate == null ? "—" : `${report.winRate}%`} />
        <Metric label="평균 수익률" value={signedPct(report.avgReturnPct)} />
        <Metric label="수익 / 손실" value={`${report.winCount} / ${report.lossCount}`} sub="본전은 둘 다 아님" />
      </div>
      {report.missingFxCount > 0 ? (
        <p className="yds-pf-v1__metric-sub">
          환율이 없는 미국 매도 {report.missingFxCount}건은 달러 손익만 유지하고 원화 합계에서 빼 두었습니다.
        </p>
      ) : null}

      <h3 className="yds-pf-v1__h3">매도 기록</h3>
      <form className="yds-pf-v1__form" onSubmit={handleSubmit}>
        <div className="yds-pf-v1__sell-grid">
          <label className="yds-pf-v1__field-wide">
            <span className="yds-pf-v1__label">종목</span>
            <select
              value={holdingId}
              onChange={(e) => setHoldingId(e.target.value)}
              className="yds-pf-v1__input"
              required
            >
              <option value="">보유 종목 선택</option>
              {holdings.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} {row.ticker ? `(${row.ticker})` : ""} · {row.quantity}주
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="yds-pf-v1__label">매수일</span>
            <input className="yds-pf-v1__input font-mono" value={holding?.firstBuyDate ?? ""} readOnly />
          </label>
          <label>
            <span className="yds-pf-v1__label">평균 매수가</span>
            <input
              className="yds-pf-v1__input font-mono"
              value={holding ? localMoney(holding.avgUnitPrice, holding.country === "kr" ? "KRW" : "USD") : ""}
              readOnly
            />
          </label>
          <label>
            <span className="yds-pf-v1__label">매도일</span>
            <input className="yds-pf-v1__input font-mono" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label>
            <span className="yds-pf-v1__label">매도가</span>
            <input
              className="yds-pf-v1__input font-mono tabular-nums"
              type="number"
              min="0"
              step="any"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              required
            />
          </label>
          <label>
            <span className="yds-pf-v1__label">매도수량</span>
            <input
              className="yds-pf-v1__input font-mono tabular-nums"
              type="number"
              min="0"
              max={holding?.quantity || undefined}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </label>
          <label>
            <span className="yds-pf-v1__label">수수료</span>
            <input className="yds-pf-v1__input font-mono tabular-nums" type="number" min="0" step="any" value={fee} onChange={(e) => setFee(e.target.value)} />
          </label>
          <label>
            <span className="yds-pf-v1__label">세금</span>
            <input className="yds-pf-v1__input font-mono tabular-nums" type="number" min="0" step="any" value={tax} onChange={(e) => setTax(e.target.value)} />
          </label>
          <label className="yds-pf-v1__field-wide">
            <span className="yds-pf-v1__label">메모</span>
            <input className="yds-pf-v1__input" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </label>
        </div>
        {holding?.country === "us" ? (
          <p className="yds-pf-v1__metric-sub">
            {liveRate
              ? `기준 환율 ${liveRate.toLocaleString("ko-KR")}원. 저장 시점 환율로 원화 환산 손익을 남깁니다.`
              : "기준 환율이 없어 달러 손익만 기록하고 원화 환산은 비워 둡니다."}
          </p>
        ) : null}
        {preview?.preview ? (
          <p className="yds-pf-v1__metric-sub font-mono tabular-nums">
            매도금액 {localMoney(preview.preview.proceeds, preview.preview.currency)} · 매수원가{" "}
            {localMoney(preview.preview.cost, preview.preview.currency)} · 실현손익{" "}
            {localMoney(preview.preview.realizedLocal, preview.preview.currency)} · 수익률{" "}
            {signedPct(preview.preview.returnPct)}
            {preview.preview.realizedKrw != null ? ` · 원화 ${moneyKrw(preview.preview.realizedKrw)}` : ""}
            {preview.preview.fullClose ? " · 전량 매도" : " · 부분 매도"}
          </p>
        ) : preview?.message && (quantity || unitPrice) ? (
          <p className="yds-pf-v1__metric-sub">{preview.message}</p>
        ) : null}
        {notice ? <p className="yds-pf-v1__metric-sub">{notice}</p> : null}
        <button type="submit" className="yds-pf-v1__btn" disabled={!preview?.ok}>
          매도 저장
        </button>
      </form>

      <h3 className="yds-pf-v1__h3">월별 실현손익</h3>
      {report.byMonth.length ? (
        <ul className="yds-pf-v1__bars">
          {report.byMonth.map((row) => (
            <li key={row.key} className="yds-pf-v1__bar-row">
              <span className="font-mono">{row.key}</span>
              <span className="yds-pf-v1__bar-track">
                <span
                  className={`yds-pf-v1__bar-fill ${(row.realizedKrw ?? 0) < 0 ? "yds-pf-v1__bar-fill--down" : "yds-pf-v1__bar-fill--up"}`}
                  style={{ width: `${(Math.abs(row.realizedKrw ?? 0) / monthMax) * 100}%` }}
                />
              </span>
              <span className="font-mono tabular-nums">{moneyKrw(row.realizedKrw)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="yds-pf-v1__metric-sub">매도 기록이 없습니다.</p>
      )}

      <h3 className="yds-pf-v1__h3">연도별 성과</h3>
      {report.byYear.length ? (
        <ul className="yds-pf-v1__sells">
          {report.byYear.map((row) => (
            <li key={row.key}>
              {row.key} · {row.sellCount}건 · {moneyKrw(row.realizedKrw)} · {signedPct(row.returnPct)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="yds-pf-v1__metric-sub">매도 기록이 없습니다.</p>
      )}

      <h3 className="yds-pf-v1__h3">종목별 실현손익</h3>
      {report.bySymbol.length ? (
        <ul className="yds-pf-v1__sells">
          {report.bySymbol.map((row) => (
            <li key={row.key}>
              {row.name} {row.ticker ? `(${row.ticker})` : ""} · {row.sellCount}건 ·{" "}
              {row.realizedLocal != null ? localMoney(row.realizedLocal, row.currency) : moneyKrw(row.realizedKrw)} ·{" "}
              {signedPct(row.returnPct)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="yds-pf-v1__metric-sub">매도 기록이 없습니다.</p>
      )}

      <h3 className="yds-pf-v1__h3">수익률 상위</h3>
      <ul className="yds-pf-v1__sells">
        {report.winners.length ? report.winners.map((row) => (
          <li key={row.key}>{row.name} · {signedPct(row.returnPct)}</li>
        )) : <li>수익 종목이 없습니다.</li>}
      </ul>
      <h3 className="yds-pf-v1__h3">손실률 상위</h3>
      <ul className="yds-pf-v1__sells">
        {report.losers.length ? report.losers.map((row) => (
          <li key={row.key}>{row.name} · {signedPct(row.returnPct)}</li>
        )) : <li>손실 종목이 없습니다.</li>}
      </ul>

      <h3 className="yds-pf-v1__h3">최근 매도</h3>
      <ul className="yds-pf-v1__sells">
        {report.recent.length ? report.recent.map((row) => (
          <li key={row.id}>
            {row.date} {row.name} {row.quantity}주 · {localMoney(row.realizedLocal, row.currency)} · {signedPct(row.returnPct)}
            {row.fullClose ? " · 전량" : " · 부분"}
          </li>
        )) : <li>매도 기록이 없습니다.</li>}
      </ul>

      <h3 className="yds-pf-v1__h3">매매 내역</h3>
      <ul className="yds-pf-v1__sells">
        {ledger.length ? ledger.map((trade) => {
          const sold = settlementById.get(trade.id)
          return (
            <li key={trade.id}>
              {trade.date} {trade.action === "sell" ? "매도" : "매수"} {trade.name}{" "}
              {trade.ticker ? `(${trade.ticker})` : ""} {trade.quantity ?? "—"}주
              {sold
                ? ` · 손익 ${localMoney(sold.realizedLocal, sold.currency)} · ${signedPct(sold.returnPct)}`
                : trade.unitPrice
                  ? ` · ${localMoney(trade.unitPrice, trade.country === "kr" ? "KRW" : "USD")}`
                  : ""}
              {sold?.links?.length
                ? ` · 연결 매수 ${sold.links.map((link) => link.buyDate).join(", ")}`
                : ""}
              {trade.action === "sell" ? (
                <>
                  {" "}
                  <button type="button" className="yds-pf-v1__btn yds-pf-v1__btn--ghost" onClick={() => cancelSell(trade.id)}>
                    매도 취소
                  </button>
                </>
              ) : null}
            </li>
          )
        }) : <li>매매 기록이 없습니다.</li>}
      </ul>
      <p className="yds-pf-v1__metric-sub">
        매도금액 − 매도 수량의 매수원가 − 수수료 − 세금. 수익률은 그 손익을 매수원가로 나눈 값입니다. 매수 기록은 매도를 취소해도 지우지 않습니다.
      </p>
      {report.closedCount ? (
        <p className="yds-pf-v1__metric-sub">원화 매수원가 합계 {plainKrw(report.costKrw)}</p>
      ) : null}
    </section>
  )
}
