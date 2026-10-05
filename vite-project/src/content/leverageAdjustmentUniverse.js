/**
 * 레버리지 조정매매 화면용 유니버스.
 * 매수·매도 기준은 포함하지 않는다.
 */
export const LEVERAGE_ADJUSTMENT_UNIVERSE = Object.freeze([
  Object.freeze({ symbol: "SOXL", leverage: 3, theme: "반도체" }),
  Object.freeze({ symbol: "TQQQ", leverage: 3, theme: "NASDAQ-100" }),
  Object.freeze({ symbol: "FNGU", leverage: 3, theme: "FANG+" }),
  Object.freeze({ symbol: "TSLL", leverage: 2, theme: "Tesla" }),
  Object.freeze({ symbol: "CURE", leverage: 3, theme: "Healthcare" }),
])

export function leverageAdjustmentSymbols(universe = LEVERAGE_ADJUSTMENT_UNIVERSE) {
  return universe.map((item) => item.symbol)
}
