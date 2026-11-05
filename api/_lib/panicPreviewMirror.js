/**
 * Preview-only READ mirror: Staging schema may lack panic tables.
 * Never writes to Production. Disabled when YDS_PANIC_MIRROR_ORIGIN=0/off.
 */

const DEFAULT_MIRROR_ORIGIN = "https://yds-web-kappa.vercel.app"

/** @returns {string | null} */
export function resolvePanicMirrorOrigin() {
  const raw = String(process.env.YDS_PANIC_MIRROR_ORIGIN ?? "").trim()
  if (raw === "0" || /^off$/i.test(raw) || /^false$/i.test(raw)) return null
  if (raw) return raw.replace(/\/+$/, "")
  // Auto-enable on Vercel Preview only.
  if (String(process.env.VERCEL_ENV || "").toLowerCase() === "preview") {
    return DEFAULT_MIRROR_ORIGIN
  }
  return null
}

/**
 * @param {string} pathAndQuery e.g. `/api/panic?mode=latest`
 * @returns {Promise<{ ok: boolean, status: number, json: any } | null>}
 */
export async function fetchPanicMirrorJson(pathAndQuery) {
  const origin = resolvePanicMirrorOrigin()
  if (!origin) return null
  const path = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`
  const url = `${origin}${path}`
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", "Cache-Control": "no-store" },
      signal: AbortSignal.timeout(12_000),
    })
    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      return { ok: false, status: res.status, json: null }
    }
    return { ok: res.ok, status: res.status, json }
  } catch (err) {
    console.warn("[panic-mirror] fetch failed", err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} json
 */
export function isUsablePanicLatestMirror(json) {
  if (!json || typeof json !== "object") return false
  if (json.emergency === true) return false
  const data = json.data
  if (!data || typeof data !== "object" || data.__emergency === true) return false
  const vix = Number(data.vix)
  const fg = Number(data.fearGreed)
  const pc = Number(data.putCall)
  return Number.isFinite(vix) || Number.isFinite(fg) || Number.isFinite(pc)
}

/**
 * @param {Record<string, unknown> | null | undefined} json
 */
export function isUsablePanicHistoryLatestMirror(json) {
  if (!json || typeof json !== "object") return false
  const row = json.row
  if (!row || typeof row !== "object") return false
  return Number.isFinite(Number(row.vix)) || Number.isFinite(Number(row.fearGreed))
}
