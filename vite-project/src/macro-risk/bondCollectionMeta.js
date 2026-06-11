import { isValidUsTreasuryYield } from "./bondYieldValidity.js"
import { MACRO_RISK_SEED_HISTORY } from "./staticSeed.js"
import { loadBondFredSnapshot } from "./bondFredSnapshotStore.js"

/** @typedef {"live" | "cache" | "seed" | "missing"} BondMetricSourceKind */

/**
 * @typedef {{
 *   liveBondOk: boolean
 *   usedStaleFallback: boolean
 *   errors: string[]
 *   asOfNy: string | null
 *   lastKnown: { US10Y: number | null; US30Y: number | null }
 *   sourceByKey: Record<string, BondMetricSourceKind>
 * }} BondCollectionMeta
 */

/**
 * @param {Record<string, number[]>} history
 * @param {Record<string, string>} sources
 */
export function readBondLastKnown(history, sources = {}) {
  /** @type {{ US10Y: number | null; US30Y: number | null }} */
  const lastKnown = { US10Y: null, US30Y: null }
  for (const key of /** @type {const} */ (["US10Y", "US30Y"])) {
    const arr = history[key]
    const last = Array.isArray(arr) ? arr[arr.length - 1] : null
    if (isValidUsTreasuryYield(last)) {
      lastKnown[key] = Number(last)
      continue
    }
    const stored = loadBondFredSnapshot()?.historyByMacroKey?.[key]
    const storedLast = Array.isArray(stored) ? stored[stored.length - 1] : null
    if (isValidUsTreasuryYield(storedLast)) {
      lastKnown[key] = Number(storedLast)
      continue
    }
    const seed = MACRO_RISK_SEED_HISTORY[key]
    const seedLast = Array.isArray(seed) ? seed[seed.length - 1] : null
    if (isValidUsTreasuryYield(seedLast)) lastKnown[key] = Number(seedLast)
  }

  const usedStaleFallback = ["US10Y", "US30Y"].some((key) => {
    const src = sources[key] ?? ""
    return src.includes("stale") || src.includes("staticSeed")
  })

  /** @type {Record<string, BondMetricSourceKind>} */
  const sourceByKey = {}
  for (const key of ["US10Y", "US30Y"]) {
    const src = sources[key] ?? ""
    if (src === "fred-h15") sourceByKey[key] = "live"
    else if (src === "spot-cache" || src.includes("fred-h15-stale") || src.includes("cache"))
      sourceByKey[key] = "cache"
    else if (src.includes("staticSeed")) sourceByKey[key] = "seed"
    else if (lastKnown[key] != null) sourceByKey[key] = "seed"
    else sourceByKey[key] = "missing"
  }

  return { lastKnown, usedStaleFallback, sourceByKey }
}

/**
 * @param {Record<string, number[]>} history
 * @param {Record<string, string>} sources
 * @param {{ errors?: Record<string, string>; liveCount?: number; bondAsOfNy?: string | null }} [fetchMeta]
 * @returns {BondCollectionMeta}
 */
export function buildBondCollectionMeta(history, sources, fetchMeta = {}) {
  const { lastKnown, usedStaleFallback, sourceByKey } = readBondLastKnown(history, sources)
  const liveBondOk =
    sources.US10Y === "fred-h15" &&
    sources.US30Y === "fred-h15" &&
    isValidUsTreasuryYield(history.US10Y?.[history.US10Y.length - 1]) &&
    isValidUsTreasuryYield(history.US30Y?.[history.US30Y.length - 1])

  /** @type {string[]} */
  const errors = []
  for (const [series, msg] of Object.entries(fetchMeta.errors ?? {})) {
    errors.push(`${series}: ${msg}`)
  }

  return {
    liveBondOk,
    usedStaleFallback: usedStaleFallback || (!liveBondOk && (lastKnown.US10Y != null || lastKnown.US30Y != null)),
    errors,
    asOfNy: fetchMeta.bondAsOfNy ?? null,
    lastKnown,
    sourceByKey,
  }
}

/**
 * @param {Record<string, number[]>} history
 * @param {Record<string, string>} sources
 */
export function applyBondStaleFallback(history, sources) {
  const stored = loadBondFredSnapshot()

  for (const key of ["US10Y", "US30Y", "US2Y"]) {
    if (Array.isArray(history[key]) && history[key].length >= 2) continue

    const fromStore = stored?.historyByMacroKey?.[key]
    if (Array.isArray(fromStore) && fromStore.length >= 2) {
      history[key] = fromStore.slice(-22)
      sources[key] = "fred-h15-stale"
      continue
    }

    const seed = MACRO_RISK_SEED_HISTORY[key]
    if (Array.isArray(seed) && seed.length >= 2) {
      history[key] = seed.slice(-22)
      sources[key] = "staticSeed-stale"
    }
  }

  return history
}
