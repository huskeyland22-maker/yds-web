import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { addEquitySell, cancelEquitySell, previewEquitySell, recordedShareCount } from "../content/ydsEquitySellLedger.js"
import { buildOperatingJournal, filterJournalRows } from "../content/ydsOperatingJournal.js"
import { fetchPortfolioQuotes } from "../content/ydsPortfolioQuoteService.js"
import {
  formatShares,
  formatUsdAmount,
  formatUsdPrice,
  listTradeRecords,
  readTradeRecordsStore,
  TRADE_RECORDS_CHANGED_EVENT,
  upsertTradeRecord,
} from "../content/ydsTradeRecords.js"

const FILTERS = [
  { id: "all", label: "전체" },
  { id: "buy", label: "매수" },
  { id: "sell", label: "매도" },
  { id: "open", label: "보유 중" },
  { id: "closed", label: "전량 매도" },
]

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
  const text = `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`
  return text
}

function tone(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || Math.abs(n) < 1e-8) return ""
  return n > 0 ? "yds-oj__up" : "yds-oj__down"
}

function SummaryCard({ label, value, hint, className = "" }) {
  return (
    <article className="yds-oj__card">
      <p className="yds-oj__card-label">{label}</p>
      <p className={`yds-oj__card-value ${className}`}>{value}</p>
      {hint ? <p className="yds-oj__card-hint">{hint}</p> : null}
    </article>
  )
}

function sharesLeft(value) {
  return value > 1e-8 ? formatShares(value) : "0주"
}

function TradeCells({ row, onCancel }) {
  return (
    <>
      <td>{row.date}</td>
      <td>
        <strong>{row.symbol}</strong>
        <span className="yds-oj__sub">{row.name}</span>
      </td>
      <td>
        {row.typeLabel}
        {row.kind === "sell" ? (
          <button type="button" onClick={() => onCancel(row.id)}>취소</button>
        ) : null}
      </td>
      <td className="yds-oj__num">{formatUsdPrice(row.buyPrice)}</td>
      <td className="yds-oj__num">{row.sellPrice == null ? "—" : formatUsdPrice(row.sellPrice)}</td>
      <td className="yds-oj__num">{formatShares(row.shares)}</td>
      <td className="yds-oj__num">{row.buyAmount > 0 ? formatUsdAmount(row.buyAmount) : "—"}</td>
      <td className="yds-oj__num">{row.sellAmount == null ? "—" : formatUsdAmount(row.sellAmount)}</td>
      <td className={`yds-oj__num ${tone(row.realizedPnl)}`}>{row.realizedPnl == null ? "—" : signedUsd(row.realizedPnl)}</td>
      <td className={`yds-oj__num ${tone(row.returnPct)}`}>{row.returnPct == null ? "—" : signedPct(row.returnPct)}</td>
    </>
  )
}

export default function OperatingJournalPage() {
  const [version, setVersion] = useState(0)
  const [prices, setPrices] = useState({})
  const [kind, setKind] = useState("all")
  const [query, setQuery] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [notice, setNotice] = useState("")

  const [buySymbol, setBuySymbol] = useState("")
  const [buyDate, setBuyDate] = useState("")
  const [buyPrice, setBuyPrice] = useState("")
  const [buyShares, setBuyShares] = useState("")
  const [buyWeight, setBuyWeight] = useState("")
  const [buyMemo, setBuyMemo] = useState("")
  const [buySystem, setBuySystem] = useState("dbb")

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

  const store = useMemo(() => {
    void version
    return readTradeRecordsStore()
  }, [version])

  const symbols = useMemo(() => {
    const found = new Set()
    for (const key of Object.keys(store.records || {})) {
      const symbol = key.slice(key.indexOf(":") + 1)
      if (symbol) found.add(symbol)
    }
    return [...found]
  }, [store])

  useEffect(() => {
    if (!symbols.length) return undefined
    let cancelled = false
    fetchPortfolioQuotes(
      symbols.map((symbol) => ({ id: symbol, ticker: symbol, country: "us", priceReady: true })),
    ).then((result) => {
      if (cancelled) return
      const next = {}
      for (const symbol of symbols) {
        const price = Number(result?.quoteMap?.get(symbol)?.price)
        if (price > 0) next[symbol] = price
      }
      setPrices(next)
    })
    return () => {
      cancelled = true
    }
  }, [symbols.join("|")])

  const report = useMemo(() => buildOperatingJournal(store, prices), [store, prices])
  const visibleRows = useMemo(
    () => filterJournalRows(report.rows, { kind, query, from, to }),
    [report.rows, kind, query, from, to],
  )
  const sellTarget = report.holdings.find((row) => `${row.system}:${row.symbol}` === sellKey) || null
  const sellSystem = sellTarget?.system || "dbb"
  const sellSymbol = sellTarget?.symbol || ""
  const preview = useMemo(() => {
    if (!sellSymbol || (!sellPrice && !sellShares)) return null
    return previewEquitySell(sellSystem, sellSymbol, {
      sellDate,
      sellPrice,
      shares: sellShares,
      feeUsd,
      taxUsd,
      memo: sellMemo,
    })
  }, [sellSystem, sellSymbol, sellDate, sellPrice, sellShares, feeUsd, taxUsd, sellMemo, version])

  function saveBuy(event) {
    event.preventDefault()
    const symbol = buySymbol.trim().toUpperCase()
    const price = Number(buyPrice)
    const shares = Number(buyShares)
    const weight = buyWeight === "" ? null : Number(buyWeight)
    if (!symbol || !/^\d{4}-\d{2}-\d{2}$/.test(buyDate) || !(price > 0) || !(shares > 0)) {
      setNotice("종목, 매수일, 매수가, 수량을 입력하세요.")
      return
    }
    if (weight != null && (!(weight > 0) || weight > 100)) {
      setNotice("매수 비중은 확인된 1~100%만 입력하세요.")
      return
    }
    const duplicate = listTradeRecords(buySystem, symbol).some(
      (row) =>
        row.buyDate === buyDate &&
        Math.abs(row.buyPrice - price) < 1e-8 &&
        Math.abs((recordedShareCount(row) || 0) - shares) < 1e-8,
    )
    if (duplicate) {
      setNotice("같은 매수 기록이 이미 있습니다.")
      return
    }
    const saved = upsertTradeRecord({
      system: buySystem,
      symbol,
      buyDate,
      buyPrice: price,
      shares,
      buyAmountUsd: price * shares,
      ...(weight != null
        ? { weightPct: weight, buyType: "strategy", buyStage: 1 }
        : { buyType: "discretionary" }),
      memo: buyMemo,
    })
    setNotice(saved ? "매수 기록을 추가했습니다. 기존 매수는 바꾸지 않았습니다." : "매수 기록을 저장하지 못했습니다.")
    if (!saved) return
    setBuySymbol("")
    setBuyDate("")
    setBuyPrice("")
    setBuyShares("")
    setBuyWeight("")
    setBuyMemo("")
  }

  function saveSell(event) {
    event.preventDefault()
    const result = addEquitySell(sellSystem, sellSymbol, {
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

  const nee = report.nee

  return (
    <div className="yds-oj">
      <header className="yds-oj__head">
        <p className="yds-oj__kicker">실제 매수 기록</p>
        <h1>실전 매매일지</h1>
        <p>
          개별 종목 조정매매에 저장된 매수와 여기에 쌓인 매도를 한 장부로 봅니다. 금액은 USD입니다.
          신호 확인은 <Link to="/equity-daily-bottom-buy">개별 종목 조정매매</Link>에서 계속합니다.
        </p>
      </header>

      <section className="yds-oj__summary" aria-label="장부 요약">
        <SummaryCard label="총 매수금액" value={formatUsdAmount(report.totalBuyUsd)} />
        <SummaryCard label="총 실현손익" value={signedUsd(report.realizedPnl)} className={tone(report.realizedPnl)} hint="매도 체결만 합산" />
        <SummaryCard
          label="총 평가손익"
          value={report.unrealizedPnl == null ? "—" : signedUsd(report.unrealizedPnl)}
          className={tone(report.unrealizedPnl)}
          hint={report.missingPriceCount ? `시세 없는 보유 ${report.missingPriceCount}개 제외` : "남은 수량 × 현재가"}
        />
        <SummaryCard label="누적 수익률" value={signedPct(report.cumulativeReturnPct)} className={tone(report.cumulativeReturnPct)} hint="실현손익 ÷ 매도된 매수원가" />
        <SummaryCard label="매도 거래" value={`${report.sellCount}건`} />
        <SummaryCard label="승률" value={report.winRatePct == null ? "—" : signedPct(report.winRatePct).replace("+", "")} hint="실현손익이 플러스인 매도 ÷ 매도 건수" />
        <SummaryCard label="보유 종목" value={`${report.holdingCount}개`} />
      </section>

      {nee.length ? (
        <section className="yds-oj__note" aria-label="NEE 기록">
          {nee.map((row) => (
            <p key={`${row.system}:${row.symbol}`}>
              {row.name} ({row.symbol}) 매수 기록이 있습니다. 남은 수량 {formatShares(row.openShares)}, 저장된 매도 {row.sellCount}건.
              매도일·매도가·수량이 없으면 확인된 값만 아래에 입력합니다.
            </p>
          ))}
        </section>
      ) : null}

      {notice ? <p className="yds-oj__notice" role="status">{notice}</p> : null}

      <div className="yds-oj__forms">
        <form className="yds-oj__panel" onSubmit={saveBuy} aria-label="매수 입력">
          <h2>매수 추가</h2>
          <p>새 매수만 추가합니다. 이미 저장된 매수 내용은 바꾸지 않습니다.</p>
          <label>구분
            <select value={buySystem} onChange={(event) => setBuySystem(event.target.value)}>
              <option value="dbb">조정 매수</option>
              <option value="panic">공포 매수</option>
            </select>
          </label>
          <label>종목
            <input value={buySymbol} onChange={(event) => setBuySymbol(event.target.value)} list="oj-symbols" required />
          </label>
          <label>매수일
            <input type="date" value={buyDate} onChange={(event) => setBuyDate(event.target.value)} required />
          </label>
          <label>매수가 USD
            <input inputMode="decimal" value={buyPrice} onChange={(event) => setBuyPrice(event.target.value)} required />
          </label>
          <label>수량
            <input inputMode="decimal" value={buyShares} onChange={(event) => setBuyShares(event.target.value)} required />
          </label>
          <label>비중 %
            <input inputMode="decimal" value={buyWeight} onChange={(event) => setBuyWeight(event.target.value)} placeholder="없으면 비움" />
          </label>
          <label>메모
            <input value={buyMemo} onChange={(event) => setBuyMemo(event.target.value)} />
          </label>
          <button type="submit">매수 저장</button>
        </form>

        <form className="yds-oj__panel" onSubmit={saveSell} aria-label="매도 입력">
          <h2>매도 입력</h2>
          <p>보유 잔량이 있는 매수에서만 고릅니다. 모르는 수수료와 세금은 비워 둡니다.</p>
          <label>종목
            <select value={sellKey} onChange={(event) => setSellKey(event.target.value)} required>
              <option value="">보유 종목 선택</option>
              {report.holdings.map((row) => (
                <option key={`${row.system}:${row.symbol}`} value={`${row.system}:${row.symbol}`}>
                  {row.symbol} · {row.name} · 남은 {formatShares(row.openShares)}
                </option>
              ))}
            </select>
          </label>
          <label>매도일
            <input type="date" value={sellDate} onChange={(event) => setSellDate(event.target.value)} required />
          </label>
          <label>매도가 USD
            <input inputMode="decimal" value={sellPrice} onChange={(event) => setSellPrice(event.target.value)} required />
          </label>
          <label>매도수량
            <input inputMode="decimal" value={sellShares} onChange={(event) => setSellShares(event.target.value)} required />
          </label>
          <label>수수료 USD
            <input inputMode="decimal" value={feeUsd} onChange={(event) => setFeeUsd(event.target.value)} />
          </label>
          <label>세금 USD
            <input inputMode="decimal" value={taxUsd} onChange={(event) => setTaxUsd(event.target.value)} />
          </label>
          <label>메모
            <input value={sellMemo} onChange={(event) => setSellMemo(event.target.value)} />
          </label>
          {preview?.ok && preview.preview ? (
            <div className="yds-oj__preview" aria-label="매도 미리보기">
              <p>매도금액 {formatUsdAmount(preview.preview.proceeds)}</p>
              <p>매수원가 {formatUsdAmount(preview.preview.cost)}</p>
              <p>{preview.preview.chargesKnown ? `수수료·세금 ${formatUsdAmount((preview.preview.feeUsd || 0) + (preview.preview.taxUsd || 0))}` : "수수료·세금 미입력"}</p>
              <p className={tone(preview.preview.realizedPnl)}>예상 실현손익 {signedUsd(preview.preview.realizedPnl)}</p>
              <p className={tone(preview.preview.returnPct)}>예상 수익률 {signedPct(preview.preview.returnPct)}</p>
              <p>매도 후 잔여 {sharesLeft(preview.openShares - preview.preview.filledShares)}</p>
            </div>
          ) : preview && !preview.ok ? (
            <p className="yds-oj__warn">{preview.message}</p>
          ) : null}
          <button type="submit" disabled={!report.holdings.length}>매도 저장</button>
        </form>
      </div>

      <section className="yds-oj__panel" aria-label="보유 현황">
        <h2>현재 보유</h2>
        {report.holdings.length ? (
          <ul className="yds-oj__holdings">
            {report.holdings.map((row) => (
              <li key={`${row.system}:${row.symbol}`}>
                <strong>{row.symbol}</strong>
                <span>{row.name}</span>
                <span>남은 {formatShares(row.openShares)}</span>
                <span>평균 {formatUsdPrice(row.avgPrice)}</span>
                <span>현재가 {row.price == null ? "시세 없음" : formatUsdPrice(row.price)}</span>
                <span className={tone(row.unrealizedPnl)}>평가 {row.unrealizedPnl == null ? "—" : signedUsd(row.unrealizedPnl)}</span>
                <span className={tone(row.realizedPnl)}>실현 {row.sellCount ? signedUsd(row.realizedPnl) : "—"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>남은 보유 수량이 없습니다.</p>
        )}
      </section>

      <section className="yds-oj__panel" aria-label="누적 거래 내역">
        <h2>누적 거래 내역</h2>
        <div className="yds-oj__filters">
          {FILTERS.map((item) => (
            <button key={item.id} type="button" className={kind === item.id ? "is-on" : ""} onClick={() => setKind(item.id)}>
              {item.label}
            </button>
          ))}
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="종목 검색" aria-label="종목 검색" />
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="시작일" />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="종료일" />
        </div>
        {visibleRows.length ? (
          <>
            <div className="yds-oj__table-wrap">
              <table className="yds-oj__table">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>종목</th>
                    <th>거래 유형</th>
                    <th>매수가</th>
                    <th>매도가</th>
                    <th>수량</th>
                    <th>매수금액</th>
                    <th>매도금액</th>
                    <th>실현손익</th>
                    <th>수익률</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={`${row.kind}:${row.id}`}>
                      <TradeCells row={row} onCancel={cancelSell} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="yds-oj__mobile">
              {visibleRows.map((row) => (
                <li key={`card-${row.kind}:${row.id}`}>
                  <div>
                    <strong>{row.symbol}</strong> · {row.typeLabel}
                  </div>
                  <div>{row.date} · {formatShares(row.shares)}</div>
                  <div>매수 {formatUsdPrice(row.buyPrice)} · 매도 {row.sellPrice == null ? "—" : formatUsdPrice(row.sellPrice)}</div>
                  <div className={tone(row.realizedPnl)}>
                    {row.realizedPnl == null ? "보유 기록" : `실현 ${signedUsd(row.realizedPnl)} · ${signedPct(row.returnPct)}`}
                  </div>
                  {row.kind === "sell" ? (
                    <button type="button" onClick={() => cancelSell(row.id)}>매도 취소</button>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>이 조건의 거래 기록이 없습니다.</p>
        )}
      </section>

      <section className="yds-oj__panel" aria-label="실현손익 분석">
        <h2>실현손익 분석</h2>
        <p>아래 숫자는 이 장부의 매도 기록에서만 계산합니다.</p>
        <div className="yds-oj__analysis">
          <article>
            <h3>월별</h3>
            {report.months.length ? report.months.map((row) => (
              <p key={row.key} className={tone(row.pnl)}>{row.key} {signedUsd(row.pnl)}</p>
            )) : <p>저장된 매도가 없습니다.</p>}
          </article>
          <article>
            <h3>연도별</h3>
            {report.years.length ? report.years.map((row) => (
              <p key={row.key} className={tone(row.pnl)}>{row.key} {signedUsd(row.pnl)}</p>
            )) : <p>저장된 매도가 없습니다.</p>}
          </article>
          <article>
            <h3>종목별</h3>
            {report.symbols.length ? report.symbols.map((row) => (
              <p key={row.symbol} className={tone(row.realizedPnl)}>{row.symbol} {signedUsd(row.realizedPnl)} · {row.sellCount}건</p>
            )) : <p>저장된 매도가 없습니다.</p>}
          </article>
          <article>
            <h3>수익 / 손실</h3>
            <p className="yds-oj__up">수익 거래 {report.winCount}건</p>
            <p className="yds-oj__down">손실 거래 {report.lossCount}건</p>
          </article>
          <article>
            <h3>최근 매도</h3>
            {report.recentSells.length ? report.recentSells.map((row) => (
              <p key={row.id}>
                {row.date} {row.symbol} {row.typeLabel} <span className={tone(row.realizedPnl)}>{signedUsd(row.realizedPnl)}</span>
                <button type="button" onClick={() => cancelSell(row.id)}>취소</button>
              </p>
            )) : <p>저장된 매도가 없습니다.</p>}
          </article>
        </div>
      </section>
      <datalist id="oj-symbols">
        {symbols.map((symbol) => (
          <option key={symbol} value={symbol} />
        ))}
      </datalist>
    </div>
  )
}
