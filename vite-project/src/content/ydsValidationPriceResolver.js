/**
 * 성과검증 — 실시간 시세 맵 (더미 snapshot 100 금지)
 */

import { readInitialStockPickSnapshots } from "./ydsStockPickSnapshotCache.js"
import { isValidationDummyPrice } from "./ydsValidationPriceSanitize.js"

/** @param {unknown} v */
function toNum(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @returns {number | null}
 */
export function priceFromStockPickView(stock) {
  const snap = stock?.snapshot
  const fromSnap = toNum(snap?.price ?? snap?.close)
  if (fromSnap != null) return fromSnap
  const fromQuote = toNum(stock?.quote?.price)
  return fromQuote
}

/**
 * @param {import("./ydsStockPickLiveFetcher.js").LivePickSnapshotEntry | undefined} entry
 * @returns {number | null}
 */
function priceFromSnapshotEntry(entry) {
  if (!entry) return null
  const eng = entry.engineSnapshot
  const fromEng = toNum(eng?.close ?? eng?.price)
  if (fromEng != null) return fromEng
  const ps = entry.apiBody?.priceSummary
  const fromApi = toNum(ps?.todayClose ?? ps?.headlinePrice ?? entry.apiBody?.price)
  if (fromApi != null) return fromApi
  return toNum(entry.quote?.price)
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView[]} [liveStocks]
 * @returns {Map<string, number>}
 */
export function buildValidationPriceMap(liveStocks = []) {
  /** @type {Map<string, number>} */
  const map = new Map()

  for (const stock of liveStocks ?? []) {
    const p = priceFromStockPickView(stock)
    if (p != null && !isValidationDummyPrice(p, null, stock.country === "KR" ? "KR" : "US")) {
      map.set(stock.ticker, p)
    }
  }

  const boot = readInitialStockPickSnapshots()
  for (const [ticker, entry] of boot.snapshots ?? []) {
    if (map.has(ticker)) continue
    const p = priceFromSnapshotEntry(entry)
    if (p != null) map.set(ticker, p)
  }

  return map
}

/**
 * @param {string} ticker
 * @param {'US' | 'KR'} country
 * @param {Map<string, number>} [priceMap]
 * @param {number | null | undefined} [recommendPrice]
 * @returns {{ price: number; source: string } | null}
 */
export function resolveValidationLivePrice(ticker, country, priceMap, recommendPrice = null) {
  const c = country === "KR" ? "KR" : "US"
  const fromMap = priceMap?.get(ticker)
  if (fromMap != null && fromMap > 0) {
    if (isValidationDummyPrice(fromMap, recommendPrice, c)) return null
    return { price: fromMap, source: "live-map" }
  }

  const boot = readInitialStockPickSnapshots()
  const entry = boot.snapshots?.get(ticker)
  const fromCache = priceFromSnapshotEntry(entry)
  if (fromCache != null) {
    if (isValidationDummyPrice(fromCache, recommendPrice, c)) return null
    return { price: fromCache, source: "snapshot-cache" }
  }

  return null
}
