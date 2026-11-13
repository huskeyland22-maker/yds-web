import { useEffect, useMemo, useState } from "react"
import {
  addEquitySell,
  cancelEquitySell,
  equityPosition,
  previewEquitySell,
} from "../../content/ydsEquitySellLedger.js"
import {
  formatReturnPct,
  formatShares,
  formatTradeRecordShares,
  formatUsdAmount,
  formatUsdPrice,
  listTradeRecords,
  TRADE_RECORDS_CHANGED_EVENT,
} from "../../content/ydsTradeRecords.js"

/**
 * Sell entry for one symbol that already has a real buy record.
 * Sell date, price, quantity, fee, and tax stay empty until the user types them.
 * @param {{ system?: 'dbb' | 'panic', symbol: string, name?: string }} props
 */
export default function EquityOperatingLedger({ system = "dbb", symbol, name = "" }) {
  const [version, setVersion] = useState(0)
  const [sellDate, setSellDate] = useState("")
  const [sellPrice, setSellPrice] = useState("")
  const [shares, setShares] = useState("")
  const [feeUsd, setFeeUsd] = useState("")
  const [taxUsd, setTaxUsd] = useState("")
  const [memo, setMemo] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    const onChange = () => setVersion((n) => n + 1)
    window.addEventListener(TRADE_RECORDS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(TRADE_RECORDS_CHANGED_EVENT, onChange)
  }, [])

  const buys = useMemo(() => listTradeRecords(system, symbol), [system, symbol, version])
  const position = useMemo(() => equityPosition(system, symbol), [system, symbol, version])
  const preview = useMemo(() => {
    if (!sellDate && !sellPrice && !shares) return null
    return previewEquitySell(system, symbol, { sellDate, sellPrice, shares, feeUsd, taxUsd, memo })
  }, [system, symbol, sellDate, sellPrice, shares, feeUsd, taxUsd, memo, version])

  if (!buys.length) return null

  function handleSubmit(e) {
    e.preventDefault()
    const result = addEquitySell(system, symbol, { sellDate, sellPrice, shares, feeUsd, taxUsd, memo })
    setNotice(result.ok ? "매도 기록을 저장했습니다." : result.message)
    if (!result.ok) return
    setSellDate("")
    setSellPrice("")
    setShares("")
    setFeeUsd("")
    setTaxUsd("")
    setMemo("")
  }

  function handleCancel(id) {
    if (!window.confirm("이 매도 기록만 취소합니다. 매수 기록은 남습니다.")) return
    cancelEquitySell(id)
    setNotice("매도 기록을 취소했습니다.")
  }

  return (
    <section className="yds-dbb-trade" aria-label="실제 매도 기록">
      <h3 className="yds-dbb-section__title">매도 기록</h3>
      <p className="yds-dbb__meta">
        {name || symbol} · 확인된 매도일, 매도가, 매도수량만 입력합니다. 모르는 수수료와 세금은 비워 둡니다.
      </p>
      <p className="yds-dbb__meta">
        남은 보유 {formatShares(position.openShares)}
        {position.settlements.length
          ? ` · 실현손익 ${formatUsdAmount(position.realizedPnl)}`
          : ""}
      </p>
      {position.openShares > 0 ? (
        <form className="yds-dbb-dash__trade-stack" onSubmit={handleSubmit}>
          <label>
            매도일
            <input type="date" value={sellDate} onChange={(e) => setSellDate(e.target.value)} required />
          </label>
          <label>
            매도가 USD
            <input
              type="number"
              min="0"
              step="0.01"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              required
            />
          </label>
          <label>
            매도수량
            <input
              type="number"
              min="0"
              step="any"
              max={position.openShares}
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              required
            />
          </label>
          <label>
            수수료 USD
            <input type="number" min="0" step="0.01" value={feeUsd} onChange={(e) => setFeeUsd(e.target.value)} />
          </label>
          <label>
            세금 USD
            <input type="number" min="0" step="0.01" value={taxUsd} onChange={(e) => setTaxUsd(e.target.value)} />
          </label>
          <label>
            메모
            <input value={memo} onChange={(e) => setMemo(e.target.value)} />
          </label>
          {preview?.preview ? (
            <p className="yds-dbb__meta">
              매도금액 {formatUsdAmount(preview.preview.proceeds)} · 매수원가 {formatUsdAmount(preview.preview.cost)} ·
              실현손익 {formatUsdAmount(preview.preview.realizedPnl)} · 수익률 {formatReturnPct(preview.preview.returnPct)}
              {preview.preview.fullClose ? " · 전량 매도" : " · 부분 매도"}
              {preview.preview.chargesKnown ? "" : " · 수수료·세금 미입력"}
            </p>
          ) : preview?.message ? (
            <p className="yds-dbb__meta">{preview.message}</p>
          ) : null}
          {notice ? <p className="yds-dbb__meta">{notice}</p> : null}
          <button type="submit" disabled={!preview?.ok}>
            매도 저장
          </button>
        </form>
      ) : (
        <p className="yds-dbb__meta">전량 매도되어 보유 목록에서 빠져 있습니다. 매수와 매도 기록은 아래에 남습니다.</p>
      )}
      <ol className="yds-dbb-holdings__buys-list">
        {buys.map((row) => (
          <li key={row.id}>
            매수 {row.buyDate} · {formatTradeRecordShares(row)} · {formatUsdPrice(row.buyPrice)}
          </li>
        ))}
        {position.settlements.map((row) => (
          <li key={row.id}>
            매도 {row.sellDate} · {formatShares(row.filledShares)} · {formatUsdPrice(row.sellPrice)} · 손익{" "}
            {formatUsdAmount(row.realizedPnl)} · {formatReturnPct(row.returnPct)}
            {row.chargesKnown ? "" : " · 수수료·세금 미입력"}
            {` · 연결 매수 ${row.links.map((link) => link.buyDate).join(", ")}`}
            <button type="button" onClick={() => handleCancel(row.id)}>
              매도 취소
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
