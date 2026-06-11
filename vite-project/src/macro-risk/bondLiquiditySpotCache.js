/**
 * 채권·유동성 마지막 정상 스팟 값 (localStorage)
 */

import { isValidUsTreasuryYield } from "./bondYieldValidity.js"

const STORAGE_KEY = "yds-bond-liquidity-spot-v1"

/** @typedef {"US10Y"|"US30Y"|"US2Y"|"DXY"|"REAL_YIELD"|"BEI"|"MOVE"} BondLiquiditySpotKey */

/**
 * @typedef {{
 *   spots: Partial<Record<BondLiquiditySpotKey, { value: number; savedAt: string }>>
 * }} BondLiquiditySpotCache
 */

/** @returns {BondLiquiditySpotCache} */
export function loadBondLiquiditySpotCache() {
  if (typeof window === "undefined") return { spots: {} }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { spots: {} }
    const parsed = JSON.parse(raw)
    if (!parsed?.spots || typeof parsed.spots !== "object") return { spots: {} }
    return { spots: parsed.spots }
  } catch {
    return { spots: {} }
  }
}

/**
 * @param {BondLiquiditySpotKey} key
 * @param {number} value
 */
function isValidSpot(key, value) {
  if (!Number.isFinite(value)) return false
  if (key === "US10Y" || key === "US30Y" || key === "US2Y") return isValidUsTreasuryYield(value)
  if (key === "MOVE") return value > 0 && value < 500
  if (key === "DXY") return value > 0 && value < 300
  return true
}

/**
 * @param {Partial<Record<BondLiquiditySpotKey, number | null | undefined>>} spots
 */
export function mergeBondLiquiditySpotCache(spots) {
  if (typeof window === "undefined") return
  const prev = loadBondLiquiditySpotCache()
  const next = { ...prev.spots }
  const savedAt = new Date().toISOString()

  for (const [key, raw] of Object.entries(spots)) {
    const value = Number(raw)
    if (!isValidSpot(/** @type {BondLiquiditySpotKey} */ (key), value)) continue
    next[key] = { value, savedAt }
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ spots: next }))
  } catch {
    // ignore quota
  }
}

/**
 * @param {import("./engine.js").MacroRiskSnapshot | null | undefined} snapshot
 * @param {number | null | undefined} panicMove
 */
export function persistBondLiquiditySpotCacheFromSnapshot(snapshot, panicMove = null) {
  if (!snapshot) return

  const rows = [
    ...(snapshot.tieredMetrics?.tier1 ?? []),
    ...(snapshot.tieredMetrics?.tier2 ?? []),
  ]

  /** @type {Partial<Record<BondLiquiditySpotKey, number | null>>} */
  const spots = {}

  for (const row of rows) {
    const key = row?.key
    if (!key) continue
    if (["US10Y", "US30Y", "US2Y", "DXY", "REAL_YIELD", "BEI"].includes(key)) {
      const n = Number(row.current)
      if (Number.isFinite(n)) spots[key] = n
    }
  }

  const move = Number(panicMove)
  if (Number.isFinite(move)) spots.MOVE = move

  mergeBondLiquiditySpotCache(spots)
}

/** @param {BondLiquiditySpotKey} key @returns {number | null} */
export function getBondLiquiditySpotCache(key) {
  const entry = loadBondLiquiditySpotCache().spots[key]
  const value = Number(entry?.value)
  return isValidSpot(key, value) ? value : null
}

/** @returns {boolean} */
export function hasBondLiquiditySpotCache() {
  return Object.keys(loadBondLiquiditySpotCache().spots).length > 0
}

/**
 * @param {Record<string, number[]>} history
 * @param {Record<string, string>} sources
 * @param {(current: number|null, change: number|null, points?: number) => number[]} synthesizeHistory
 */
export function applyBondLiquiditySpotCacheToHistory(history, sources, synthesizeHistory) {
  const cache = loadBondLiquiditySpotCache()

  for (const [key, entry] of Object.entries(cache.spots)) {
    const value = Number(entry?.value)
    if (!isValidSpot(/** @type {BondLiquiditySpotKey} */ (key), value)) continue
    if (key === "MOVE" || key === "REAL_YIELD" || key === "BEI") continue
    if (Array.isArray(history[key]) && history[key].length >= 2) continue
    history[key] = synthesizeHistory(value, 0)
    if (!sources[key]) sources[key] = "spot-cache"
  }

  return history
}
