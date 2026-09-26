import {
  formatReturnPct,
  formatUsdPrice,
} from "../../content/ydsTradeRecords.js"

/**
 * @param {{
 *   view: {
 *     signalLabel: string
 *     stageLabel: string
 *     userStageNote?: string
 *     recordedWeightPct: number
 *     nextStep: string
 *     currentPrice: number | null
 *     priceAsOfDate?: string | null
 *     avgBuyPrice: number | null
 *     returnPct: number | null
 *     daysSinceBuy: number | null
 *   }
 * }} props
 */
export default function TradeRecordStatusBlock({ view }) {
  if (!view) return null
  return (
    <div className="yds-trade-status" aria-label="매수 기록 현황">
      <div className="yds-trade-status__row">
        <span>현재 신호</span>
        <strong className="font-mono tabular-nums">{view.signalLabel}</strong>
      </div>
      <div className="yds-trade-status__row">
        <span>현재 매수 단계</span>
        <strong>{view.stageLabel}</strong>
      </div>
      {view.userStageNote ? (
        <div className="yds-trade-status__row">
          <span>내 기록 상태</span>
          <strong>{view.userStageNote}</strong>
        </div>
      ) : null}
      <div className="yds-trade-status__row">
        <span>기록 비중</span>
        <strong className="font-mono tabular-nums">
          {Number(view.recordedWeightPct).toFixed(0)}%
        </strong>
      </div>
      <div className="yds-trade-status__row">
        <span>다음 단계</span>
        <strong>{view.nextStep}</strong>
      </div>
      <div className="yds-trade-status__row">
        <span>평균 매수가 (USD)</span>
        <strong className="font-mono tabular-nums">{formatUsdPrice(view.avgBuyPrice)}</strong>
      </div>
      <div className="yds-trade-status__row">
        <span>
          현재가 USD
          {view.priceAsOfDate ? ` · ${view.priceAsOfDate} 종가` : ""}
        </span>
        <strong className="font-mono tabular-nums">{formatUsdPrice(view.currentPrice)}</strong>
      </div>
      <div className="yds-trade-status__row">
        <span>현재 수익률</span>
        <strong className={`font-mono tabular-nums${pnlClass(view.returnPct)}`}>
          {formatReturnPct(view.returnPct)}
        </strong>
      </div>
      <div className="yds-trade-status__row">
        <span>매수 후 경과일</span>
        <strong className="font-mono tabular-nums">
          {view.daysSinceBuy != null ? `${view.daysSinceBuy}일` : "—"}
        </strong>
      </div>
    </div>
  )
}

/** @param {number | null} pct */
function pnlClass(pct) {
  if (pct == null || !Number.isFinite(pct)) return ""
  if (pct > 0) return " is-up"
  if (pct < 0) return " is-down"
  return ""
}
