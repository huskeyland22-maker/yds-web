/**
 * @param {{
 *   view: {
 *     signalLabel: string
 *     stageLabel: string
 *     userStageNote?: string
 *     recordedWeightPct: number
 *     nextStep: string
 *     currentPrice: number | null
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
        <strong className="font-mono tabular-nums">{fmt(view.recordedWeightPct)}%</strong>
      </div>
      <div className="yds-trade-status__row">
        <span>다음 단계</span>
        <strong>{view.nextStep}</strong>
      </div>
      <div className="yds-trade-status__row">
        <span>평균 매수가</span>
        <strong className="font-mono tabular-nums">
          {view.avgBuyPrice != null ? fmt(view.avgBuyPrice) : "—"}
        </strong>
      </div>
      <div className="yds-trade-status__row">
        <span>현재가</span>
        <strong className="font-mono tabular-nums">
          {view.currentPrice != null ? fmt(view.currentPrice) : "—"}
        </strong>
      </div>
      <div className="yds-trade-status__row">
        <span>현재 수익률</span>
        <strong className={`font-mono tabular-nums${pnlClass(view.returnPct)}`}>
          {view.returnPct != null ? `${view.returnPct >= 0 ? "+" : ""}${view.returnPct.toFixed(1)}%` : "—"}
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

/** @param {number} n */
function fmt(n) {
  if (!Number.isFinite(Number(n))) return "—"
  const x = Number(n)
  return Number.isInteger(x) ? String(x) : x.toFixed(2)
}

/** @param {number | null} pct */
function pnlClass(pct) {
  if (pct == null || !Number.isFinite(pct)) return ""
  if (pct > 0) return " is-up"
  if (pct < 0) return " is-down"
  return ""
}
