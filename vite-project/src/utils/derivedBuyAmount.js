/**
 * Buy amount shown on the equity record form.
 * Stored records still use buyAmountUsd. This only derives that number.
 * @param {string | number | null | undefined} priceRaw
 * @param {string | number | null | undefined} sharesRaw
 * @returns {string} cents text, or "" when price or shares are missing or not positive
 */
export function derivedBuyAmountUsdText(priceRaw, sharesRaw) {
  if (priceRaw == null || sharesRaw == null) return ""
  if (String(priceRaw).trim() === "" || String(sharesRaw).trim() === "") return ""
  const price = Number(priceRaw)
  const shares = Number(sharesRaw)
  if (!Number.isFinite(price) || price <= 0) return ""
  if (!Number.isFinite(shares) || shares <= 0) return ""
  return (Math.round((price * shares + Number.EPSILON) * 100) / 100).toFixed(2)
}

/**
 * Share count for the edit form. Prefers stored shares.
 * If an older row has only price and amount, recovers quantity for display.
 * Does not write storage.
 * @param {{ shares?: number | null, buyPrice?: number | null, buyAmountUsd?: number | null } | null | undefined} record
 * @returns {number | null}
 */
export function restoredShareCount(record) {
  const direct = Number(record?.shares)
  if (Number.isFinite(direct) && direct > 0) return direct
  const price = Number(record?.buyPrice)
  const amount = Number(record?.buyAmountUsd)
  if (!Number.isFinite(price) || price <= 0) return null
  if (!Number.isFinite(amount) || amount <= 0) return null
  const computed = amount / price
  if (!Number.isFinite(computed) || computed <= 0) return null
  if (Math.abs(computed - Math.round(computed)) < 1e-6) return Math.round(computed)
  return Math.round(computed * 1e6) / 1e6
}
