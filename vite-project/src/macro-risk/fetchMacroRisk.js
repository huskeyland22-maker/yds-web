import { withNoStoreQuery, LIVE_JSON_GET_INIT } from "../config/liveDataFetch.js"
import { buildMacroRiskSnapshot } from "./engine.js"

/**
 * @returns {Promise<{ history: Record<string, number[]>; updatedAt?: string } | null>}
 */
async function fetchMacroRiskApi() {
  try {
    const res = await fetch(withNoStoreQuery("/api/macro-risk"), LIVE_JSON_GET_INIT)
    if (!res.ok) return null
    const data = await res.json()
    if (!data || typeof data !== "object") return null
    return data
  } catch {
    return null
  }
}

/**
 * @param {object | null} panicContext read-only
 */
export async function loadMacroRiskSnapshot(panicContext = null) {
  const api = await fetchMacroRiskApi()
  const history = api?.history && typeof api.history === "object" ? api.history : {}
  const snapshot = buildMacroRiskSnapshot(history, panicContext)
  if (api?.updatedAt) snapshot.updatedAt = api.updatedAt
  return snapshot
}
