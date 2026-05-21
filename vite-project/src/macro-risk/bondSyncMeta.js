const SYNC_META_KEY = "yds-bond-sync-meta-v1"

/**
 * @typedef {{ at: string; asOfNy?: string|null }} BondSyncMeta
 */

/** @returns {BondSyncMeta|null} */
export function loadBondSyncMeta() {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(SYNC_META_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.at) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * @param {{ asOfNy?: string|null }} [extra]
 */
export function recordBondSyncMeta(extra = {}) {
  if (typeof window === "undefined") return
  /** @type {BondSyncMeta} */
  const meta = { at: new Date().toISOString(), asOfNy: extra.asOfNy ?? null }
  try {
    window.localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta))
  } catch {
    // ignore
  }
}

/** @param {string|null|undefined} iso */
export function formatBondLastSyncKst(iso) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d)
  const y = parts.find((p) => p.type === "year")?.value ?? ""
  const mo = parts.find((p) => p.type === "month")?.value ?? ""
  const da = parts.find((p) => p.type === "day")?.value ?? ""
  const h = parts.find((p) => p.type === "hour")?.value ?? ""
  const mi = parts.find((p) => p.type === "minute")?.value ?? ""
  return `${y}-${mo}-${da} ${h}:${mi}`
}

export const BOND_SYNC_METRICS_LABEL = "10년물 · 30년물 · 2년물 · 실질금리 · 기대인플레 · 달러지수"

export const BOND_SYNC_REQUEST_EVENT = "yds-bond-sync-request"

/** 수동 Bond Sync — MarketOsPhase2Shell 등 동시 갱신 */
export function dispatchBondSyncRequest() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(BOND_SYNC_REQUEST_EVENT))
}
