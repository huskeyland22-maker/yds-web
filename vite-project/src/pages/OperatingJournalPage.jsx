import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { addEquitySell, cancelEquitySell, previewEquitySell } from "../content/ydsEquitySellLedger.js"
import { buildOperatingJournal, filterJournalRows } from "../content/ydsOperatingJournal.js"
import {
  formatShares,
  formatUsdAmount,
  formatUsdPrice,
  readTradeRecordsStore,
  TRADE_RECORDS_CHANGED_EVENT,
} from "../content/ydsTradeRecords.js"

function signedUsd(value) {
  if (value == null || value === "") return "—"
  const n = Number(value)
  if (!Number.isFinite(n)) return "—"
  const body = formatUsdAmount(Math.abs(n))
  if (Math.abs(n) < 1e-8) return body
  return n > 0 ? `+${body}` : `-${body}`
}

function signedPct(value) {
  if (value == null || value === "") return "—"
  const n = Number(value)
  if (!Number.isFinite(n)) return "—"
  const rounded = Math.round(n * 10) / 10
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`
}

function tone(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || Math.abs(n) < 1e-8) return ""
  return n > 0 ? "yds-oj__up" : "yds-oj__down"
}

function chargeText(value) {
  if (value == null) return "미입력"
  return formatUsdAmount(value)
}

function SummaryCard({ label, value, className = "" }) {
  return (
    <article className="yds-oj__card">
      <p className="yds-oj__card-label">{label}</p>
      <p className={`yds-oj__card-value ${className}`}>{value}</p>
    </article>
  )
}

function sharesLeft(value) {
  return value > 1e-8 ? formatShares(value) : "0주"
}

const COLUMNS = [
  ["매도일", (row) => row.date],
  ["종목", (row) => `${row.name} ${row.symbol}`],
  ["매수일", (row) => row.buyDateLabel || "—"],
  ["매수 평균단가", (row) => formatUsdPrice(row.avgBuyPrice)],
  ["매도단가", (row) => formatUsdPrice(row.sellPrice)],
  ["매도수량", (row) => formatShares(row.shares)],
  ["매수원가", (row) => formatUsdAmount(row.cost)],
  ["매도금액", (row) => formatUsdAmount(row.proceeds)],
  ["수수료", (row) => chargeText(row.feeUsd)],
  ["세금", (row) => chargeText(row.taxUsd)],
  ["실현손익", (row) => signedUsd(row.realizedPnl), "realizedPnl"],
  ["실현수익률", (row) => signedPct(row.returnPct), "returnPct"],
  ["메모", (row) => row.memo || "—"],
]

export default function OperatingJournalPage() {
  const [version, setVersion] = useState(0)
  const [query, setQuery] = useState("")
  const [year, setYear] = useState("")
  const [month, setMonth] = useState("")
  const [notice, setNotice] = useState("")
  const [sellKey, setSellKey] = useState("")
  const [sellDate, setSellDate] = useState("")
  const [sellPrice, setSellPrice] = useState("")
  const [sellShares, setSellShares] = useState("")
  const [feeUsd, setFeeUsd] = useState("")
  const [taxUsd, setTaxUsd] = useState("")
  const [sellMemo, setSellMemo] = useState("")

  useEffect(() => {
    const onChange = () => setVersion((n) => n + 1)
    window.addEventListener(TRADE_RECORDS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(TRADE_RECORDS_CHANGED_EVENT, onChange)
  }, [])

  const report = useMemo(() => {
    void version
    return buildOperatingJournal(readTradeRecordsStore())
  }, [version])

  const visibleRows = useMemo(
    () => filterJournalRows(report.rows, { query, year, month }),
    [report.rows, query, year, month],
  )
  const sellTarget = report.sellTargets.find((row) => `${row.system}:${row.symbol}` === sellKey) || null
  const preview = useMemo(() => {
    if (!sellTarget || (!sellPrice && !sellShares)) return null
    return previewEquitySell(sellTarget.system, sellTarget.symbol, {
      sellDate,
      sellPrice,
      shares: sellShares,
      feeUsd,
      taxUsd,
      memo: sellMemo,
    })
  }, [sellTarget, sellDate, sellPrice, sellShares, feeUsd, taxUsd, sellMemo, version])

  function saveSell(event) {
    event.preventDefault()
    if (!sellTarget) {
      setNotice("보유 잔량이 있는 종목을 선택하세요.")
      return
    }
    const result = addEquitySell(sellTarget.system, sellTarget.symbol, {
      sellDate,
      sellPrice,
      shares: sellShares,
      feeUsd,
      taxUsd,
      memo: sellMemo,
    })
    setNotice(result.ok ? "매도 기록을 저장했습니다." : result.message)
    if (!result.ok) return
    setSellDate("")
    setSellPrice("")
    setSellShares("")
    setFeeUsd("")
    setTaxUsd("")
    setSellMemo("")
  }

  function cancelSell(id) {
    if (!window.confirm("이 매도 기록만 취소합니다. 매수 기록은 남습니다.")) return
    cancelEquitySell(id)
    setNotice("매도 기록을 취소했습니다.")
  }

  return (
    <div className="yds-oj">
      <header className="yds-oj__head">
        <p className="yds-oj__kicker">실현손익</p>
        <h1>실전 매매일지</h1>
        <p>
          매도가 저장된 거래만 표시합니다. 매수 기록은 <Link to="/equity-daily-bottom-buy">개별 종목 조정매매</Link>에 그대로 둡니다.
          평가손익은 이 합계에 넣지 않습니다.
        </p>
      </header>

      <section className="yds-oj__summary" aria-label="실현 성과">
        <SummaryCard label="누적 실현손익" value={signedUsd(report.realizedPnl)} className={tone(report.realizedPnl)} />
        <SummaryCard label="누적 실현수익률" value={signedPct(report.cumulativeReturnPct)} className={tone(report.cumulativeReturnPct)} />
        <SummaryCard label="실현 매도" value={`${report.sellCount}건`} />
        <SummaryCard label="수익 거래" value={`${report.winCount}건`} className="yds-oj__up" />
        <SummaryCard label="손실 거래" value={`${report.lossCount}건`} className={report.lossCount ? "yds-oj__down" : ""} />
        <SummaryCard label="승률" value={report.winRatePct == null ? "—" : `${(Math.round(report.winRatePct * 10) / 10).toFixed(1)}%`} />
      </section>

      <section className="yds-oj__panel" aria-label="월별 실현손익">
        <h2>월별 실현손익</h2>
        {report.months.length ? (
          <ul className="yds-oj__months">
            {report.months.map((row) => (
              <li key={row.key}>
                <span>{row.key}</span>
                <strong className={tone(row.pnl)}>{signedUsd(row.pnl)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p>저장된 매도가 없습니다.</p>
        )}
      </section>

      {notice ? <p className="yds-oj__notice" role="status">{notice}</p> : null}

      <form className="yds-oj__panel" onSubmit={saveSell} aria-label="매도 입력">
        <h2>매도 기록</h2>
        <p>확인된 매도만 저장합니다. 모르는 수수료와 세금은 비워 둡니다.</p>
        <div className="yds-oj__sell-grid">
          <label>종목
            <select value={sellKey} onChange={(event) => setSellKey(event.target.value)} required>
              <option value="">보유 종목 선택</option>
              {report.sellTargets.map((row) => (
                <option key={`${row.system}:${row.symbol}`} value={`${row.system}:${row.symbol}`}>
                  {row.symbol} · {row.name} · 남은 {formatShares(row.openShares)}
                </option>
              ))}
            </select>
          </label>
          <label>매도일<input type="date" value={sellDate} onChange={(event) => setSellDate(event.target.value)} required /></label>
          <label>매도단가 USD<input inputMode="decimal" value={sellPrice} onChange={(event) => setSellPrice(event.target.value)} required /></label>
          <label>매도수량<input inputMode="decimal" value={sellShares} onChange={(event) => setSellShares(event.target.value)} required /></label>
          <label>수수료 USD<input inputMode="decimal" value={feeUsd} onChange={(event) => setFeeUsd(event.target.value)} /></label>
          <label>세금 USD<input inputMode="decimal" value={taxUsd} onChange={(event) => setTaxUsd(event.target.value)} /></label>
          <label>메모<input value={sellMemo} onChange={(event) => setSellMemo(event.target.value)} /></label>
        </div>
        {preview?.ok && preview.preview ? (
          <div className="yds-oj__preview" aria-label="매도 미리보기">
            <p>매수원가 {formatUsdAmount(preview.preview.cost)}</p>
            <p>매도금액 {formatUsdAmount(preview.preview.proceeds)}</p>
            <p>{preview.preview.chargesKnown ? `수수료·세금 ${formatUsdAmount((preview.preview.feeUsd || 0) + (preview.preview.taxUsd || 0))}` : "수수료·세금 미입력"}</p>
            <p className={tone(preview.preview.realizedPnl)}>실현손익 {signedUsd(preview.preview.realizedPnl)}</p>
            <p className={tone(preview.preview.returnPct)}>실현수익률 {signedPct(preview.preview.returnPct)}</p>
            <p>매도 후 잔여 {sharesLeft(preview.openShares - preview.preview.filledShares)}</p>
          </div>
        ) : preview && !preview.ok ? (
          <p className="yds-oj__warn">{preview.message}</p>
        ) : null}
        <button type="submit" disabled={!report.sellTargets.length}>매도 저장</button>
      </form>

      <section className="yds-oj__panel" aria-label="실현 매도 내역">
        <h2>실현 매도 내역</h2>
        <div className="yds-oj__filters">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="종목 검색" aria-label="종목 검색" />
          <select value={year} onChange={(event) => setYear(event.target.value)} aria-label="연도">
            <option value="">전체 연도</option>
            {report.years.map((row) => (
              <option key={row.key} value={row.key}>{row.key}</option>
            ))}
          </select>
          <select value={month} onChange={(event) => setMonth(event.target.value)} aria-label="월">
            <option value="">전체 월</option>
            {report.months.map((row) => (
              <option key={row.key} value={row.key}>{row.key}</option>
            ))}
          </select>
        </div>
        {visibleRows.length ? (
          <>
            <div className="yds-oj__table-wrap">
              <table className="yds-oj__table">
                <thead>
                  <tr>
                    {COLUMNS.map(([label]) => (
                      <th key={label}>{label}</th>
                    ))}
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id}>
                      {COLUMNS.map(([label, read, field]) => (
                        <td key={label} className={field ? `yds-oj__num ${tone(row[field])}` : "yds-oj__num"}>
                          {read(row)}
                        </td>
                      ))}
                      <td><button type="button" onClick={() => cancelSell(row.id)}>취소</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="yds-oj__mobile">
              {visibleRows.map((row) => (
                <li key={`card-${row.id}`}>
                  {COLUMNS.map(([label, read, field]) => (
                    <p key={label}>
                      <span>{label}</span>
                      <strong className={field ? tone(row[field]) : ""}>{read(row)}</strong>
                    </p>
                  ))}
                  <button type="button" onClick={() => cancelSell(row.id)}>매도 취소</button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>이 조건의 실현 매도가 없습니다.</p>
        )}
      </section>
    </div>
  )
}
