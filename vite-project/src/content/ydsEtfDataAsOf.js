/**
 * Phase G — multi-source as-of helpers (presentation only).
 * Never invents dates; never collapses mismatched dates into one fake value.
 */

import { pickEtfDataAsOf } from "./ydsEtfInvestDecision.js"

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function cleanDate(value) {
  if (typeof value !== "string") return null
  const d = value.trim()
  return d || null
}

/**
 * @param {unknown} card
 * @returns {{
 *   price: string | null
 *   quality: string | null
 *   aum: string | null
 *   holdings: string | null
 *   expenseRatio: string | null
 *   dbb: string | null
 * }}
 */
export function extractEtfAsOfDates(card) {
  const c = card && typeof card === "object" ? /** @type {Record<string, unknown>} */ (card) : null
  const q = c?.quality && typeof c.quality === "object" ? /** @type {Record<string, unknown>} */ (c.quality) : null
  const sources = Array.isArray(q?.sources) ? q.sources : []

  /** @type {Record<string, string | null>} */
  const byField = {
    priceSeries: null,
    aum: null,
    holdings: null,
    expenseRatio: null,
    inception: null,
  }
  for (const raw of sources) {
    if (!raw || typeof raw !== "object") continue
    const s = /** @type {Record<string, unknown>} */ (raw)
    const field = typeof s.field === "string" ? s.field : ""
    const asOf = cleanDate(s.asOf)
    if (field && Object.prototype.hasOwnProperty.call(byField, field) && asOf) {
      byField[field] = asOf
    }
  }

  const price = cleanDate(c?.asOfDate) || byField.priceSeries || cleanDate(q?.asOfDate)
  const dbb = cleanDate(c?.asOfDate) || byField.priceSeries
  const quality = cleanDate(q?.asOfDate) || byField.expenseRatio || byField.holdings || byField.aum

  return {
    price: price || null,
    quality: quality || null,
    aum: byField.aum,
    holdings: byField.holdings,
    expenseRatio: byField.expenseRatio,
    dbb: dbb || null,
  }
}

/**
 * Unique non-null dates from a list.
 * @param {Array<string | null | undefined>} dates
 * @returns {string[]}
 */
export function uniqueAsOfDates(dates) {
  const set = new Set()
  for (const d of dates) {
    const clean = cleanDate(d)
    if (clean) set.add(clean)
  }
  return [...set].sort()
}

/**
 * @param {unknown[]} cards
 */
export function summarizeUniverseAsOf(cards) {
  const list = Array.isArray(cards) ? cards : []
  const priceDates = []
  const qualityDates = []
  const aumDates = []
  const holdingsDates = []
  const dbbDates = []

  for (const card of list) {
    const a = extractEtfAsOfDates(card)
    priceDates.push(a.price)
    qualityDates.push(a.quality)
    aumDates.push(a.aum)
    holdingsDates.push(a.holdings)
    dbbDates.push(a.dbb)
  }

  const price = uniqueAsOfDates(priceDates)
  const quality = uniqueAsOfDates(qualityDates)
  const aum = uniqueAsOfDates(aumDates)
  const holdings = uniqueAsOfDates(holdingsDates)
  const dbb = uniqueAsOfDates(dbbDates)

  const allPresent = uniqueAsOfDates([...price, ...quality, ...dbb])
  const mismatch = allPresent.length > 1

  return {
    priceDates: price,
    qualityDates: quality,
    aumDates: aum,
    holdingsDates: holdings,
    dbbDates: dbb,
    mismatch,
    missingPrice: price.length === 0,
    missingQuality: quality.length === 0,
    missingDbb: dbb.length === 0,
    /** Primary display strings (null if missing — never invent). */
    priceLabel: price.length === 0 ? null : price.length === 1 ? price[0] : `${price[0]}~${price[price.length - 1]}`,
    qualityLabel:
      quality.length === 0 ? null : quality.length === 1 ? quality[0] : `${quality[0]}~${quality[quality.length - 1]}`,
    dbbLabel: dbb.length === 0 ? null : dbb.length === 1 ? dbb[0] : `${dbb[0]}~${dbb[dbb.length - 1]}`,
  }
}

/**
 * Cards that are quality-pending specifically for missing official AUM (e.g. QQQM).
 * @param {unknown[]} cards
 */
export function listOfficialAumPendingCards(cards) {
  return (Array.isArray(cards) ? cards : []).filter((card) => {
    if (!card || typeof card !== "object") return false
    const c = /** @type {Record<string, unknown>} */ (card)
    const q = c.quality && typeof c.quality === "object" ? /** @type {Record<string, unknown>} */ (c.quality) : null
    const status = c.qualityStatus ?? q?.status
    if (status !== "pending") return false
    const reasons = Array.isArray(q?.pendingReasons)
      ? q.pendingReasons
      : Array.isArray(c.pendingReasons)
        ? c.pendingReasons
        : []
    return reasons.includes("missing_aum")
  })
}

export { pickEtfDataAsOf }
