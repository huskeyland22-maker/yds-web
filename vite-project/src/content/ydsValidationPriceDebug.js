/**
 * 성과검증 가격·수익률 디버그 로그
 */

import { isDevMode } from "../utils/devMode.js"

/** @typedef {{ key: string; days: number; label: string }} HorizonDef */

/**
 * @param {{
 *   symbol: string
 *   recommend_price: number | null
 *   price7d: number | null
 *   source: string
 *   horizons?: Array<{
 *     key: string
 *     label: string
 *     target_date: string
 *     price: number | null
 *     return_pct: number | null
 *     lookup_ok: boolean
 *     source?: string
 *   }>
 * }} audit
 */
export function logValidationPickPriceAudit(audit) {
  console.info(
    "[perf-validation]",
    JSON.stringify({
      symbol: audit.symbol,
      recommendPrice: audit.recommend_price,
      price7d: audit.price7d,
      source: audit.source,
    }),
  )

  if (audit.horizons?.length) {
    for (const h of audit.horizons) {
      console.info(
        `[perf-validation] ${h.label}`,
        JSON.stringify({
          symbol: audit.symbol,
          target_date: h.target_date,
          price: h.price,
          lookup_ok: h.lookup_ok,
          source: h.source ?? audit.source,
        }),
      )
    }
  }
}

/**
 * @param {string} symbol
 * @param {string} reason
 * @param {unknown} [detail]
 */
export function logValidationPriceLookupFailure(symbol, reason, detail) {
  console.warn(
    "[perf-validation] price lookup failed",
    JSON.stringify({ symbol, reason, detail: detail ?? null }),
  )
}

/**
 * @param {{
 *   ticker: string
 *   recommendPrice: number | null
 *   currentPrice: number | null
 *   profitPercent: number | null
 *   source?: string | null
 * }} payload
 */
export function logRecommendProfitServerTrace(payload) {
  if (!isDevMode()) return
  console.info(
    "[recommend-profit]",
    JSON.stringify({
      stage: "validation-refresh",
      ticker: payload.ticker,
      recommendPrice: payload.recommendPrice,
      currentPrice: payload.currentPrice,
      profitPercent: payload.profitPercent,
      source: payload.source ?? null,
    }),
  )
}
