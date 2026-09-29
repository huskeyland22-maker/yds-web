import { useEffect, useMemo, useState } from "react"
import {
  deleteTradeRecord,
  formatTradeRecordShares,
  formatUsdAmount,
  formatUsdPrice,
  listTradeRecords,
  TRADE_RECORDS_CHANGED_EVENT,
  upsertTradeRecord,
} from "../../content/ydsTradeRecords.js"

/**
 * Equity pages pass `integerUsdInputs` so price and amount drop the fraction.
 * ETF leaves the flag unset and keeps decimals. Empty input stays empty.
 * @param {string | number | null | undefined} raw
 * @param {boolean} integerUsdInputs
 * @returns {string}
 */
export function coerceUsdInputText(raw, integerUsdInputs) {
  const text = raw == null ? "" : String(raw)
  if (!integerUsdInputs) return text
  if (text.trim() === "") return ""
  const n = Number(text)
  if (!Number.isFinite(n)) return text
  return String(Math.trunc(n))
}

/**
 * @param {string | number | null | undefined} raw
 * @param {boolean} integerUsdInputs
 * @returns {number}
 */
export function coerceUsdSaveNumber(raw, integerUsdInputs) {
  const n = Number(raw)
  if (!integerUsdInputs || !Number.isFinite(n)) return n
  return Math.trunc(n)
}

/**
 * @param {{
 *   system: 'dbb' | 'panic'
 *   symbol: string
 *   defaultWeightPct?: number
 *   onChange?: () => void
 *   integerUsdInputs?: boolean
 * }} props
 */
export default function TradeRecordEditor({
  system,
  symbol,
  defaultWeightPct = 50,
  onChange,
  integerUsdInputs = false,
}) {
  const [buyDate, setBuyDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [buyPrice, setBuyPrice] = useState("")
  const [shares, setShares] = useState("")
  const [buyAmountUsd, setBuyAmountUsd] = useState("")
  const [weightPct, setWeightPct] = useState(String(defaultWeightPct))
  const [memo, setMemo] = useState("")
  const [editId, setEditId] = useState(/** @type {string | null} */ (null))
  const [error, setError] = useState(/** @type {string | null} */ (null))
  const [tick, setTick] = useState(0)

  const records = useMemo(() => {
    void tick
    return listTradeRecords(system, symbol)
  }, [system, symbol, tick])

  useEffect(() => {
    const onRecordsChanged = () => setTick((n) => n + 1)
    window.addEventListener(TRADE_RECORDS_CHANGED_EVENT, onRecordsChanged)
    return () => window.removeEventListener(TRADE_RECORDS_CHANGED_EVENT, onRecordsChanged)
  }, [])

  function refresh() {
    setTick((n) => n + 1)
    onChange?.()
  }

  function resetForm(nextWeight = defaultWeightPct) {
    setEditId(null)
    setBuyDate(new Date().toISOString().slice(0, 10))
    setBuyPrice("")
    setShares("")
    setBuyAmountUsd("")
    setWeightPct(String(nextWeight))
    setMemo("")
    setError(null)
  }

  function onSubmit(e) {
    e.preventDefault()
    setError(null)
    const priceNum = coerceUsdSaveNumber(buyPrice, integerUsdInputs)
    const amountNum = coerceUsdSaveNumber(buyAmountUsd, integerUsdInputs)
    const sharesNum = shares === "" ? null : Number(shares)
    const saved = upsertTradeRecord({
      id: editId || undefined,
      system,
      symbol,
      buyDate,
      buyPrice: priceNum,
      buyAmountUsd: amountNum,
      shares: sharesNum,
      weightPct: Number(weightPct),
      memo,
    })
    if (!saved) {
      setError("입력값을 확인해 주세요. (매수일·매수가 USD·금액 USD·비중)")
      return
    }
    resetForm(defaultWeightPct)
    refresh()
  }

  function onEdit(rec) {
    setEditId(rec.id)
    setBuyDate(rec.buyDate)
    setBuyPrice(coerceUsdInputText(rec.buyPrice, integerUsdInputs))
    setShares(rec.shares != null ? String(rec.shares) : "")
    setBuyAmountUsd(coerceUsdInputText(rec.buyAmountUsd, integerUsdInputs))
    setWeightPct(String(rec.weightPct))
    setMemo(rec.memo || "")
    setError(null)
  }

  function onDelete(id) {
    deleteTradeRecord(system, symbol, id)
    if (editId === id) resetForm(defaultWeightPct)
    refresh()
  }

  return (
    <div className="yds-trade-rec">
      <form className="yds-trade-rec__form" onSubmit={onSubmit}>
        <div className="yds-trade-rec__grid">
          <label>
            <span>매수일</span>
            <input
              type="date"
              value={buyDate}
              onChange={(ev) => setBuyDate(ev.target.value)}
              required
            />
          </label>
          <label>
            <span>매수가 (USD)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="216.17"
              value={buyPrice}
              onChange={(ev) => setBuyPrice(coerceUsdInputText(ev.target.value, integerUsdInputs))}
              required
            />
          </label>
          <label>
            <span>매수 수량 (주)</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="5"
              value={shares}
              onChange={(ev) => setShares(ev.target.value)}
            />
          </label>
          <label>
            <span>매수금액 (USD)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="1080"
              value={buyAmountUsd}
              onChange={(ev) => setBuyAmountUsd(coerceUsdInputText(ev.target.value, integerUsdInputs))}
              required
            />
          </label>
          <label>
            <span>매수 비중 (%)</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              max="100"
              value={weightPct}
              onChange={(ev) => setWeightPct(ev.target.value)}
              required
            />
          </label>
        </div>
        <label className="yds-trade-rec__memo">
          <span>메모 (선택)</span>
          <input
            type="text"
            value={memo}
            maxLength={120}
            placeholder="선택"
            onChange={(ev) => setMemo(ev.target.value)}
          />
        </label>
        {error ? <p className="yds-trade-rec__err">{error}</p> : null}
        <div className="yds-trade-rec__actions">
          <button type="submit" className="yds-trade-rec__save">
            {editId ? "수정 저장" : "기록 저장"}
          </button>
          {editId ? (
            <button type="button" className="yds-trade-rec__cancel" onClick={() => resetForm()}>
              취소
            </button>
          ) : null}
        </div>
      </form>

      {records.length > 0 ? (
        <ul className="yds-trade-rec__list" aria-label="매수 기록 목록">
          {records.map((r) => (
            <li key={r.id}>
              <div
                className="yds-trade-rec__list-main yds-trade-rec__list-main--usd font-mono tabular-nums"
                title="매수일 · 매수가 · 수량 · 금액 · 비중"
              >
                {[
                  r.buyDate,
                  formatUsdPrice(r.buyPrice),
                  formatTradeRecordShares(r),
                  formatUsdAmount(r.buyAmountUsd),
                  `${Number(r.weightPct).toFixed(0)}%`,
                ].join(" | ")}
              </div>
              {r.memo ? <p className="yds-trade-rec__list-memo">{r.memo}</p> : null}
              <div className="yds-trade-rec__list-actions">
                <button type="button" onClick={() => onEdit(r)}>
                  수정
                </button>
                <button type="button" onClick={() => onDelete(r.id)}>
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
