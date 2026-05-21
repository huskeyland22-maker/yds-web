import { BOND_FRED_SERIES_MAP } from "./bondFredPolicy.js"

const STORAGE_KEY = "yds-bond-fred-snapshot-v1"

/**
 * @typedef {Object} BondFredStoredSnapshot
 * @property {string} asOfNy
 * @property {string} savedAt
 * @property {Record<string, number[]>} historyByMacroKey
 * @property {Record<string, string>} sources
 */

/**
 * @param {{ series?: Record<string, { values?: number[]; asOfNy?: string|null }>; asOfNy?: string|null }|null|undefined} bondFred
 * @returns {BondFredStoredSnapshot|null}
 */
export function bondFredPayloadToSnapshot(bondFred) {
  if (!bondFred?.series || typeof bondFred.series !== "object") return null

  /** @type {Record<string, number[]>} */
  const historyByMacroKey = {}
  /** @type {Record<string, string>} */
  const sources = {}
  let asOfNy = bondFred.asOfNy ?? null

  for (const row of BOND_FRED_SERIES_MAP) {
    const block = bondFred.series[row.fredId]
    const values = Array.isArray(block?.values)
      ? block.values.map(Number).filter((n) => Number.isFinite(n))
      : []
    if (values.length < 2) continue
    historyByMacroKey[row.macroKey] = values
    sources[row.macroKey] = "fred-h15"
    if (!asOfNy && block?.asOfNy) asOfNy = block.asOfNy
  }

  if (!asOfNy || !Object.keys(historyByMacroKey).length) return null

  return {
    asOfNy,
    savedAt: new Date().toISOString(),
    historyByMacroKey,
    sources,
  }
}

/** @returns {BondFredStoredSnapshot|null} */
export function loadBondFredSnapshot() {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.asOfNy || !parsed?.historyByMacroKey) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * 확정 스냅샷 우선: 동일 NY asOf면 저장본 사용(백테스트·일관성)
 * @param {BondFredStoredSnapshot|null} stored
 * @param {BondFredStoredSnapshot|null} incoming
 */
export function mergeBondFredSnapshots(stored, incoming) {
  if (!incoming) return stored
  if (!stored) return incoming
  if (stored.asOfNy === incoming.asOfNy) return stored
  if (incoming.asOfNy > stored.asOfNy) return incoming
  return stored
}

/**
 * @param {BondFredStoredSnapshot|null} snap
 */
/** 수동 Sync 시 PWA/로컬 확정 스냅샷 무시 */
export function clearBondFredSnapshot() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function persistBondFredSnapshot(snap) {
  if (typeof window === "undefined" || !snap) return
  const prev = loadBondFredSnapshot()
  const merged = mergeBondFredSnapshots(prev, snap)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // ignore quota
  }
}

/**
 * @param {{ bondFred?: { series?: Record<string, { values?: number[] }>; asOfNy?: string|null } }|null} market
 * @returns {{ history: Record<string, number[]>; sources: Record<string, string>; asOfNy: string|null }}
 */
/**
 * @param {{ bondFred?: object }|null} market
 * @param {{ forceRefresh?: boolean }} [opts]
 */
export function resolveBondFredFromMarket(market, opts = {}) {
  const incoming = bondFredPayloadToSnapshot(market?.bondFred ?? null)
  if (opts.forceRefresh) {
    if (incoming) persistBondFredSnapshot(incoming)
    return {
      history: incoming?.historyByMacroKey ?? {},
      sources: incoming?.sources ?? {},
      asOfNy: incoming?.asOfNy ?? market?.bondFred?.asOfNy ?? null,
    }
  }
  const stored = loadBondFredSnapshot()
  const snap = mergeBondFredSnapshots(stored, incoming)
  if (snap) persistBondFredSnapshot(snap)
  return {
    history: snap?.historyByMacroKey ?? incoming?.historyByMacroKey ?? {},
    sources: snap?.sources ?? incoming?.sources ?? {},
    asOfNy: snap?.asOfNy ?? incoming?.asOfNy ?? market?.bondFred?.asOfNy ?? null,
  }
}
