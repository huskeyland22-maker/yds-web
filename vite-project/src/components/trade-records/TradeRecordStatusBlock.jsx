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
const STATUS_ROWS = ["signal", "stage", "note", "weight", "next", "avg", "price", "return", "days"]
const LEAD_ROWS = ["signal", "stage", "note", "avg", "price", "return"]
const TAIL_ROWS = ["weight", "next", "days"]

/**
 * @param {{ view: object, part?: "all" | "lead" | "tail" }} props
 * `all` keeps the existing row order. `lead` / `tail` only regroup the same fields.
 */
export default function TradeRecordStatusBlock({ view, part = "all" }) {
  if (!view) return null
  const order = part === "lead" ? LEAD_ROWS : part === "tail" ? TAIL_ROWS : STATUS_ROWS
  const rows = order.map((key) => statusRow(view, key)).filter(Boolean)
  if (!rows.length) return null
  return (
    <div className={`yds-trade-status${part === "tail" ? " yds-trade-status--meta" : ""}`} aria-label="매수 기록 현황">
      {rows.map((row) => (
        <div key={row.key} className={`yds-trade-status__row${row.emphasis ? " yds-trade-status__row--emphasis" : ""}`}>
          <span>{row.label}</span>
          <strong className={row.strongClass}>{row.value}</strong>
        </div>
      ))}
    </div>
  )
}

/**
 * @param {object} view
 * @param {string} key
 */
function statusRow(view, key) {
  if (key === "signal") {
    return { key, label: "현재 신호", value: view.signalLabel, strongClass: "font-mono tabular-nums", emphasis: true }
  }
  if (key === "stage") {
    return { key, label: "현재 매수 단계", value: view.stageLabel, strongClass: "", emphasis: true }
  }
  if (key === "note") {
    if (!view.userStageNote) return null
    return { key, label: "내 기록 상태", value: view.userStageNote, strongClass: "", emphasis: false }
  }
  if (key === "weight") {
    return {
      key,
      label: "기록 비중",
      value: `${Number(view.recordedWeightPct).toFixed(0)}%`,
      strongClass: "font-mono tabular-nums",
      emphasis: false,
    }
  }
  if (key === "next") {
    return { key, label: "다음 단계", value: view.nextStep, strongClass: "", emphasis: false }
  }
  if (key === "avg") {
    return {
      key,
      label: "평균 매수가 (USD)",
      value: formatUsdPrice(view.avgBuyPrice),
      strongClass: "font-mono tabular-nums",
      emphasis: false,
    }
  }
  if (key === "price") {
    return {
      key,
      label: `현재가 USD${view.priceAsOfDate ? ` · ${view.priceAsOfDate} 종가` : ""}`,
      value: formatUsdPrice(view.currentPrice),
      strongClass: "font-mono tabular-nums",
      emphasis: false,
    }
  }
  if (key === "return") {
    return {
      key,
      label: "현재 수익률",
      value: formatReturnPct(view.returnPct),
      strongClass: `font-mono tabular-nums${pnlClass(view.returnPct)}`,
      emphasis: false,
    }
  }
  return {
    key,
    label: "매수 후 경과일",
    value: view.daysSinceBuy != null ? `${view.daysSinceBuy}일` : "—",
    strongClass: "font-mono tabular-nums",
    emphasis: false,
  }
}

/** @param {number | null} pct */
function pnlClass(pct) {
  if (pct == null || !Number.isFinite(pct)) return ""
  if (pct > 0) return " is-up"
  if (pct < 0) return " is-down"
  return ""
}
