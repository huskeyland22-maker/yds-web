import { useEffect, useMemo, useState } from "react"
import { getPanicScoreV2 } from "../../utils/tradingScores.js"
import { listTradeRecords, TRADE_RECORDS_CHANGED_EVENT } from "../../content/ydsTradeRecords.js"
import { buildPanicTradeStatusView } from "../../content/ydsTradeRecordsStatus.js"
import TradeRecordEditor from "../trade-records/TradeRecordEditor.jsx"
import TradeRecordStatusBlock from "../trade-records/TradeRecordStatusBlock.jsx"

const PANIC_TRADE_SYMBOL = "SPY"

/**
 * Panic 매수 수동 기록 — 핵심 Panic UI와 분리된 보조 영역.
 * 자동 주문 없음 · Panic 계산/단계 로직 변경 없음.
 * @param {{
 *   panicData?: object | null
 *   currentPrice?: number | null
 *   asOfDate?: string | null
 *   className?: string
 * }} props
 */
export default function YdsPanicTradeRecordPanel({
  panicData = null,
  currentPrice = null,
  asOfDate = null,
  className = "",
}) {
  const [open, setOpen] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const onChange = () => setVersion((n) => n + 1)
    window.addEventListener(TRADE_RECORDS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(TRADE_RECORDS_CHANGED_EVENT, onChange)
  }, [])

  const score = useMemo(() => getPanicScoreV2(panicData), [panicData])
  const records = useMemo(() => {
    void version
    return listTradeRecords("panic", PANIC_TRADE_SYMBOL)
  }, [version])

  const statusView = useMemo(
    () =>
      buildPanicTradeStatusView(score, records, {
        currentPrice,
        asOfDate,
      }),
    [score, records, currentPrice, asOfDate],
  )

  return (
    <section
      className={["yds-panic-trade", className].filter(Boolean).join(" ")}
      aria-label="공포·패닉 매수 기록"
    >
      <header className="yds-panic-trade__head">
        <div>
          <h3 className="yds-panic-trade__title">매수 기록</h3>
          <p className="yds-panic-trade__sub">
            SPY 기준 수동 기록 (USD) · 자동 주문 없음 · 40/27/33 참고
          </p>
        </div>
        <button
          type="button"
          className="yds-panic-trade__toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "닫기" : records.length ? "기록 보기·추가" : "기록하기"}
        </button>
      </header>

      {statusView.hasRecords ? <TradeRecordStatusBlock view={statusView} /> : null}

      {open ? (
        <TradeRecordEditor
          system="panic"
          symbol={PANIC_TRADE_SYMBOL}
          defaultWeightPct={40}
          onChange={() => setVersion((n) => n + 1)}
        />
      ) : null}
    </section>
  )
}
