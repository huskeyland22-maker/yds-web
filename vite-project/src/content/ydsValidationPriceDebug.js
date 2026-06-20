/**
 * 성과검증 가격·수익률 디버그 로그
 */

import { isDevMode } from "../utils/devMode.js"

/** @typedef {{ key: string; days: number; label: string }} HorizonDef */

/**
 * @param {{
 *   symbol: string
 *   recommend_price: number | null
 *   horizons: Array<{
 *     key: string
 *     label: string
 *     target_date: string
 *     price: number | null
 *     return_pct: number | null
 *     lookup_ok: boolean
 *   }>
 * }} audit
 */
export function logValidationPickPriceAudit(audit) {
  if (!isDevMode()) return

  console.group(`[perf-validation] ${audit.symbol}`)
  console.info(
    "[perf-validation] recommend_price",
    JSON.stringify({ symbol: audit.symbol, recommend_price: audit.recommend_price }),
  )

  for (const h of audit.horizons) {
    console.info(
      `[perf-validation] ${h.label} price lookup`,
      JSON.stringify({
        symbol: audit.symbol,
        target_date: h.target_date,
        price: h.price,
        lookup_ok: h.lookup_ok,
      }),
    )
  }

  const calc = {
    recommend_price: audit.recommend_price,
    price_7d: audit.horizons.find((x) => x.key === "d7")?.price ?? null,
    return_7d: audit.horizons.find((x) => x.key === "d7")?.return_pct ?? null,
    price_14d: audit.horizons.find((x) => x.key === "d14")?.price ?? null,
    return_14d: audit.horizons.find((x) => x.key === "d14")?.return_pct ?? null,
    price_30d: audit.horizons.find((x) => x.key === "d30")?.price ?? null,
    return_30d: audit.horizons.find((x) => x.key === "d30")?.return_pct ?? null,
  }
  console.info("[perf-validation] calculation", JSON.stringify(calc))
  console.groupEnd()
}

/**
 * @param {string} symbol
 * @param {string} reason
 * @param {unknown} [detail]
 */
export function logValidationPriceLookupFailure(symbol, reason, detail) {
  if (!isDevMode()) return
  console.warn(
    `[perf-validation] price lookup failed`,
    JSON.stringify({ symbol, reason, detail: detail ?? null }),
  )
}
