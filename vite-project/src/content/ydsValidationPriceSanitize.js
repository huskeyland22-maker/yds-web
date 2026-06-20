/**
 * 성과검증 — 더미 fallback 가격(100) 탐지·제거
 */

/** @typedef {'US' | 'KR'} ValidationCountry */

export const VALIDATION_DUMMY_PRICE = 100

/**
 * @param {number | null | undefined} price
 * @param {number | null | undefined} [recommendPrice]
 * @param {ValidationCountry} [country]
 */
export function isValidationDummyPrice(price, recommendPrice = null, country = "US") {
  if (price == null || !Number.isFinite(price)) return false
  if (price !== VALIDATION_DUMMY_PRICE) return false

  if (country === "KR") return true

  if (recommendPrice == null || recommendPrice <= 0) return true
  if (Math.abs(recommendPrice - VALIDATION_DUMMY_PRICE) <= 12) return false

  return true
}

/**
 * @param {Record<string, number>} priceLog
 * @param {number | null | undefined} recommendPrice
 * @param {ValidationCountry} country
 */
export function sanitizeValidationPriceLog(priceLog, recommendPrice, country) {
  /** @type {Record<string, number>} */
  const next = {}
  for (const [date, raw] of Object.entries(priceLog ?? {})) {
    const p = Number(raw)
    if (!Number.isFinite(p) || p <= 0) continue
    if (isValidationDummyPrice(p, recommendPrice, country)) continue
    next[date] = p
  }
  return next
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} record
 */
export function sanitizeValidationPickRecord(record) {
  const recommendPrice =
    record.recommendedPrice != null && record.recommendedPrice > 0
      ? record.recommendedPrice
      : null
  const country = record.country === "KR" ? "KR" : "US"

  const priceLog = sanitizeValidationPriceLog(record.priceLog, recommendPrice, country)

  /** @type {import("./ydsValidationStorage.js").ValidationHorizonPrices} */
  const horizonPrices = { ...record.horizonPrices }
  /** @type {import("./ydsValidationStorage.js").ValidationHorizonReturns} */
  const horizons = { ...record.horizons }

  for (const key of Object.keys(horizonPrices)) {
    const p = horizonPrices[key]
    if (p != null && isValidationDummyPrice(p, recommendPrice, country)) {
      horizonPrices[key] = null
      horizons[key] = null
    }
  }

  let recommendedPrice = record.recommendedPrice
  if (
    recommendedPrice != null &&
    isValidationDummyPrice(recommendedPrice, null, country) &&
    country === "KR"
  ) {
    recommendedPrice = null
  }

  return {
    ...record,
    recommendedPrice,
    priceLog,
    horizonPrices,
    horizons,
  }
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord[]} picks
 */
export function sanitizeValidationPicks(picks) {
  return (picks ?? []).map(sanitizeValidationPickRecord)
}
