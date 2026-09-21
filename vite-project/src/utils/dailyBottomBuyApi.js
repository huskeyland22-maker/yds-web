import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"

const API_PATH = "/api/daily-bottom-buy"
const SNAPSHOT_PATH = "/data/daily-bottom-buy-snapshot.json"

/**
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchDailyBottomBuySnapshot({ signal } = {}) {
  const apiUrl = withNoStoreQuery(API_PATH)
  try {
    const res = await fetch(apiUrl, { ...LIVE_JSON_GET_INIT, signal })
    if (res.ok) {
      const json = await res.json()
      if (json?.ok && Array.isArray(json.all)) {
        return { ...json, source: "api" }
      }
    }
  } catch {
    /* fall through to static snapshot */
  }

  const snapUrl = withNoStoreQuery(SNAPSHOT_PATH)
  const res2 = await fetch(snapUrl, { ...LIVE_JSON_GET_INIT, signal })
  if (!res2.ok) throw new Error(`daily-bottom-buy unavailable (HTTP ${res2.status})`)
  const json2 = await res2.json()
  return { ...json2, source: json2.source || "snapshot" }
}
