/**
 * 실전 매매존 position.id → /api/stock code
 * US: symbol 그대로, KR: 6자리 종목코드
 */

/** @type {Record<string, string>} */
export const TRADING_ZONE_KR_API_CODE = {
  "kr-silicon": "257720",
  "kr-hyosung": "298040",
  "kr-ls": "010120",
  "kr-spg": "058610",
}

/**
 * @param {import("./tacticalTradingZoneData.js").TradingZonePosition} position
 * @returns {string | null}
 */
export function resolvePositionApiCode(position) {
  if (!position) return null
  if (position.market === "us") {
    const sym = String(position.symbol ?? "").trim()
    return sym && /^[A-Za-z]/.test(sym) ? sym.toUpperCase() : null
  }
  return TRADING_ZONE_KR_API_CODE[position.id] ?? null
}
