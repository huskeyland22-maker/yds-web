import { getAdvancedSignal } from "./panicMarketSignal.js"

/**
 * STEP 17: `getAdvancedSignal` 기준 백테스트 — 최종 자산·거래·승률·MDD(피크 대비 낙폭 %).
 * @param {Array<Record<string, unknown>>} history
 * @returns {{
 *   finalValue: number;
 *   trades: number;
 *   winRate: number;
 *   mdd: number;
 * }}
 */
export function runAdvancedSignalBacktest(history) {
  const empty = {
    finalValue: 100,
    trades: 0,
    winRate: 0,
    mdd: 0,
  }

  if (!Array.isArray(history) || history.length === 0) {
    return empty
  }

  let cash = 100
  let position = 0
  let trades = 0
  let wins = 0
  let lastBuyPrice = 0
  let peak = 100
  let maxDrawdown = 0

  for (const day of history) {
    const signal = getAdvancedSignal(day)
    const price = Number(day.price)
    if (!Number.isFinite(price) || price <= 0) continue

    const currentValue = cash + position * price

    if (currentValue > peak) peak = currentValue
    const drawdown = peak > 0 ? (peak - currentValue) / peak : 0
    if (drawdown > maxDrawdown) maxDrawdown = drawdown

    if (signal.text.includes("매수") && cash > 0) {
      position = cash / price
      lastBuyPrice = price
      cash = 0
      trades++
    }

    if (signal.text.includes("매도") && position > 0) {
      if (price > lastBuyPrice) wins++
      cash = position * price
      position = 0
    }
  }

  const lastPrice = Number(history[history.length - 1]?.price)
  const finalValue =
    cash + (Number.isFinite(lastPrice) && lastPrice > 0 ? position * lastPrice : 0)

  return {
    finalValue,
    trades,
    winRate: trades ? (wins / trades) * 100 : 0,
    mdd: maxDrawdown * 100,
  }
}
